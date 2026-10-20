"""Historial del chat contra PostgreSQL real: guardas, forma de los datos, paginado y aislamiento.

El paginado vive en SQL, así que se prueba con la base (se salta sin FUTBOL_TEST_DSN); las guardas de
acceso y la validación no la necesitan.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import asyncpg
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from accounts.application.credentials import hash_password
from accounts.application.session_service import SessionService
from accounts.infrastructure.api import router as auth_router
from accounts.infrastructure.pg import PgAccountRepository
from fiscal.infrastructure.api import router
from fiscal.infrastructure.api_chat import PAGE
from tests.accounts.fakes import FakeAccountRepo

URL = "/fiscal/agent/history"
ENTRY: dict[str, Any] = {"kind": "user", "text": "hola", "files": ["036.pdf"], "proposals": []}
PROPOSAL: dict[str, Any] = {
    "proposal": {
        "id": "p1",
        "kind": "status",
        "titulo": "IVA 2T",
        "detalle": ["estado: a → b"],
        "payload": {"key": "k"},
    },
    "status": "pendiente",
    "error": None,
}


class NoPool:
    """Si una guarda o la validación fallan, la base no se toca."""

    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"no debería usarse la base ({name})")


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    accounts = FakeAccountRepo()
    for email in ("pedro@x.com", "ana@x.com"):
        accounts.add_user(email, "correcta-123")
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(router)
    app.state.accounts = SessionService(accounts, app_access={"dashboard": ["pedro@x.com"]})
    app.state.db_pool = NoPool()
    return app


def login(app: FastAPI, email: str | None = None) -> TestClient:
    c = TestClient(app)
    if email:
        assert c.post("/auth/login", json={"email": email, "password": "correcta-123"}).status_code == 200
    return c


def test_history_requires_session_and_dashboard_access(app: FastAPI) -> None:
    cases: list[tuple[str, str, dict[str, Any]]] = [
        ("get", URL, {}),
        ("post", URL, {"json": {"entries": [ENTRY]}}),
        ("put", f"{URL}/1", {"json": {"proposals": []}}),
        ("delete", URL, {}),
    ]
    for method, url, kwargs in cases:
        assert getattr(login(app), method)(url, **kwargs).status_code == 401
        assert getattr(login(app, "ana@x.com"), method)(url, **kwargs).status_code == 403


@pytest.mark.parametrize(
    "bad",
    [
        {**ENTRY, "kind": "system"},
        {**ENTRY, "text": "x" * 20001},
        {**ENTRY, "files": ["a", "b", "c", "d"]},
        {**ENTRY, "proposals": [{**PROPOSAL, "status": "guardando"}]},
        {**ENTRY, "proposals": [{**PROPOSAL, "proposal": {**PROPOSAL["proposal"], "kind": "borrar"}}]},
        {"kind": "user"},
    ],
)
def test_malformed_entries_are_rejected_before_touching_the_database(app: FastAPI, bad: dict[str, Any]) -> None:
    c = login(app, "pedro@x.com")
    assert c.post(URL, json={"entries": [bad]}).status_code == 422
    assert c.post(URL, json={"entries": []}).status_code == 422
    assert c.get(f"{URL}?limit=0").status_code == 422 and c.get(f"{URL}?limit=101").status_code == 422
    assert c.get(f"{URL}?before=0").status_code == 422
    assert c.put(f"{URL}/abc", json={"proposals": []}).status_code == 422


# ── contra PostgreSQL real ──────────────────────────────────────────────────
DSN = os.getenv("FUTBOL_TEST_DSN")
BACKEND = Path(__file__).parents[2]


@pytest.fixture
async def clients(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[tuple[httpx.AsyncClient, httpx.AsyncClient]]:
    if not DSN:
        pytest.skip("FUTBOL_TEST_DSN no configurado")
    assert "test" in DSN
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=2)
    for folder in ("futbol", "fiscal"):
        for m in sorted((BACKEND / folder / "migrations").glob("*.sql")):
            await pool.execute(m.read_text(encoding="utf-8"))
    await pool.execute("TRUNCATE futbol.app_users CASCADE")
    emails = ["pedro@x.com", "otra@x.com"]
    for email in emails:
        await pool.execute(
            "INSERT INTO futbol.app_users (email, password_hash) VALUES ($1, $2)", email, hash_password("correcta-123")
        )
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(router)
    app.state.accounts = SessionService(PgAccountRepository(pool), app_access={"dashboard": emails})
    app.state.db_pool = pool
    transport = httpx.ASGITransport(app=app)
    out = []
    for email in emails:
        c = httpx.AsyncClient(transport=transport, base_url="http://test")
        assert (await c.post("/auth/login", json={"email": email, "password": "correcta-123"})).status_code == 200
        out.append(c)
    yield out[0], out[1]
    for c in out:
        await c.aclose()
    await pool.close()


async def test_append_and_read_latest_block_in_chronological_order(
    clients: tuple[httpx.AsyncClient, httpx.AsyncClient],
) -> None:
    pedro, otra = clients
    assert (await pedro.get(URL)).json() == {"entries": [], "has_more": False}
    reply = {"kind": "assistant", "text": "¡Hola! ñandú", "files": [], "proposals": [PROPOSAL]}
    r = await pedro.post(URL, json={"entries": [ENTRY, reply]})
    assert r.status_code == 201
    first, second = r.json()["ids"]
    assert second > first
    assert (await pedro.get(URL)).json() == {
        "entries": [{"id": first, **ENTRY}, {"id": second, **reply}],
        "has_more": False,
    }
    assert (await otra.get(URL)).json() == {"entries": [], "has_more": False}


async def test_history_is_paged_from_newest_to_oldest(clients: tuple[httpx.AsyncClient, httpx.AsyncClient]) -> None:
    pedro, _ = clients
    total = PAGE * 2 + 5
    ids: list[int] = []
    for start in range(0, total, 10):
        batch = [{**ENTRY, "text": f"m{i}", "files": []} for i in range(start, min(start + 10, total))]
        ids += (await pedro.post(URL, json={"entries": batch})).json()["ids"]

    latest = (await pedro.get(URL)).json()
    assert [e["text"] for e in latest["entries"]] == [f"m{i}" for i in range(total - PAGE, total)]
    assert latest["has_more"] is True

    older = (await pedro.get(f"{URL}?before={latest['entries'][0]['id']}")).json()
    assert [e["text"] for e in older["entries"]] == [f"m{i}" for i in range(total - 2 * PAGE, total - PAGE)]
    assert older["has_more"] is True

    oldest = (await pedro.get(f"{URL}?before={older['entries'][0]['id']}")).json()
    assert [e["text"] for e in oldest["entries"]] == [f"m{i}" for i in range(5)] and oldest["has_more"] is False

    small = (await pedro.get(f"{URL}?limit=2")).json()
    assert [e["id"] for e in small["entries"]] == ids[-2:] and small["has_more"] is True
    exact = (await pedro.get(f"{URL}?before={ids[2]}&limit=2")).json()
    assert [e["id"] for e in exact["entries"]] == ids[:2] and exact["has_more"] is False


async def test_proposal_state_update_and_clear_are_scoped_to_the_owner(
    clients: tuple[httpx.AsyncClient, httpx.AsyncClient],
) -> None:
    pedro, otra = clients
    reply = {"kind": "assistant", "text": "Propuesta", "files": [], "proposals": [PROPOSAL]}
    (mid,) = (await pedro.post(URL, json={"entries": [reply]})).json()["ids"]
    await otra.post(URL, json={"entries": [ENTRY]})
    saved = {**PROPOSAL, "status": "guardada"}

    assert (await otra.put(f"{URL}/{mid}", json={"proposals": [saved]})).status_code == 404
    assert (await pedro.put(f"{URL}/999999", json={"proposals": [saved]})).status_code == 404
    assert (await pedro.put(f"{URL}/{mid}", json={"proposals": [saved]})).status_code == 204
    assert (await pedro.get(URL)).json()["entries"][0]["proposals"] == [saved]

    assert (await pedro.delete(URL)).status_code == 204
    assert (await pedro.get(URL)).json() == {"entries": [], "has_more": False}
    assert len((await otra.get(URL)).json()["entries"]) == 1
