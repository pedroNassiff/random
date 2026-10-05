"""Sesión compartida: login, expiración y acceso por app."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from accounts.application.credentials import SESSION_TTL, hash_token, normalize_email
from accounts.application.errors import Forbidden, Unauthorized
from accounts.application.ports import Identity
from accounts.application.session_service import SessionService
from tests.accounts.fakes import FakeAccountRepo

NOW = datetime(2026, 10, 1, 12, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


def make(access: dict[str, list[str]] | None = None) -> tuple[SessionService, FakeAccountRepo, Clock]:
    repo, clock = FakeAccountRepo(), Clock()
    tokens = iter(f"token-{i}" for i in range(100))
    svc = SessionService(repo, app_access=access, clock=clock, token_factory=lambda: next(tokens))
    return svc, repo, clock


def test_normalize_email_and_token_hash_are_stable() -> None:
    assert normalize_email("  Pedro@X.com ") == "pedro@x.com"
    assert hash_token("a") == hash_token("a") != hash_token("b")
    assert len(hash_token("a")) == 64


async def test_login_opens_a_session_stored_only_as_hash() -> None:
    svc, repo, _ = make()
    user_id = repo.add_user("pedro@x.com", "correcta-123")
    session, identity = await svc.login(" Pedro@X.com ", "correcta-123")
    assert identity == Identity(user_id, "pedro@x.com", has_password=True)
    assert session == "token-0" and session not in repo.sessions
    assert repo.sessions[hash_token(session)] == (user_id, NOW + SESSION_TTL)
    assert await svc.identity_for(session) == identity


@pytest.mark.parametrize(
    ("email", "password"),
    [("pedro@x.com", "incorrecta"), ("nadie@x.com", "correcta-123"), ("sin-clave@x.com", "correcta-123")],
)
async def test_login_fails_with_the_same_error_for_any_bad_credential(email: str, password: str) -> None:
    svc, repo, _ = make()
    repo.add_user("pedro@x.com", "correcta-123")
    repo.add_user("sin-clave@x.com")
    with pytest.raises(Unauthorized, match="^Email o contraseña incorrectos.$"):
        await svc.login(email, password)
    assert repo.sessions == {}


async def test_session_expires_exactly_at_ttl() -> None:
    svc, repo, clock = make()
    repo.add_user("pedro@x.com", "correcta-123")
    session, _ = await svc.login("pedro@x.com", "correcta-123")
    clock.now = NOW + SESSION_TTL - timedelta(seconds=1)
    assert (await svc.identity_for(session)).email == "pedro@x.com"
    clock.now = NOW + SESSION_TTL
    with pytest.raises(Unauthorized, match="venció"):
        await svc.identity_for(session)


@pytest.mark.parametrize("token", [None, ""])
async def test_missing_session_asks_to_log_in(token: str | None) -> None:
    svc, _, _ = make()
    with pytest.raises(Unauthorized, match="Iniciá sesión"):
        await svc.identity_for(token)


async def test_unknown_session_is_rejected() -> None:
    svc, _, _ = make()
    with pytest.raises(Unauthorized, match="venció"):
        await svc.identity_for("inventado")


async def test_logout_revokes_only_that_session() -> None:
    svc, repo, _ = make()
    repo.add_user("pedro@x.com", "correcta-123")
    a, _ = await svc.login("pedro@x.com", "correcta-123")
    b, _ = await svc.login("pedro@x.com", "correcta-123")
    await svc.logout(a)
    await svc.logout(None)
    with pytest.raises(Unauthorized):
        await svc.identity_for(a)
    assert (await svc.identity_for(b)).email == "pedro@x.com"


def test_app_access_is_an_allowlist_and_fails_closed() -> None:
    svc, _, _ = make({"dashboard": [" Pedro@X.com ", "", " "], "otra": ["ana@x.com"], "abierta": ["pedro@x.com"]})
    pedro, ana = Identity("u1", "pedro@x.com"), Identity("u2", "ana@x.com")
    assert svc.apps_for(pedro) == ("abierta", "dashboard")
    assert svc.apps_for(ana) == ("otra",)
    svc.require_app(pedro, "dashboard")
    with pytest.raises(Forbidden, match="no tiene acceso"):
        svc.require_app(ana, "dashboard")
    with pytest.raises(Forbidden):
        svc.require_app(pedro, "no-configurada")


def test_blank_allowlist_entries_never_match_an_empty_email() -> None:
    svc, _, _ = make({"dashboard": ["", " "]})
    with pytest.raises(Forbidden):
        svc.require_app(Identity("u", ""), "dashboard")
    assert make()[0].apps_for(Identity("u", "pedro@x.com")) == ()
