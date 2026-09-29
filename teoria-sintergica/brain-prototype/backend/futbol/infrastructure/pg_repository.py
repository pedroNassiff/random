"""Repositorio PostgreSQL (schema `futbol`). Único módulo que toca la BBDD."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

import asyncpg

from futbol.application.ports import Actor
from futbol.domain.models import Player, Position, Role, SkillInfo
from futbol.domain.skills import SkillRating

_PLAYER_COLS = "id, display_name, nickname, email, preferred_position, can_play_gk, is_guest, guest_level, active"
_SKILL_COLS = "id, key, name, description, weight, is_active, sort_order"


def _player(r: asyncpg.Record) -> Player:
    return Player(
        id=str(r["id"]),
        display_name=r["display_name"],
        nickname=r["nickname"],
        email=r["email"],
        preferred_position=cast("Position | None", r["preferred_position"]),
        can_play_gk=r["can_play_gk"],
        is_guest=r["is_guest"],
        guest_level=r["guest_level"],
        active=r["active"],
    )


def _skill(r: asyncpg.Record) -> SkillInfo:
    return SkillInfo(
        id=str(r["id"]),
        key=r["key"],
        name=r["name"],
        description=r["description"],
        weight=float(r["weight"]),
        is_active=r["is_active"],
        sort_order=r["sort_order"],
    )


def _actor(r: asyncpg.Record) -> Actor:
    return Actor(
        user_id=str(r["user_id"]),
        group_id=str(r["group_id"]),
        role=cast("Role", r["role"]),
        email=r["email"],
        player_id=str(r["player_id"]) if r["player_id"] else None,
        has_password=r["has_password"],
    )


_ACTOR_SELECT = """
    SELECT gm.user_id, gm.group_id, gm.role, u.email, p.id AS player_id,
           u.password_hash IS NOT NULL AS has_password
    FROM futbol.group_members gm
    JOIN futbol.app_users u ON u.id = gm.user_id
    LEFT JOIN futbol.players p ON p.group_id = gm.group_id AND p.user_id = gm.user_id
"""


class PgFutbolRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def _fetchrow(self, sql: str, *args: Any) -> asyncpg.Record | None:
        return cast("asyncpg.Record | None", await self._pool.fetchrow(sql, *args))

    # ── auth ────────────────────────────────────────────────────────────────
    async def email_known(self, email: str) -> bool:
        row = await self._fetchrow(
            "SELECT 1 FROM futbol.players WHERE email = $1 UNION ALL SELECT 1 FROM futbol.app_users WHERE email = $1",
            email,
        )
        return row is not None

    async def save_magic_link(self, token_hash: str, email: str, expires_at: datetime) -> None:
        await self._pool.execute(
            "INSERT INTO futbol.magic_links (token_hash, email, expires_at) VALUES ($1, $2, $3)",
            token_hash,
            email,
            expires_at,
        )

    async def consume_magic_link(self, token_hash: str, now: datetime) -> str | None:
        row = await self._fetchrow(
            "UPDATE futbol.magic_links SET used_at = $2 "
            "WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING email",
            token_hash,
            now,
        )
        return None if row is None else cast(str, row["email"])

    async def get_or_create_user(self, email: str) -> str:
        row = await self._fetchrow(
            "INSERT INTO futbol.app_users (email) VALUES ($1) "
            "ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
            email,
        )
        assert row is not None
        return str(row["id"])

    async def default_group_id(self) -> str:
        row = await self._fetchrow("SELECT id FROM futbol.groups ORDER BY created_at LIMIT 1")
        assert row is not None, "falta el seed del grupo (futbol/migrations/001)"
        return str(row["id"])

    async def ensure_membership(self, group_id: str, user_id: str, role: Role, promote: bool) -> None:
        await self._pool.execute(
            "INSERT INTO futbol.group_members (group_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3) "
            "ON CONFLICT (group_id, user_id) DO UPDATE "
            "SET role = CASE WHEN $4 THEN 'admin' ELSE futbol.group_members.role END",
            group_id,
            user_id,
            role,
            promote,
        )

    async def link_player_by_email(self, group_id: str, user_id: str, email: str) -> None:
        await self._pool.execute(
            "UPDATE futbol.players SET user_id = $2::uuid "
            "WHERE group_id = $1::uuid AND email = $3 AND user_id IS NULL "
            "AND NOT EXISTS (SELECT 1 FROM futbol.players WHERE group_id = $1::uuid AND user_id = $2::uuid)",
            group_id,
            user_id,
            email,
        )

    async def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        await self._pool.execute(
            "INSERT INTO futbol.auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, $3)",
            token_hash,
            user_id,
            expires_at,
        )

    async def actor_for_session(self, token_hash: str, now: datetime) -> Actor | None:
        row = await self._fetchrow(
            _ACTOR_SELECT + " JOIN futbol.auth_sessions s ON s.user_id = gm.user_id "
            "WHERE s.token_hash = $1 AND s.expires_at > $2 ORDER BY gm.group_id LIMIT 1",
            token_hash,
            now,
        )
        return None if row is None else _actor(row)

    async def actor_for_user(self, user_id: str) -> Actor | None:
        row = await self._fetchrow(_ACTOR_SELECT + " WHERE gm.user_id = $1::uuid ORDER BY gm.group_id LIMIT 1", user_id)
        return None if row is None else _actor(row)

    async def delete_session(self, token_hash: str) -> None:
        await self._pool.execute("DELETE FROM futbol.auth_sessions WHERE token_hash = $1", token_hash)

    async def password_hash_for(self, email: str) -> tuple[str, str | None] | None:
        row = await self._fetchrow("SELECT id, password_hash FROM futbol.app_users WHERE email = $1", email)
        return None if row is None else (str(row["id"]), row["password_hash"])

    async def set_password_hash(self, user_id: str, password_hash: str, now: datetime) -> None:
        await self._pool.execute(
            "UPDATE futbol.app_users SET password_hash = $2, password_updated_at = $3 WHERE id = $1::uuid",
            user_id,
            password_hash,
            now,
        )

    # ── skills ──────────────────────────────────────────────────────────────
    async def list_skills(self, group_id: str) -> list[SkillInfo]:
        rows = await self._pool.fetch(
            f"SELECT {_SKILL_COLS} FROM futbol.skills WHERE group_id = $1::uuid ORDER BY sort_order, key", group_id
        )
        return [_skill(r) for r in rows]

    async def create_skill(self, group_id: str, skill: SkillInfo) -> SkillInfo:
        row = await self._fetchrow(
            "INSERT INTO futbol.skills (id, group_id, key, name, description, weight, is_active, sort_order) "
            f"VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8) RETURNING {_SKILL_COLS}",
            skill.id,
            group_id,
            skill.key,
            skill.name,
            skill.description,
            skill.weight,
            skill.is_active,
            skill.sort_order,
        )
        assert row is not None
        return _skill(row)

    async def update_skill(self, group_id: str, skill: SkillInfo) -> SkillInfo | None:
        row = await self._fetchrow(
            "UPDATE futbol.skills SET name = $3, description = $4, weight = $5, is_active = $6, sort_order = $7 "
            f"WHERE id = $1::uuid AND group_id = $2::uuid RETURNING {_SKILL_COLS}",
            skill.id,
            group_id,
            skill.name,
            skill.description,
            skill.weight,
            skill.is_active,
            skill.sort_order,
        )
        return None if row is None else _skill(row)

    # ── players ─────────────────────────────────────────────────────────────
    async def list_players(self, group_id: str) -> list[Player]:
        rows = await self._pool.fetch(
            f"SELECT {_PLAYER_COLS} FROM futbol.players WHERE group_id = $1::uuid ORDER BY lower(display_name)",
            group_id,
        )
        return [_player(r) for r in rows]

    async def get_player(self, group_id: str, player_id: str) -> Player | None:
        row = await self._fetchrow(
            f"SELECT {_PLAYER_COLS} FROM futbol.players WHERE group_id = $1::uuid AND id = $2::uuid",
            group_id,
            player_id,
        )
        return None if row is None else _player(row)

    async def create_player(self, group_id: str, p: Player) -> Player:
        row = await self._fetchrow(
            "INSERT INTO futbol.players (id, group_id, display_name, nickname, email, preferred_position, "
            "can_play_gk, is_guest, guest_level, active) "
            f"VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING {_PLAYER_COLS}",
            p.id,
            group_id,
            p.display_name,
            p.nickname,
            p.email,
            p.preferred_position,
            p.can_play_gk,
            p.is_guest,
            p.guest_level,
            p.active,
        )
        assert row is not None
        return _player(row)

    async def update_player(self, group_id: str, p: Player) -> Player | None:
        row = await self._fetchrow(
            "UPDATE futbol.players SET display_name = $3, nickname = $4, email = $5, preferred_position = $6, "
            "can_play_gk = $7, is_guest = $8, guest_level = $9, active = $10 "
            f"WHERE id = $1::uuid AND group_id = $2::uuid RETURNING {_PLAYER_COLS}",
            p.id,
            group_id,
            p.display_name,
            p.nickname,
            p.email,
            p.preferred_position,
            p.can_play_gk,
            p.is_guest,
            p.guest_level,
            p.active,
        )
        return None if row is None else _player(row)

    # ── ratings ─────────────────────────────────────────────────────────────
    async def list_group_ratings(self, group_id: str) -> list[SkillRating]:
        rows = await self._pool.fetch(
            "SELECT sr.skill_id, sr.player_id, sr.rater_player_id, sr.value, "
            "COALESCE(gm.role = 'admin', false) AS rater_is_admin "
            "FROM futbol.skill_ratings sr "
            "JOIN futbol.players rp ON rp.id = sr.rater_player_id "
            "LEFT JOIN futbol.group_members gm ON gm.user_id = rp.user_id AND gm.group_id = rp.group_id "
            "WHERE rp.group_id = $1::uuid",
            group_id,
        )
        return [
            SkillRating(
                str(r["skill_id"]), str(r["player_id"]), str(r["rater_player_id"]), r["value"], r["rater_is_admin"]
            )
            for r in rows
        ]

    async def list_ratings_by(self, rater_player_id: str, player_id: str) -> dict[str, int]:
        rows = await self._pool.fetch(
            "SELECT skill_id, value FROM futbol.skill_ratings "
            "WHERE rater_player_id = $1::uuid AND player_id = $2::uuid",
            rater_player_id,
            player_id,
        )
        return {str(r["skill_id"]): r["value"] for r in rows}

    async def upsert_ratings(self, rater_player_id: str, player_id: str, values: dict[str, int]) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.executemany(
                "INSERT INTO futbol.skill_ratings (skill_id, player_id, rater_player_id, value) "
                "VALUES ($1::uuid, $2::uuid, $3::uuid, $4) "
                "ON CONFLICT (skill_id, player_id, rater_player_id) "
                "DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
                [(skill_id, player_id, rater_player_id, v) for skill_id, v in values.items()],
            )
