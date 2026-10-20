"""Contrato HTTP del Gestor Autónomo: guardas de sesión/acceso y serialización."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from accounts.application.session_service import SessionService
from accounts.infrastructure.api import router as auth_router
from fiscal.application.errors import FiscalError
from fiscal.application.service import FiscalService
from fiscal.infrastructure.api import http_error, router
from fiscal.infrastructure.pg import PgFiscalRepository
from fiscal.infrastructure.wiring import build_service
from tests.accounts.fakes import FakeAccountRepo
from tests.fiscal.fakes import FakeFiscalRepo

PROFILE: dict[str, Any] = {
    "nif": "12345678z",
    "fecha_alta": "2025-12-05",
    "iae": "763",
    "regimen_iva": "general",
    "regimen_irpf": "directa_simplificada",
    "roi": True,
    "tarifa_plana_hasta": "2026-12-05",
    "domicilio_fiscal": "Carrer de l'Exemple 1",
    "municipio": "Barcelona",
    "comunidad": "Cataluña",
}


class World:
    def __init__(self) -> None:
        accounts = FakeAccountRepo()
        for email in ("pedro@x.com", "otra@x.com", "ana@x.com"):
            accounts.add_user(email, "correcta-123")
        self.repo = FakeFiscalRepo()
        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(router)
        self.app.state.accounts = SessionService(accounts, app_access={"dashboard": ["pedro@x.com", "otra@x.com"]})
        self.app.state.fiscal = FiscalService(self.repo, clock=lambda: datetime(2026, 10, 1, 10, tzinfo=UTC))

    def client(self, email: str | None = None) -> TestClient:
        c = TestClient(self.app)
        if email:
            r = c.post("/auth/login", json={"email": email, "password": "correcta-123"})
            assert r.status_code == 200, r.text
        return c


@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    return World()


ENDPOINTS = [
    ("get", "/fiscal/profile", None),
    ("put", "/fiscal/profile", PROFILE),
    ("get", "/fiscal/calendar", None),
    ("put", "/fiscal/obligations/303-2026-3T/status", {"estado": "preparado"}),
    ("post", "/fiscal/deadlines", {"tipo": "apremio", "fecha_notificacion": "2026-09-16"}),
]


@pytest.mark.parametrize(("method", "url", "body"), ENDPOINTS)
def test_every_endpoint_requires_session_and_dashboard_access(
    world: World, method: str, url: str, body: dict[str, Any] | None
) -> None:
    kwargs = {} if body is None else {"json": body}
    assert getattr(world.client(), method)(url, **kwargs).status_code == 401
    assert getattr(world.client("ana@x.com"), method)(url, **kwargs).status_code == 403
    assert world.repo.profiles == {} and world.repo.statuses == {}


def test_profile_roundtrip_and_versioning(world: World) -> None:
    c = world.client("pedro@x.com")
    assert c.get("/fiscal/profile").json() is None
    r = c.put("/fiscal/profile", json=PROFILE)
    assert r.status_code == 200
    assert r.json() == {**PROFILE, "nif": "12345678Z", "version": 1}
    r2 = c.put("/fiscal/profile", json={**PROFILE, "tarifa_plana_hasta": None, "roi": False})
    assert r2.json()["version"] == 2 and r2.json()["tarifa_plana_hasta"] is None
    assert c.get("/fiscal/profile").json() == r2.json()


def test_profile_validation_errors_are_422_with_readable_detail(world: World) -> None:
    c = world.client("pedro@x.com")
    r = c.put("/fiscal/profile", json={**PROFILE, "nif": "12345678A"})
    assert r.status_code == 422 and r.json()["detail"] == "La letra del NIF no coincide con el número."
    assert c.put("/fiscal/profile", json={**PROFILE, "regimen_iva": "otro"}).status_code == 422
    assert c.put("/fiscal/profile", json={**PROFILE, "fecha_alta": "ayer"}).status_code == 422


def test_calendar_without_profile_is_404(world: World) -> None:
    r = world.client("pedro@x.com").get("/fiscal/calendar")
    assert r.status_code == 404 and "perfil fiscal" in r.json()["detail"]


def test_calendar_serializes_obligations_with_state_and_alert(world: World) -> None:
    c = world.client("pedro@x.com")
    c.put("/fiscal/profile", json=PROFILE)
    body = c.get("/fiscal/calendar").json()
    assert body["hoy"] == "2026-10-01" and body["festivos_cargados"] == [2026]
    q3 = next(i for i in body["items"] if i["key"] == "349-2026-3T")
    assert q3 == {
        "key": "349-2026-3T",
        "modelo": "349",
        "ejercicio": 2026,
        "periodo": "3T",
        "titulo": "Operaciones intracomunitarias 3T 2026",
        "vence": "2026-10-20",
        "vence_nominal": "2026-10-20",
        "provisional": False,
        "condicional": True,
        "nota": "Solo se presenta si hubo operaciones con clientes de la UE en el trimestre.",
        "fuente": "RIVA arts. 78-81 y Orden EHA/769/2010",
        "estado": "pendiente",
        "justificante": None,
        "aviso": "sin_aviso",
        "dias_restantes": 19,
    }
    annual = next(i for i in body["items"] if i["key"] == "390-2026-anual")
    assert (annual["vence_nominal"], annual["vence"], annual["provisional"]) == ("2027-01-30", "2027-02-01", True)


def test_status_flow_over_http(world: World) -> None:
    c = world.client("pedro@x.com")
    c.put("/fiscal/profile", json=PROFILE)
    url = "/fiscal/obligations/303-2026-2T/status"
    r = c.put(url, json={"estado": "presentado"})
    assert r.status_code == 422 and "justificante" in r.json()["detail"]
    r = c.put(url, json={"estado": "presentado", "justificante": "CSV-9"})
    assert r.status_code == 200
    assert (r.json()["estado"], r.json()["justificante"], r.json()["aviso"]) == ("presentado", "CSV-9", "sin_aviso")
    assert c.put("/fiscal/obligations/nope/status", json={"estado": "preparado"}).status_code == 404
    # Otro usuario con acceso no ve el estado de Pedro.
    other = world.client("otra@x.com")
    other.put("/fiscal/profile", json=PROFILE)
    mine = next(i for i in other.get("/fiscal/calendar").json()["items"] if i["key"] == "303-2026-2T")
    assert mine["estado"] == "pendiente"


def test_deadline_calculator_over_http(world: World) -> None:
    c = world.client("pedro@x.com")
    c.put("/fiscal/profile", json=PROFILE)
    r = c.post("/fiscal/deadlines", json={"tipo": "apremio", "fecha_notificacion": "2026-09-16"})
    assert r.status_code == 200
    assert r.json() == {
        "vence": "2026-10-05",
        "fuente": "LGT art. 62.5",
        "traza": [
            "Notificación: 16/09/2026.",
            "Notificada entre el día 16 y fin de mes: se paga hasta el día 5 del mes siguiente.",
            "Último día de pago: 05/10/2026.",
        ],
    }
    r = c.post("/fiscal/deadlines", json={"tipo": "dias_habiles", "fecha_notificacion": "2026-09-21", "dias": 10})
    assert r.json()["vence"] == "2026-10-06"
    r = c.post("/fiscal/deadlines", json={"tipo": "dias_habiles", "fecha_notificacion": "2026-09-21"})
    assert r.status_code == 422 and "cuántos días" in r.json()["detail"]
    assert c.post("/fiscal/deadlines", json={"tipo": "otro", "fecha_notificacion": "2026-09-21"}).status_code == 422


def test_unknown_fiscal_errors_map_to_400_and_wiring_uses_postgres() -> None:
    assert http_error(FiscalError("x")).status_code == 400
    assert isinstance(build_service(object())._repo, PgFiscalRepository)
