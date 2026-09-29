"""Endpoints de resultados (UC-08) e historial de partidos."""

from __future__ import annotations

from dataclasses import asdict
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from futbol.application.errors import FutbolError
from futbol.application.results_service import HistoryEntry, ResultForm
from futbol.domain.results import MatchResult
from futbol.domain.share import TEAM_NAMES
from futbol.infrastructure.deps import CurrentActor, Svc, http_error

router = APIRouter()


class ResultIn(BaseModel):
    goals_a: int = Field(ge=0, le=99)
    goals_b: int = Field(ge=0, le=99)
    notes: str = Field(default="", max_length=500)
    team_a: list[UUID] = Field(min_length=1, max_length=30)
    team_b: list[UUID] = Field(min_length=1, max_length=30)
    player_goals: dict[UUID, Annotated[int, Field(ge=0, le=99)]] = Field(default_factory=dict)


def _match(m: Any) -> dict[str, Any]:
    return {"id": m.id, "starts_at": m.starts_at.isoformat(), "status": m.status}


def _entry(e: HistoryEntry) -> dict[str, Any]:
    return {
        "match": _match(e.match),
        "result": asdict(e.result),
        "close": e.close,
        "team_a": [asdict(p) for p in e.team_a],
        "team_b": [asdict(p) for p in e.team_b],
    }


def _form(f: ResultForm) -> dict[str, Any]:
    return {
        "match": _match(f.match),
        "team_names": list(TEAM_NAMES),
        "team_a": [asdict(p) for p in f.team_a],
        "team_b": [asdict(p) for p in f.team_b],
        "result": asdict(f.result) if f.result else None,
        "roster": [asdict(p) for p in f.roster],
    }


@router.get("/matches/history")
async def history(svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    return {"team_names": list(TEAM_NAMES), "matches": [_entry(e) for e in await svc.results.history(actor)]}


@router.get("/matches/{match_id}/result")
async def result_form(match_id: UUID, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _form(await svc.results.form(actor, str(match_id)))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.put("/matches/{match_id}/result")
async def record_result(match_id: UUID, body: ResultIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        form = await svc.results.record(
            actor,
            str(match_id),
            MatchResult(body.goals_a, body.goals_b, body.notes.strip()),
            [str(i) for i in body.team_a],
            [str(i) for i in body.team_b],
            {str(k): v for k, v in body.player_goals.items()},
        )
        return _form(form)
    except FutbolError as exc:
        raise http_error(exc) from exc
