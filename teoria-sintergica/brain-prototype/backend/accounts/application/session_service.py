"""Sesión compartida: un solo login sirve para todas las páginas con login.

La identidad no implica acceso: cada app declara su allowlist de emails (`app_access`) y sin
allowlist nadie entra (falla cerrado).
"""

from __future__ import annotations

import secrets
from collections.abc import Callable, Collection, Mapping
from datetime import UTC, datetime

from accounts.application.credentials import (
    SESSION_TTL,
    burn_time,
    hash_token,
    normalize_email,
    verify_password,
)
from accounts.application.errors import Forbidden, Unauthorized
from accounts.application.ports import AccountRepository, Identity

_BAD_CREDENTIALS = "Email o contraseña incorrectos."


class SessionService:
    def __init__(
        self,
        repo: AccountRepository,
        *,
        app_access: Mapping[str, Collection[str]] | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32),
    ) -> None:
        self._repo = repo
        self._access = {
            app: frozenset(normalize_email(e) for e in emails if e.strip())
            for app, emails in (app_access or {}).items()
        }
        self._clock = clock
        self._token = token_factory

    async def login(self, email: str, password: str) -> tuple[str, Identity]:
        """Email + contraseña. Mismo error si el email no existe o la contraseña es incorrecta."""
        email = normalize_email(email)
        user_id, stored = await self._repo.password_hash_for(email) or ("", None)
        if stored is None:
            burn_time(password)  # iguala el tiempo de respuesta
            raise Unauthorized(_BAD_CREDENTIALS)
        if not verify_password(password, stored):
            raise Unauthorized(_BAD_CREDENTIALS)
        session = self._token()
        await self._repo.save_session(hash_token(session), user_id, self._clock() + SESSION_TTL)
        return session, Identity(user_id, email, has_password=True)

    async def identity_for(self, session_token: str | None) -> Identity:
        if not session_token:
            raise Unauthorized("Iniciá sesión.")
        identity = await self._repo.identity_for_session(hash_token(session_token), self._clock())
        if identity is None:
            raise Unauthorized("Tu sesión venció. Iniciá sesión de nuevo.")
        return identity

    async def logout(self, session_token: str | None) -> None:
        if session_token:
            await self._repo.delete_session(hash_token(session_token))

    def apps_for(self, identity: Identity) -> tuple[str, ...]:
        return tuple(sorted(app for app, emails in self._access.items() if identity.email in emails))

    def require_app(self, identity: Identity, app: str) -> None:
        if identity.email not in self._access.get(app, frozenset()):
            raise Forbidden("Tu usuario no tiene acceso a esta sección.")
