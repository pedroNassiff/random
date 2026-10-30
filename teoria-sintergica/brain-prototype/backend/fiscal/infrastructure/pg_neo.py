"""Lectura directa de NEO: una consulta SELECT con el usuario `neo_reader` (migración 009).

La seguridad la pone Postgres, no este código: conexión propia de NEO, transacción READ ONLY, solo SELECT y
RLS por dueño. Envolver la consulta en un subselect además rechaza varias sentencias y escrituras.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from fiscal.application.errors import Invalid


@dataclass(frozen=True)
class QueryResult:
    columnas: tuple[str, ...]
    filas: tuple[tuple[object, ...], ...]
    truncado: bool


class PgNeoReader:
    """`app` es el pool de la app (escribe el dueño de cada consulta); `neo`, el de NEO_DATABASE_URL."""

    def __init__(self, app: asyncpg.Pool, neo: asyncpg.Pool, *, max_rows: int = 200, timeout_ms: int = 5000) -> None:
        self._app = app
        self._neo = neo
        self._max_rows = int(max_rows)
        self._timeout_ms = int(timeout_ms)

    async def query(self, owner_id: str, sql: str) -> QueryResult:
        body = sql.strip().rstrip(";")
        async with self._neo.acquire() as conn:
            pid = await conn.fetchval("SELECT pg_backend_pid()")
            await self._app.execute(
                "INSERT INTO fiscal.neo_sessions (pid, owner_id) VALUES ($1, $2::uuid) "
                "ON CONFLICT (pid) DO UPDATE SET owner_id = EXCLUDED.owner_id",
                pid,
                owner_id,
            )
            try:
                async with conn.transaction(readonly=True):
                    await conn.execute(f"SET LOCAL statement_timeout = {self._timeout_ms}")
                    stmt = await conn.prepare(
                        # La consulta es de NEO a propósito: la acotan el usuario neo_reader y RLS.
                        f"SELECT * FROM (\n{body}\n) AS neo_q LIMIT {self._max_rows + 1}"  # nosec B608
                    )
                    records = await stmt.fetch()
                    columnas = tuple(a.name for a in stmt.get_attributes())
            except asyncpg.PostgresError as exc:
                raise Invalid(f"La consulta falló: {exc}") from exc
            finally:
                await self._app.execute("DELETE FROM fiscal.neo_sessions WHERE pid = $1", pid)
        filas = tuple(tuple(r.values()) for r in records[: self._max_rows])
        return QueryResult(columnas, filas, len(records) > self._max_rows)
