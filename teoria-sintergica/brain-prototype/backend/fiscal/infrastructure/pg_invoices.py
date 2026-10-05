"""Adaptador PostgreSQL de facturas emitidas. Append-only: solo INSERT y el marcado de anulada."""

from __future__ import annotations

from typing import cast

import asyncpg

from fiscal.domain.invoices import Invoice

_COLS = (
    "id, serie, numero, fecha, fecha_devengo, cliente, cliente_pais, cliente_tax_id, cliente_empresa, concepto, "
    "moneda, importe, tipo_cambio, tipo_iva, retencion_pct, mencion, documento_id, anulada"
)


def _invoice(r: asyncpg.Record) -> Invoice:
    return Invoice(
        id=str(r["id"]),
        serie=r["serie"],
        numero=r["numero"],
        fecha=r["fecha"],
        fecha_devengo=r["fecha_devengo"],
        cliente=r["cliente"],
        cliente_pais=r["cliente_pais"],
        cliente_tax_id=r["cliente_tax_id"],
        cliente_empresa=r["cliente_empresa"],
        concepto=r["concepto"],
        moneda=r["moneda"],
        importe=r["importe"],
        tipo_cambio=r["tipo_cambio"].normalize() if r["tipo_cambio"] % 1 else r["tipo_cambio"].quantize(1),
        tipo_iva=r["tipo_iva"],
        retencion_pct=r["retencion_pct"],
        mencion=r["mencion"],
        documento_id=str(r["documento_id"]) if r["documento_id"] else None,
        anulada=r["anulada"],
    )


class PgInvoiceRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def add_invoice(self, owner_id: str, invoice: Invoice) -> Invoice:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "INSERT INTO fiscal.invoices (owner_id, serie, numero, fecha, fecha_devengo, cliente, cliente_pais, "
                "cliente_tax_id, cliente_empresa, concepto, moneda, importe, tipo_cambio, tipo_iva, retencion_pct, "
                "mencion, documento_id) "
                # El documento se vincula solo si existe y es del mismo dueño; si no, queda sin vínculo.
                "VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, "
                "(SELECT id FROM fiscal.documents WHERE owner_id = $1::uuid AND id::text = $17)) "
                f"RETURNING {_COLS}",  # nosec B608 - columnas constantes
                owner_id,
                invoice.serie,
                invoice.numero,
                invoice.fecha,
                invoice.fecha_devengo,
                invoice.cliente,
                invoice.cliente_pais,
                invoice.cliente_tax_id,
                invoice.cliente_empresa,
                invoice.concepto,
                invoice.moneda,
                invoice.importe,
                invoice.tipo_cambio,
                invoice.tipo_iva,
                invoice.retencion_pct,
                invoice.mencion,
                invoice.documento_id,
            ),
        )
        assert row is not None
        return _invoice(row)

    async def list_invoices(self, owner_id: str) -> list[Invoice]:
        rows = await self._pool.fetch(
            f"SELECT {_COLS} FROM fiscal.invoices "  # nosec B608 - columnas constantes
            "WHERE owner_id = $1::uuid ORDER BY fecha, numero, created_at",
            owner_id,
        )
        return [_invoice(r) for r in rows]

    async def void_invoice(self, owner_id: str, invoice_id: str) -> bool:
        result: str = await self._pool.execute(
            "UPDATE fiscal.invoices SET anulada = true WHERE owner_id = $1::uuid AND id::text = $2",
            owner_id,
            invoice_id,
        )
        return result.endswith(" 1")
