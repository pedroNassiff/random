"""Repositorio PostgreSQL de partidos e inscripciones (schema `futbol`)."""

from __future__ import annotations

from datetime import datetime
from typing import cast

import asyncpg

from futbol.application.ports import SignupMutation
from futbol.domain.models import Match, MatchStatus, Signup, SignupStatus
from futbol.domain.schedule import MatchWindow, ScheduleConfig

_MATCH_COLS = "id, starts_at, signup_closes_at, status"
_ACTIVE = "('open', 'closed', 'teams_published')"


def _match(r: asyncpg.Record) -> Match:
    return Match(str(r["id"]), r["starts_at"], r["signup_closes_at"], cast(MatchStatus, r["status"]))


def _signup(r: asyncpg.Record) -> Signup:
    return Signup(str(r["player_id"]), cast(SignupStatus, r["status"]), r["created_at"], r["late_withdrawal"])


class PgMatchRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_group_ids(self) -> list[str]:
        return [str(r["id"]) for r in await self._pool.fetch("SELECT id FROM futbol.groups ORDER BY created_at")]

    async def get_schedule(self, group_id: str) -> ScheduleConfig:
        r = await self._pool.fetchrow(
            "SELECT timezone, match_weekday, match_time, signup_close_weekday, signup_close_time, "
            "signup_open_weekday, signup_open_time, capacity "
            "FROM futbol.groups WHERE id = $1::uuid",
            group_id,
        )
        assert r is not None, "grupo inexistente"
        return ScheduleConfig(
            timezone=r["timezone"],
            match_weekday=r["match_weekday"],
            match_time=r["match_time"],
            signup_close_weekday=r["signup_close_weekday"],
            signup_close_time=r["signup_close_time"],
            signup_open_weekday=r["signup_open_weekday"],
            signup_open_time=r["signup_open_time"],
            capacity=r["capacity"],
        )

    async def recent_matches(self, group_id: str, since: datetime) -> list[Match]:
        rows = await self._pool.fetch(
            f"SELECT {_MATCH_COLS} FROM futbol.matches WHERE group_id = $1::uuid AND starts_at >= $2 "
            "ORDER BY starts_at",
            group_id,
            since,
        )
        return [_match(r) for r in rows]

    async def create_match(self, group_id: str, window: MatchWindow) -> None:
        await self._pool.execute(
            "INSERT INTO futbol.matches (group_id, starts_at, signup_closes_at) VALUES ($1::uuid, $2, $3) "
            "ON CONFLICT (group_id, starts_at) DO NOTHING",
            group_id,
            window.starts_at,
            window.signup_closes_at,
        )

    async def close_matches(self, match_ids: tuple[str, ...]) -> None:
        await self._pool.execute(
            "UPDATE futbol.matches SET status = 'closed' WHERE id = ANY($1::uuid[]) AND status = 'open'",
            list(match_ids),
        )

    async def current_match(self, group_id: str) -> Match | None:
        """El más antiguo todavía sin resultado: el de esta semana, o uno pasado esperando resultado (M4)."""
        r = await self._pool.fetchrow(
            f"SELECT {_MATCH_COLS} FROM futbol.matches WHERE group_id = $1::uuid AND status IN {_ACTIVE} "
            "ORDER BY starts_at LIMIT 1",
            group_id,
        )
        return None if r is None else _match(r)

    async def get_match(self, group_id: str, match_id: str) -> Match | None:
        r = await self._pool.fetchrow(
            f"SELECT {_MATCH_COLS} FROM futbol.matches WHERE group_id = $1::uuid AND id = $2::uuid",
            group_id,
            match_id,
        )
        return None if r is None else _match(r)

    async def list_signups(self, match_id: str) -> list[Signup]:
        rows = await self._pool.fetch(
            "SELECT player_id, status, created_at, late_withdrawal FROM futbol.signups WHERE match_id = $1::uuid",
            match_id,
        )
        return [_signup(r) for r in rows]

    async def mutate_signups(self, match_id: str, mutation: SignupMutation) -> list[Signup]:
        async with self._pool.acquire() as conn, conn.transaction():
            m = await conn.fetchrow(
                f"SELECT {_MATCH_COLS} FROM futbol.matches WHERE id = $1::uuid FOR UPDATE", match_id
            )
            assert m is not None, "partido inexistente"
            rows = await conn.fetch(
                "SELECT player_id, status, created_at, late_withdrawal FROM futbol.signups WHERE match_id = $1::uuid",
                match_id,
            )
            before = {s.player_id: s for s in (_signup(r) for r in rows)}
            after = mutation(_match(m), list(before.values()))
            changed = [s for s in after if before.get(s.player_id) != s]
            await conn.executemany(
                "INSERT INTO futbol.signups (match_id, player_id, status, late_withdrawal, created_at) "
                "VALUES ($1::uuid, $2::uuid, $3, $4, $5) ON CONFLICT (match_id, player_id) DO UPDATE SET "
                "status = EXCLUDED.status, late_withdrawal = EXCLUDED.late_withdrawal, "
                "created_at = EXCLUDED.created_at, updated_at = now()",
                [(match_id, s.player_id, s.status, s.late_withdrawal, s.created_at) for s in changed],
            )
            return after
