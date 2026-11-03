"""Endpoints del botón Construir. Sin NEO_BUILDER=1 solo informan que no está disponible."""

from __future__ import annotations

from dataclasses import asdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.builds import BuildService
from fiscal.application.errors import Invalid, NotFound

router = APIRouter(prefix="/builds")


class BuildIn(BaseModel):
    modulo: str = Field(min_length=1, max_length=100)


def _service(request: Request) -> BuildService:
    service: BuildService = request.app.state.fiscal_builds
    return service


Svc = Annotated[BuildService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


@router.get("")
async def list_builds(svc: Svc, _owner: Owner) -> dict[str, Any]:
    return {
        "disponible": svc.available,
        "presupuesto_usd": svc.budget_usd,
        "builds": [{**asdict(b), "log": list(b.log)} for b in svc.list()],
    }


@router.post("", status_code=202)
async def start_build(body: BuildIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        status = await svc.start(owner.user_id, body.modulo)
    except NotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except Invalid as exc:
        raise HTTPException(409, str(exc)) from exc
    return {**asdict(status), "log": list(status.log)}


@router.post("/{slug}/cancel", status_code=204)
async def cancel_build(slug: str, svc: Svc, _owner: Owner) -> Response:
    try:
        svc.cancel(slug)
    except NotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    return Response(status_code=204)
