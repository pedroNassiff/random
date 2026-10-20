"""Puertos que implementa infrastructure."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class Identity:
    """Quién está logueado, sin saber nada de la app que lo usa (grupo de fútbol, perfil fiscal…)."""

    user_id: str
    email: str
    has_password: bool = False


class AccountRepository(Protocol):
    async def password_hash_for(self, email: str) -> tuple[str, str | None] | None: ...
    async def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None: ...
    async def identity_for_session(self, token_hash: str, now: datetime) -> Identity | None: ...
    async def delete_session(self, token_hash: str) -> None: ...
