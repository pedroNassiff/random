from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from futbol.application.auth_service import MAGIC_LINK_TTL, AuthService, hash_token
from futbol.application.errors import Invalid, Unauthorized
from futbol.application.ports import Actor
from tests.futbol.fakes import FakeMailer, FakeRepo

T0 = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now


def make(admin_emails: tuple[str, ...] = ("boss@x.com",)) -> tuple[AuthService, FakeRepo, FakeMailer, Clock]:
    repo, mailer, clock = FakeRepo(), FakeMailer(), Clock()
    counter = iter(range(1000))
    svc = AuthService(
        repo,
        mailer,
        base_url="https://random.dev/",
        admin_emails=admin_emails,
        clock=clock,
        token_factory=lambda: f"tok{next(counter):040d}",
    )
    return svc, repo, mailer, clock


async def test_unknown_email_gets_no_link_and_no_error() -> None:
    svc, repo, mailer, _ = make()
    await svc.request_link("nadie@x.com")
    assert mailer.sent == [] and repo.links == {}


async def test_known_player_email_gets_link_with_hashed_storage() -> None:
    svc, repo, mailer, _ = make()
    repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("  Juan@X.com ")
    email, link = mailer.sent[0]
    assert email == "juan@x.com"
    assert link.startswith("https://random.dev/vaca-futbolera/entrar?token=")
    assert hash_token(mailer.last_token) in repo.links
    assert mailer.last_token not in repo.links


async def test_verify_creates_session_links_player_and_makes_member() -> None:
    svc, repo, mailer, _ = make()
    player = repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("juan@x.com")
    session, actor = await svc.verify(mailer.last_token)
    assert (actor.role, actor.player_id, actor.email) == ("member", player.id, "juan@x.com")
    assert (await svc.actor_for(session)) == actor


async def test_admin_email_becomes_admin_even_without_player() -> None:
    svc, _, mailer, _ = make()
    await svc.request_link("boss@x.com")
    _, actor = await svc.verify(mailer.last_token)
    assert actor.is_admin and actor.player_id is None


async def test_magic_link_is_single_use() -> None:
    svc, repo, mailer, _ = make()
    repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("juan@x.com")
    await svc.verify(mailer.last_token)
    with pytest.raises(Unauthorized):
        await svc.verify(mailer.last_token)


async def test_magic_link_expires() -> None:
    svc, repo, mailer, clock = make()
    repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("juan@x.com")
    clock.now += MAGIC_LINK_TTL + timedelta(seconds=1)
    with pytest.raises(Unauthorized):
        await svc.verify(mailer.last_token)


async def test_session_expires_and_logout_revokes() -> None:
    svc, repo, mailer, clock = make()
    repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("juan@x.com")
    session, _ = await svc.verify(mailer.last_token)
    await svc.logout(session)
    with pytest.raises(Unauthorized):
        await svc.actor_for(session)
    await svc.logout(None)  # no-op


async def test_missing_or_unknown_session_is_unauthorized() -> None:
    svc, *_ = make()
    for token in (None, "", "inventado"):
        with pytest.raises(Unauthorized):
            await svc.actor_for(token)


async def test_user_without_membership_is_rejected() -> None:
    svc, repo, mailer, _ = make(admin_emails=())
    repo.users["ghost@x.com"] = "u-ghost"  # usuario conocido pero sin grupo
    await svc.request_link("ghost@x.com")

    async def no_membership(*_a: object) -> None:
        return None

    repo.ensure_membership = no_membership  # type: ignore[assignment,method-assign]
    with pytest.raises(Unauthorized):
        await svc.verify(mailer.last_token)


async def _logged_in(svc: AuthService, repo: FakeRepo, mailer: FakeMailer) -> tuple[str, Actor]:
    repo.add_player("Juan", email="juan@x.com")
    await svc.request_link("juan@x.com")
    return await svc.verify(mailer.last_token)


async def test_first_access_has_no_password_then_sets_it_and_logs_in() -> None:
    svc, repo, mailer, _ = make()
    _, actor = await _logged_in(svc, repo, mailer)
    assert actor.has_password is False
    updated = await svc.set_password(actor, "mi-clave-segura")
    assert updated.has_password is True
    session, again = await svc.login("  JUAN@x.com ", "mi-clave-segura")
    assert again.has_password and (await svc.actor_for(session)).user_id == actor.user_id


async def test_login_fails_with_same_message_for_wrong_password_unknown_email_or_no_password() -> None:
    svc, repo, mailer, _ = make()
    _, actor = await _logged_in(svc, repo, mailer)
    with pytest.raises(Unauthorized, match="Email o contraseña incorrectos") as no_password:
        await svc.login("juan@x.com", "lo-que-sea")
    await svc.set_password(actor, "mi-clave-segura")
    with pytest.raises(Unauthorized) as wrong:
        await svc.login("juan@x.com", "otra-clave-mala")
    with pytest.raises(Unauthorized) as unknown:
        await svc.login("nadie@x.com", "mi-clave-segura")
    assert str(no_password.value) == str(wrong.value) == str(unknown.value)


async def test_short_password_is_rejected() -> None:
    svc, repo, mailer, _ = make()
    _, actor = await _logged_in(svc, repo, mailer)
    with pytest.raises(Invalid):
        await svc.set_password(actor, "corta")


async def test_forgot_password_magic_link_still_works_and_allows_changing_it() -> None:
    svc, repo, mailer, _ = make()
    _, actor = await _logged_in(svc, repo, mailer)
    await svc.set_password(actor, "clave-vieja-123")
    await svc.request_link("juan@x.com")
    _, again = await svc.verify(mailer.last_token)
    assert again.has_password
    await svc.set_password(again, "clave-nueva-456")
    await svc.login("juan@x.com", "clave-nueva-456")
    with pytest.raises(Unauthorized):
        await svc.login("juan@x.com", "clave-vieja-123")


async def test_password_login_links_a_player_created_later_with_the_same_email() -> None:
    svc, repo, mailer, _ = make()
    await svc.request_link("boss@x.com")
    _, admin = await svc.verify(mailer.last_token)
    await svc.set_password(admin, "clave-segura-1")
    assert admin.player_id is None
    player = repo.add_player("Boss", email="boss@x.com")  # el admin se carga como jugador después
    _, again = await svc.login("boss@x.com", "clave-segura-1")
    assert again.player_id == player.id
