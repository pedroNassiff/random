"""Composición: arma la sesión compartida a partir del entorno."""

from __future__ import annotations

import os

import asyncpg

from accounts.application.session_service import SessionService
from accounts.infrastructure.pg import PgAccountRepository

DASHBOARD_APP = "dashboard"


def build_session_service(pool: asyncpg.Pool) -> SessionService:
    # Sin DASHBOARD_EMAILS nadie entra a /dashboard: los datos fiscales fallan cerrado.
    access = {DASHBOARD_APP: os.getenv("DASHBOARD_EMAILS", "").split(",")}
    return SessionService(PgAccountRepository(pool), app_access=access)
