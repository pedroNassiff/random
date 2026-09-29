"""Textos para compartir por WhatsApp (spec §7). Puro."""

from __future__ import annotations

from collections.abc import Sequence
from zoneinfo import ZoneInfo

from futbol.domain.models import Match
from futbol.domain.schedule import WEEKDAY_NAMES, ScheduleConfig, describe_close


def match_heading(match: Match, cfg: ScheduleConfig) -> str:
    """ "⚽ Fútbol miércoles 30/09 — 19:00"."""
    local = match.starts_at.astimezone(ZoneInfo(cfg.timezone))
    return f"⚽ Fútbol {WEEKDAY_NAMES[(local.weekday() + 1) % 7]} {local:%d/%m} — {local:%H:%M}"


def signup_text(
    match: Match,
    cfg: ScheduleConfig,
    *,
    link: str,
    confirmed: Sequence[str],
    waitlist: Sequence[str],
    signup_open: bool,
) -> str:
    lines = [match_heading(match, cfg), f"Anotate acá: {link}"]
    lines.append(f"✅ Van {len(confirmed)}/{cfg.capacity}: {', '.join(confirmed) or '—'}")
    if waitlist:
        lines.append(f"⏳ En espera: {', '.join(waitlist)}")
    lines.append(f"Cierra {describe_close(match, cfg)}" if signup_open else "Inscripción cerrada")
    return "\n".join(lines)


TEAM_NAMES = ("Blancos", "Negros")


def win_percentages(win_prob_a: float) -> tuple[int, int]:
    a = round(win_prob_a * 100)
    return a, 100 - a


def teams_text(match: Match, cfg: ScheduleConfig, team_a: Sequence[str], team_b: Sequence[str]) -> str:
    """Formato spec §7: encabezado, ⬜ BLANCOS + nombres, ⬛ NEGROS + nombres.

    Sin % de victoria: lo recibe todo el grupo y no queremos sesgar quién "va a ganar".
    """
    return "\n".join(
        [
            match_heading(match, cfg),
            f"⬜ {TEAM_NAMES[0].upper()}",
            ", ".join(team_a),
            f"⬛ {TEAM_NAMES[1].upper()}",
            ", ".join(team_b),
        ]
    )
