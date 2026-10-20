"""Contrato HTTP de /auth y de la guarda por app, con repositorio en memoria."""

from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from accounts.application.errors import AccountError
from accounts.application.ports import Identity
from accounts.application.session_service import SessionService
from accounts.infrastructure.api import SESSION_COOKIE, http_error, require_app, router
from accounts.infrastructure.pg import PgAccountRepository
from accounts.infrastructure.wiring import build_session_service
from tests.accounts.fakes import FakeAccountRepo


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    repo = FakeAccountRepo()
    repo.add_user("pedro@x.com", "correcta-123")
    repo.add_user("ana@x.com", "correcta-123")
    app = FastAPI()
    app.include_router(router)
    app.state.accounts = SessionService(repo, app_access={"dashboard": ["pedro@x.com"]})

    @app.get("/privado")
    async def privado(identity: Annotated[Identity, Depends(require_app("dashboard"))]) -> dict[str, str]:
        return {"email": identity.email}

    return TestClient(app)


def login(client: TestClient, email: str, password: str = "correcta-123") -> None:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text


def test_anonymous_gets_401(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401
    assert client.get("/privado").status_code == 401


def test_login_sets_httponly_cookie_and_me_lists_apps(client: TestClient) -> None:
    r = client.post("/auth/login", json={"email": "pedro@x.com", "password": "correcta-123"})
    assert r.json() == {"email": "pedro@x.com", "has_password": True, "apps": ["dashboard"]}
    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=") and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "Max-Age=2592000" in cookie and "Path=/" in cookie and "Secure" not in cookie
    assert client.get("/auth/me").json()["apps"] == ["dashboard"]
    assert client.get("/privado").json() == {"email": "pedro@x.com"}


def test_cookie_is_secure_by_default(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SESSION_COOKIE_SECURE")
    monkeypatch.delenv("FUTBOL_COOKIE_SECURE", raising=False)
    r = client.post("/auth/login", json={"email": "pedro@x.com", "password": "correcta-123"})
    assert "Secure" in r.headers["set-cookie"]


def test_bad_credentials_are_401_without_cookie(client: TestClient) -> None:
    r = client.post("/auth/login", json={"email": "pedro@x.com", "password": "mala"})
    assert r.status_code == 401 and r.json()["detail"] == "Email o contraseña incorrectos."
    assert "set-cookie" not in r.headers


def test_logged_user_outside_the_allowlist_gets_403(client: TestClient) -> None:
    login(client, "ana@x.com")
    assert client.get("/auth/me").json()["apps"] == []
    r = client.get("/privado")
    assert r.status_code == 403 and "no tiene acceso" in r.json()["detail"]


def test_logout_revokes_the_session(client: TestClient) -> None:
    login(client, "pedro@x.com")
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_unknown_account_errors_map_to_400() -> None:
    assert http_error(AccountError("x")).status_code == 400


def test_wiring_reads_the_dashboard_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DASHBOARD_EMAILS", "pedro@x.com, ,Otra@x.com")
    svc = build_session_service(object())
    assert isinstance(svc._repo, PgAccountRepository)
    assert svc.apps_for(Identity("u", "otra@x.com")) == ("dashboard",)
    monkeypatch.delenv("DASHBOARD_EMAILS")
    assert build_session_service(object()).apps_for(Identity("u", "pedro@x.com")) == ()
