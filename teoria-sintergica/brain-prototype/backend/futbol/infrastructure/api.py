"""Router FastAPI de Fútbol Vaquero. Traduce HTTP ↔ casos de uso; no tiene lógica de negocio."""

from __future__ import annotations

import os
from dataclasses import asdict
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel, Field

from futbol.application.auth_service import SESSION_TTL
from futbol.application.errors import FutbolError
from futbol.application.ports import Actor
from futbol.application.roster_service import PlayerListing
from futbol.domain.models import Player, Position, SkillInfo
from futbol.infrastructure.api_matches import router as matches_router
from futbol.infrastructure.api_results import router as results_router
from futbol.infrastructure.api_teams import router as teams_router
from futbol.infrastructure.deps import CurrentActor, Services, Svc, current_actor, http_error

__all__ = ["Services", "current_actor", "http_error", "router"]

COOKIE = "futbol_session"

router = APIRouter(prefix="/futbol", tags=["Fútbol Vaquero"])


# ── schemas ─────────────────────────────────────────────────────────────────
class RequestLink(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class VerifyLink(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PasswordIn(BaseModel):
    password: str = Field(max_length=128)


class SkillIn(BaseModel):
    key: str = ""
    name: str
    description: str = ""
    weight: float
    is_active: bool = True
    sort_order: int = 0


class PlayerIn(BaseModel):
    display_name: str
    nickname: str | None = None
    email: str | None = None
    preferred_position: Position | None = None
    can_play_gk: bool = False
    is_guest: bool = False
    guest_level: int | None = None
    active: bool = True


class RatingsIn(BaseModel):
    ratings: dict[str, int]


def _me(actor: Actor) -> dict[str, Any]:
    return {
        "email": actor.email,
        "role": actor.role,
        "player_id": actor.player_id,
        "has_password": actor.has_password,
    }


def _set_session_cookie(response: Response, session: str) -> None:
    response.set_cookie(
        COOKIE,
        session,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=os.getenv("FUTBOL_COOKIE_SECURE", "1") == "1",
        samesite="lax",
        path="/",
    )


def _listing(item: PlayerListing) -> dict[str, Any]:
    out = asdict(item.player)
    if item.scoring is not None:  # solo llega para admin
        out["scoring"] = asdict(item.scoring)
    return out


def _player(body: PlayerIn, player_id: str = "") -> Player:
    return Player(player_id, **body.model_dump())


def _skill(body: SkillIn, skill_id: str = "") -> SkillInfo:
    return SkillInfo(skill_id, **body.model_dump())


# ── auth ────────────────────────────────────────────────────────────────────
@router.post("/auth/request", status_code=202)
async def request_link(body: RequestLink, svc: Svc) -> dict[str, str]:
    await svc.auth.request_link(body.email)
    return {"status": "Si el email está en el grupo, te llegó un link."}


@router.post("/auth/verify")
async def verify_link(body: VerifyLink, svc: Svc, response: Response) -> dict[str, Any]:
    try:
        session, actor = await svc.auth.verify(body.token)
    except FutbolError as exc:
        raise http_error(exc) from exc
    _set_session_cookie(response, session)
    return _me(actor)


@router.post("/auth/login")
async def login(body: LoginIn, svc: Svc, response: Response) -> dict[str, Any]:
    try:
        session, actor = await svc.auth.login(body.email, body.password)
    except FutbolError as exc:
        raise http_error(exc) from exc
    _set_session_cookie(response, session)
    return _me(actor)


@router.put("/auth/password")
async def set_password(body: PasswordIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return _me(await svc.auth.set_password(actor, body.password))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.post("/auth/logout", status_code=204)
async def logout(svc: Svc, response: Response, futbol_session: Annotated[str | None, Cookie()] = None) -> None:
    await svc.auth.logout(futbol_session)
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
async def me(actor: CurrentActor) -> dict[str, Any]:
    return _me(actor)


# ── skills ──────────────────────────────────────────────────────────────────
@router.get("/skills")
async def list_skills(svc: Svc, actor: CurrentActor) -> list[dict[str, Any]]:
    return [asdict(s) for s in await svc.roster.list_skills(actor)]


@router.post("/skills", status_code=201)
async def create_skill(body: SkillIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return asdict(await svc.roster.create_skill(actor, _skill(body)))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.put("/skills/{skill_id}")
async def update_skill(skill_id: str, body: SkillIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return asdict(await svc.roster.update_skill(actor, _skill(body, skill_id)))
    except FutbolError as exc:
        raise http_error(exc) from exc


# ── players ─────────────────────────────────────────────────────────────────
@router.get("/players")
async def list_players(svc: Svc, actor: CurrentActor) -> list[dict[str, Any]]:
    return [_listing(i) for i in await svc.roster.list_players(actor)]


@router.post("/players", status_code=201)
async def create_player(body: PlayerIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return asdict(await svc.roster.create_player(actor, _player(body)))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.put("/players/{player_id}")
async def update_player(player_id: str, body: PlayerIn, svc: Svc, actor: CurrentActor) -> dict[str, Any]:
    try:
        return asdict(await svc.roster.update_player(actor, _player(body, player_id)))
    except FutbolError as exc:
        raise http_error(exc) from exc


@router.get("/players/{player_id}/ratings")
async def my_ratings(player_id: str, svc: Svc, actor: CurrentActor) -> dict[str, int]:
    return await svc.roster.my_ratings(actor, player_id)


@router.put("/players/{player_id}/ratings", status_code=204)
async def rate_player(player_id: str, body: RatingsIn, svc: Svc, actor: CurrentActor) -> None:
    try:
        await svc.roster.rate(actor, player_id, body.ratings)
    except FutbolError as exc:
        raise http_error(exc) from exc


router.include_router(matches_router)
router.include_router(teams_router)
router.include_router(results_router)
