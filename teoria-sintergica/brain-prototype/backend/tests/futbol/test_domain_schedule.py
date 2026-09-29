"""spec §3 — calendario y plan del cron."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from futbol.domain.models import Match
from futbol.domain.schedule import (
    ScheduleConfig,
    describe_close,
    next_window,
    plan_tick,
    signup_open,
    window_for,
)

MAD = ZoneInfo("Europe/Madrid")
CFG = ScheduleConfig()


def at(y: int, m: int, d: int, hh: int = 0, mm: int = 0) -> datetime:
    return datetime(y, m, d, hh, mm, tzinfo=MAD)


def test_default_window_is_wed_20h_closes_sunday_2359_opens_thursday() -> None:
    w = window_for(date(2026, 9, 30), CFG)  # miércoles
    assert w.starts_at == at(2026, 9, 30, 20)
    assert w.signup_closes_at == at(2026, 9, 27, 23, 59)  # domingo, 3 días antes
    assert w.opens_at == at(2026, 9, 24)  # jueves 00:00


def test_next_window_from_monday_is_this_wednesday() -> None:
    assert next_window(at(2026, 9, 28, 10), CFG).starts_at == at(2026, 9, 30, 20)


def test_next_window_on_wednesday_after_kickoff_is_next_week() -> None:
    assert next_window(at(2026, 9, 30, 20, 0), CFG).starts_at == at(2026, 10, 7, 20)
    assert next_window(at(2026, 9, 30, 19, 59), CFG).starts_at == at(2026, 9, 30, 20)


def test_window_respects_dst_change() -> None:
    # 25/10/2026 cambia el horario en Madrid: el partido sigue a las 20:00 locales.
    w = window_for(date(2026, 10, 28), CFG)
    assert w.starts_at.astimezone(UTC).hour == 19
    assert window_for(date(2026, 10, 21), CFG).starts_at.astimezone(UTC).hour == 18


def test_close_on_same_weekday_as_match_before_kickoff_and_otherwise_week_before() -> None:
    same_day = ScheduleConfig(signup_close_weekday=3, signup_close_time=time(12, 0))
    assert window_for(date(2026, 9, 30), same_day).signup_closes_at == at(2026, 9, 30, 12)
    after_kickoff = ScheduleConfig(signup_close_weekday=3, signup_close_time=time(21, 0))
    assert window_for(date(2026, 9, 30), after_kickoff).signup_closes_at == at(2026, 9, 23, 21)


def match(mid: str, day: date, status: str = "open") -> Match:
    w = window_for(day, CFG)
    return Match(mid, w.starts_at, w.signup_closes_at, status)  # type: ignore[arg-type]


def test_tick_creates_next_match_when_window_is_open_and_none_exists() -> None:
    plan = plan_tick(at(2026, 9, 24, 0, 15), CFG, [])
    assert plan.create is not None and plan.create.starts_at == at(2026, 9, 30, 20)
    assert plan.close_ids == ()


def test_tick_waits_until_thursday_after_previous_match() -> None:
    played = match("prev", date(2026, 9, 23), "closed")
    assert plan_tick(at(2026, 9, 23, 22), CFG, [played]).create is None  # miércoles de noche
    assert plan_tick(at(2026, 9, 24, 0, 0), CFG, [played]).create is not None  # jueves 00:00


def test_tick_is_idempotent_and_closes_expired_signups() -> None:
    m = match("m1", date(2026, 9, 30))
    before_close = plan_tick(at(2026, 9, 27, 23, 58), CFG, [m])
    assert before_close.close_ids == () and before_close.create is None
    after_close = plan_tick(at(2026, 9, 27, 23, 59), CFG, [m])
    assert after_close.close_ids == ("m1",) and after_close.create is None
    closed = Match(m.id, m.starts_at, m.signup_closes_at, "closed")
    assert plan_tick(at(2026, 9, 28), CFG, [closed]) == plan_tick(at(2026, 9, 28), CFG, [closed])
    assert plan_tick(at(2026, 9, 28), CFG, [closed]).close_ids == ()


def test_cancelled_match_is_not_recreated_nor_blocks() -> None:
    cancelled = match("c", date(2026, 9, 30), "cancelled")
    assert plan_tick(at(2026, 9, 28), CFG, [cancelled]).create is None


def test_signup_open_and_close_description() -> None:
    m = match("m1", date(2026, 9, 30))
    assert signup_open(m, at(2026, 9, 27, 23, 58))
    assert not signup_open(m, at(2026, 9, 27, 23, 59))
    assert not signup_open(Match(m.id, m.starts_at, m.signup_closes_at, "closed"), at(2026, 9, 25))
    assert describe_close(m, CFG) == "el domingo a las 23:59"
    assert m.starts_at - m.signup_closes_at == timedelta(days=2, hours=20, minutes=1)


def test_custom_calendar_opens_friday_closes_tuesday() -> None:
    cfg = ScheduleConfig(signup_close_weekday=2, signup_open_weekday=5)
    w = window_for(date(2026, 9, 30), cfg)
    assert w.signup_closes_at == at(2026, 9, 29, 23, 59)  # martes
    assert w.opens_at == at(2026, 9, 25)  # viernes 00:00
    assert plan_tick(at(2026, 9, 24, 23, 59), cfg, []).create is None  # jueves: todavía no
    assert plan_tick(at(2026, 9, 25, 0, 0), cfg, []).create is not None
    assert plan_tick(at(2026, 9, 29, 23, 59), cfg, [Match("m", w.starts_at, w.signup_closes_at, "open")]).close_ids == (
        "m",
    )


def test_opening_on_same_weekday_as_close_goes_to_previous_week() -> None:
    cfg = ScheduleConfig(signup_close_weekday=2, signup_open_weekday=2, signup_open_time=time(23, 59))
    assert window_for(date(2026, 9, 30), cfg).opens_at == at(2026, 9, 22, 23, 59)
