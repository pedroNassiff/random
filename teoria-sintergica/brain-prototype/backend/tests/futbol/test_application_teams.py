"""UC-05/06/07/13 con repositorios en memoria."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.match_service import MatchService
from futbol.application.ports import Actor
from futbol.application.teams_service import TeamsService
from futbol.domain.balancer import Partition
from futbol.domain.models import Player
from futbol.domain.schedule import ScheduleConfig, window_for
from futbol.domain.results import MatchResult
from tests.futbol.fakes import GROUP, FakeMatchRepo, FakeRepo, FakeResultsRepo, FakeTeamsRepo

MAD = ZoneInfo("Europe/Madrid")
ADMIN = Actor("u-admin", GROUP, "admin", "boss@x.com", None, True)
MEMBER = Actor("u-m", GROUP, "member", "m@x.com", None, True)
THU = datetime(2026, 9, 24, 10, tzinfo=MAD)


class World:
    def __init__(self, n: int = 10, capacity: int = 12) -> None:
        self.roster, self.match_repo = FakeRepo(), FakeMatchRepo(ScheduleConfig(capacity=capacity))
        self.teams_repo = FakeTeamsRepo(self.match_repo)
        self.now = THU
        self.matches = MatchService(self.match_repo, self.roster, lambda: self.now, teams=self.teams_repo)
        self.results_repo = FakeResultsRepo(self.match_repo, self.teams_repo)
        self.teams = TeamsService(self.teams_repo, self.match_repo, self.roster, self.results_repo)
        overall = self.roster.add_skill("overall", 3.0)
        self.roster.add_skill("goalkeeping", 0.0)
        raters = [self.roster.add_player(f"R{i}", active=False) for i in range(3)]
        self.players: list[Player] = []
        for i in range(n):
            p = self.roster.add_player(f"J{i:02d}", preferred_position=("DEF", "MED", "DEL")[i % 3])
            for r in raters:
                self.roster.ratings[(overall.id, p.id, r.id)] = 3 + (i * 7) % 7
            self.players.append(p)
        self.match = self.match_repo.add_match(window_for(date(2026, 9, 30), ScheduleConfig()))

    async def sign_all(self, players: list[Player] | None = None) -> None:
        for p in players or self.players:
            self.now += timedelta(minutes=1)
            await self.matches.join(ADMIN, self.match.id, p.id)


async def test_generate_three_diverse_proposals_for_ten() -> None:
    w = World(10)
    await w.sign_all()
    view = await w.teams.generate(ADMIN, w.match.id)
    assert len(view.proposals) == 3
    assert all(len(e.partition.team_a) == 5 and len(e.partition.team_b) == 5 for e in view.proposals)
    assert set(view.players) == {p.id for p in w.players}
    assert all(p.strength is not None for p in view.players.values())
    assert view.published is None and view.share_text is None


async def test_eleven_gives_five_and_six() -> None:
    w = World(11)
    await w.sign_all()
    e = (await w.teams.generate(ADMIN, w.match.id)).proposals[0]
    assert (len(e.partition.team_a), len(e.partition.team_b)) == (5, 6)


async def test_member_sees_no_proposals_nor_strengths() -> None:
    w = World(10)
    await w.sign_all()
    await w.teams.generate(ADMIN, w.match.id)
    view = await w.teams.view(MEMBER, w.match.id)
    assert view.proposals == [] and all(p.strength is None for p in view.players.values())
    with pytest.raises(Forbidden):
        await w.teams.generate(MEMBER, w.match.id)
    with pytest.raises(Forbidden):
        await w.teams.publish(MEMBER, w.match.id, [], [])


async def test_evaluate_manual_move_and_publish_with_share_text() -> None:
    w = World(10)
    await w.sign_all()
    best = (await w.teams.generate(ADMIN, w.match.id)).proposals[0]
    a, b = list(best.partition.team_a), list(best.partition.team_b)
    moved_a, moved_b = a[1:], [*b, a[0]]
    manual = await w.teams.evaluate(ADMIN, w.match.id, moved_a, moved_b)
    assert (len(manual.partition.team_a), len(manual.partition.team_b)) == (4, 6)
    assert manual.cost >= best.cost

    view = await w.teams.publish(ADMIN, w.match.id, a, b)
    assert view.match.status == "teams_published" and view.published == best.partition
    assert view.published_eval is not None and view.share_text is not None
    lines = view.share_text.splitlines()
    assert lines[0] == "⚽ Fútbol miércoles 30/09 — 20:00" and lines[1] == "⬜ BLANCOS" and "%" not in view.share_text
    member_view = await w.teams.view(MEMBER, w.match.id)
    assert member_view.published == best.partition and member_view.share_text == view.share_text


async def test_teams_must_split_exactly_the_confirmed() -> None:
    w = World(10)
    await w.sign_all()
    ids = [p.id for p in w.players]
    for a, b in ((ids[:5], ids[5:9]), (ids[:6], ids[5:]), ([], ids), (ids[:5], [*ids[5:], "intruso"])):
        with pytest.raises(Invalid, match="exactamente a los convocados"):
            await w.teams.evaluate(ADMIN, w.match.id, a, b)


async def test_signup_change_invalidates_proposals() -> None:
    w = World(12)
    await w.sign_all(w.players[:11])
    await w.teams.generate(ADMIN, w.match.id)
    assert w.teams_repo.proposals
    await w.matches.join(ADMIN, w.match.id, w.players[11].id)
    assert w.match.id not in w.teams_repo.proposals


async def test_too_few_players_and_finished_match() -> None:
    w = World(3)
    await w.sign_all()
    with pytest.raises(Invalid, match="al menos 4"):
        await w.teams.generate(ADMIN, w.match.id)
    with pytest.raises(NotFound):
        await w.teams.view(ADMIN, "nope")
    played = w.match_repo.add_match(window_for(date(2026, 9, 16), ScheduleConfig()), "played")
    with pytest.raises(Invalid, match="ya no admite"):
        await w.teams.generate(ADMIN, played.id)
    with pytest.raises(Invalid, match="ya no admite"):
        await w.teams.publish(ADMIN, played.id, [], [])


async def test_view_without_signups_is_empty() -> None:
    w = World(4)
    view = await w.teams.view(ADMIN, w.match.id)
    assert view.players == {} and view.proposals == [] and view.published_eval is None


async def test_constraints_crud_and_effect() -> None:
    w = World(10)
    await w.sign_all()
    a, b = w.players[0].id, w.players[1].id
    c = await w.teams.add_constraint(ADMIN, a, b, "together")
    assert [x.id for x in await w.teams.constraints(ADMIN)] == [c.id]
    for e in (await w.teams.generate(ADMIN, w.match.id)).proposals:
        assert (a in e.partition.team_a) == (b in e.partition.team_a)
    with pytest.raises(Invalid, match="Ya hay"):
        await w.teams.add_constraint(ADMIN, b, a, "apart")
    with pytest.raises(Invalid, match="distintos"):
        await w.teams.add_constraint(ADMIN, a, a, "apart")
    with pytest.raises(NotFound):
        await w.teams.add_constraint(ADMIN, a, "nadie", "apart")
    with pytest.raises(Forbidden):
        await w.teams.constraints(MEMBER)
    await w.teams.delete_constraint(ADMIN, c.id)
    with pytest.raises(NotFound):
        await w.teams.delete_constraint(ADMIN, c.id)


async def test_impossible_constraints_are_reported() -> None:
    w = World(10)
    await w.sign_all()
    ids = [p.id for p in w.players]
    for other in ids[1:6]:  # 6 jugadores "siempre juntos" no entran en un equipo de 5
        await w.teams.add_constraint(ADMIN, ids[0], other, "together")
    with pytest.raises(Invalid, match="no se pueden cumplir"):
        await w.teams.generate(ADMIN, w.match.id)


async def test_cron_generates_pending_and_skips_what_it_cannot() -> None:
    w = World(10)
    await w.sign_all()
    w.match_repo.matches[w.match.id] = w.match_repo.matches[w.match.id].__class__(
        w.match.id, w.match.starts_at, w.match.signup_closes_at, "closed"
    )
    small = w.match_repo.add_match(window_for(date(2026, 10, 7), ScheduleConfig()), "closed")
    assert await w.teams.generate_pending(GROUP) == 1
    assert len(w.teams_repo.proposals[w.match.id]) == 3 and small.id not in w.teams_repo.proposals
    assert await w.teams.generate_pending(GROUP) == 0


async def test_previous_teams_penalize_repeating() -> None:
    w = World(10)
    await w.sign_all()
    previous = w.match_repo.add_match(window_for(date(2026, 9, 23), ScheduleConfig()), "played")
    first = (await w.teams.generate(ADMIN, w.match.id)).proposals[0]
    w.teams_repo.teams[previous.id] = first.partition
    again = (await w.teams.generate(ADMIN, w.match.id)).proposals[0]
    assert again.partition != first.partition or again.breakdown["repeat"] > 0


async def test_guests_and_balancer_overrides() -> None:
    w = World(9)
    guest = w.roster.add_player("Invitado", is_guest=True, guest_level=9)
    await w.sign_all([*w.players, guest])
    w.teams_repo.overrides = {"n_proposals": 1}
    view = await w.teams.generate(ADMIN, w.match.id)
    assert len(view.proposals) == 1 and guest.id in view.players


async def test_scorers_from_previous_matches_end_up_split() -> None:
    w = World(10)
    await w.sign_all()
    scorer_a, scorer_b = w.players[0].id, w.players[1].id
    previous = w.match_repo.add_match(window_for(date(2026, 9, 23), ScheduleConfig()), "teams_published")
    lineup = Partition((scorer_a, scorer_b), tuple(p.id for p in w.players[2:]))
    await w.results_repo.save_result(previous.id, MatchResult(10, 0), lineup, "u-admin", {scorer_a: 5, scorer_b: 5})
    for e in (await w.teams.generate(ADMIN, w.match.id)).proposals:
        assert (scorer_a in e.partition.team_a) != (scorer_b in e.partition.team_a)
