"""Endpoints de equipos (M3): propuestas, evaluación de movimientos, publicación y restricciones."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from futbol.application.errors import FutbolError
from futbol.application.teams_service import TeamsView
from futbol.domain.balancer import Evaluation
from futbol.domain.share import TEAM_NAMES, win_percentages
from futbol.infrastructure.deps import CurrentActor, Svc, http_error

router = APIRouter()


class TeamsIn(BaseModel):
    team_a: list[UUID] = Field(min_length=1, max_length=20)
    team_b: list[UUID] = Field(min_length=1, max_length=20)

    def ids(self) -> tuple[list[str], list[str]]:
        return [str(i) for i in self.team_a], [str(i) for i in self.team_b]


class ConstraintIn(BaseModel):
    player_a: UUID
    player_b: UUID
    kind: Literal["apart", "together"]


def _evaluation(e: Evaluation) -> dict[str, Any]:
    pa, pb = win_percentages(e.win_prob_a)
    return {
        "team_a": list(e.partition.team_a),
        "team_b": list(e.partition.team_b),
        "cost": e.cost,
        "breakdown": e.breakdown,
        "strength_a": e.strength_a,
        "strength_b": e.strength_b,
        "win_pct_a": pa,
        "win_pct_b": pb,
    }


def _lineup(e: Evaluation) -> dict[str, Any]:
    """Para miembros: solo quién juega dónde. Sin %, fuerza ni costo (no sesgar al grupo)."""
    return {"team_a": list(e.partition.team_a), "team_b": list(e.partition.team_b)}


def _teams(v: TeamsView, is_admin: bool) -> dict[str, Any]:
    return {
        "match": {"id": v.match.id, "starts_at": v.match.starts_at.isoformat(), "status": v.match.status},
        "team_names": list(TEAM_NAMES),
        "players": {pid: asdict(p) for pid, p in v.players.items()},
        "proposals": [_evaluation(e) for e in v.proposals],
        "published": (_evaluation if is_admin else _lineup)(v.published_eval) if v.published_eval else None,
        "share_text": v.share_text,
    }


@router.get("/matches/{match_id}/teams")
async def get_teams(match_id: UUID, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _teams(await svc.teams.view(actor, str(match_id)), actor.is_admin)
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/matches/{match_id}/teams/generate")
async def generate_teams(match_id: UUID, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _teams(await svc.teams.generate(actor, str(match_id)), actor.is_admin)
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/matches/{match_id}/teams/evaluate")
async def evaluate_teams(match_id: UUID, body: TeamsIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _evaluation(await svc.teams.evaluate(actor, str(match_id), *body.ids()))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/matches/{match_id}/teams/publish")
async def publish_teams(match_id: UUID, body: TeamsIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _teams(await svc.teams.publish(actor, str(match_id), *body.ids()), actor.is_admin)
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.get("/constraints")
async def list_constraints(svc: Svc, actor: CurrentActor) -> list[dict[str, Any]]:
    try:
        return [asdict(c) for c in await svc.teams.constraints(actor)]
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/constraints", status_code=201)
async def add_constraint(body: ConstraintIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return asdict(await svc.teams.add_constraint(actor, str(body.player_a), str(body.player_b), body.kind))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.delete("/constraints/{constraint_id}", status_code=204)
async def delete_constraint(constraint_id: UUID, svc: Svc, actor: CurrentActor) -> None:
    try:
        await svc.teams.delete_constraint(actor, str(constraint_id))
    except FutbolError as exc:
        raise http_error(exc) from exc
