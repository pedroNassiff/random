"""Adaptador PostgreSQL de cuentas.

Los usuarios y las sesiones nacieron con Fútbol Vaquero y siguen en el schema `futbol`
(`app_users`, `auth_sessions`): se comparten tal cual para no migrar sesiones vivas.
"""

from __future__ import annotations

from datetime import datetime
from typing import cast

import asyncpg

from accounts.application.ports import Identity


class PgAccountRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def password_hash_for(self, email: str) -> tuple[str, str | None] | None:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow("SELECT id, password_hash FROM futbol.app_users WHERE email = $1", email),
        )
        return None if row is None else (str(row["id"]), row["password_hash"])

    async def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        await self._pool.execute(
            "INSERT INTO futbol.auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, $3)",
            token_hash,
            user_id,
            expires_at,
        )

    async def identity_for_session(self, token_hash: str, now: datetime) -> Identity | None:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "SELECT u.id, u.email, u.password_hash IS NOT NULL AS has_password "
                "FROM futbol.auth_sessions s JOIN futbol.app_users u ON u.id = s.user_id "
                "WHERE s.token_hash = $1 AND s.expires_at > $2",
                token_hash,
                now,
            ),
        )
        return None if row is None else Identity(str(row["id"]), row["email"], row["has_password"])

    async def delete_session(self, token_hash: str) -> None:
        await self._pool.execute("DELETE FROM futbol.auth_sessions WHERE token_hash = $1", token_hash)
