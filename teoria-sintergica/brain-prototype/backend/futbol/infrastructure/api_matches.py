"""Endpoints de partido e inscripción (M2) y del cron."""

from __future__ import annotations

import hmac
import os
from dataclasses import asdict
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from futbol.application.errors import FutbolError
from futbol.application.match_service import MatchView
from futbol.infrastructure.deps import CurrentActor, Svc, http_error

router = APIRouter()


class SignupIn(BaseModel):
    """Sin `player_id` actúa sobre uno mismo; con `player_id`, solo el admin."""

    player_id: UUID | None = None


def _view(view: MatchView | None) -> dict[str, Any]:
    if view is None:
        return {"match": None}
    out = asdict(view)
    out["match"]["starts_at"] = view.match.starts_at.isoformat()
    out["match"]["signup_closes_at"] = view.match.signup_closes_at.isoformat()
    return out


@router.get("/matches/current")
async def current_match(svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    return _view(await svc.matches.current(actor))


@router.post("/matches/{match_id}/signup")
async def signup(match_id: UUID, svc: Svc, actor: CurrentActor, body: SignupIn | None = None) -> dict[str, Any]:
    player = str(body.player_id) if body and body.player_id else None
    try:
        return _view(await svc.matches.join(actor, str(match_id), player))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/matches/{match_id}/withdraw")
async def withdraw(match_id: UUID, svc: Svc, actor: CurrentActor, body: SignupIn | None = None) -> dict[str, Any]:
    player = str(body.player_id) if body and body.player_id else None
    try:
        return _view(await svc.matches.leave(actor, str(match_id), player))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/cron/tick")
async def cron_tick(svc: Svc, authorization: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    """Idempotente. Lo llama un scheduler cada 15 min con `Authorization: Bearer $FUTBOL_CRON_SECRET`."""
    secret = os.getenv("FUTBOL_CRON_SECRET", "")
    if not secret or not hmac.compare_digest(authorization or "", f"Bearer {secret}"):
        raise HTTPException(401, "No autorizado.")
    results = [asdict(r) for r in await svc.matches.tick_all()]
    for r in results:
        r["proposals_generated"] = await svc.teams.generate_pending(r["group_id"])
    return {"results": results}
