"""Adaptador PostgreSQL de clientes."""

from __future__ import annotations

from typing import cast

import asyncpg

from fiscal.domain.clients import Client, ClientType

_COLS = (
    "id, codigo, nombre, pais, tipo, tax_id, direccion, email, moneda, retencion_pct, dias_pago, vinculada, notas, "
    "vies_ok, vies_checked_at, vies_nombre, activo"
)


def _client(r: asyncpg.Record) -> Client:
    return Client(
        id=str(r["id"]),
        codigo=r["codigo"],
        nombre=r["nombre"],
        pais=r["pais"],
        tipo=cast("ClientType", r["tipo"]),
        tax_id=r["tax_id"],
        direccion=r["direccion"],
        email=r["email"],
        moneda=r["moneda"],
        retencion_pct=r["retencion_pct"],
        dias_pago=r["dias_pago"],
        vinculada=r["vinculada"],
        notas=r["notas"],
        vies_ok=r["vies_ok"],
        vies_checked_at=r["vies_checked_at"],
        vies_nombre=r["vies_nombre"],
        activo=r["activo"],
    )


class PgClientRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def add_client(self, owner_id: str, c: Client) -> Client:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "INSERT INTO fiscal.clients (owner_id, codigo, nombre, pais, tipo, tax_id, direccion, email, moneda, "
                "retencion_pct, dias_pago, vinculada, notas) "
                "SELECT $1::uuid, COALESCE(MAX(codigo), 0) + 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12 "
                "FROM fiscal.clients WHERE owner_id = $1::uuid "
                f"RETURNING {_COLS}",  # nosec B608 - columnas constantes
                owner_id,
                c.nombre,
                c.pais,
                c.tipo,
                c.tax_id,
                c.direccion,
                c.email,
                c.moneda,
                c.retencion_pct,
                c.dias_pago,
                c.vinculada,
                c.notas,
            ),
        )
        assert row is not None
        return _client(row)

    async def update_client(self, owner_id: str, c: Client) -> Client | None:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "UPDATE fiscal.clients SET nombre = $3, pais = $4, tipo = $5, tax_id = $6, direccion = $7, "
                "email = $8, moneda = $9, retencion_pct = $10, dias_pago = $11, vinculada = $12, notas = $13, "
                "vies_ok = $14, vies_checked_at = $15, vies_nombre = $16, activo = $17 "
                "WHERE owner_id = $1::uuid AND id::text = $2 "
                f"RETURNING {_COLS}",  # nosec B608 - columnas constantes
                owner_id,
                c.id,
                c.nombre,
                c.pais,
                c.tipo,
                c.tax_id,
                c.direccion,
                c.email,
                c.moneda,
                c.retencion_pct,
                c.dias_pago,
                c.vinculada,
                c.notas,
                c.vies_ok,
                c.vies_checked_at,
                c.vies_nombre,
                c.activo,
            ),
        )
        return None if row is None else _client(row)

    async def get_client(self, owner_id: str, client_id: str) -> Client | None:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                f"SELECT {_COLS} FROM fiscal.clients "  # nosec B608 - columnas constantes
                "WHERE owner_id = $1::uuid AND id::text = $2",
                owner_id,
                client_id,
            ),
        )
        return None if row is None else _client(row)

    async def list_clients(self, owner_id: str) -> list[Client]:
        rows = await self._pool.fetch(
            f"SELECT {_COLS} FROM fiscal.clients WHERE owner_id = $1::uuid ORDER BY codigo",  # nosec B608
            owner_id,
        )
        return [_client(r) for r in rows]
