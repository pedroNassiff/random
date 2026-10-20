"""Endpoints de clientes. Mismo guardado que usa la UI al confirmar una propuesta del agente."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.client_tools import client_dict, client_from
from fiscal.application.clients import ClientService
from fiscal.application.errors import FiscalError, Invalid, NotFound
from fiscal.domain.clients import ClientType

router = APIRouter(prefix="/clients")


class ClientIn(BaseModel):
    nombre: str = Field(max_length=200)
    pais: str = Field(max_length=2)
    tipo: ClientType = "empresa"
    tax_id: str | None = Field(default=None, max_length=30)
    direccion: str = Field(default="", max_length=400)
    email: str | None = Field(default=None, max_length=254)
    moneda: str = Field(default="EUR", max_length=3)
    retencion_pct: Decimal = Decimal("0")
    dias_pago: int | None = None
    vinculada: bool = False
    notas: str = Field(default="", max_length=1000)


def _service(request: Request) -> ClientService:
    service: ClientService = request.app.state.fiscal_clients
    return service


Svc = Annotated[ClientService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


def _http(exc: FiscalError) -> HTTPException:
    if isinstance(exc, NotFound):
        return HTTPException(404, str(exc))
    return HTTPException(422 if isinstance(exc, Invalid) else 400, str(exc))


@router.get("")
async def list_clients(svc: Svc, owner: Owner, archivados: bool = False) -> list[dict[str, Any]]:
    return [client_dict(c) for c in await svc.list(owner.user_id, include_archived=archivados)]


@router.post("", status_code=201)
async def create_client(body: ClientIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return client_dict(await svc.create(owner.user_id, client_from(body.model_dump(mode="json"))))
    except FiscalError as exc:
        raise _http(exc) from exc


@router.put("/{client_id}")
async def update_client(client_id: str, body: ClientIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return client_dict(await svc.update(owner.user_id, client_id, client_from(body.model_dump(mode="json"))))
    except FiscalError as exc:
        raise _http(exc) from exc


@router.post("/{client_id}/vies")
async def check_vies(client_id: str, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return client_dict(await svc.check_vies(owner.user_id, client_id))
    except FiscalError as exc:
        raise _http(exc) from exc


@router.post("/{client_id}/archive")
async def archive_client(client_id: str, svc: Svc, owner: Owner, activo: bool = False) -> dict[str, Any]:
    try:
        return client_dict(await svc.archive(owner.user_id, client_id, activo=activo))
    except FiscalError as exc:
        raise _http(exc) from exc
