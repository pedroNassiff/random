"""Login con contraseña + magic link (primer acceso y "olvidé mi contraseña") + sesiones.

Solo se guardan hashes: SHA-256 para tokens de link/sesión, scrypt para contraseñas.
"""

from __future__ import annotations

import secrets
from collections.abc import Callable, Collection
from dataclasses import replace
from datetime import UTC, datetime, timedelta

from accounts.application.credentials import SESSION_TTL, hash_token, normalize_email
from futbol.application.errors import Unauthorized
from futbol.application.passwords import burn_time, hash_password, validate_password, verify_password
from futbol.application.ports import Actor, FutbolRepository, Mailer

__all__ = ["MAGIC_LINK_TTL", "SESSION_TTL", "AuthService", "hash_token", "normalize_email"]

MAGIC_LINK_TTL = timedelta(minutes=15)
_BAD_CREDENTIALS = "Email o contraseña incorrectos."


class AuthService:
    def __init__(
        self,
        repo: FutbolRepository,
        mailer: Mailer,
        *,
        base_url: str,
        admin_emails: Collection[str] = (),
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32),
    ) -> None:
        self._repo = repo
        self._mailer = mailer
        self._base_url = base_url.rstrip("/")
        self._admin_emails = frozenset(normalize_email(e) for e in admin_emails)
        self._clock = clock
        self._token = token_factory

    async def request_link(self, email: str) -> None:
        """Envía el link solo a emails conocidos. Nunca revela si el email existe."""
        email = normalize_email(email)
        if email not in self._admin_emails and not await self._repo.email_known(email):
            return
        token = self._token()
        await self._repo.save_magic_link(hash_token(token), email, self._clock() + MAGIC_LINK_TTL)
        await self._mailer.send_magic_link(email, f"{self._base_url}/vaca-futbolera/entrar?token={token}")

    async def verify(self, token: str) -> tuple[str, Actor]:
        """Canjea el magic link (un solo uso) y abre una sesión. Devuelve (token de sesión, actor)."""
        now = self._clock()
        email = await self._repo.consume_magic_link(hash_token(token), now)
        if email is None:
            raise Unauthorized("El link venció o ya se usó. Pedí uno nuevo.")
        user_id = await self._repo.get_or_create_user(email)
        group_id = await self._repo.default_group_id()
        is_admin = email in self._admin_emails
        await self._repo.ensure_membership(group_id, user_id, "admin" if is_admin else "member", is_admin)
        await self._repo.link_player_by_email(group_id, user_id, email)
        return await self._open_session(user_id, now)

    async def login(self, email: str, password: str) -> tuple[str, Actor]:
        """Email + contraseña. Mismo error si el email no existe o la contraseña es incorrecta."""
        user_id, stored = await self._repo.password_hash_for(normalize_email(email)) or ("", None)
        if stored is None:
            burn_time(password)  # iguala el tiempo de respuesta
            raise Unauthorized(_BAD_CREDENTIALS)
        if not verify_password(password, stored):
            raise Unauthorized(_BAD_CREDENTIALS)
        # Si el admin cargó después un jugador con este email, queda vinculado en este ingreso.
        await self._repo.link_player_by_email(await self._repo.default_group_id(), user_id, normalize_email(email))
        return await self._open_session(user_id, self._clock())

    async def set_password(self, actor: Actor, password: str) -> Actor:
        """Crea o cambia la contraseña del usuario logueado."""
        validate_password(password)
        await self._repo.set_password_hash(actor.user_id, hash_password(password), self._clock())
        return replace(actor, has_password=True)

    async def _open_session(self, user_id: str, now: datetime) -> tuple[str, Actor]:
        actor = await self._repo.actor_for_user(user_id)
        if actor is None:
            raise Unauthorized("Tu usuario no pertenece a ningún grupo.")
        session = self._token()
        await self._repo.save_session(hash_token(session), user_id, now + SESSION_TTL)
        return session, actor

    async def actor_for(self, session_token: str | None) -> Actor:
        if not session_token:
            raise Unauthorized("Iniciá sesión.")
        actor = await self._repo.actor_for_session(hash_token(session_token), self._clock())
        if actor is None:
            raise Unauthorized("Tu sesión venció. Iniciá sesión de nuevo.")
        return actor

    async def logout(self, session_token: str | None) -> None:
        if session_token:
            await self._repo.delete_session(hash_token(session_token))
