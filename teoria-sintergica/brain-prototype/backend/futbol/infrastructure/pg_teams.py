"""Repositorio PostgreSQL de propuestas, equipos publicados y restricciones (schema `futbol`)."""

from __future__ import annotations

import json
from typing import Any, cast

import asyncpg

from futbol.application.ports import StoredConstraint
from futbol.domain.balancer import ConstraintKind, Evaluation, Partition


def _ids(values: list[Any]) -> tuple[str, ...]:
    return tuple(sorted(str(v) for v in values))


def _evaluation(r: asyncpg.Record) -> Evaluation:
    data = json.loads(r["breakdown"]) if isinstance(r["breakdown"], str) else r["breakdown"]
    return Evaluation(
        partition=Partition(_ids(r["team_a"]), _ids(r["team_b"])),
        cost=float(r["cost"]),
        breakdown={k: float(v) for k, v in data["terms"].items()},
        strength_a=float(data["strength_a"]),
        strength_b=float(data["strength_b"]),
        win_prob_a=float(r["win_prob_a"]),
    )


def _constraint(r: asyncpg.Record) -> StoredConstraint:
    return StoredConstraint(str(r["id"]), str(r["player_a"]), str(r["player_b"]), cast(ConstraintKind, r["kind"]))


class PgTeamsRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def balancer_overrides(self, group_id: str) -> dict[str, object] | None:
        raw = await self._pool.fetchval("SELECT balancer_config FROM futbol.groups WHERE id = $1::uuid", group_id)
        return cast("dict[str, object] | None", json.loads(raw) if isinstance(raw, str) else raw)

    async def save_proposals(self, match_id: str, proposals: list[Evaluation]) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM futbol.team_proposals WHERE match_id = $1::uuid", match_id)
            await conn.executemany(
                "INSERT INTO futbol.team_proposals (match_id, rank, team_a, team_b, cost, win_prob_a, breakdown) "
                "VALUES ($1::uuid, $2, $3::uuid[], $4::uuid[], $5, $6, $7::jsonb)",
                [
                    (
                        match_id,
                        rank,
                        list(e.partition.team_a),
                        list(e.partition.team_b),
                        e.cost,
                        e.win_prob_a,
                        json.dumps({"terms": e.breakdown, "strength_a": e.strength_a, "strength_b": e.strength_b}),
                    )
                    for rank, e in enumerate(proposals, start=1)
                ],
            )

    async def list_proposals(self, match_id: str) -> list[Evaluation]:
        rows = await self._pool.fetch(
            "SELECT team_a, team_b, cost, win_prob_a, breakdown FROM futbol.team_proposals "
            "WHERE match_id = $1::uuid ORDER BY rank",
            match_id,
        )
        return [_evaluation(r) for r in rows]

    async def delete_proposals(self, match_id: str) -> None:
        await self._pool.execute("DELETE FROM futbol.team_proposals WHERE match_id = $1::uuid", match_id)

    async def publish(self, match_id: str, partition: Partition) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM futbol.match_teams WHERE match_id = $1::uuid", match_id)
            await conn.executemany(
                "INSERT INTO futbol.match_teams (match_id, player_id, team) VALUES ($1::uuid, $2::uuid, $3)",
                [(match_id, pid, "A") for pid in partition.team_a] + [(match_id, pid, "B") for pid in partition.team_b],
            )
            await conn.execute(
                "UPDATE futbol.matches SET status = 'teams_published' "
                "WHERE id = $1::uuid AND status IN ('open', 'closed', 'teams_published')",
                match_id,
            )

    async def published(self, match_id: str) -> Partition | None:
        rows = await self._pool.fetch(
            "SELECT player_id, team FROM futbol.match_teams WHERE match_id = $1::uuid", match_id
        )
        if not rows:
            return None
        return Partition(
            _ids([r["player_id"] for r in rows if r["team"] == "A"]),
            _ids([r["player_id"] for r in rows if r["team"] == "B"]),
        )

    async def recent_partitions(self, group_id: str, before_match_id: str, limit: int) -> list[Partition]:
        """Equipos de los últimos partidos anteriores (para penalizar repetir, W_REP)."""
        rows = await self._pool.fetch(
            "SELECT m.id, array_agg(mt.player_id) FILTER (WHERE mt.team = 'A') AS a, "
            "array_agg(mt.player_id) FILTER (WHERE mt.team = 'B') AS b "
            "FROM futbol.matches m JOIN futbol.match_teams mt ON mt.match_id = m.id "
            "WHERE m.group_id = $1::uuid AND m.id <> $2::uuid "
            "AND m.starts_at < (SELECT starts_at FROM futbol.matches WHERE id = $2::uuid) "
            "GROUP BY m.id, m.starts_at ORDER BY m.starts_at DESC LIMIT $3",
            group_id,
            before_match_id,
            limit,
        )
        return [Partition(_ids(r["a"] or []), _ids(r["b"] or [])) for r in rows]

    async def pending_matches(self, group_id: str) -> list[str]:
        rows = await self._pool.fetch(
            "SELECT m.id FROM futbol.matches m WHERE m.group_id = $1::uuid AND m.status = 'closed' "
            "AND NOT EXISTS (SELECT 1 FROM futbol.team_proposals p WHERE p.match_id = m.id) "
            "AND NOT EXISTS (SELECT 1 FROM futbol.match_teams t WHERE t.match_id = m.id) ORDER BY m.starts_at",
            group_id,
        )
        return [str(r["id"]) for r in rows]

    async def list_constraints(self, group_id: str) -> list[StoredConstraint]:
        rows = await self._pool.fetch(
            "SELECT id, player_a, player_b, kind FROM futbol.player_constraints WHERE group_id = $1::uuid ORDER BY id",
            group_id,
        )
        return [_constraint(r) for r in rows]

    async def add_constraint(self, group_id: str, a: str, b: str, kind: ConstraintKind) -> StoredConstraint:
        r = await self._pool.fetchrow(
            "INSERT INTO futbol.player_constraints (group_id, player_a, player_b, kind) "
            "VALUES ($1::uuid, $2::uuid, $3::uuid, $4) RETURNING id, player_a, player_b, kind",
            group_id,
            a,
            b,
            kind,
        )
        assert r is not None
        return _constraint(r)

    async def delete_constraint(self, group_id: str, constraint_id: str) -> bool:
        status = await self._pool.execute(
            "DELETE FROM futbol.player_constraints WHERE group_id = $1::uuid AND id = $2::uuid", group_id, constraint_id
        )
        return bool(status.endswith(" 1"))
