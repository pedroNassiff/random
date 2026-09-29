"""spec §3 / M2 — cupo, lista de espera y bajas tardías."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from futbol.domain.models import Signup
from futbol.domain.signups import join, leave, ordered

T0 = datetime(2026, 9, 24, tzinfo=UTC)


def signups_for(n: int, capacity: int = 16) -> list[Signup]:
    out: list[Signup] = []
    for i in range(n):
        out = join(out, f"p{i:02d}", T0 + timedelta(minutes=i), capacity)
    return out


def ids(signups: list[Signup], status: str) -> list[str]:
    return [s.player_id for s in ordered(signups, status)]  # type: ignore[arg-type]


def test_18_with_capacity_16_gives_16_confirmed_and_2_waitlist_in_arrival_order() -> None:
    s = signups_for(18)
    assert ids(s, "confirmed") == [f"p{i:02d}" for i in range(16)]
    assert ids(s, "waitlist") == ["p16", "p17"]


def test_join_twice_is_idempotent() -> None:
    s = signups_for(3)
    assert join(s, "p01", T0 + timedelta(days=1), 16) == s


def test_late_withdrawal_promotes_first_waitlisted_and_is_marked() -> None:
    s = leave(signups_for(18), "p03", late=True)
    assert "p03" not in ids(s, "confirmed") and "p16" in ids(s, "confirmed")
    assert ids(s, "waitlist") == ["p17"]
    gone = next(x for x in s if x.player_id == "p03")
    assert gone.status == "withdrawn" and gone.late_withdrawal


def test_early_withdrawal_is_not_late_and_waitlist_leaving_does_not_promote() -> None:
    s = leave(signups_for(18), "p03", late=False)
    assert not next(x for x in s if x.player_id == "p03").late_withdrawal
    s2 = leave(signups_for(18), "p17", late=True)
    assert ids(s2, "waitlist") == ["p16"] and len(ids(s2, "confirmed")) == 16
    assert not next(x for x in s2 if x.player_id == "p17").late_withdrawal


def test_leave_is_idempotent_and_ignores_unknown_players() -> None:
    s = leave(signups_for(3), "p01", late=False)
    assert leave(s, "p01", late=False) == s
    assert leave(s, "nadie", late=False) == s


def test_confirmed_leaving_with_empty_waitlist_just_frees_the_spot() -> None:
    s = leave(signups_for(5), "p00", late=False)
    assert len(ids(s, "confirmed")) == 4 and ids(s, "waitlist") == []


def test_rejoining_after_withdrawal_goes_to_the_back_of_the_line() -> None:
    s = leave(signups_for(17), "p00", late=False)  # p16 sube
    s = join(s, "p00", T0 + timedelta(hours=5), 16)
    assert ids(s, "waitlist") == ["p00"]
