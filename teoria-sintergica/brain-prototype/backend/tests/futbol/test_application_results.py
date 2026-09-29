"""UC-08 (cargar resultado) e historial."""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import Actor
from futbol.application.results_service import ResultsService
from futbol.domain.balancer import Partition
from futbol.domain.models import Match, Signup
from futbol.domain.results import MatchResult, is_close, player_goals_error
from futbol.domain.schedule import ScheduleConfig, window_for
from tests.futbol.fakes import GROUP, FakeMatchRepo, FakeRepo, FakeResultsRepo, FakeTeamsRepo

MAD = ZoneInfo("Europe/Madrid")
ADMIN = Actor("u-admin", GROUP, "admin", "boss@x.com", None, True)
MEMBER = Actor("u-m", GROUP, "member", "m@x.com", None, True)


class World:
    def __init__(self) -> None:
        self.roster, self.matches = FakeRepo(), FakeMatchRepo(ScheduleConfig())
        self.teams = FakeTeamsRepo(self.matches)
        self.results = FakeResultsRepo(self.matches, self.teams)
        self.svc = ResultsService(self.results, self.matches, self.teams, self.roster)
        self.players = [self.roster.add_player(n) for n in ("Ana", "Beto", "Caro", "Dani", "Eli")]
        self.match = self.matches.add_match(window_for(date(2026, 9, 30), ScheduleConfig()), "teams_published")
        self.ids = [p.id for p in self.players]
        self.teams.teams[self.match.id] = Partition(tuple(self.ids[:2]), tuple(self.ids[2:4]))


def test_is_close() -> None:
    assert is_close(MatchResult(5, 3)) and is_close(MatchResult(0, 0)) and not is_close(MatchResult(6, 3))


async def test_form_starts_from_published_teams() -> None:
    w = World()
    form = await w.svc.form(ADMIN, w.match.id)
    assert [p.display_name for p in form.team_a] == ["Ana", "Beto"]
    assert [p.display_name for p in form.team_b] == ["Caro", "Dani"]
    assert form.result is None and len(form.roster) == 5


async def test_form_without_published_teams_puts_confirmed_in_a() -> None:
    w = World()
    del w.teams.teams[w.match.id]
    w.matches.signups[w.match.id] = {
        w.ids[0]: Signup(w.ids[0], "confirmed", datetime(2026, 9, 25, tzinfo=MAD)),
        w.ids[1]: Signup(w.ids[1], "waitlist", datetime(2026, 9, 26, tzinfo=MAD)),
    }
    form = await w.svc.form(ADMIN, w.match.id)
    assert [p.id for p in form.team_a] == [w.ids[0]] and form.team_b == []


async def test_record_saves_lineup_marks_played_opens_next_and_history() -> None:
    w = World()
    # Ana faltó y vino Eli sin anotarse
    form = await w.svc.record(ADMIN, w.match.id, MatchResult(5, 4, "golazo"), [w.ids[1], w.ids[4]], w.ids[2:4])
    assert form.result == MatchResult(5, 4, "golazo")
    assert w.matches.matches[w.match.id].status == "played"
    assert w.results.recorded_by[w.match.id] == "u-admin"
    upcoming = [m for m in w.matches.matches.values() if m.starts_at > w.match.starts_at]
    assert [m.starts_at for m in upcoming] == [datetime(2026, 10, 7, 20, tzinfo=MAD)]

    history = await w.svc.history(MEMBER)
    assert len(history) == 1 and history[0].close
    assert [p.display_name for p in history[0].team_a] == ["Beto", "Eli"]


async def test_editing_a_result_again_is_allowed() -> None:
    w = World()
    await w.svc.record(ADMIN, w.match.id, MatchResult(1, 1), w.ids[:2], w.ids[2:4])
    await w.svc.record(ADMIN, w.match.id, MatchResult(2, 1), w.ids[:2], w.ids[2:4])
    assert (await w.svc.history(MEMBER))[0].result == MatchResult(2, 1)


async def test_validations_and_permissions() -> None:
    w = World()
    with pytest.raises(Forbidden):
        await w.svc.form(MEMBER, w.match.id)
    with pytest.raises(Forbidden):
        await w.svc.record(MEMBER, w.match.id, MatchResult(1, 0), w.ids[:1], w.ids[1:2])
    with pytest.raises(NotFound):
        await w.svc.form(ADMIN, "nope")
    with pytest.raises(Invalid, match="0 a 99"):
        await w.svc.record(ADMIN, w.match.id, MatchResult(-1, 0), w.ids[:1], w.ids[1:2])
    with pytest.raises(Invalid, match="al menos un jugador"):
        await w.svc.record(ADMIN, w.match.id, MatchResult(1, 0), [], w.ids[1:2])
    with pytest.raises(Invalid, match="los dos equipos"):
        await w.svc.record(ADMIN, w.match.id, MatchResult(1, 0), w.ids[:2], w.ids[1:3])
    with pytest.raises(NotFound, match="Jugador"):
        await w.svc.record(ADMIN, w.match.id, MatchResult(1, 0), w.ids[:1], ["fantasma"])
    cancelled = w.matches.add_match(window_for(date(2026, 9, 16), ScheduleConfig()), "cancelled")
    with pytest.raises(Invalid, match="cancelado"):
        await w.svc.record(ADMIN, cancelled.id, MatchResult(1, 0), w.ids[:1], w.ids[1:2])


async def test_history_tolerates_deleted_players_and_orders_newest_first() -> None:
    w = World()
    old = w.matches.add_match(window_for(date(2026, 9, 23), ScheduleConfig()), "teams_published")
    await w.svc.record(ADMIN, old.id, MatchResult(9, 1), w.ids[:1], w.ids[1:2])
    await w.svc.record(ADMIN, w.match.id, MatchResult(3, 3), w.ids[:1], w.ids[1:2])
    del w.roster.players[w.ids[0]]
    history = await w.svc.history(MEMBER)
    assert [h.result.goals_a for h in history] == [3, 9] and not history[1].close
    assert history[0].team_a[0].display_name == "Jugador"
    assert isinstance(history[0].match, Match)


def test_player_goals_validation() -> None:
    lineup = Partition(("a", "b"), ("c",))
    assert player_goals_error(MatchResult(3, 1), lineup, {"a": 2, "b": 1, "c": 1}) is None
    assert player_goals_error(MatchResult(3, 1), lineup, {"a": 1}) is None  # parciales o en contra: OK
    assert "no jugó" in (player_goals_error(MatchResult(3, 1), lineup, {"z": 1}) or "")
    assert "0 a 99" in (player_goals_error(MatchResult(3, 1), lineup, {"a": -1}) or "")
    assert "Blancos suman más" in (player_goals_error(MatchResult(1, 1), lineup, {"a": 1, "b": 1}) or "")
    assert "Negros suman más" in (player_goals_error(MatchResult(1, 0), lineup, {"c": 1}) or "")


async def test_record_player_goals_show_in_form_history_and_rates() -> None:
    w = World()
    goals = {w.ids[0]: 3, w.ids[2]: 1}
    form = await w.svc.record(ADMIN, w.match.id, MatchResult(4, 2), w.ids[:2], w.ids[2:4], goals)
    assert {p.id: p.goals for p in form.team_a} == {w.ids[0]: 3, w.ids[1]: None}
    entry = (await w.svc.history(MEMBER))[0]
    assert {p.display_name: p.goals for p in entry.team_a + entry.team_b} == {
        "Ana": 3,
        "Beto": None,
        "Caro": 1,
        "Dani": None,
    }
    assert await w.results.goal_rates(GROUP, 10) == {w.ids[0]: 3.0, w.ids[2]: 1.0}
    with pytest.raises(Invalid, match="suman más"):
        await w.svc.record(ADMIN, w.match.id, MatchResult(1, 2), w.ids[:2], w.ids[2:4], goals)
