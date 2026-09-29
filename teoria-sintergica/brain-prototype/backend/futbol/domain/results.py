"""Resultados (ALGORITHMS §4). Puro."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

from futbol.domain.balancer import Partition
from futbol.domain.models import Match

CLOSE_MARGIN = 2
MAX_GOALS = 99


@dataclass(frozen=True)
class MatchResult:
    goals_a: int
    goals_b: int
    notes: str = ""


@dataclass(frozen=True)
class PlayedMatch:
    match: Match
    result: MatchResult
    lineup: Partition
    goals: Mapping[str, int] = field(default_factory=dict)
    """Goles por jugador (opcional: solo los que se cargaron)."""


def is_close(result: MatchResult) -> bool:
    """ "Parejo": diferencia de goles ≤ 2."""
    return abs(result.goals_a - result.goals_b) <= CLOSE_MARGIN


def valid_goals(goals: int) -> bool:
    return 0 <= goals <= MAX_GOALS


GOAL_RATE_WINDOW = 10
"""Promedio de goles por partido sobre los últimos N partidos con dato (término "Goleadores")."""


def player_goals_error(result: MatchResult, lineup: Partition, goals: Mapping[str, int]) -> str | None:
    """Los goles por jugador son opcionales, pero si se cargan: de jugadores que jugaron, 0–99, y los de un
    equipo no pueden sumar más que el resultado del equipo (pueden sumar menos: goles en contra, datos parciales)."""
    if not set(goals) <= set(lineup.team_a) | set(lineup.team_b):
        return "Hay goles cargados para alguien que no jugó."
    if any(not valid_goals(g) for g in goals.values()):
        return "Los goles de cada jugador van de 0 a 99."
    for team, total, name in ((lineup.team_a, result.goals_a, "Blancos"), (lineup.team_b, result.goals_b, "Negros")):
        if sum(goals.get(p, 0) for p in team) > total:
            return f"Los goles de los jugadores de {name} suman más que el resultado ({total})."
    return None
