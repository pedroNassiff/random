"""Días hábiles: sábados, domingos y festivos del domicilio son inhábiles (Ley 39/2015 art. 30.2)."""

from __future__ import annotations

from datetime import date

import pytest

from fiscal.domain.errors import MissingHolidays
from fiscal.domain.holidays import BusinessCalendar, Holiday, build_calendar, is_weekend, next_weekday
from tests.fiscal.helpers import TERRITORIOS, barcelona, seeded_holidays


def test_seed_has_the_2026_calendar_for_the_three_scopes() -> None:
    by_territory: dict[str, list[date]] = {}
    for h in seeded_holidays():
        by_territory.setdefault(h.territorio, []).append(h.day)
    assert {t: len(d) for t, d in by_territory.items()} == {"ES": 10, "Cataluña": 4, "Barcelona": 2}
    assert date(2026, 9, 24) in by_territory["Barcelona"] and date(2026, 9, 11) in by_territory["Cataluña"]


def test_weekend_helpers() -> None:
    assert not is_weekend(date(2026, 10, 2)) and is_weekend(date(2026, 10, 3)) and is_weekend(date(2026, 10, 4))
    assert next_weekday(date(2026, 10, 2)) == date(2026, 10, 2)
    assert next_weekday(date(2026, 10, 3)) == date(2026, 10, 5)
    assert next_weekday(date(2026, 10, 4)) == date(2026, 10, 5)


@pytest.mark.parametrize(
    ("day", "habil"),
    [
        (date(2026, 10, 9), True),  # viernes
        (date(2026, 10, 10), False),  # sábado
        (date(2026, 10, 11), False),  # domingo
        (date(2026, 10, 12), False),  # festivo nacional (lunes)
        (date(2026, 9, 11), False),  # festivo autonómico
        (date(2026, 9, 24), False),  # festivo local
        (date(2026, 10, 13), True),
    ],
)
def test_business_days_in_barcelona(day: date, habil: bool) -> None:
    assert barcelona().is_business_day(day) is habil


def test_next_and_previous_business_day_are_inclusive_and_skip_runs() -> None:
    cal = barcelona()
    assert cal.next_business_day(date(2026, 10, 9)) == date(2026, 10, 9)
    assert cal.next_business_day(date(2026, 10, 10)) == date(2026, 10, 13)  # sáb, dom, festivo
    assert cal.previous_business_day(date(2026, 10, 13)) == date(2026, 10, 13)
    assert cal.previous_business_day(date(2026, 10, 12)) == date(2026, 10, 9)


def test_local_holidays_only_apply_to_that_municipality() -> None:
    madrid = build_calendar(
        [*seeded_holidays(), Holiday(date(2026, 5, 15), "Madrid", "San Isidro")],
        ("ES", "Cataluña", "Madrid"),
    )
    assert madrid.is_business_day(date(2026, 9, 24))
    assert not madrid.is_business_day(date(2026, 5, 15))
    assert barcelona().is_business_day(date(2026, 5, 15))


def test_territory_match_ignores_case_and_spaces() -> None:
    cal = build_calendar(seeded_holidays(), (" es ", "CATALUÑA", "barcelona "))
    assert cal.years == frozenset({2026}) and not cal.is_business_day(date(2026, 9, 24))


def test_a_year_is_covered_only_if_every_territory_has_holidays() -> None:
    assert barcelona().covers(2026) and not barcelona().covers(2027)
    partial = build_calendar([*seeded_holidays(), Holiday(date(2027, 1, 1), "ES", "Año Nuevo")], TERRITORIOS)
    assert partial.years == frozenset({2026})
    unknown_town = build_calendar(seeded_holidays(), ("ES", "Cataluña", "Girona"))
    assert unknown_town.years == frozenset()
    assert build_calendar(seeded_holidays(), ()).years == frozenset()


def test_uncovered_year_raises_instead_of_guessing() -> None:
    cal = barcelona()
    with pytest.raises(MissingHolidays, match="2027") as exc:
        cal.is_business_day(date(2027, 1, 4))
    assert exc.value.year == 2027
    with pytest.raises(MissingHolidays):
        cal.next_business_day(date(2027, 1, 1))
    with pytest.raises(MissingHolidays):
        BusinessCalendar([], []).previous_business_day(date(2026, 1, 2))
