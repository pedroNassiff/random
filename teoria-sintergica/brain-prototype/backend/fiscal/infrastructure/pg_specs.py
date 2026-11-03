"""Adaptador PostgreSQL de specs (migración fiscal/010)."""

from __future__ import annotations

from datetime import datetime
from typing import cast

import asyncpg

from fiscal.application.specs import SpecEstado, StoredSpec
from fiscal.domain.specs import Spec

_COLS = "id, modulo, contenido, version, estado, created_at"


def _spec(r: asyncpg.Record) -> StoredSpec:
    return StoredSpec(
        id=str(r["id"]),
        modulo=r["modulo"],
        contenido=r["contenido"],
        version=r["version"],
        estado=cast("SpecEstado", r["estado"]),
        created_at=r["created_at"],
    )


class PgSpecRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def add_version(self, owner_id: str, spec: Spec, now: datetime) -> StoredSpec:
        row = cast(
            "asyncpg.Record",
            await self._pool.fetchrow(
                "INSERT INTO fiscal.specs (owner_id, modulo, contenido, version, created_at) "
                "SELECT $1::uuid, $2, $3, COALESCE(MAX(version), 0) + 1, $4 FROM fiscal.specs "
                f"WHERE owner_id = $1::uuid AND lower(modulo) = lower($2) RETURNING {_COLS}",
                owner_id,
                spec.modulo,
                spec.contenido,
                now,
            ),
        )
        return _spec(row)

    async def current(self, owner_id: str, modulo: str) -> StoredSpec | None:
        row = await self._pool.fetchrow(
            f"SELECT {_COLS} FROM fiscal.specs WHERE owner_id = $1::uuid AND lower(modulo) = lower($2) "
            "ORDER BY version DESC LIMIT 1",
            owner_id,
            modulo,
        )
        return None if row is None else _spec(cast("asyncpg.Record", row))

    async def latest(self, owner_id: str) -> list[StoredSpec]:
        rows = await self._pool.fetch(
            f"SELECT * FROM (SELECT DISTINCT ON (lower(modulo)) {_COLS} FROM fiscal.specs "
            "WHERE owner_id = $1::uuid ORDER BY lower(modulo), version DESC) AS s ORDER BY created_at DESC, modulo",
            owner_id,
        )
        return [_spec(r) for r in rows]
