"""Fuerza de cada jugador y probabilidad de victoria (ALGORITHMS §2.1, §2.4 y §3.3). Puro.

En M3 la fuerza es el prior desde skills (sin resultados). En M5 el `mu` se actualiza con OpenSkill,
y `win_probability` se puede reemplazar por el `predictWin` de la librería.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import sqrt
from statistics import NormalDist, fmean, pstdev

MU_BASE = 25.0
PRIOR_SCALE = 3.0
SIGMA_BASE = 25.0 / 3.0
BETA = 25.0 / 6.0
GUEST_SIGMA_FACTOR = 1.5
EXTRA_PLAYER_FACTOR = 0.6


@dataclass(frozen=True)
class Rating:
    mu: float
    sigma: float


def prior_ratings(
    composites: Mapping[str, float],
    guest_levels: Mapping[str, float] | None = None,
    *,
    prior_scale: float = PRIOR_SCALE,
) -> dict[str, Rating]:
    """mu0 = MU_BASE + PRIOR_SCALE · z, con z calculado sobre los miembros (no invitados).

    Los invitados usan su nivel general como C, la misma media/sd del grupo y σ · 1.5.
    """
    values = list(composites.values())
    mean = fmean(values) if values else 0.0
    sd = pstdev(values) if len(values) > 1 else 0.0

    def mu(c: float) -> float:
        return MU_BASE + prior_scale * ((c - mean) / sd if sd > 0 else 0.0)

    out = {pid: Rating(mu(c), SIGMA_BASE) for pid, c in composites.items()}
    out.update({pid: Rating(mu(c), SIGMA_BASE * GUEST_SIGMA_FACTOR) for pid, c in (guest_levels or {}).items()})
    return out


def team_strength(values: Sequence[float], other_size: int, extra_factor: float = EXTRA_PLAYER_FACTOR) -> float:
    """S(T) = Σ s_i; si T tiene un jugador más que el rival, se descuenta (1 − factor) · media(s_T)."""
    total = sum(values)
    if values and len(values) > other_size:
        total -= (1 - extra_factor) * fmean(values)
    return total


def win_probability(
    team_a: Sequence[Rating], team_b: Sequence[Rating], extra_factor: float = EXTRA_PLAYER_FACTOR
) -> float:
    """P(gana A) con el modelo de Thurstone (normal) sobre las fuerzas ajustadas por jugador extra."""
    s_a = team_strength([r.mu for r in team_a], len(team_b), extra_factor)
    s_b = team_strength([r.mu for r in team_b], len(team_a), extra_factor)
    variance = sum(r.sigma**2 for r in (*team_a, *team_b)) + (len(team_a) + len(team_b)) * BETA**2
    return NormalDist().cdf((s_a - s_b) / sqrt(variance)) if variance > 0 else 0.5
