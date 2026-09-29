"""ALGORITHMS §2.1 (prior) y §3.3 (jugador extra), y probabilidad de victoria."""

from __future__ import annotations

import pytest

from futbol.domain.strength import MU_BASE, SIGMA_BASE, Rating, prior_ratings, team_strength, win_probability


def test_prior_is_centered_on_mu_base_and_scaled_by_z() -> None:
    r = prior_ratings({"a": 4.0, "b": 6.0, "c": 8.0})
    assert r["b"].mu == MU_BASE and r["b"].sigma == SIGMA_BASE
    assert r["c"].mu == pytest.approx(MU_BASE + 3 * 1.224744871, abs=1e-6)
    assert r["a"].mu == pytest.approx(2 * MU_BASE - r["c"].mu)


def test_identical_players_get_mu_base_and_guests_more_uncertainty() -> None:
    r = prior_ratings({"a": 5.0, "b": 5.0}, {"g": 9.0})
    assert r["a"].mu == r["b"].mu == r["g"].mu == MU_BASE
    assert r["g"].sigma == pytest.approx(SIGMA_BASE * 1.5)
    assert prior_ratings({}, {"g": 7.0})["g"].mu == MU_BASE  # sin miembros: z = 0


def test_team_strength_discounts_the_extra_player() -> None:
    assert team_strength([10, 10, 10], 3) == 30
    assert team_strength([10, 10, 10], 2) == pytest.approx(30 - 0.4 * 10)
    assert team_strength([], 0) == 0


def test_win_probability_is_symmetric_and_favours_the_stronger() -> None:
    even = [Rating(25, 8)] * 5
    assert win_probability(even, even) == pytest.approx(0.5)
    strong = [Rating(30, 8)] * 5
    p = win_probability(strong, even)
    assert 0.5 < p < 1 and win_probability(even, strong) == pytest.approx(1 - p)
    assert win_probability([], []) == 0.5
