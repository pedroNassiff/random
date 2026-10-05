"""Calendario de días hábiles (Ley 39/2015 art. 30.2: sábados, domingos y festivos son inhábiles).

Los festivos se cargan por ejercicio y territorio (nacional, comunidad autónoma y municipio del domicilio
fiscal). Un año solo está "cubierto" si tiene festivos cargados para los tres ámbitos.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from fiscal.domain.errors import MissingHolidays

NACIONAL = "ES"
_SATURDAY = 5


@dataclass(frozen=True)
class Holiday:
    day: date
    territorio: str
    nombre: str


def _norm(territorio: str) -> str:
    return territorio.strip().casefold()


def is_weekend(day: date) -> bool:
    return day.weekday() >= _SATURDAY


def next_weekday(day: date) -> date:
    """Primer día de lunes a viernes desde `day` (inclusive). No mira festivos."""
    while is_weekend(day):
        day += timedelta(days=1)
    return day


class BusinessCalendar:
    def __init__(self, holidays: Iterable[date], years: Iterable[int]) -> None:
        self._holidays = frozenset(holidays)
        self._years = frozenset(years)

    @property
    def years(self) -> frozenset[int]:
        return self._years

    def covers(self, year: int) -> bool:
        return year in self._years

    def is_business_day(self, day: date) -> bool:
        if not self.covers(day.year):
            raise MissingHolidays(day.year)
        return not is_weekend(day) and day not in self._holidays

    def next_business_day(self, day: date) -> date:
        """Primer día hábil desde `day` (inclusive)."""
        while not self.is_business_day(day):
            day += timedelta(days=1)
        return day

    def previous_business_day(self, day: date) -> date:
        """Último día hábil hasta `day` (inclusive)."""
        while not self.is_business_day(day):
            day -= timedelta(days=1)
        return day


def build_calendar(holidays: Sequence[Holiday], territorios: Sequence[str]) -> BusinessCalendar:
    """Calendario para un domicilio: une los festivos de `territorios` y cubre solo los años que tienen
    festivos en todos ellos (un territorio sin datos deja el año sin cubrir)."""
    wanted = [_norm(t) for t in territorios]
    years_by_territory: dict[str, set[int]] = {t: set() for t in wanted}
    days: set[date] = set()
    for h in holidays:
        territorio = _norm(h.territorio)
        if territorio in years_by_territory:
            years_by_territory[territorio].add(h.day.year)
            days.add(h.day)
    covered = set.intersection(*years_by_territory.values()) if years_by_territory else set()
    return BusinessCalendar(days, covered)
