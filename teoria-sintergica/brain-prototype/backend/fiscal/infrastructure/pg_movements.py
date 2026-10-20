"""Adaptador PostgreSQL de movimientos (ingresos y gastos)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

import asyncpg

from fiscal.domain.movements import Movement, Tipo


class PgMovementRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def upsert_movements(self, owner_id: str, movements: Sequence[Movement]) -> tuple[int, int]:
        nuevos = actualizados = 0
        async with self._pool.acquire() as conn, conn.transaction():
            for m in movements:
                inserted = await conn.fetchval(
                    "INSERT INTO fiscal.movements (owner_id, mes, tipo, persona, concepto, categoria, importe, moneda, "
                    "fuente, fuente_ref) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10) "
                    "ON CONFLICT (owner_id, fuente_ref) DO UPDATE SET mes = EXCLUDED.mes, tipo = EXCLUDED.tipo, "
                    "persona = EXCLUDED.persona, concepto = EXCLUDED.concepto, categoria = EXCLUDED.categoria, "
                    "importe = EXCLUDED.importe, moneda = EXCLUDED.moneda, fuente = EXCLUDED.fuente "
                    # xmax = 0 solo en filas recién insertadas: distingue alta de actualización.
                    "RETURNING (xmax = 0)",
                    owner_id,
                    m.mes,
                    m.tipo,
                    m.persona,
                    m.concepto,
                    m.categoria,
                    m.importe,
                    m.moneda,
                    m.fuente,
                    m.fuente_ref,
                )
                if inserted:
                    nuevos += 1
                else:
                    actualizados += 1
        return nuevos, actualizados

    async def list_movements(self, owner_id: str) -> list[Movement]:
        rows = await self._pool.fetch(
            "SELECT id, mes, tipo, persona, concepto, categoria, importe, moneda, fuente, fuente_ref "
            "FROM fiscal.movements WHERE owner_id = $1::uuid ORDER BY mes, fuente_ref",
            owner_id,
        )
        return [
            Movement(
                mes=r["mes"],
                tipo=cast("Tipo", r["tipo"]),
                persona=r["persona"],
                concepto=r["concepto"],
                categoria=r["categoria"],
                importe=r["importe"],
                moneda=r["moneda"],
                fuente=r["fuente"],
                fuente_ref=r["fuente_ref"],
                id=str(r["id"]),
            )
            for r in rows
        ]
