"""Integración contra PostgreSQL real. Se salta si no hay FUTBOL_TEST_DSN.

DB dedicada de test (nunca la de desarrollo): createdb futbol_test y aplicar
futbol/migrations/*.sql. Cada test parte de tablas vacías.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import asyncpg
import pytest

from futbol.application.auth_service import AuthService
from futbol.application.roster_service import RosterService
from futbol.domain.models import Player, SkillInfo
from futbol.infrastructure.pg_repository import PgFutbolRepository
from tests.futbol.fakes import FakeMailer

DSN = os.getenv("FUTBOL_TEST_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="FUTBOL_TEST_DSN no configurado")
MIGRATIONS = sorted((Path(__file__).parents[2] / "futbol" / "migrations").glob("*.sql"))


async def _migrate(p: asyncpg.Pool) -> None:
    for m in MIGRATIONS:
        await p.execute(m.read_text())


@pytest.fixture
async def pool() -> AsyncIterator[asyncpg.Pool]:
    assert DSN and "test" in DSN, "el DSN de test debe apuntar a una DB con 'test' en el nombre"
    p = await asyncpg.create_pool(DSN, min_size=1, max_size=3)
    await _migrate(p)  # crea el schema si no existe
    await p.execute("TRUNCATE futbol.groups, futbol.app_users, futbol.magic_links, futbol.auth_sessions CASCADE")
    await _migrate(p)  # re-siembra grupo y skills: cada test parte de cero
    yield p
    await p.close()


async def test_seed_and_default_group(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()
    keys = [s.key for s in await repo.list_skills(group)]
    assert keys[0] == "overall" and len(keys) == 9


async def test_full_login_and_rating_flow_against_postgres(pool: asyncpg.Pool) -> None:
    repo, mailer = PgFutbolRepository(pool), FakeMailer()
    auth = AuthService(repo, mailer, base_url="https://x.dev", admin_emails=["boss@x.com"])
    roster = RosterService(repo)

    await auth.request_link("boss@x.com")
    boss_session, boss = await auth.verify(mailer.last_token)
    assert boss.is_admin

    group = boss.group_id
    skill = next(s for s in await repo.list_skills(group) if s.key == "pace")
    ana = await roster.create_player(boss, Player("", "Ana", None, "ana@x.com", "MED", False, False, None, True))
    target = await roster.create_player(boss, Player("", "Beto", None, None, "DEF", False, False, None, True))

    await auth.request_link("ana@x.com")
    _, ana_actor = await auth.verify(mailer.last_token)
    assert ana_actor.player_id == ana.id and ana_actor.role == "member"

    await roster.rate(ana_actor, target.id, {skill.id: 7})
    await roster.rate(ana_actor, target.id, {skill.id: 8})  # upsert
    assert await roster.my_ratings(ana_actor, target.id) == {skill.id: 8}

    listing = {i.player.display_name: i for i in await roster.list_players(boss)}
    scoring = listing["Beto"].scoring
    assert scoring is not None
    assert scoring.skills["pace"]["source"] == "imputed"  # 1 par (< 3) y ningún admin puntuó

    assert (await auth.actor_for(boss_session)).user_id == boss.user_id
    await auth.logout(boss_session)


async def test_sql_view_matches_python_domain(pool: asyncpg.Pool) -> None:
    """La vista player_skill_scores debe coincidir con domain.skills (fuente de verdad)."""
    from futbol.domain.skills import aggregate_skill_scores

    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()
    skills = await repo.list_skills(group)
    pace = next(s for s in skills if s.key == "pace")
    ids = []
    for name in "ABCDE":
        p = await repo.create_player(group, Player(str(uuid4()), name, None, None, None, False, False, None, True))
        ids.append(p.id)
    for rater, value in zip(ids[1:4], (3, 5, 9), strict=True):
        await repo.upsert_ratings(rater, ids[0], {pace.id: value})

    expected = aggregate_skill_scores([s.to_skill() for s in skills], ids, await repo.list_group_ratings(group))
    rows = await pool.fetch(
        "SELECT player_id, value, n_raters, source FROM futbol.player_skill_scores WHERE skill_id = $1::uuid",
        pace.id,
    )
    for r in rows:
        e = expected[(str(r["player_id"]), pace.id)]
        assert (float(r["value"]), r["n_raters"], r["source"]) == (round(e.value, 2), e.n_raters, e.source)


async def test_expired_magic_link_and_unknown_session(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    now = datetime.now(UTC)
    await repo.save_magic_link("h1", "a@x.com", now - timedelta(seconds=1))
    assert await repo.consume_magic_link("h1", now) is None
    assert await repo.actor_for_session("nope", now) is None


async def test_skill_update_persists_and_missing_returns_none(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()
    pace = next(s for s in await repo.list_skills(group) if s.key == "pace")
    changed = await repo.update_skill(group, SkillInfo(pace.id, pace.key, "Rapidez", "", 2.0, False, 5))
    assert changed is not None and (changed.name, changed.is_active) == ("Rapidez", False)
    ghost = SkillInfo("00000000-0000-0000-0000-000000000000", "x", "x", "", 1.0, True, 0)
    assert await repo.update_skill(group, ghost) is None
    assert await repo.get_player(group, "00000000-0000-0000-0000-000000000000") is None


async def test_create_skill_and_players_round_trip(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()

    skill = await repo.create_skill(
        group, SkillInfo(str(uuid4()), "juego_aereo", "Juego aéreo", "Cabeceo", 1.25, True, 10)
    )
    assert (skill.key, skill.weight, skill.is_active) == ("juego_aereo", 1.25, True)
    assert skill.id in {s.id for s in await repo.list_skills(group)}

    player = await repo.create_player(
        group, Player(str(uuid4()), "Juan", "Juancho", "juan@x.com", "POR", True, False, None, True)
    )
    assert (player.preferred_position, player.can_play_gk, player.email) == ("POR", True, "juan@x.com")

    guest = await repo.create_player(group, Player(str(uuid4()), "Invitado", None, None, None, False, True, 6, True))
    assert guest.guest_level == 6

    from dataclasses import replace

    updated = await repo.update_player(group, replace(player, nickname="J", active=False))
    assert updated is not None and (updated.nickname, updated.active) == ("J", False)
    assert await repo.update_player(group, replace(player, id=str(uuid4()))) is None
    assert [p.display_name for p in await repo.list_players(group)] == ["Invitado", "Juan"]
    assert (await repo.get_player(group, player.id)) == updated


async def test_password_hash_round_trip(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    assert await repo.password_hash_for("nadie@x.com") is None
    user_id = await repo.get_or_create_user("ana@x.com")
    assert await repo.password_hash_for("ana@x.com") == (user_id, None)
    await repo.set_password_hash(user_id, "scrypt$hash", datetime.now(UTC))
    assert await repo.password_hash_for("ana@x.com") == (user_id, "scrypt$hash")
    await repo.ensure_membership(await repo.default_group_id(), user_id, "member", False)
    actor = await repo.actor_for_user(user_id)
    assert actor is not None and actor.has_password


async def test_old_position_codes_are_rejected_by_the_database(pool: asyncpg.Pool) -> None:
    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()
    for code in ("POR", "DEF", "MED", "DEL"):
        await repo.create_player(group, Player(str(uuid4()), code, None, None, code, False, False, None, True))
    with pytest.raises(asyncpg.CheckViolationError):
        await repo.create_player(group, Player(str(uuid4()), "Viejo", None, None, "GK", False, False, None, True))  # type: ignore[arg-type]


async def test_matches_and_signups_against_postgres(pool: asyncpg.Pool) -> None:
    import asyncio
    from datetime import date

    from futbol.application.ports import SignupMutation
    from futbol.domain.schedule import window_for
    from futbol.domain.signups import join
    from futbol.infrastructure.pg_matches import PgMatchRepository

    repo, matches = PgFutbolRepository(pool), PgMatchRepository(pool)
    group = await repo.default_group_id()
    assert await matches.list_group_ids() == [group]
    cfg = await matches.get_schedule(group)
    # Calendario acordado (migración 006): miércoles 19:00, cierra martes 23:59, abre viernes 00:00, cupo 12.
    assert (cfg.timezone, cfg.match_weekday, cfg.match_time.hour, cfg.capacity) == ("Europe/Madrid", 3, 19, 12)
    assert (cfg.signup_close_weekday, cfg.signup_open_weekday) == (2, 5)

    window = window_for(date(2026, 9, 30), cfg)
    await matches.create_match(group, window)
    await matches.create_match(group, window)  # idempotente (UNIQUE)
    listed = await matches.recent_matches(group, window.starts_at - timedelta(days=30))
    assert len(listed) == 1
    match = listed[0]
    assert await matches.current_match(group) == match
    assert await matches.get_match(group, match.id) == match

    # 3 jugadores compiten por 2 lugares a la vez: el lock evita sobrecupo.
    players = [
        await repo.create_player(group, Player(str(uuid4()), f"P{i}", None, None, None, False, False, None, True))
        for i in range(3)
    ]
    now = datetime.now(UTC)

    def joiner(pid: str) -> SignupMutation:
        return lambda _m, s: join(s, pid, now, 2)

    await asyncio.gather(*(matches.mutate_signups(match.id, joiner(p.id)) for p in players))
    statuses = sorted(s.status for s in await matches.list_signups(match.id))
    assert statuses == ["confirmed", "confirmed", "waitlist"]

    await matches.close_matches((match.id,))
    closed = await matches.get_match(group, match.id)
    assert closed is not None and closed.status == "closed"
    assert await matches.get_match(group, str(uuid4())) is None


async def test_import_cli_against_postgres(pool: asyncpg.Pool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio
    import json

    from futbol.infrastructure import import_players

    repo = PgFutbolRepository(pool)
    group = await repo.default_group_id()
    user = await repo.get_or_create_user("boss@x.com")
    await repo.ensure_membership(group, user, "admin", True)
    await repo.create_player(group, Player(str(uuid4()), "Boss", None, "boss@x.com", None, False, False, None, True))
    await repo.link_player_by_email(group, user, "boss@x.com")
    data = {
        "rated_by": "boss@x.com",
        "players": [{"display_name": "Juan", "preferred_position": "DEL", "skills": {"overall": 7, "pace": 9}}],
    }
    path = tmp_path / "players.json"
    path.write_text(json.dumps(data))

    assert DSN is not None
    monkeypatch.setenv("DATABASE_URL", DSN)
    monkeypatch.delenv("ANALYTICS_DATABASE_URL", raising=False)
    assert await asyncio.to_thread(import_players.main, [str(path), "--dry-run"]) == 0
    assert [p.display_name for p in await repo.list_players(group)] == ["Boss"]
    assert await asyncio.to_thread(import_players.main, [str(path)]) == 0
    juan = next(p for p in await repo.list_players(group) if p.display_name == "Juan")
    assert juan.preferred_position == "DEL"
    assert len([r for r in await repo.list_group_ratings(group) if r.player_id == juan.id]) == 2

    path.write_text("{no es json")
    assert await asyncio.to_thread(import_players.main, [str(path)]) == 1
    monkeypatch.delenv("DATABASE_URL")
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: None)
    assert await asyncio.to_thread(import_players.main, [str(path)]) == 2


async def test_teams_repository_against_postgres(pool: asyncpg.Pool) -> None:
    from datetime import date

    from futbol.domain.balancer import Evaluation, Partition
    from futbol.domain.schedule import window_for
    from futbol.infrastructure.pg_matches import PgMatchRepository
    from futbol.infrastructure.pg_teams import PgTeamsRepository

    repo, matches, teams = PgFutbolRepository(pool), PgMatchRepository(pool), PgTeamsRepository(pool)
    group = await repo.default_group_id()
    cfg = await matches.get_schedule(group)
    players = [
        (await repo.create_player(group, Player(str(uuid4()), f"P{i}", None, None, None, False, False, None, True))).id
        for i in range(4)
    ]
    for day, status in ((date(2026, 9, 23), "closed"), (date(2026, 9, 30), "closed")):
        await matches.create_match(group, window_for(day, cfg))
    prev, current = await matches.recent_matches(group, datetime(2026, 9, 1, tzinfo=UTC))
    await pool.execute("UPDATE futbol.matches SET status = 'closed' WHERE group_id = $1::uuid", group)
    assert await teams.balancer_overrides(group) is None
    assert await teams.pending_matches(group) == [prev.id, current.id]

    part = Partition(tuple(sorted(players[:2])), tuple(sorted(players[2:])))
    ev = Evaluation(part, 0.25, {"balance": 0.2, "repeat": 0.05}, 50.0, 49.0, 0.52)
    await teams.save_proposals(current.id, [ev, ev])
    await teams.save_proposals(current.id, [ev])  # reemplaza
    assert await teams.list_proposals(current.id) == [ev]
    assert await teams.pending_matches(group) == [prev.id]
    await teams.delete_proposals(current.id)
    assert await teams.list_proposals(current.id) == []

    assert await teams.published(current.id) is None
    await teams.publish(prev.id, part)
    assert await teams.published(prev.id) == part
    published = await matches.get_match(group, prev.id)
    assert published is not None and published.status == "teams_published"
    assert await teams.recent_partitions(group, current.id, 3) == [part]
    assert await teams.recent_partitions(group, prev.id, 3) == []

    c = await teams.add_constraint(group, players[0], players[1], "together")
    assert await teams.list_constraints(group) == [c]
    with pytest.raises(asyncpg.UniqueViolationError):
        await teams.add_constraint(group, players[1], players[0], "apart")
    assert await teams.delete_constraint(group, c.id) and not await teams.delete_constraint(group, c.id)

    await pool.execute("UPDATE futbol.groups SET balancer_config = '{\"w_bal\": 2}' WHERE id = $1::uuid", group)
    assert await teams.balancer_overrides(group) == {"w_bal": 2}


async def test_results_repository_against_postgres(pool: asyncpg.Pool) -> None:
    from datetime import date

    from futbol.domain.balancer import Partition
    from futbol.domain.results import MatchResult
    from futbol.domain.schedule import window_for
    from futbol.infrastructure.pg_matches import PgMatchRepository
    from futbol.infrastructure.pg_results import PgResultsRepository
    from futbol.infrastructure.pg_teams import PgTeamsRepository

    repo, matches, results = PgFutbolRepository(pool), PgMatchRepository(pool), PgResultsRepository(pool)
    group = await repo.default_group_id()
    user = await repo.get_or_create_user("boss@x.com")
    cfg = await matches.get_schedule(group)
    players = [
        (await repo.create_player(group, Player(str(uuid4()), f"P{i}", None, None, None, False, False, None, True))).id
        for i in range(4)
    ]
    for day in (date(2026, 9, 23), date(2026, 9, 30)):
        await matches.create_match(group, window_for(day, cfg))
    old, new = await matches.recent_matches(group, datetime(2026, 9, 1, tzinfo=UTC))
    lineup = Partition(tuple(sorted(players[:2])), tuple(sorted(players[2:])))
    await PgTeamsRepository(pool).publish(new.id, Partition(tuple(sorted(players[:3])), (players[3],)))

    assert await results.get_result(new.id) is None and await results.history(group, 10) == []
    scorer = lineup.team_a[0]
    await results.save_result(new.id, MatchResult(5, 4, "ok"), lineup, user, {})
    await results.save_result(new.id, MatchResult(6, 4, "corregido"), lineup, user, {scorer: 4})  # upsert
    await results.save_result(old.id, MatchResult(1, 1), lineup, user, {scorer: 1})
    assert await results.get_result(new.id) == MatchResult(6, 4, "corregido")
    history = await results.history(group, 10)
    assert [h.match.id for h in history] == [new.id, old.id]
    assert history[0].lineup == lineup and history[0].match.status == "played"
    assert history[0].goals == {scorer: 4} and await results.player_goals(new.id) == {scorer: 4}
    assert await results.goal_rates(group, 10) == {scorer: 2.5}
    assert await results.goal_rates(group, 1) == {scorer: 4.0}  # solo el más reciente
    assert len(await results.history(group, 1)) == 1
