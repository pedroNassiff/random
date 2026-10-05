"""Endpoints de facturas emitidas. Mismo guardado que usa la UI al confirmar una propuesta del agente."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.errors import FiscalError, Invalid, NotFound
from fiscal.application.invoice_tools import invoice_dict, invoice_from
from fiscal.application.invoices import InvoiceService

router = APIRouter(prefix="/invoices")


class InvoiceIn(BaseModel):
    serie: str = Field(default="", max_length=20)
    numero: int
    fecha: date
    fecha_devengo: date | None = None
    cliente: str = Field(max_length=200)
    cliente_pais: str = Field(max_length=2)
    cliente_tax_id: str | None = Field(default=None, max_length=30)
    cliente_empresa: bool = True
    concepto: str = Field(max_length=500)
    moneda: str = Field(default="EUR", max_length=3)
    importe: Decimal
    tipo_cambio: Decimal = Decimal("1")
    tipo_iva: Decimal = Decimal("0")
    retencion_pct: Decimal = Decimal("0")
    mencion: str = Field(default="", max_length=300)
    documento_id: str | None = Field(default=None, max_length=64)


def _service(request: Request) -> InvoiceService:
    service: InvoiceService = request.app.state.fiscal_invoices
    return service


Svc = Annotated[InvoiceService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


def _http(exc: FiscalError) -> HTTPException:
    if isinstance(exc, NotFound):
        return HTTPException(404, str(exc))
    return HTTPException(422 if isinstance(exc, Invalid) else 400, str(exc))


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


@router.get("")
async def list_invoices(svc: Svc, owner: Owner, ejercicio: int) -> dict[str, Any]:
    view = await svc.overview(owner.user_id, ejercicio)
    return {
        "ejercicio": view.ejercicio,
        "invoices": [invoice_dict(i) for i in view.invoices],
        "numeracion": list(view.numeracion),
    }


@router.post("", status_code=201)
async def add_invoice(body: InvoiceIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return invoice_dict(await svc.add(owner.user_id, invoice_from(body.model_dump(mode="json"))))
    except FiscalError as exc:
        raise _http(exc) from exc


@router.post("/{invoice_id}/void", status_code=204)
async def void_invoice(invoice_id: str, svc: Svc, owner: Owner) -> None:
    try:
        await svc.void(owner.user_id, invoice_id)
    except FiscalError as exc:
        raise _http(exc) from exc


@router.get("/summary")
async def summary(svc: Svc, owner: Owner, ejercicio: int, trimestre: int) -> dict[str, Any]:
    try:
        result: dict[str, Any] = _jsonable(asdict(await svc.summary(owner.user_id, ejercicio, trimestre)))
    except FiscalError as exc:
        raise _http(exc) from exc
    return result
