"""Lee la última versión guardada de una spec (fiscal.specs, migración 010)."""

from __future__ import annotations

import asyncpg

from builder.application.ports import SavedSpec


class PgSavedSpecs:
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn

    async def latest(self, modulo: str) -> SavedSpec | None:
        conn = await asyncpg.connect(self._dsn)
        try:
            row = await conn.fetchrow(
                "SELECT modulo, version, contenido FROM fiscal.specs WHERE lower(modulo) = lower($1) "
                "ORDER BY version DESC, created_at DESC LIMIT 1",
                modulo,
            )
        finally:
            await conn.close()
        return None if row is None else SavedSpec(row["modulo"], row["version"], row["contenido"])
