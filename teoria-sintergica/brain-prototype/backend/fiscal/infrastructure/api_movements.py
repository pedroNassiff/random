"""Endpoints de ingresos y gastos: importar la planilla y el resumen por categoría y mes."""

from __future__ import annotations

import base64
import binascii
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.errors import FiscalError
from fiscal.application.movements import MovementService

MAX_BYTES = 5 * 1024 * 1024
router = APIRouter(prefix="/movements")


class ImportIn(BaseModel):
    name: str = Field(max_length=200)
    data: str = Field(min_length=1, max_length=MAX_BYTES * 4 // 3 + 4)


def _service(request: Request) -> MovementService:
    service: MovementService = request.app.state.fiscal_movements
    return service


Svc = Annotated[MovementService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


@router.post("/import")
async def import_sheet(body: ImportIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        data = base64.b64decode(body.data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(422, "El archivo llegó dañado. Volvé a elegirlo.") from exc
    if len(data) > MAX_BYTES:
        raise HTTPException(422, "El Excel pesa más de 5 MB.")
    try:
        result = await svc.import_sheet(owner.user_id, data)
    except FiscalError as exc:
        raise HTTPException(422, str(exc)) from exc
    r = result.report
    return {
        "nuevos": result.nuevos,
        "actualizados": result.actualizados,
        "movimientos": len(r.movimientos),
        "desde": r.meses[0].isoformat(),
        "hasta": r.meses[-1].isoformat(),
        "meses": len(r.meses),
        "omitidas": r.omitidas,
        "dudosos": r.dudosos,
        "descuadres": r.descuadres,
    }


@router.get("/summary")
async def summary(
    svc: Svc,
    owner: Owner,
    tipo: Literal["gasto", "ingreso"] = "gasto",
    persona: Annotated[list[str] | None, Query(max_length=10)] = None,
    meses: int = 6,
) -> dict[str, Any]:
    try:
        view = await svc.summary(owner.user_id, tipo=tipo, personas=persona or (), meses=meses)
    except FiscalError as exc:
        raise HTTPException(422, str(exc)) from exc
    s = view.summary
    return {
        "meses": [m.isoformat() for m in s.meses],
        "filas": [
            {
                "categoria": f.categoria,
                "valores": [str(v) for v in f.valores],
                "total": str(f.total),
                "promedio": str(f.promedio),
                "variacion": None if f.variacion is None else str(f.variacion),
                "conceptos": list(f.conceptos),
            }
            for f in s.filas
        ],
        "totales": [str(t) for t in s.totales],
        "total": str(s.total),
        "personas": list(view.personas),
    }
