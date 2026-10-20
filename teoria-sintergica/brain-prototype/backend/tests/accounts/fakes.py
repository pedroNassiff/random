"""Repositorio de cuentas en memoria."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from accounts.application.credentials import hash_password
from accounts.application.ports import Identity


@dataclass
class FakeAccountRepo:
    users: dict[str, str] = field(default_factory=dict)  # email -> id
    passwords: dict[str, str] = field(default_factory=dict)  # user_id -> hash
    sessions: dict[str, tuple[str, datetime]] = field(default_factory=dict)

    def add_user(self, email: str, password: str | None = None) -> str:
        user_id = self.users.setdefault(email, str(uuid4()))
        if password is not None:
            self.passwords[user_id] = hash_password(password)
        return user_id

    async def password_hash_for(self, email: str) -> tuple[str, str | None] | None:
        user_id = self.users.get(email)
        return None if user_id is None else (user_id, self.passwords.get(user_id))

    async def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        self.sessions[token_hash] = (user_id, expires_at)

    async def identity_for_session(self, token_hash: str, now: datetime) -> Identity | None:
        s = self.sessions.get(token_hash)
        if s is None or s[1] <= now:
            return None
        email = next(e for e, u in self.users.items() if u == s[0])
        return Identity(s[0], email, s[0] in self.passwords)

    async def delete_session(self, token_hash: str) -> None:
        self.sessions.pop(token_hash, None)
