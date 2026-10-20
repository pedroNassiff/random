"""HU-08: import del plantel desde JSON."""

from __future__ import annotations

from dataclasses import replace
from typing import Any

import pytest

from futbol.application.errors import Invalid
from futbol.application.roster_import import RosterImporter, parse_roster
from tests.futbol.fakes import GROUP, FakeRepo

KEYS = {"overall", "pace", "goalkeeping"}


def roster(*players: Any, rated_by: str = "boss@x.com") -> dict[str, Any]:
    return {"rated_by": rated_by, "players": list(players)}


JUAN = {"display_name": "Juan", "email": "Juan@X.com", "preferred_position": "DEF", "skills": {"overall": 7}}
MARC = {"display_name": "Marc", "preferred_position": "POR", "skills": {"overall": 6, "goalkeeping": 9}}


def test_parse_normalizes_and_defaults_goalkeeper() -> None:
    r = parse_roster(roster(JUAN, MARC), KEYS)
    assert r.rated_by == "boss@x.com"
    assert r.players[0].email == "juan@x.com" and not r.players[0].can_play_gk
    assert r.players[1].can_play_gk and r.players[1].skills == {"overall": 6, "goalkeeping": 9}


def test_parse_reports_all_errors_at_once() -> None:
    bad = roster(
        {"display_name": "", "preferred_position": "GK"},
        {"display_name": "Ana", "skills": {"volea": 5, "pace": 11, "overall": True}, "edad": 30},
        {"display_name": "ana"},
        "no-es-objeto",
        {"display_name": "Leo", "skills": [1, 2]},
        rated_by="",
    )
    with pytest.raises(Invalid) as exc:
        parse_roster(bad, KEYS)
    msg = str(exc.value)
    for expected in (
        "falta rated_by",
        "falta display_name",
        "puesto 'GK' inválido",
        "skill desconocida 'volea'",
        "pace=11",
        "overall=True",
        "campo desconocido 'edad'",
        "jugador repetido: ana",
        "players[3]: tiene que ser un objeto",
        "skills tiene que ser un objeto",
    ):
        assert expected in msg


@pytest.mark.parametrize("data", [[], {"rated_by": "a@x.com", "players": []}, {"rated_by": "a@x.com"}])
def test_parse_rejects_wrong_shapes(data: Any) -> None:
    with pytest.raises(Invalid):
        parse_roster(data, KEYS)


def world() -> tuple[RosterImporter, FakeRepo]:
    repo = FakeRepo()
    for key in sorted(KEYS):
        repo.add_skill(key)
    boss = repo.add_player("Boss", email="boss@x.com")
    repo.users["boss@x.com"] = "u-boss"
    repo.members["u-boss"] = "admin"
    repo.player_user[boss.id] = "u-boss"
    return RosterImporter(repo), repo


async def test_import_creates_players_and_admin_ratings_then_is_idempotent() -> None:
    importer, repo = world()
    first = await importer.run(GROUP, roster(JUAN, MARC))
    assert (first.created, first.updated, first.ratings) == (["Juan", "Marc"], [], 3)
    juan = next(p for p in repo.players.values() if p.display_name == "Juan")
    assert (juan.email, juan.preferred_position) == ("juan@x.com", "DEF")
    ratings = await repo.list_group_ratings(GROUP)
    assert len(ratings) == 3 and all(r.rater_is_admin for r in ratings)

    again = await importer.run(GROUP, roster({**JUAN, "nickname": "Juancho", "skills": {"overall": 8}}, MARC))
    assert (again.created, again.updated) == ([], ["Juan", "Marc"])
    assert len(repo.players) == 3 and next(iter(p for p in repo.players.values() if p.nickname)).nickname == "Juancho"
    assert sorted(r.value for r in await repo.list_group_ratings(GROUP)) == [6, 8, 9]


async def test_dry_run_changes_nothing() -> None:
    importer, repo = world()
    report = await importer.run(GROUP, roster(JUAN), dry_run=True)
    assert report.created == ["Juan"] and report.ratings == 1
    assert len(repo.players) == 1 and repo.ratings == {}
    existing = await importer.run(GROUP, roster({"display_name": "Boss", "skills": {}}), dry_run=True)
    assert existing.updated == ["Boss"]


async def test_rating_the_admin_himself_warns_self_evaluation() -> None:
    importer, _ = world()
    report = await importer.run(GROUP, roster({"display_name": "Boss", "email": "boss@x.com", "skills": {"pace": 5}}))
    assert "autoevaluación" in report.warnings[0]


async def test_rater_must_be_an_admin_with_a_player_in_file_or_db() -> None:
    importer, repo = world()
    with pytest.raises(Invalid, match="tiene que ser un admin"):
        await importer.run(GROUP, roster(JUAN, rated_by="nadie@x.com"))
    repo.members["u-boss"] = "member"
    with pytest.raises(Invalid, match="tiene que ser un admin"):
        await importer.run(GROUP, roster(JUAN))
    repo.members["u-boss"] = "admin"
    repo.player_user.clear()
    boss = next(p for p in repo.players.values() if p.email == "boss@x.com")
    repo.players[boss.id] = replace(boss, email=None)
    with pytest.raises(Invalid, match="agregá al archivo un jugador con ese email"):
        await importer.run(GROUP, roster(JUAN))
    assert len(repo.players) == 1  # validó antes de escribir


async def test_import_links_the_rater_when_a_player_has_its_email() -> None:
    importer, repo = world()
    repo.player_user.clear()  # admin sin jugador vinculado (como en prod recién migrado)
    boss_id = next(p.id for p in repo.players.values() if p.email == "boss@x.com")
    simulated = await importer.run(GROUP, roster(JUAN), dry_run=True)
    assert simulated.ratings == 1 and repo.player_user == {}
    await importer.run(GROUP, roster(JUAN))
    assert repo.player_user == {boss_id: "u-boss"}
    assert {r.rater_player_id for r in await repo.list_group_ratings(GROUP)} == {boss_id}


async def test_import_links_the_rater_from_a_new_player_in_the_file() -> None:
    importer, repo = world()
    repo.player_user.clear()
    repo.players.clear()
    report = await importer.run(GROUP, roster({"display_name": "Boss", "email": "boss@x.com"}, JUAN))
    boss = next(p for p in repo.players.values() if p.display_name == "Boss")
    assert report.created == ["Boss", "Juan"] and repo.player_user == {boss.id: "u-boss"}
