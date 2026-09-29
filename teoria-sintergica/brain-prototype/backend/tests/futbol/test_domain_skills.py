"""ALGORITHMS §5.1 — tests obligatorios de domain/skills."""

from __future__ import annotations

from futbol.domain.skills import Skill, SkillRating, aggregate_skill_scores, composite

PLAYERS = ["a", "b", "c", "d", "e"]
OVERALL = Skill("s_overall", "overall", 3.0)
PACE = Skill("s_pace", "pace", 1.0)


def rating(skill: Skill, player: str, rater: str, value: int, admin: bool = False) -> SkillRating:
    return SkillRating(skill.id, player, rater, value, admin)


def test_player_without_ratings_is_unknown_and_worth_five() -> None:
    """Decisión del grupo: sin datos = 5 ("no sabemos cómo juega"), no la media del grupo."""
    ratings = [rating(PACE, p, r, v) for p, v in (("a", 8), ("b", 4)) for r in ("c", "d", "e")]
    scores = aggregate_skill_scores([PACE], PLAYERS, ratings)
    assert scores[("c", PACE.id)].source == "imputed"
    assert scores[("c", PACE.id)].value == 5.0
    assert scores[("c", PACE.id)].n_raters == 0


def test_nobody_has_data_everyone_is_five() -> None:
    scores = aggregate_skill_scores([PACE], PLAYERS, [])
    assert {s.value for s in scores.values()} == {5.0}


def test_self_rating_is_excluded_from_median() -> None:
    ratings = [rating(PACE, "a", r, 5) for r in ("b", "c", "d")] + [rating(PACE, "a", "a", 10)]
    score = aggregate_skill_scores([PACE], PLAYERS, ratings)[("a", PACE.id)]
    assert (score.value, score.n_raters, score.source) == (5.0, 3, "peers")


def test_two_peers_and_admin_uses_admin() -> None:
    ratings = [
        rating(PACE, "a", "b", 3),
        rating(PACE, "a", "c", 4),
        rating(PACE, "a", "d", 9, admin=True),
    ]
    score = aggregate_skill_scores([PACE], PLAYERS, ratings)[("a", PACE.id)]
    assert (score.value, score.source) == (9.0, "admin")


def test_three_peers_beat_admin_and_use_median() -> None:
    ratings = [
        rating(PACE, "a", "b", 3),
        rating(PACE, "a", "c", 4),
        rating(PACE, "a", "e", 8),
        rating(PACE, "a", "d", 9, admin=True),
    ]
    score = aggregate_skill_scores([PACE], PLAYERS, ratings)[("a", PACE.id)]
    assert (score.value, score.source) == (4.0, "peers")


def test_new_skill_without_ratings_keeps_composite_order() -> None:
    ratings = [rating(OVERALL, p, r, v) for p, v in (("a", 9), ("b", 5), ("c", 2)) for r in ("d", "e", "x")]
    before = aggregate_skill_scores([OVERALL], PLAYERS, ratings)
    new_skill = Skill("s_air", "aerial", 1.0)
    after = aggregate_skill_scores([OVERALL, new_skill], PLAYERS, ratings)

    def order(scores: dict, skills: list[Skill]) -> list[str]:  # type: ignore[type-arg]
        return sorted(PLAYERS, key=lambda p: composite(p, skills, scores))

    assert order(before, [OVERALL]) == order(after, [OVERALL, new_skill])


def test_zero_weight_or_inactive_skill_does_not_affect_composite() -> None:
    ratings = [rating(OVERALL, "a", r, 8) for r in ("b", "c", "d")] + [rating(PACE, "a", r, 1) for r in ("b", "c", "d")]
    zero = Skill("s_zero", "zero", 0.0)
    off = Skill("s_off", "off", 3.0, is_active=False)
    base = aggregate_skill_scores([OVERALL], PLAYERS, ratings)
    full = aggregate_skill_scores([OVERALL, zero, off], PLAYERS, ratings)
    assert composite("a", [OVERALL, zero, off], full) == composite("a", [OVERALL], base) == 8.0


def test_goalkeeping_is_excluded_from_composite() -> None:
    gk = Skill("s_gk", "goalkeeping", 3.0)
    ratings = [rating(OVERALL, "a", r, 8) for r in ("b", "c", "d")] + [rating(gk, "a", r, 1) for r in ("b", "c", "d")]
    scores = aggregate_skill_scores([OVERALL, gk], PLAYERS, ratings)
    assert composite("a", [OVERALL, gk], scores) == 8.0


def test_composite_is_weighted_average() -> None:
    ratings = [rating(OVERALL, "a", r, 8) for r in ("b", "c", "d")] + [rating(PACE, "a", r, 4) for r in ("b", "c", "d")]
    scores = aggregate_skill_scores([OVERALL, PACE], PLAYERS, ratings)
    assert composite("a", [OVERALL, PACE], scores) == (3 * 8 + 1 * 4) / 4


def test_composite_without_weighted_skills_returns_neutral_default() -> None:
    assert composite("a", [Skill("s_zero", "zero", 0.0)], {}) == 5.0
