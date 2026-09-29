"""Calendario del grupo y plan del cron (spec §3). Puro: recibe `now`, nunca lee el reloj.

Días de la semana con la convención de la spec y de Postgres: 0 = domingo … 6 = sábado.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from futbol.domain.models import Match

WEEKDAY_NAMES = ("domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado")


@dataclass(frozen=True)
class ScheduleConfig:
    timezone: str = "Europe/Madrid"
    match_weekday: int = 3
    match_time: time = time(20, 0)
    signup_close_weekday: int = 0
    signup_close_time: time = time(23, 59)
    signup_open_weekday: int = 4
    signup_open_time: time = time(0, 0)
    capacity: int = 16


@dataclass(frozen=True)
class MatchWindow:
    starts_at: datetime
    signup_closes_at: datetime
    opens_at: datetime
    """Última ocurrencia de `signup_open_weekday/time` antes del cierre (default jueves 00:00)."""


@dataclass(frozen=True)
class TickPlan:
    close_ids: tuple[str, ...]
    create: MatchWindow | None


def _py_weekday(dow: int) -> int:
    """0 = domingo (spec) → 0 = lunes (Python)."""
    return (dow - 1) % 7


def window_for(match_day: date, cfg: ScheduleConfig) -> MatchWindow:
    tz = ZoneInfo(cfg.timezone)
    starts = datetime.combine(match_day, cfg.match_time, tzinfo=tz)
    back = (match_day.weekday() - _py_weekday(cfg.signup_close_weekday)) % 7
    closes = datetime.combine(match_day - timedelta(days=back), cfg.signup_close_time, tzinfo=tz)
    if closes >= starts:
        closes -= timedelta(days=7)
    return MatchWindow(starts, closes, _last_before(closes, cfg.signup_open_weekday, cfg.signup_open_time, tz))


def _last_before(limit: datetime, dow: int, at: time, tz: ZoneInfo) -> datetime:
    """Última vez que es `dow` a la hora `at`, estrictamente antes de `limit`."""
    local = limit.astimezone(tz)
    back = (local.weekday() - _py_weekday(dow)) % 7
    candidate = datetime.combine(local.date() - timedelta(days=back), at, tzinfo=tz)
    return candidate if candidate < limit else candidate - timedelta(days=7)


def next_window(now: datetime, cfg: ScheduleConfig) -> MatchWindow:
    """Ventana del próximo partido que empieza estrictamente después de `now`."""
    local = now.astimezone(ZoneInfo(cfg.timezone))
    days = (_py_weekday(cfg.match_weekday) - local.weekday()) % 7
    window = window_for(local.date() + timedelta(days=days), cfg)
    if window.starts_at <= now:
        window = window_for(local.date() + timedelta(days=days + 7), cfg)
    return window


def signup_open(match: Match, now: datetime) -> bool:
    return match.status == "open" and now < match.signup_closes_at


def plan_tick(now: datetime, cfg: ScheduleConfig, matches: Sequence[Match]) -> TickPlan:
    """Idempotente: cierra inscripciones vencidas y crea el próximo partido si ya abrió su ventana."""
    close_ids = tuple(m.id for m in matches if m.status == "open" and now >= m.signup_closes_at)
    window = next_window(now, cfg)
    has_upcoming = any(m.starts_at > now and m.status != "cancelled" for m in matches)
    already_exists = any(m.starts_at == window.starts_at for m in matches)
    create = window if not has_upcoming and not already_exists and now >= window.opens_at else None
    return TickPlan(close_ids, create)


def describe_close(match: Match, cfg: ScheduleConfig) -> str:
    """Ej.: "el domingo a las 23:59" en la zona horaria del grupo."""
    local = match.signup_closes_at.astimezone(ZoneInfo(cfg.timezone))
    return f"el {WEEKDAY_NAMES[(local.weekday() + 1) % 7]} a las {local:%H:%M}"
