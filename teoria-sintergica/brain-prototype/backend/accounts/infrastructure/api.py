"""Router FastAPI de la sesión compartida (/auth) y dependencias para proteger otras apps."""

from __future__ import annotations

import os
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from accounts.application.credentials import SESSION_TTL
from accounts.application.errors import AccountError, Forbidden, Unauthorized
from accounts.application.ports import Identity
from accounts.application.session_service import SessionService

# Nombre histórico: la cookie nació con Fútbol Vaquero y es la misma para todas las páginas con login.
SESSION_COOKIE = "futbol_session"

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


def _service(request: Request) -> SessionService:
    service: SessionService = request.app.state.accounts
    return service


Sessions = Annotated[SessionService, Depends(_service)]
SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


def http_error(exc: AccountError) -> HTTPException:
    if isinstance(exc, Unauthorized):
        return HTTPException(401, str(exc))
    if isinstance(exc, Forbidden):
        return HTTPException(403, str(exc))
    return HTTPException(400, str(exc))


def set_session_cookie(response: Response, session: str) -> None:
    secure = os.getenv("SESSION_COOKIE_SECURE", os.getenv("FUTBOL_COOKIE_SECURE", "1")) == "1"
    response.set_cookie(
        SESSION_COOKIE,
        session,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


async def current_identity(svc: Sessions, session: SessionToken = None) -> Identity:
    try:
        return await svc.identity_for(session)
    except AccountError as exc:
        raise http_error(exc) from exc


CurrentIdentity = Annotated[Identity, Depends(current_identity)]


def require_app(app: str) -> Callable[[SessionService, Identity], Coroutine[Any, Any, Identity]]:
    """Dependencia: sesión válida + email en la allowlist de `app`."""

    async def dependency(svc: Sessions, identity: CurrentIdentity) -> Identity:
        try:
            svc.require_app(identity, app)
        except AccountError as exc:
            raise http_error(exc) from exc
        return identity

    return dependency


def _me(svc: SessionService, identity: Identity) -> dict[str, Any]:
    return {"email": identity.email, "has_password": identity.has_password, "apps": list(svc.apps_for(identity))}


@router.post("/login")
async def login(body: LoginIn, svc: Sessions, response: Response) -> dict[str, Any]:
    try:
        session, identity = await svc.login(body.email, body.password)
    except AccountError as exc:
        raise http_error(exc) from exc
    set_session_cookie(response, session)
    return _me(svc, identity)


@router.get("/me")
async def me(svc: Sessions, identity: CurrentIdentity) -> dict[str, Any]:
    return _me(svc, identity)


@router.post("/logout", status_code=204)
async def logout(svc: Sessions, response: Response, session: SessionToken = None) -> None:
    await svc.logout(session)
    response.delete_cookie(SESSION_COOKIE, path="/")
