from __future__ import annotations

from dataclasses import replace

import pytest

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import Actor
from futbol.application.roster_service import RosterService
from futbol.domain.models import Player, SkillInfo
from tests.futbol.fakes import GROUP, FakeRepo

ADMIN = Actor("u-admin", GROUP, "admin", "boss@x.com", None)


def member(player_id: str | None) -> Actor:
    return Actor("u-m", GROUP, "member", "m@x.com", player_id)


def new_player(**kw: object) -> Player:
    base = Player("", "Juan", None, "Juan@X.com ", "MED", False, False, None, True)
    return replace(base, **kw)  # type: ignore[arg-type]


def new_skill(**kw: object) -> SkillInfo:
    return replace(SkillInfo("", "juego_aereo", "Juego aéreo", "", 1.0, True, 10), **kw)  # type: ignore[arg-type]


@pytest.fixture
def repo() -> FakeRepo:
    return FakeRepo()


@pytest.fixture
def svc(repo: FakeRepo) -> RosterService:
    return RosterService(repo)


# ── skills ──────────────────────────────────────────────────────────────────
async def test_admin_creates_skill_and_member_sees_it(svc: RosterService) -> None:
    created = await svc.create_skill(ADMIN, new_skill())
    assert created.id
    assert [s.key for s in await svc.list_skills(member(None))] == ["juego_aereo"]


async def test_member_cannot_create_or_update_skill(svc: RosterService) -> None:
    with pytest.raises(Forbidden):
        await svc.create_skill(member("p"), new_skill())
    with pytest.raises(Forbidden):
        await svc.update_skill(member("p"), new_skill(id="x"))


@pytest.mark.parametrize(
    "bad", [{"key": "Con Espacios"}, {"key": "x"}, {"name": " "}, {"weight": 3.5}, {"weight": -1.0}]
)
async def test_invalid_skill_is_rejected(svc: RosterService, bad: dict[str, object]) -> None:
    with pytest.raises(Invalid):
        await svc.create_skill(ADMIN, new_skill(**bad))


async def test_duplicate_skill_key_is_rejected(svc: RosterService) -> None:
    await svc.create_skill(ADMIN, new_skill())
    with pytest.raises(Invalid):
        await svc.create_skill(ADMIN, new_skill())


async def test_inactive_skills_hidden_from_members_but_visible_to_admin(svc: RosterService, repo: FakeRepo) -> None:
    repo.add_skill("old", active=False)
    repo.add_skill("new")
    assert [s.key for s in await svc.list_skills(member(None))] == ["new"]
    assert {s.key for s in await svc.list_skills(ADMIN)} == {"old", "new"}


async def test_update_skill_keeps_key_and_can_deactivate(svc: RosterService, repo: FakeRepo) -> None:
    s = repo.add_skill("pace")
    updated = await svc.update_skill(ADMIN, replace(s, key="hack", is_active=False, weight=2.0))
    assert (updated.key, updated.is_active, updated.weight) == ("pace", False, 2.0)


async def test_update_unknown_skill_is_not_found(svc: RosterService, repo: FakeRepo) -> None:
    with pytest.raises(NotFound):
        await svc.update_skill(ADMIN, new_skill(id="nope"))

    async def gone(*_a: object) -> None:
        return None

    s = repo.add_skill("pace")
    repo.update_skill = gone  # type: ignore[assignment,method-assign]
    with pytest.raises(NotFound):
        await svc.update_skill(ADMIN, s)


# ── players ─────────────────────────────────────────────────────────────────
async def test_admin_creates_player_normalizing_email(svc: RosterService) -> None:
    p = await svc.create_player(ADMIN, new_player())
    assert p.email == "juan@x.com" and p.id


async def test_member_cannot_manage_players(svc: RosterService) -> None:
    with pytest.raises(Forbidden):
        await svc.create_player(member("p"), new_player())
    with pytest.raises(Forbidden):
        await svc.update_player(member("p"), new_player(id="x"))


@pytest.mark.parametrize(
    "bad",
    [
        {"display_name": " "},
        {"preferred_position": "XXX"},
        {"preferred_position": "GK"},
        {"is_guest": True},
        {"guest_level": 5},
        {"is_guest": True, "guest_level": 11},
    ],
)
async def test_invalid_player_is_rejected(svc: RosterService, bad: dict[str, object]) -> None:
    with pytest.raises(Invalid):
        await svc.create_player(ADMIN, new_player(**bad))


async def test_update_player_and_not_found(svc: RosterService, repo: FakeRepo) -> None:
    p = repo.add_player("Juan")
    assert (await svc.update_player(ADMIN, replace(p, nickname="Juancho", email=None))).nickname == "Juancho"
    with pytest.raises(NotFound):
        await svc.update_player(ADMIN, new_player(id="nope"))


async def test_member_listing_has_no_scoring_and_hides_inactive(svc: RosterService, repo: FakeRepo) -> None:
    repo.add_player("A")
    repo.add_player("B", active=False)
    listing = await svc.list_players(member(None))
    assert [(i.player.display_name, i.scoring) for i in listing] == [("A", None)]


async def test_admin_listing_has_scores_and_guest_level(svc: RosterService, repo: FakeRepo) -> None:
    skill = repo.add_skill("overall", 3.0)
    a, b, c, d = (repo.add_player(n) for n in "ABCD")
    guest = repo.add_player("G", is_guest=True, guest_level=7)
    for rater in (b, c, d):
        repo.ratings[(skill.id, a.id, rater.id)] = 8
    listing = {i.player.display_name: i for i in await svc.list_players(ADMIN)}
    scoring = listing["A"].scoring
    assert scoring is not None and scoring.composite == 8.0
    assert scoring.skills["overall"] == {
        "name": "Overall",
        "value": 8.0,
        "n_raters": 3,
        "source": "peers",
        "self_value": None,
    }
    assert listing["G"].scoring is not None and listing["G"].scoring.composite == 7.0
    assert guest.id  # invitado sin puntajes por skill


async def test_admin_listing_inactive_player_has_no_scoring(svc: RosterService, repo: FakeRepo) -> None:
    repo.add_player("Baja", active=False)
    assert (await svc.list_players(ADMIN))[0].scoring is None


# ── ratings ─────────────────────────────────────────────────────────────────
async def test_member_rates_and_sees_only_own_values(svc: RosterService, repo: FakeRepo) -> None:
    skill = repo.add_skill("pace")
    me, other, target = (repo.add_player(n) for n in ("Yo", "Otro", "Target"))
    repo.ratings[(skill.id, target.id, other.id)] = 2  # puntaje ajeno
    await svc.rate(member(me.id), target.id, {skill.id: 9})
    assert await svc.my_ratings(member(me.id), target.id) == {skill.id: 9}
    assert await svc.my_ratings(member(other.id), target.id) == {skill.id: 2}


async def test_rating_again_overwrites(svc: RosterService, repo: FakeRepo) -> None:
    skill = repo.add_skill("pace")
    me, target = repo.add_player("Yo"), repo.add_player("T")
    await svc.rate(member(me.id), target.id, {skill.id: 3})
    await svc.rate(member(me.id), target.id, {skill.id: 6})
    assert await svc.my_ratings(member(me.id), target.id) == {skill.id: 6}


async def test_unlinked_user_cannot_rate_and_sees_nothing(svc: RosterService, repo: FakeRepo) -> None:
    skill = repo.add_skill("pace")
    target = repo.add_player("T")
    with pytest.raises(Forbidden):
        await svc.rate(member(None), target.id, {skill.id: 5})
    assert await svc.my_ratings(member(None), target.id) == {}


async def test_rating_validation(svc: RosterService, repo: FakeRepo) -> None:
    active, off = repo.add_skill("pace"), repo.add_skill("old", active=False)
    me, target = repo.add_player("Yo"), repo.add_player("T")
    guest, gone = repo.add_player("G", is_guest=True, guest_level=5), repo.add_player("X", active=False)
    actor = member(me.id)
    with pytest.raises(NotFound):
        await svc.rate(actor, "nope", {active.id: 5})
    with pytest.raises(NotFound):
        await svc.rate(actor, gone.id, {active.id: 5})
    with pytest.raises(Invalid):
        await svc.rate(actor, guest.id, {active.id: 5})
    with pytest.raises(Invalid):
        await svc.rate(actor, target.id, {})
    with pytest.raises(Invalid):
        await svc.rate(actor, target.id, {off.id: 5})
    with pytest.raises(Invalid):
        await svc.rate(actor, target.id, {active.id: 11})
    with pytest.raises(Invalid):
        await svc.rate(actor, target.id, {active.id: 0})


async def test_admin_sees_self_rating_but_it_does_not_count(svc: RosterService, repo: FakeRepo) -> None:
    """ALGORITHMS §1.2: la autoevaluación se guarda y el admin la ve, pero no se agrega."""
    skill = repo.add_skill("pace")
    me = repo.add_player("Pedro")
    repo.ratings[(skill.id, me.id, me.id)] = 10
    scoring = (await svc.list_players(ADMIN))[0].scoring
    assert scoring is not None
    assert scoring.skills["pace"] == {
        "name": "Pace",
        "value": 5.0,
        "n_raters": 0,
        "source": "imputed",
        "self_value": 10,
    }
