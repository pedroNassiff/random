"""Tools del agente para facturas emitidas: consultar, resumir por trimestre y proponer el registro."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import asdict
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from fiscal.application.agent_types import PROPOSED, Handler, Proposal, ToolOutput, to_json
from fiscal.application.errors import Invalid
from fiscal.application.invoices import InvoiceService
from fiscal.domain.invoices import (
    MENCION_EXTRACOMUNITARIA,
    MENCION_INTRACOMUNITARIA,
    Invoice,
    invoice_issues,
)


def invoice_dict(i: Invoice) -> dict[str, Any]:
    """Factura con sus importes derivados, clasificación y observaciones. Decimales como texto."""
    return {
        "id": i.id,
        "serie": i.serie,
        "numero": i.numero,
        "fecha": i.fecha.isoformat(),
        "fecha_devengo": i.fecha_devengo.isoformat(),
        "trimestre": i.trimestre,
        "cliente": i.cliente,
        "cliente_pais": i.cliente_pais,
        "cliente_tax_id": i.cliente_tax_id,
        "cliente_empresa": i.cliente_empresa,
        "concepto": i.concepto,
        "moneda": i.moneda,
        "importe": str(i.importe),
        "tipo_cambio": str(i.tipo_cambio),
        "tipo_iva": str(i.tipo_iva),
        "retencion_pct": str(i.retencion_pct),
        "mencion": i.mencion,
        "documento_id": i.documento_id,
        "anulada": i.anulada,
        "operacion": i.operacion,
        "base": str(i.base),
        "cuota_iva": str(i.cuota_iva),
        "retencion": str(i.retencion),
        "total": str(i.total),
        "observaciones": list(invoice_issues(i)),
    }


def _decimal(value: object, label: str) -> Decimal:
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise Invalid(f"{label} debe ser un número.") from exc


def _date(value: object, label: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise Invalid(f"{label} debe ser una fecha aaaa-mm-dd.") from exc


def invoice_from(args: Mapping[str, Any]) -> Invoice:
    """Arma una factura desde un dict (tool del agente o cuerpo HTTP ya validado en forma)."""
    fecha = _date(args.get("fecha"), "fecha")
    devengo = args.get("fecha_devengo")
    return Invoice(
        serie=str(args.get("serie") or ""),
        numero=int(args.get("numero") or 0),
        fecha=fecha,
        fecha_devengo=_date(devengo, "fecha_devengo") if devengo else fecha,
        cliente=str(args.get("cliente") or ""),
        cliente_pais=str(args.get("cliente_pais") or ""),
        cliente_tax_id=args.get("cliente_tax_id") or None,
        cliente_empresa=bool(args.get("cliente_empresa", True)),
        concepto=str(args.get("concepto") or ""),
        moneda=str(args.get("moneda") or "EUR"),
        importe=_decimal(args.get("importe"), "importe"),
        tipo_cambio=_decimal(args.get("tipo_cambio") or 1, "tipo_cambio"),
        tipo_iva=_decimal(args.get("tipo_iva") or 0, "tipo_iva"),
        retencion_pct=_decimal(args.get("retencion_pct") or 0, "retencion_pct"),
        mencion=str(args.get("mencion") or ""),
        documento_id=args.get("documento_id") or None,
    )


class InvoiceTools:
    def __init__(self, invoices: InvoiceService, new_id: Callable[[], str]) -> None:
        self._invoices = invoices
        self._new_id = new_id

    def handlers(self) -> dict[str, Handler]:
        return {
            "ver_facturas": self._ver_facturas,
            "resumen_trimestre": self._resumen_trimestre,
            "proponer_factura": self._proponer_factura,
        }

    async def _ver_facturas(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        view = await self._invoices.overview(owner_id, int(args.get("ejercicio") or 0))
        return ToolOutput(
            to_json(
                {
                    "ejercicio": view.ejercicio,
                    "facturas": [invoice_dict(i) for i in view.invoices],
                    "incidencias_numeracion": list(view.numeracion),
                }
            )
        )

    async def _resumen_trimestre(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        summary = await self._invoices.summary(
            owner_id, int(args.get("ejercicio") or 0), int(args.get("trimestre") or 0)
        )
        return ToolOutput(to_json(asdict(summary)))

    async def _proponer_factura(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        invoice = self._invoices.check(invoice_from(args))
        data = invoice_dict(invoice)
        detalle = [
            f"fecha: {invoice.fecha:%d/%m/%Y} (devengo {invoice.fecha_devengo:%d/%m/%Y}, {invoice.trimestre}T)",
            f"cliente: {invoice.cliente} ({invoice.cliente_pais}) — operación {invoice.operacion}",
            f"importe: {invoice.importe} {invoice.moneda} → base {invoice.base} €",
            f"IVA {invoice.tipo_iva}%: {invoice.cuota_iva} €",
            f"retención {invoice.retencion_pct}%: {invoice.retencion} €",
            *(f"⚠ {issue}" for issue in data["observaciones"]),
        ]
        payload = {k: data[k] for k in _PAYLOAD_FIELDS}
        titulo = f"Registrar factura {invoice.numero}/{invoice.fecha.year} — {invoice.cliente}"
        proposal = Proposal(self._new_id(), "invoice", titulo, tuple(detalle), payload)
        hint = ""
        if data["observaciones"]:
            hint = (
                " La factura tiene observaciones: explicáselas al usuario. Se registra tal como se emitió; "
                f'las menciones correctas son "{MENCION_INTRACOMUNITARIA}" (UE) y "{MENCION_EXTRACOMUNITARIA}" '
                "(fuera de la UE), y se corrigen con una factura rectificativa."
            )
        return ToolOutput(PROPOSED + hint, proposal=proposal)


_PAYLOAD_FIELDS = (
    "serie",
    "numero",
    "fecha",
    "fecha_devengo",
    "cliente",
    "cliente_pais",
    "cliente_tax_id",
    "cliente_empresa",
    "concepto",
    "moneda",
    "importe",
    "tipo_cambio",
    "tipo_iva",
    "retencion_pct",
    "mencion",
    "documento_id",
)
