from __future__ import annotations

from datetime import date, time

from futbol.domain.models import Match
from futbol.domain.schedule import ScheduleConfig, window_for
from futbol.domain.share import match_heading, signup_text

CFG = ScheduleConfig(match_time=time(19, 0), signup_close_weekday=2, capacity=12)
W = window_for(date(2026, 9, 30), CFG)
MATCH = Match("m1", W.starts_at, W.signup_closes_at, "open")


def test_heading() -> None:
    assert match_heading(MATCH, CFG) == "⚽ Fútbol miércoles 30/09 — 19:00"


def test_signup_text_open_with_waitlist() -> None:
    text = signup_text(
        MATCH, CFG, link="https://x.dev/vaca-futbolera", confirmed=["Juan", "Pedro"], waitlist=["Leo"], signup_open=True
    )
    assert text == (
        "⚽ Fútbol miércoles 30/09 — 19:00\n"
        "Anotate acá: https://x.dev/vaca-futbolera\n"
        "✅ Van 2/12: Juan, Pedro\n"
        "⏳ En espera: Leo\n"
        "Cierra el martes a las 23:59"
    )


def test_signup_text_empty_and_closed() -> None:
    text = signup_text(MATCH, CFG, link="L", confirmed=[], waitlist=[], signup_open=False)
    assert text.splitlines()[2:] == ["✅ Van 0/12: —", "Inscripción cerrada"]


def test_teams_text_matches_spec_format_without_win_percentage() -> None:
    from futbol.domain.share import teams_text, win_percentages

    text = teams_text(MATCH, CFG, ["Juan", "Pedro"], ["Fede", "Pau"])
    assert text == "⚽ Fútbol miércoles 30/09 — 19:00\n⬜ BLANCOS\nJuan, Pedro\n⬛ NEGROS\nFede, Pau"
    assert "%" not in text
    assert win_percentages(0.5) == (50, 50) and sum(win_percentages(0.337)) == 100
