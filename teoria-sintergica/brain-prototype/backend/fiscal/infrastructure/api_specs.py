"""Endpoints de specs. Mismo guardado que usa la UI al confirmar la propuesta de spec de NEO."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.errors import Invalid
from fiscal.application.specs import SpecService, StoredSpec
from fiscal.domain.specs import MAX_CONTENIDO, MAX_MODULO, escenarios

router = APIRouter(prefix="/specs")


class SpecIn(BaseModel):
    modulo: str = Field(max_length=MAX_MODULO + 20)
    contenido: str = Field(max_length=MAX_CONTENIDO + 200)


def _service(request: Request) -> SpecService:
    service: SpecService = request.app.state.fiscal_specs
    return service


Svc = Annotated[SpecService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


def spec_dict(s: StoredSpec) -> dict[str, Any]:
    return {
        "id": s.id,
        "modulo": s.modulo,
        "contenido": s.contenido,
        "version": s.version,
        "estado": s.estado,
        "escenarios": escenarios(s.contenido),
        "creada": s.created_at.isoformat(),
    }


@router.get("")
async def list_specs(svc: Svc, owner: Owner) -> list[dict[str, Any]]:
    return [spec_dict(s) for s in await svc.list(owner.user_id)]


@router.post("", status_code=201)
async def save_spec(body: SpecIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return spec_dict(await svc.save(owner.user_id, body.modulo, body.contenido))
    except Invalid as exc:
        raise HTTPException(422, str(exc)) from exc
