"""UC-04 y cron (M2) con repositorios en memoria y reloj controlado."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.match_service import MatchService
from futbol.application.ports import Actor
from futbol.domain.schedule import ScheduleConfig, window_for
from tests.futbol.fakes import GROUP, FakeMatchRepo, FakeRepo

MAD = ZoneInfo("Europe/Madrid")
ADMIN = Actor("u-admin", GROUP, "admin", "boss@x.com", None, True)


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


def world(now: datetime, capacity: int = 16) -> tuple[MatchService, FakeMatchRepo, FakeRepo, Clock]:
    matches, roster, clock = FakeMatchRepo(ScheduleConfig(capacity=capacity)), FakeRepo(), Clock(now)
    return MatchService(matches, roster, clock), matches, roster, clock


def member(player_id: str | None) -> Actor:
    return Actor(f"u-{player_id}", GROUP, "member", "m@x.com", player_id, True)


THU = datetime(2026, 9, 24, 10, tzinfo=MAD)  # jueves: inscripción abierta para el miércoles 30


async def test_cron_twice_does_not_duplicate_matches() -> None:
    svc, matches, _, _ = world(THU)
    first, second = await svc.tick_all(), await svc.tick_all()
    assert first[0].created and not second[0].created
    assert len(matches.matches) == 1


async def test_current_creates_the_match_and_shows_it_open() -> None:
    svc, _, _, _ = world(THU)
    view = await svc.current(member(None))
    assert view is not None and view.signup_open and view.capacity == 16
    assert view.match.starts_at == datetime(2026, 9, 30, 20, tzinfo=MAD)
    assert view.closes_text == "el domingo a las 23:59"
    assert view.share_text.startswith(
        "⚽ Fútbol miércoles 30/09 — 20:00\nAnotate acá: http://localhost:5173/vaca-futbolera"
    )


async def test_current_is_none_before_the_window_opens() -> None:
    svc, matches, _, _ = world(datetime(2026, 9, 23, 22, tzinfo=MAD))  # miércoles de noche
    matches.add_match(window_for(date(2026, 9, 23), ScheduleConfig()), "played")
    assert await svc.current(member(None)) is None


async def test_18_signups_with_capacity_16_and_names_in_view() -> None:
    svc, _, roster, clock = world(THU)
    match = await svc.current(ADMIN)
    assert match is not None
    players = [roster.add_player(f"J{i:02d}", preferred_position="MED") for i in range(18)]
    view = None
    for p in players:
        clock.now += timedelta(minutes=1)
        view = await svc.join(member(p.id), match.match.id)
    assert view is not None
    assert [v.display_name for v in view.confirmed] == [f"J{i:02d}" for i in range(16)]
    assert [v.display_name for v in view.waitlist] == ["J16", "J17"]
    assert view.confirmed[0].preferred_position == "MED"
    assert view.my_status == "waitlist"


async def test_member_cannot_join_after_close_but_can_withdraw_late_and_promotes() -> None:
    svc, _, roster, clock = world(THU, capacity=2)
    match = (await svc.current(ADMIN)).match  # type: ignore[union-attr]
    a, b, c = (roster.add_player(n) for n in "ABC")
    for p in (a, b, c):
        clock.now += timedelta(minutes=1)
        await svc.join(member(p.id), match.id)
    clock.now = datetime(2026, 9, 28, 9, tzinfo=MAD)  # lunes, cerrada
    late = roster.add_player("Tarde")
    with pytest.raises(Invalid, match="La inscripción cerró el domingo a las 23:59"):
        await svc.join(member(late.id), match.id)
    view = await svc.leave(member(a.id), match.id)
    assert [v.player_id for v in view.confirmed] == [b.id, c.id] and view.waitlist == []
    assert view.my_status is None
    signups = {s.player_id: s for s in await svc._matches.list_signups(match.id)}
    assert signups[a.id].late_withdrawal


async def test_admin_can_add_and_remove_anyone_even_after_close() -> None:
    svc, _, roster, clock = world(THU)
    match = (await svc.current(ADMIN)).match  # type: ignore[union-attr]
    p = roster.add_player("Juan")
    clock.now = datetime(2026, 9, 29, tzinfo=MAD)
    assert [v.player_id for v in (await svc.join(ADMIN, match.id, p.id)).confirmed] == [p.id]
    assert (await svc.leave(ADMIN, match.id, p.id)).confirmed == []


async def test_permissions_and_errors() -> None:
    svc, matches, roster, _ = world(THU)
    match = (await svc.current(ADMIN)).match  # type: ignore[union-attr]
    other = roster.add_player("Otro")
    with pytest.raises(Forbidden, match="vinculado"):
        await svc.join(member(None), match.id)
    with pytest.raises(Forbidden, match="a vos mismo"):
        await svc.join(member("p-yo"), match.id, other.id)
    with pytest.raises(NotFound, match="Partido"):
        await svc.join(ADMIN, "nope", other.id)
    with pytest.raises(NotFound, match="Jugador"):
        await svc.join(ADMIN, match.id, "nope")
    inactive = roster.add_player("Baja", active=False)
    with pytest.raises(NotFound):
        await svc.join(ADMIN, match.id, inactive.id)
    played = matches.add_match(window_for(date(2026, 9, 16), ScheduleConfig()), "played")
    with pytest.raises(Invalid, match="ya no admite cambios"):
        await svc.leave(ADMIN, played.id, other.id)


async def test_view_tolerates_signup_of_deleted_player() -> None:
    svc, matches, roster, _ = world(THU)
    match = (await svc.current(ADMIN)).match  # type: ignore[union-attr]
    p = roster.add_player("Fantasma")
    await svc.join(member(p.id), match.id)
    del roster.players[p.id]
    view = await svc.current(ADMIN)
    assert view is not None and view.confirmed[0].display_name == "Jugador"
