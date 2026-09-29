"""Skills → puntaje compuesto (ALGORITHMS §1)."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from statistics import median
from typing import Literal

from futbol.domain.config import GOALKEEPING_KEY, MIN_RATERS, UNKNOWN_DEFAULT

Source = Literal["peers", "admin", "imputed"]


@dataclass(frozen=True)
class Skill:
    id: str
    key: str
    weight: float
    is_active: bool = True


@dataclass(frozen=True)
class SkillRating:
    skill_id: str
    player_id: str
    rater_player_id: str
    value: int
    rater_is_admin: bool = False


@dataclass(frozen=True)
class SkillScore:
    player_id: str
    skill_id: str
    value: float
    n_raters: int
    source: Source


def _resolve(ratings: Sequence[SkillRating], min_raters: int) -> tuple[float, int, Source] | None:
    """Peers si hay >= min_raters; si no, admin; si no, None (se imputa)."""
    peers = [r.value for r in ratings if not r.rater_is_admin]
    if len(peers) >= min_raters:
        return float(median(peers)), len(peers), "peers"
    admins = [r.value for r in ratings if r.rater_is_admin]
    if admins:
        return float(median(admins)), len(admins), "admin"
    return None


def aggregate_skill_scores(
    skills: Iterable[Skill],
    player_ids: Iterable[str],
    ratings: Iterable[SkillRating],
    *,
    min_raters: int = MIN_RATERS,
) -> dict[tuple[str, str], SkillScore]:
    """Un SkillScore por (jugador, skill activa). La autoevaluación no se agrega; sin datos → UNKNOWN_DEFAULT (5)."""
    players = list(player_ids)
    by_cell: dict[tuple[str, str], list[SkillRating]] = defaultdict(list)
    for r in ratings:
        if r.rater_player_id != r.player_id:
            by_cell[(r.player_id, r.skill_id)].append(r)

    scores: dict[tuple[str, str], SkillScore] = {}
    for skill in (s for s in skills if s.is_active):
        for p in players:
            res = _resolve(by_cell.get((p, skill.id), []), min_raters)
            value, n, source = res if res is not None else (UNKNOWN_DEFAULT, 0, "imputed")
            scores[(p, skill.id)] = SkillScore(p, skill.id, value, n, source)
    return scores


def composite(
    player_id: str,
    skills: Iterable[Skill],
    scores: Mapping[tuple[str, str], SkillScore],
) -> float:
    """C_i = Σ w_k·v_ik / Σ w_k sobre skills activas con w > 0, sin goalkeeping."""
    used = [s for s in skills if s.is_active and s.weight > 0 and s.key != GOALKEEPING_KEY]
    total_weight = sum(s.weight for s in used)
    if total_weight == 0:
        return UNKNOWN_DEFAULT
    return sum(s.weight * scores[(player_id, s.id)].value for s in used) / total_weight
