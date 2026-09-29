"""Composición: arma los servicios con sus adaptadores a partir del entorno."""

from __future__ import annotations

import os

import asyncpg

from futbol.application.auth_service import AuthService
from futbol.application.match_service import MatchService
from futbol.application.ports import Mailer
from futbol.application.results_service import ResultsService
from futbol.application.roster_service import RosterService
from futbol.application.teams_service import TeamsService
from futbol.infrastructure.deps import Services
from futbol.infrastructure.mailer import ConsoleMailer, SmtpMailer
from futbol.infrastructure.pg_matches import PgMatchRepository
from futbol.infrastructure.pg_repository import PgFutbolRepository
from futbol.infrastructure.pg_results import PgResultsRepository
from futbol.infrastructure.pg_teams import PgTeamsRepository


def _mailer() -> Mailer:
    host = os.getenv("FUTBOL_SMTP_HOST")
    if not host:
        return ConsoleMailer()
    return SmtpMailer(
        host,
        int(os.getenv("FUTBOL_SMTP_PORT", "587")),
        os.getenv("FUTBOL_SMTP_USER", ""),
        os.getenv("FUTBOL_SMTP_PASSWORD", ""),
        os.getenv("FUTBOL_MAIL_FROM", "futbol@random.com"),
    )


def build_services(pool: asyncpg.Pool) -> Services:
    repo = PgFutbolRepository(pool)
    admins = [e for e in os.getenv("FUTBOL_ADMIN_EMAILS", "").split(",") if e.strip()]
    base_url = os.getenv("FUTBOL_BASE_URL", "http://localhost:5173").rstrip("/")
    auth = AuthService(repo, _mailer(), base_url=base_url, admin_emails=admins)
    matches_repo, teams_repo = PgMatchRepository(pool), PgTeamsRepository(pool)
    matches = MatchService(matches_repo, repo, app_url=f"{base_url}/vaca-futbolera", teams=teams_repo)
    results_repo = PgResultsRepository(pool)
    teams = TeamsService(teams_repo, matches_repo, repo, results_repo)
    results = ResultsService(results_repo, matches_repo, teams_repo, repo)
    return Services(auth, RosterService(repo), matches, teams, results)
