"""ALGORITHMS §5.2 — tests obligatorios del balanceador."""

from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import replace
from math import comb

import pytest

from futbol.domain.balancer import (
    BalancerConfig,
    BalancerPlayer,
    Constraint,
    InfeasibleConstraintsError,
    Partition,
    build_context,
    enumerate_partitions,
    evaluate_partition,
    overlap,
    propose,
)
from futbol.domain.strength import Rating

WEIGHTS = {"overall": 3.0, "pace": 1.0}


def player(i: int, mu: float = 25.0, position: str | None = "MED", gk: float = 1.0) -> BalancerPlayer:
    return BalancerPlayer(f"p{i:02d}", Rating(mu, 8.33), {"overall": mu / 5, "pace": 5.0}, position, gk)


def squad(mus: Sequence[float]) -> list[BalancerPlayer]:
    return [player(i, mu) for i, mu in enumerate(mus)]


VARIED: list[float] = [31, 29, 28, 27, 26, 25, 24, 23, 22, 20, 19, 18]


@pytest.mark.parametrize(("n", "expected"), [(16, 6435), (15, 6435), (12, comb(11, 5)), (10, comb(9, 4))])
def test_partition_counts(n: int, expected: int) -> None:
    assert sum(1 for _ in enumerate_partitions([f"p{i:02d}" for i in range(n)])) == expected


def test_ten_identical_players_have_zero_strength_difference() -> None:
    best = propose(build_context(squad([25] * 10), WEIGHTS))[0]
    assert abs(best.strength_a - best.strength_b) == 0
    assert best.win_prob_a == pytest.approx(0.5)


def test_team_sizes_follow_signups_10_11_12() -> None:
    for n, sizes in ((10, (5, 5)), (11, (5, 6)), (12, (6, 6))):
        e = propose(build_context(squad(VARIED[:n] if n <= 12 else VARIED), WEIGHTS))[0]
        assert (len(e.partition.team_a), len(e.partition.team_b)) == sizes


def test_fifteen_gives_seven_and_eight() -> None:
    e = propose(build_context(squad([20 + i for i in range(15)]), WEIGHTS))[0]
    assert (len(e.partition.team_a), len(e.partition.team_b)) == (7, 8)


def test_two_goalkeepers_split_in_every_proposal() -> None:
    players = [player(i, 25 + i % 3, "POR" if i in (0, 1) else "DEF") for i in range(10)]
    for e in propose(build_context(players, WEIGHTS)):
        assert ("p00" in e.partition.team_a) != ("p01" in e.partition.team_a)


def test_goalkeeper_rule_can_be_disabled() -> None:
    players = [player(i, 25, "POR" if i in (0, 1) else "DEF") for i in range(4)]
    cfg = BalancerConfig(enforce_goalkeepers=False, n_proposals=10, min_diff=0)
    together = [
        e for e in propose(build_context(players, WEIGHTS, config=cfg)) if {"p00", "p01"} <= set(e.partition.team_a)
    ]
    assert together


def test_apart_and_together_are_respected() -> None:
    constraints = [Constraint("p00", "p01", "apart"), Constraint("p02", "p03", "together")]
    for e in propose(build_context(squad(VARIED[:10]), WEIGHTS, constraints)):
        a = set(e.partition.team_a)
        assert ("p00" in a) != ("p01" in a)
        assert ("p02" in a) == ("p03" in a)


def test_impossible_constraints_raise_with_the_conflicts() -> None:
    constraints = [Constraint("p00", "p01", "together"), Constraint("p00", "p01", "apart")]
    with pytest.raises(InfeasibleConstraintsError) as exc:
        propose(build_context(squad(VARIED[:10]), WEIGHTS, constraints))
    assert "p00 con p01" in str(exc.value) and "p00 separado de p01" in exc.value.conflicts


def test_constraints_on_players_not_signed_up_are_ignored() -> None:
    ctx = build_context(squad(VARIED[:10]), WEIGHTS, [Constraint("p00", "nadie", "apart")])
    assert ctx.constraints == [] and propose(ctx)


def test_deterministic_regardless_of_input_order() -> None:
    players = squad(VARIED[:12])
    first = propose(build_context(players, WEIGHTS))
    again = propose(build_context(list(reversed(players)), WEIGHTS))
    assert [e.partition for e in first] == [e.partition for e in again]


def test_three_proposals_differ_in_at_least_two_players() -> None:
    proposals = propose(build_context(squad(VARIED[:12]), WEIGHTS))
    assert len(proposals) == 3
    for i, x in enumerate(proposals):
        for y in proposals[i + 1 :]:
            assert len(set(x.partition.team_a) - set(y.partition.team_a)) >= 2
    assert proposals[0].cost <= proposals[1].cost <= proposals[2].cost


def test_repeating_last_match_exactly_adds_w_rep() -> None:
    players = squad(VARIED[:10])
    p = Partition(("p00", "p02", "p04", "p06", "p08"), ("p01", "p03", "p05", "p07", "p09"))
    fresh = evaluate_partition(p, build_context(players, WEIGHTS))
    mirrored = Partition(p.team_b, p.team_a)
    repeated = evaluate_partition(p, build_context(players, WEIGHTS, history=[mirrored]))
    assert repeated.cost - fresh.cost == pytest.approx(BalancerConfig().w_rep)
    assert overlap(p, mirrored) == 1.0


def test_crack_ends_up_with_the_weakest() -> None:
    mus = [45, 30, 29, 28, 27, 26, 25, 24, 18, 17]  # p00 es el crack; p08 y p09 los más flojos
    best = propose(build_context(squad(mus), WEIGHTS))[0]
    crack_side = set(best.partition.team_a if "p00" in best.partition.team_a else best.partition.team_b)
    # §5.2: el crack termina con los 2–3 más flojos de su lado (p09, p08, p07).
    assert len({"p09", "p08", "p07"} & crack_side) >= 2


def test_breakdown_has_every_cost_term_and_sums_to_cost() -> None:
    e = propose(build_context(squad(VARIED[:10]), WEIGHTS))[0]
    assert set(e.breakdown) == {"balance", "profile", "positions", "goalkeeping", "repeat", "goals"}
    assert sum(e.breakdown.values()) == pytest.approx(e.cost)


def test_config_overrides_ignore_unknown_keys() -> None:
    cfg = BalancerConfig.from_overrides({"w_bal": 2.0, "desconocida": 1})
    assert cfg.w_bal == 2.0 and cfg.w_prof == 0.3
    assert BalancerConfig.from_overrides(None) == BalancerConfig()


def test_edge_cases() -> None:
    with pytest.raises(ValueError):
        propose(build_context(squad([25]), WEIGHTS))
    ctx = build_context(squad([25, 25]), {})
    assert propose(ctx)[0].breakdown["profile"] == 0.0


def test_fifteen_players_in_under_300_ms() -> None:
    ctx = build_context([player(i, 20 + (i * 7) % 13, ("DEF", "MED", "DEL")[i % 3]) for i in range(15)], WEIGHTS)
    start = time.perf_counter()
    assert len(propose(ctx)) == 3
    assert time.perf_counter() - start < 0.3


@pytest.mark.parametrize("n", [9, 10, 11])
def test_vectorized_cost_matches_evaluate_partition_for_every_partition(n: int) -> None:
    import numpy as np

    from futbol.domain.balancer import _cost_vec, _membership

    players = [
        replace(
            player(i, 18 + (i * 5) % 11, ("POR", "DEF", "MED", "DEL", None)[i % 5], 1 + i % 9), goal_rate=i % 4 * 0.7
        )
        for i in range(n)
    ]
    history = [Partition(("p00", "p01", "p02", "p03"), ("p04", "p05", "p06", "p07", "ausente"))]
    ctx = build_context(players, WEIGHTS, history=history)
    ids = sorted(ctx.players)
    cost, diff = _cost_vec(_membership(ids), ids, ctx)
    expected = [evaluate_partition(p, ctx) for p in enumerate_partitions(ids)]
    assert np.allclose(cost, [e.cost for e in expected])
    assert np.allclose(diff, [abs(e.strength_a - e.strength_b) for e in expected])


def test_goalkeeper_rule_listed_when_infeasible() -> None:
    players = [player(i, 25, "POR" if i < 2 else "DEF") for i in range(6)]
    ctx = build_context(players, WEIGHTS, [Constraint("p00", "p01", "together")])
    with pytest.raises(InfeasibleConstraintsError) as exc:
        propose(ctx)
    assert "un portero por equipo" in exc.value.conflicts


def test_propose_avoids_repeating_last_match() -> None:
    players = squad([25] * 10)
    first = propose(build_context(players, WEIGHTS))[0]
    again = propose(build_context(players, WEIGHTS, history=[first.partition]))[0]
    assert again.partition != first.partition and again.breakdown["repeat"] < BalancerConfig().w_rep


def test_top_scorers_are_split_even_if_strengths_would_allow_them_together() -> None:
    """Los dos que más goles hacen no deberían quedar juntos (término "Goleadores")."""
    players = [replace(player(i, 25, "DEL"), goal_rate=5.0 if i in (0, 1) else 0.0) for i in range(10)]
    for e in propose(build_context(players, WEIGHTS)):
        assert ("p00" in e.partition.team_a) != ("p01" in e.partition.team_a)
        assert e.breakdown["goals"] == 0.0
    together = Partition(("p00", "p01", "p02", "p03", "p04"), ("p05", "p06", "p07", "p08", "p09"))
    assert evaluate_partition(together, build_context(players, WEIGHTS)).breakdown["goals"] == pytest.approx(0.2)


def test_without_goal_data_the_term_is_zero() -> None:
    e = propose(build_context(squad(VARIED[:10]), WEIGHTS))[0]
    assert e.breakdown["goals"] == 0.0
