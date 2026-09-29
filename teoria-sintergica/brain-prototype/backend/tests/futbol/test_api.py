"""Permisos y contrato HTTP (spec §2 y escenarios e2e 5–6), con repositorio en memoria."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from futbol.application.auth_service import AuthService
from futbol.application.match_service import MatchService
from futbol.application.results_service import ResultsService
from futbol.application.roster_service import RosterService
from futbol.application.teams_service import TeamsService
from futbol.infrastructure.api import Services, router
from tests.futbol.fakes import FakeMailer, FakeMatchRepo, FakeRepo, FakeResultsRepo, FakeTeamsRepo


class World:
    def __init__(self) -> None:
        self.repo, self.mailer, self.match_repo = FakeRepo(), FakeMailer(), FakeMatchRepo()
        self.app = FastAPI()
        self.app.include_router(router)
        auth = AuthService(self.repo, self.mailer, base_url="https://x.dev", admin_emails=["boss@x.com"])
        # Reloj fijo: jueves 24/09/2026, inscripción abierta para el miércoles 30.
        self.now = datetime(2026, 9, 24, 10, tzinfo=ZoneInfo("Europe/Madrid"))
        self.teams_repo = FakeTeamsRepo(self.match_repo)
        matches = MatchService(self.match_repo, self.repo, clock=lambda: self.now, teams=self.teams_repo)
        teams = TeamsService(self.teams_repo, self.match_repo, self.repo)
        self.results_repo = FakeResultsRepo(self.match_repo, self.teams_repo)
        results = ResultsService(self.results_repo, self.match_repo, self.teams_repo, self.repo)
        self.app.state.futbol = Services(auth, RosterService(self.repo), matches, teams, results)

    def client(self, email: str | None = None) -> TestClient:
        c = TestClient(self.app)
        if email:
            assert c.post("/futbol/auth/request", json={"email": email}).status_code == 202
            r = c.post("/futbol/auth/verify", json={"token": self.mailer.last_token})
            assert r.status_code == 200, r.text
        return c


@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    monkeypatch.setenv("FUTBOL_COOKIE_SECURE", "0")
    yield World()


def test_anonymous_gets_401_everywhere(world: World) -> None:
    c = world.client()
    for method, url in [("get", "/futbol/me"), ("get", "/futbol/skills"), ("get", "/futbol/players")]:
        assert getattr(c, method)(url).status_code == 401


def test_login_flow_sets_httponly_cookie_and_logout_revokes(world: World) -> None:
    world.repo.add_player("Juan", email="juan@x.com")
    c = world.client("juan@x.com")
    assert c.get("/futbol/me").json()["role"] == "member"
    verify = world.client().post("/futbol/auth/request", json={"email": "juan@x.com"})
    assert verify.status_code == 202
    fresh = TestClient(world.app)
    resp = fresh.post("/futbol/auth/verify", json={"token": world.mailer.last_token})
    assert "httponly" in resp.headers["set-cookie"].lower() and "samesite=lax" in resp.headers["set-cookie"].lower()
    assert c.post("/futbol/auth/logout").status_code == 204
    assert c.get("/futbol/me").status_code == 401


def test_request_link_never_reveals_whether_email_exists(world: World) -> None:
    c = world.client()
    known = c.post("/futbol/auth/request", json={"email": "boss@x.com"})
    unknown = c.post("/futbol/auth/request", json={"email": "nadie@x.com"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()


def test_verify_with_bad_token_is_401(world: World) -> None:
    assert world.client().post("/futbol/auth/verify", json={"token": "x" * 20}).status_code == 401


def test_member_forbidden_on_admin_actions(world: World) -> None:
    world.repo.add_player("Juan", email="juan@x.com")
    c = world.client("juan@x.com")
    skill = {"key": "juego_aereo", "name": "Juego aéreo", "weight": 1}
    assert c.post("/futbol/skills", json=skill).status_code == 403
    assert c.put("/futbol/skills/x", json=skill).status_code == 403
    assert c.post("/futbol/players", json={"display_name": "Nuevo"}).status_code == 403
    assert c.put("/futbol/players/x", json={"display_name": "Nuevo"}).status_code == 403


def test_admin_crud_and_validation_errors(world: World) -> None:
    c = world.client("boss@x.com")
    created = c.post("/futbol/skills", json={"key": "juego_aereo", "name": "Juego aéreo", "weight": 1})
    assert created.status_code == 201
    assert c.post("/futbol/skills", json={"key": "juego_aereo", "name": "Dup", "weight": 1}).status_code == 422
    sid = created.json()["id"]
    assert c.put(f"/futbol/skills/{sid}", json={"name": "Aéreo", "weight": 2, "is_active": False}).status_code == 200
    assert c.put("/futbol/skills/nope", json={"name": "x", "weight": 1}).status_code == 404

    player = c.post("/futbol/players", json={"display_name": "Juan", "preferred_position": "DEF"})
    assert player.status_code == 201
    pid = player.json()["id"]
    assert c.put(f"/futbol/players/{pid}", json={"display_name": "Juan", "nickname": "J"}).json()["nickname"] == "J"
    assert c.put("/futbol/players/nope", json={"display_name": "x"}).status_code == 404
    assert c.post("/futbol/players", json={"display_name": "x", "preferred_position": "ZZZ"}).status_code == 422


def test_member_never_sees_scores_or_others_ratings(world: World) -> None:
    """Escenario e2e 5 + spec §2: un miembro no ve puntajes agregados ni ajenos."""
    repo = world.repo
    skill = repo.add_skill("overall", 3.0)
    me = repo.add_player("Yo", email="yo@x.com")
    other, target = repo.add_player("Otro"), repo.add_player("Target")
    repo.ratings[(skill.id, target.id, other.id)] = 1  # puntaje de otro
    c = world.client("yo@x.com")

    players = c.get("/futbol/players").json()
    assert all("scoring" not in p for p in players)
    assert c.get(f"/futbol/players/{target.id}/ratings").json() == {}

    assert c.put(f"/futbol/players/{target.id}/ratings", json={"ratings": {skill.id: 9}}).status_code == 204
    assert c.get(f"/futbol/players/{target.id}/ratings").json() == {skill.id: 9}
    assert me.id


def test_admin_sees_scoring(world: World) -> None:
    skill = world.repo.add_skill("overall", 3.0)
    world.repo.add_player("A")
    body = world.client("boss@x.com").get("/futbol/players").json()
    assert body[0]["scoring"]["composite"] == 5.0
    assert skill.id


def test_rate_errors_map_to_http(world: World) -> None:
    skill = world.repo.add_skill("pace")
    target = world.repo.add_player("T")
    unlinked = world.client("boss@x.com")  # admin sin player vinculado
    assert unlinked.put(f"/futbol/players/{target.id}/ratings", json={"ratings": {skill.id: 5}}).status_code == 403
    world.repo.add_player("Yo", email="yo@x.com")
    c = world.client("yo@x.com")
    assert c.put("/futbol/players/nope/ratings", json={"ratings": {skill.id: 5}}).status_code == 404
    assert c.put(f"/futbol/players/{target.id}/ratings", json={"ratings": {skill.id: 99}}).status_code == 422


def test_new_skill_keeps_relative_order_until_rated(world: World) -> None:
    """Escenario e2e 6 / ALGORITHMS §1.3: crear 'Juego aéreo' no cambia el orden de los jugadores.

    El valor absoluto del compuesto sí se diluye (todos reciben 5 —sin datos— en la skill nueva),
    igual para todos, por eso el orden se conserva.
    """
    repo = world.repo
    overall = repo.add_skill("overall", 3.0)
    players = [repo.add_player(n) for n in "ABCD"]
    raters = [repo.add_player(n) for n in ("R1", "R2", "R3")]
    for player, value in zip(players, (9, 7, 4, 2), strict=True):
        for rater in raters:
            repo.ratings[(overall.id, player.id, rater.id)] = value
    admin = world.client("boss@x.com")

    def ranking() -> list[str]:
        body = [p for p in admin.get("/futbol/players").json() if p["display_name"] in "ABCD"]
        return [p["display_name"] for p in sorted(body, key=lambda p: -p["scoring"]["composite"])]

    before = ranking()
    assert before == ["A", "B", "C", "D"]
    created = admin.post("/futbol/skills", json={"key": "juego_aereo", "name": "Juego aéreo", "weight": 1})
    assert created.status_code == 201
    assert ranking() == before


def test_domain_error_without_specific_mapping_is_400() -> None:
    from futbol.application.errors import FutbolError
    from futbol.infrastructure.api import http_error

    assert http_error(FutbolError("x")).status_code == 400


def test_password_flow_over_http(world: World) -> None:
    world.repo.add_player("Juan", email="juan@x.com")
    c = world.client("juan@x.com")
    assert c.get("/futbol/me").json()["has_password"] is False
    assert c.put("/futbol/auth/password", json={"password": "corta"}).status_code == 422
    r = c.put("/futbol/auth/password", json={"password": "mi-clave-segura"})
    assert r.status_code == 200 and r.json()["has_password"] is True

    fresh = TestClient(world.app)
    assert fresh.post("/futbol/auth/login", json={"email": "juan@x.com", "password": "mala-clave"}).status_code == 401
    ok = fresh.post("/futbol/auth/login", json={"email": "juan@x.com", "password": "mi-clave-segura"})
    assert ok.status_code == 200 and "httponly" in ok.headers["set-cookie"].lower()
    assert fresh.get("/futbol/me").json()["email"] == "juan@x.com"


def test_set_password_requires_session(world: World) -> None:
    assert world.client().put("/futbol/auth/password", json={"password": "mi-clave-segura"}).status_code == 401


def test_match_signup_flow_over_http(world: World) -> None:
    me = world.repo.add_player("Yo", email="yo@x.com")
    c = world.client("yo@x.com")
    body = c.get("/futbol/matches/current").json()
    assert body["match"]["starts_at"] == "2026-09-30T20:00:00+02:00"
    assert body["signup_open"] is True and body["capacity"] == 16 and body["my_status"] is None
    mid = body["match"]["id"]
    joined = c.post(f"/futbol/matches/{mid}/signup").json()
    assert joined["my_status"] == "confirmed" and joined["confirmed"][0]["player_id"] == me.id
    assert c.post(f"/futbol/matches/{mid}/withdraw").json()["my_status"] is None

    world.now = datetime(2026, 9, 28, 9, tzinfo=ZoneInfo("Europe/Madrid"))  # lunes: cerrada
    closed = c.post(f"/futbol/matches/{mid}/signup")
    assert closed.status_code == 422 and "cerró el domingo a las 23:59" in closed.json()["detail"]


def test_admin_adds_another_player_over_http(world: World) -> None:
    other = world.repo.add_player("Otro")
    admin = world.client("boss@x.com")
    mid = admin.get("/futbol/matches/current").json()["match"]["id"]
    added = admin.post(f"/futbol/matches/{mid}/signup", json={"player_id": other.id}).json()
    assert [s["display_name"] for s in added["confirmed"]] == ["Otro"]
    removed = admin.post(f"/futbol/matches/{mid}/withdraw", json={"player_id": other.id}).json()
    assert removed["confirmed"] == []


def test_match_endpoints_errors(world: World) -> None:
    other = world.repo.add_player("Otro")
    world.repo.add_player("Yo", email="yo@x.com")
    c = world.client("yo@x.com")
    missing = "00000000-0000-0000-0000-000000000000"
    assert c.post(f"/futbol/matches/{missing}/signup").status_code == 404
    assert c.post(f"/futbol/matches/{missing}/withdraw").status_code == 404
    assert c.post("/futbol/matches/no-es-uuid/signup").status_code == 422
    assert c.post(f"/futbol/matches/{missing}/signup", json={"player_id": other.id}).status_code == 403
    assert world.client().get("/futbol/matches/current").status_code == 401


def test_current_match_none_is_serialized(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    async def nothing(_actor: object) -> None:
        return None

    monkeypatch.setattr(world.app.state.futbol.matches, "current", nothing)
    world.repo.add_player("Yo", email="yo@x.com")
    assert world.client("yo@x.com").get("/futbol/matches/current").json() == {"match": None}


def test_cron_tick_requires_secret(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    c = world.client()
    monkeypatch.delenv("FUTBOL_CRON_SECRET", raising=False)
    assert c.post("/futbol/cron/tick", headers={"Authorization": "Bearer "}).status_code == 401
    monkeypatch.setenv("FUTBOL_CRON_SECRET", "s3cret")
    assert c.post("/futbol/cron/tick").status_code == 401
    assert c.post("/futbol/cron/tick", headers={"Authorization": "Bearer otro"}).status_code == 401
    ok = c.post("/futbol/cron/tick", headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200 and ok.json()["results"][0]["group_id"] == "g1"
    assert ok.json()["results"][0]["proposals_generated"] == 0


def _signed_match(world: World, n: int = 10) -> tuple[TestClient, str, list[str]]:
    overall = world.repo.add_skill("overall", 3.0)
    raters = [world.repo.add_player(f"R{i}", active=False) for i in range(3)]
    ids = []
    for i in range(n):
        p = world.repo.add_player(f"J{i:02d}", preferred_position="MED")
        for r in raters:
            world.repo.ratings[(overall.id, p.id, r.id)] = 3 + i % 6
        ids.append(p.id)
    admin = world.client("boss@x.com")
    mid = admin.get("/futbol/matches/current").json()["match"]["id"]
    for pid in ids:
        assert admin.post(f"/futbol/matches/{mid}/signup", json={"player_id": pid}).status_code == 200
    return admin, mid, ids


def test_teams_flow_over_http(world: World) -> None:
    admin, mid, ids = _signed_match(world)
    generated = admin.post(f"/futbol/matches/{mid}/teams/generate").json()
    assert len(generated["proposals"]) == 3 and generated["team_names"] == ["Blancos", "Negros"]
    best = generated["proposals"][0]
    assert best["win_pct_a"] + best["win_pct_b"] == 100 and set(best["breakdown"]) >= {"balance", "repeat"}
    assert all(p["strength"] is not None for p in generated["players"].values())

    moved = {"team_a": best["team_a"][1:], "team_b": [*best["team_b"], best["team_a"][0]]}
    evaluated = admin.post(f"/futbol/matches/{mid}/teams/evaluate", json=moved).json()
    assert len(evaluated["team_b"]) == 6 and evaluated["cost"] >= best["cost"]

    published = admin.post(f"/futbol/matches/{mid}/teams/publish", json={k: best[k] for k in ("team_a", "team_b")})
    body = published.json()
    assert body["match"]["status"] == "teams_published" and body["share_text"].count("\n") == 4
    assert body["published"]["team_a"] == best["team_a"]


def test_member_sees_published_teams_but_not_proposals(world: World) -> None:
    admin, mid, _ = _signed_match(world)
    best = admin.post(f"/futbol/matches/{mid}/teams/generate").json()["proposals"][0]
    world.repo.add_player("Yo", email="yo@x.com")
    member = world.client("yo@x.com")
    before = member.get(f"/futbol/matches/{mid}/teams").json()
    assert before["proposals"] == [] and before["published"] is None
    admin.post(f"/futbol/matches/{mid}/teams/publish", json={k: best[k] for k in ("team_a", "team_b")})
    after = member.get(f"/futbol/matches/{mid}/teams").json()
    assert after["published"] == {"team_a": best["team_a"], "team_b": best["team_b"]}  # sin %, fuerza ni costo
    assert after["share_text"] and "%" not in after["share_text"]
    assert all(p["strength"] is None for p in after["players"].values())
    assert member.post(f"/futbol/matches/{mid}/teams/generate").status_code == 403
    assert member.get("/futbol/constraints").status_code == 403


def test_teams_errors_over_http(world: World) -> None:
    admin, mid, ids = _signed_match(world, 4)
    missing = "00000000-0000-0000-0000-000000000000"
    assert admin.get(f"/futbol/matches/{missing}/teams").status_code == 404
    assert admin.post(f"/futbol/matches/{missing}/teams/generate").status_code == 404
    bad = {"team_a": ids[:1], "team_b": ids[1:3]}
    assert admin.post(f"/futbol/matches/{mid}/teams/evaluate", json=bad).status_code == 422
    assert admin.post(f"/futbol/matches/{mid}/teams/publish", json=bad).status_code == 422
    assert admin.post(f"/futbol/matches/{mid}/teams/evaluate", json={"team_a": [], "team_b": ids}).status_code == 422


def test_constraints_over_http(world: World) -> None:
    admin, _mid, ids = _signed_match(world, 4)
    created = admin.post("/futbol/constraints", json={"player_a": ids[0], "player_b": ids[1], "kind": "apart"})
    assert created.status_code == 201 and created.json()["kind"] == "apart"
    assert (
        admin.post("/futbol/constraints", json={"player_a": ids[1], "player_b": ids[0], "kind": "together"}).status_code
        == 422
    )
    assert [c["id"] for c in admin.get("/futbol/constraints").json()] == [created.json()["id"]]
    assert admin.delete(f"/futbol/constraints/{created.json()['id']}").status_code == 204
    assert admin.delete(f"/futbol/constraints/{created.json()['id']}").status_code == 404


def test_result_and_history_over_http(world: World) -> None:
    admin, mid, _ids = _signed_match(world)
    best = admin.post(f"/futbol/matches/{mid}/teams/generate").json()["proposals"][0]
    admin.post(f"/futbol/matches/{mid}/teams/publish", json={k: best[k] for k in ("team_a", "team_b")})

    form = admin.get(f"/futbol/matches/{mid}/result").json()
    assert [p["id"] for p in form["team_a"]] and form["result"] is None and len(form["roster"]) >= 10
    absent = best["team_a"][0]
    scorer = best["team_a"][1]
    body = {
        "goals_a": 5,
        "goals_b": 4,
        "notes": " golazo ",
        "team_a": best["team_a"][1:],
        "team_b": best["team_b"],
        "player_goals": {scorer: 3},
    }
    saved = admin.put(f"/futbol/matches/{mid}/result", json=body)
    assert saved.status_code == 200 and saved.json()["result"] == {"goals_a": 5, "goals_b": 4, "notes": "golazo"}
    assert absent not in [p["id"] for p in saved.json()["team_a"]]
    assert {p["id"]: p["goals"] for p in saved.json()["team_a"]}[scorer] == 3

    world.repo.add_player("Yo", email="yo@x.com")
    member = world.client("yo@x.com")
    history = member.get("/futbol/matches/history").json()
    assert history["team_names"] == ["Blancos", "Negros"]
    entry = history["matches"][0]
    assert entry["result"]["goals_a"] == 5 and entry["close"] is True and len(entry["team_a"]) == 4
    assert member.get(f"/futbol/matches/{mid}/result").status_code == 403
    assert member.put(f"/futbol/matches/{mid}/result", json=body).status_code == 403
    # cargar el resultado abrió el partido siguiente
    assert admin.get("/futbol/matches/current").json()["match"]["id"] != mid


def test_result_errors_over_http(world: World) -> None:
    admin, mid, ids = _signed_match(world, 4)
    missing = "00000000-0000-0000-0000-000000000000"
    ok = {"goals_a": 1, "goals_b": 0, "team_a": ids[:2], "team_b": ids[2:]}
    assert admin.get(f"/futbol/matches/{missing}/result").status_code == 404
    assert admin.put(f"/futbol/matches/{missing}/result", json=ok).status_code == 404
    assert admin.put(f"/futbol/matches/{mid}/result", json={**ok, "goals_a": 100}).status_code == 422
    assert admin.put(f"/futbol/matches/{mid}/result", json={**ok, "team_b": ids[:2]}).status_code == 422
    assert admin.put(f"/futbol/matches/{mid}/result", json={**ok, "team_b": [missing]}).status_code == 404
    assert admin.put(f"/futbol/matches/{mid}/result", json={**ok, "player_goals": {ids[0]: 2}}).status_code == 422
    assert admin.put(f"/futbol/matches/{mid}/result", json={**ok, "player_goals": {ids[0]: 100}}).status_code == 422
