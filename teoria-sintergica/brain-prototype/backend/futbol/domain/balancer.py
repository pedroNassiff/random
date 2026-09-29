"""Balanceador de equipos (ALGORITHMS §3). Puro y determinista.

Enumera todas las particiones, descarta las que violan restricciones duras, calcula el costo J y
devuelve las mejores propuestas con diversidad. `evaluate_partition` sirve también para los
movimientos manuales del admin.

`propose` calcula el costo de todas las particiones juntas con numpy (n = 20 son 92.378 particiones,
presupuesto < 300 ms) y después arma el desglose de las elegidas con `evaluate_partition`, la misma
fórmula en Python puro.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field, fields, replace
from itertools import combinations
from math import sqrt
from statistics import fmean, pstdev
from typing import Any, Literal

import numpy as np
from numpy.typing import NDArray

from futbol.domain.config import UNKNOWN_DEFAULT
from futbol.domain.strength import EXTRA_PLAYER_FACTOR, Rating, team_strength, win_probability

ConstraintKind = Literal["apart", "together"]
POSITIONS = ("POR", "DEF", "MED", "DEL")


@dataclass(frozen=True)
class BalancerConfig:
    w_bal: float = 1.0
    w_prof: float = 0.3
    w_pos: float = 0.2
    w_gk: float = 0.3
    w_rep: float = 0.15
    w_goals: float = 0.2
    extra_player_factor: float = EXTRA_PLAYER_FACTOR
    n_proposals: int = 3
    min_diff: int = 2
    k_repeat: int = 3
    enforce_goalkeepers: bool = True

    @classmethod
    def from_overrides(cls, overrides: Mapping[str, Any] | None) -> BalancerConfig:
        """Aplica `groups.balancer_config` ignorando claves desconocidas."""
        known = {f.name for f in fields(cls)}
        return replace(cls(), **{k: v for k, v in (overrides or {}).items() if k in known})


@dataclass(frozen=True)
class BalancerPlayer:
    id: str
    rating: Rating
    profile: Mapping[str, float] = field(default_factory=dict)
    position: str | None = None
    goalkeeping: float = 1.0
    goal_rate: float = 0.0
    """Goles por partido (promedio reciente). 0 si no hay datos."""


@dataclass(frozen=True)
class Constraint:
    a: str
    b: str
    kind: ConstraintKind


@dataclass(frozen=True)
class Partition:
    team_a: tuple[str, ...]
    team_b: tuple[str, ...]


@dataclass(frozen=True)
class Evaluation:
    partition: Partition
    cost: float
    breakdown: dict[str, float]
    strength_a: float
    strength_b: float
    win_prob_a: float


class InfeasibleConstraintsError(ValueError):
    def __init__(self, conflicts: list[str]) -> None:
        self.conflicts = conflicts
        super().__init__("Ninguna división cumple las restricciones: " + "; ".join(conflicts))


@dataclass(frozen=True)
class Context:
    players: Mapping[str, BalancerPlayer]
    skill_weights: Mapping[str, float]
    constraints: Sequence[Constraint]
    history: Sequence[Partition]
    config: BalancerConfig
    scale: float


def build_context(
    players: Sequence[BalancerPlayer],
    skill_weights: Mapping[str, float],
    constraints: Sequence[Constraint] = (),
    history: Sequence[Partition] = (),
    config: BalancerConfig | None = None,
) -> Context:
    cfg = config or BalancerConfig()
    ids = {p.id for p in players}
    strengths = [p.rating.mu for p in players]
    sd = pstdev(strengths) if len(strengths) > 1 else 0.0
    return Context(
        players={p.id: p for p in players},
        skill_weights={k: w for k, w in skill_weights.items() if w > 0},
        constraints=[c for c in constraints if c.a in ids and c.b in ids],
        history=list(history)[: cfg.k_repeat],
        config=cfg,
        scale=sqrt(len(players)) * sd if sd > 0 else 1.0,
    )


# ── enumeración ─────────────────────────────────────────────────────────────
def enumerate_partitions(player_ids: Sequence[str]) -> Iterator[Partition]:
    """A tiene floor(n/2). Con n par se fija el primer id en A para no contar espejos."""
    ids = sorted(player_ids)
    k = len(ids) // 2
    if len(ids) % 2 == 0:
        first, rest = ids[0], ids[1:]
        for combo in combinations(rest, k - 1):
            a = (first, *combo)
            yield Partition(a, tuple(i for i in ids if i not in a))
    else:
        for a in combinations(ids, k):
            yield Partition(a, tuple(i for i in ids if i not in a))


# ── restricciones duras ─────────────────────────────────────────────────────
def _goalkeepers(ctx: Context) -> set[str]:
    return {p.id for p in ctx.players.values() if p.position == "POR"}


# ── costo ───────────────────────────────────────────────────────────────────
def _profile_term(a: Sequence[BalancerPlayer], b: Sequence[BalancerPlayer], weights: Mapping[str, float]) -> float:
    total_w = sum(weights.values())
    if total_w == 0:
        return 0.0
    diff = sum(
        w
        * abs(fmean(p.profile.get(k, UNKNOWN_DEFAULT) for p in a) - fmean(p.profile.get(k, UNKNOWN_DEFAULT) for p in b))
        for k, w in weights.items()
    )
    return diff / (9 * total_w)


def _position_term(a: Sequence[BalancerPlayer], b: Sequence[BalancerPlayer]) -> float:
    n = len(a) + len(b)
    return sum(abs(sum(p.position == pos for p in a) - sum(p.position == pos for p in b)) for pos in POSITIONS) / n


def _jaccard(x: set[str], y: set[str]) -> float:
    return len(x & y) / len(x | y) if x | y else 0.0


def overlap(p: Partition, previous: Partition) -> float:
    """Jaccard medio de ambos lados, tomando la mejor asignación de lados. 1 = mismos equipos."""
    a, b = set(p.team_a), set(p.team_b)
    pa, pb = set(previous.team_a), set(previous.team_b)
    straight = (_jaccard(a, pa) + _jaccard(b, pb)) / 2
    swapped = (_jaccard(a, pb) + _jaccard(b, pa)) / 2
    return max(straight, swapped)


def _goals_term(a: Sequence[BalancerPlayer], b: Sequence[BalancerPlayer]) -> float:
    """Reparto de goles esperados: 0 si están parejos, 1 si un equipo concentra todos."""
    total = sum(x.goal_rate for x in (*a, *b))
    return abs(sum(x.goal_rate for x in a) - sum(x.goal_rate for x in b)) / total if total > 0 else 0.0


def evaluate_partition(p: Partition, ctx: Context) -> Evaluation:
    cfg = ctx.config
    a = [ctx.players[i] for i in p.team_a]
    b = [ctx.players[i] for i in p.team_b]
    s_a = team_strength([x.rating.mu for x in a], len(b), cfg.extra_player_factor)
    s_b = team_strength([x.rating.mu for x in b], len(a), cfg.extra_player_factor)
    breakdown = {
        "balance": cfg.w_bal * abs(s_a - s_b) / ctx.scale,
        "profile": cfg.w_prof * _profile_term(a, b, ctx.skill_weights),
        "positions": cfg.w_pos * _position_term(a, b),
        "goalkeeping": cfg.w_gk * abs(max(x.goalkeeping for x in a) - max(x.goalkeeping for x in b)) / 9,
        "repeat": cfg.w_rep * max((overlap(p, h) for h in ctx.history), default=0.0),
        "goals": cfg.w_goals * _goals_term(a, b),
    }
    win = win_probability([x.rating for x in a], [x.rating for x in b], cfg.extra_player_factor)
    return Evaluation(p, sum(breakdown.values()), breakdown, s_a, s_b, win)


# ── propuestas ──────────────────────────────────────────────────────────────
def _conflicts(ctx: Context) -> list[str]:
    out = [f"{c.a} {'con' if c.kind == 'together' else 'separado de'} {c.b}" for c in ctx.constraints]
    if ctx.config.enforce_goalkeepers and len(_goalkeepers(ctx)) >= 2:
        out.append("un portero por equipo")
    return out


def _membership(ids: list[str]) -> NDArray[np.bool_]:
    """Matriz (particiones × jugadores): True si el jugador va en A. Mismo orden que `enumerate_partitions`."""
    n, k = len(ids), len(ids) // 2
    if n % 2 == 0:
        combos = list(combinations(range(1, n), k - 1))
        rest = np.array(combos, dtype=np.intp).reshape(len(combos), k - 1)
        cols = np.hstack([np.zeros((len(combos), 1), dtype=np.intp), rest])
    else:
        combos = list(combinations(range(n), k))
        cols = np.array(combos, dtype=np.intp).reshape(len(combos), k)
    member = np.zeros((len(cols), n), dtype=bool)
    np.put_along_axis(member, cols, True, axis=1)
    return member


def _feasible_mask(member: NDArray[np.bool_], ids: list[str], ctx: Context) -> NDArray[np.bool_]:
    index = {pid: i for i, pid in enumerate(ids)}
    ok = np.ones(len(member), dtype=bool)
    for c in ctx.constraints:
        same = member[:, index[c.a]] == member[:, index[c.b]]
        ok &= same if c.kind == "together" else ~same
    gks = [index[g] for g in sorted(_goalkeepers(ctx))]
    if ctx.config.enforce_goalkeepers and len(gks) >= 2:
        in_a = member[:, gks]
        ok &= in_a.any(axis=1) & (~in_a).any(axis=1)
    return ok


def _jaccard_vec(inter: NDArray[np.float64], size: int, other: int) -> NDArray[np.float64]:
    union = size + other - inter
    return np.divide(inter, union, out=np.zeros_like(inter), where=union > 0)


def _repeat_vec(member: NDArray[np.bool_], ids: list[str], ctx: Context) -> NDArray[np.float64]:
    ka, kb = int(member[0].sum()), len(ids) - int(member[0].sum())
    best = np.zeros(len(member))
    for h in ctx.history:
        ha = np.array([i in h.team_a for i in ids], dtype=float)
        hb = np.array([i in h.team_b for i in ids], dtype=float)
        a, b = member.astype(float), (~member).astype(float)
        straight = (_jaccard_vec(a @ ha, ka, len(h.team_a)) + _jaccard_vec(b @ hb, kb, len(h.team_b))) / 2
        swapped = (_jaccard_vec(a @ hb, ka, len(h.team_b)) + _jaccard_vec(b @ ha, kb, len(h.team_a))) / 2
        best = np.maximum(best, np.maximum(straight, swapped))
    return best


def _cost_vec(
    member: NDArray[np.bool_], ids: list[str], ctx: Context
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Costo J y |S(A) − S(B)| de todas las particiones (misma fórmula que `evaluate_partition`)."""
    cfg, players = ctx.config, [ctx.players[i] for i in ids]
    a, b = member.astype(float), (~member).astype(float)
    ka, kb = int(member[0].sum()), len(ids) - int(member[0].sum())
    mu = np.array([p.rating.mu for p in players])
    s_a, s_b = a @ mu, b @ mu
    if ka > kb:
        s_a -= (1 - cfg.extra_player_factor) * s_a / ka
    if kb > ka:
        s_b -= (1 - cfg.extra_player_factor) * s_b / kb
    diff = np.abs(s_a - s_b)
    cost = cfg.w_bal * diff / ctx.scale
    keys, weights = list(ctx.skill_weights), np.array(list(ctx.skill_weights.values()))
    if keys:
        prof = np.array([[p.profile.get(k, UNKNOWN_DEFAULT) for k in keys] for p in players])
        cost += cfg.w_prof * (np.abs((a @ prof) / ka - (b @ prof) / kb) @ weights) / (9 * weights.sum())
    onehot = np.array([[p.position == pos for pos in POSITIONS] for p in players], dtype=float)
    cost += cfg.w_pos * np.abs(a @ onehot - b @ onehot).sum(axis=1) / len(ids)
    gk = np.array([p.goalkeeping for p in players])
    max_a = np.where(member, gk, -np.inf).max(axis=1)
    max_b = np.where(~member, gk, -np.inf).max(axis=1)
    cost += cfg.w_gk * np.abs(max_a - max_b) / 9
    rates = np.array([p.goal_rate for p in players])
    if rates.sum() > 0:
        cost += cfg.w_goals * np.abs(a @ rates - b @ rates) / rates.sum()
    return cost + cfg.w_rep * _repeat_vec(member, ids, ctx), diff


def propose(ctx: Context) -> list[Evaluation]:
    """Top `n_proposals` por J con diversidad: cada una difiere en ≥ `min_diff` jugadores del lado A.

    Desempate: menor |S(A) − S(B)| y después orden lexicográfico de A (= orden de enumeración).
    """
    if len(ctx.players) < 2:
        raise ValueError("Hacen falta al menos 2 jugadores.")
    ids = sorted(ctx.players)
    member = _membership(ids)
    feasible = np.flatnonzero(_feasible_mask(member, ids, ctx))
    if feasible.size == 0:
        raise InfeasibleConstraintsError(_conflicts(ctx))
    cost, diff = _cost_vec(member[feasible], ids, ctx)
    order = feasible[np.lexsort((feasible, np.round(diff, 9), np.round(cost, 9)))]
    chosen: list[Evaluation] = []
    for row in order:
        side = {ids[i] for i in np.flatnonzero(member[row])}
        if all(len(side - set(c.partition.team_a)) >= ctx.config.min_diff for c in chosen):
            team_a = tuple(sorted(side))
            chosen.append(evaluate_partition(Partition(team_a, tuple(i for i in ids if i not in side)), ctx))
        if len(chosen) == ctx.config.n_proposals:
            break
    return chosen
