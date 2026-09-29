"""Repositorio PostgreSQL de resultados e historial (schema `futbol`)."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, cast

import asyncpg

from futbol.domain.balancer import Partition
from futbol.domain.models import Match, MatchStatus
from futbol.domain.results import MatchResult, PlayedMatch


def _ids(values: list[Any] | None) -> tuple[str, ...]:
    return tuple(sorted(str(v) for v in values or []))


class PgResultsRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def get_result(self, match_id: str) -> MatchResult | None:
        r = await self._pool.fetchrow(
            "SELECT goals_a, goals_b, notes FROM futbol.match_results WHERE match_id = $1::uuid", match_id
        )
        return None if r is None else MatchResult(r["goals_a"], r["goals_b"], r["notes"])

    async def save_result(
        self,
        match_id: str,
        result: MatchResult,
        lineup: Partition,
        recorded_by: str,
        player_goals: Mapping[str, int],
    ) -> None:
        rows = [(p, "A") for p in lineup.team_a] + [(p, "B") for p in lineup.team_b]
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM futbol.match_teams WHERE match_id = $1::uuid", match_id)
            await conn.executemany(
                "INSERT INTO futbol.match_teams (match_id, player_id, team, goals) VALUES ($1::uuid, $2::uuid, $3, $4)",
                [(match_id, p, team, player_goals.get(p)) for p, team in rows],
            )
            await conn.execute(
                "INSERT INTO futbol.match_results (match_id, goals_a, goals_b, notes, recorded_by) "
                "VALUES ($1::uuid, $2, $3, $4, $5::uuid) ON CONFLICT (match_id) DO UPDATE SET "
                "goals_a = EXCLUDED.goals_a, goals_b = EXCLUDED.goals_b, notes = EXCLUDED.notes, "
                "recorded_by = EXCLUDED.recorded_by, recorded_at = now()",
                match_id,
                result.goals_a,
                result.goals_b,
                result.notes,
                recorded_by,
            )
            await conn.execute("UPDATE futbol.matches SET status = 'played' WHERE id = $1::uuid", match_id)

    async def player_goals(self, match_id: str) -> dict[str, int]:
        rows = await self._pool.fetch(
            "SELECT player_id, goals FROM futbol.match_teams WHERE match_id = $1::uuid AND goals IS NOT NULL",
            match_id,
        )
        return {str(r["player_id"]): r["goals"] for r in rows}

    async def goal_rates(self, group_id: str, window: int) -> dict[str, float]:
        rows = await self._pool.fetch(
            "SELECT player_id, avg(goals)::float AS rate FROM ("
            "  SELECT t.player_id, t.goals, "
            "         row_number() OVER (PARTITION BY t.player_id ORDER BY m.starts_at DESC) AS rn "
            "  FROM futbol.match_teams t JOIN futbol.matches m ON m.id = t.match_id "
            "  WHERE m.group_id = $1::uuid AND m.status = 'played' AND t.goals IS NOT NULL"
            ") recent WHERE rn <= $2 GROUP BY player_id",
            group_id,
            window,
        )
        return {str(r["player_id"]): float(r["rate"]) for r in rows}

    async def history(self, group_id: str, limit: int) -> list[PlayedMatch]:
        rows = await self._pool.fetch(
            "SELECT m.id, m.starts_at, m.signup_closes_at, m.status, r.goals_a, r.goals_b, r.notes, "
            "array_agg(t.player_id) FILTER (WHERE t.team = 'A') AS a, "
            "array_agg(t.player_id) FILTER (WHERE t.team = 'B') AS b, "
            "json_object_agg(t.player_id, t.goals) FILTER (WHERE t.goals IS NOT NULL) AS goals "
            "FROM futbol.matches m JOIN futbol.match_results r ON r.match_id = m.id "
            "LEFT JOIN futbol.match_teams t ON t.match_id = m.id "
            "WHERE m.group_id = $1::uuid AND m.status = 'played' "
            "GROUP BY m.id, r.match_id ORDER BY m.starts_at DESC LIMIT $2",
            group_id,
            limit,
        )
        return [
            PlayedMatch(
                Match(str(r["id"]), r["starts_at"], r["signup_closes_at"], cast(MatchStatus, r["status"])),
                MatchResult(r["goals_a"], r["goals_b"], r["notes"]),
                Partition(_ids(r["a"]), _ids(r["b"])),
                {str(k): int(v) for k, v in json.loads(r["goals"] or "{}").items()},
            )
            for r in rows
        ]
