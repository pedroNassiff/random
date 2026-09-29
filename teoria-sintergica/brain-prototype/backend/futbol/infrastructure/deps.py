"""Dependencias FastAPI compartidas por los routers de Fútbol Vaquero."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request

from futbol.application.auth_service import AuthService
from futbol.application.errors import Forbidden, FutbolError, Invalid, NotFound, Unauthorized
from futbol.application.match_service import MatchService
from futbol.application.ports import Actor
from futbol.application.results_service import ResultsService
from futbol.application.roster_service import RosterService
from futbol.application.teams_service import TeamsService


class Services:
    def __init__(
        self,
        auth: AuthService,
        roster: RosterService,
        matches: MatchService,
        teams: TeamsService,
        results: ResultsService,
    ) -> None:
        self.auth = auth
        self.roster = roster
        self.matches = matches
        self.teams = teams
        self.results = results


def _services(request: Request) -> Services:
    services: Services = request.app.state.futbol
    return services


Svc = Annotated[Services, Depends(_services)]


def http_error(exc: FutbolError) -> HTTPException:
    if isinstance(exc, Unauthorized):
        return HTTPException(401, str(exc))
    if isinstance(exc, Forbidden):
        return HTTPException(403, str(exc))
    if isinstance(exc, NotFound):
        return HTTPException(404, str(exc))
    if isinstance(exc, Invalid):
        return HTTPException(422, str(exc))
    return HTTPException(400, str(exc))


async def current_actor(svc: Svc, futbol_session: Annotated[str | None, Cookie()] = None) -> Actor:
    try:
        return await svc.auth.actor_for(futbol_session)
    except FutbolError as exc:
        raise http_error(exc) from exc


CurrentActor = Annotated[Actor, Depends(current_actor)]
