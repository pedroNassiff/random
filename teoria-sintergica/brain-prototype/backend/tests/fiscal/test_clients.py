"""Clientes: validación, lo que se deriva de ellos, VIES, tools del agente, HTTP y Postgres."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import asyncpg
import httpx
import pytest

from fiscal.application.clients import VatCheck
from fiscal.application.errors import Invalid, NotFound
from fiscal.domain.clients import Client, client_issues, validated
from fiscal.domain.errors import FiscalRuleError
from fiscal.infrastructure.pg_clients import PgClientRepository
from fiscal.infrastructure.vies import ViesClient
from fiscal.infrastructure.wiring import build_clients
from tests.fiscal.fakes import fake_clients
from tests.fiscal.test_agent_infra import World
from tests.fiscal.test_application_agent import PEDRO, call, make, say

NOW = datetime(2026, 10, 1, 10, tzinfo=UTC)
ITALIA = Client("Cliente Italia SRL", "IT", "empresa", "IT01234567890", "Via Esempio 28, Roma")
USA = Client("Client USA Corp", "US", "empresa", "88-0000000", "Miami, FL", moneda="USD")
ESPANA = Client("Web España SL", "ES", "empresa", "B12345678", "Calle Mayor 1", retencion_pct=Decimal("15"))


@pytest.fixture(autouse=True)
def _insecure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")


# ── dominio ─────────────────────────────────────────────────────────────────
ISP = "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)"
C_ES, C_UE, C_EXTRA = "303: casillas 07 (base) y 09 (cuota)", "303: casilla 59 · modelo 349", "303: casilla 120"


@pytest.mark.parametrize(
    ("client", "operacion", "mencion", "casillas", "vies"),
    [
        (ESPANA, "nacional", "", C_ES, False),
        (ITALIA, "intracomunitaria", ISP, C_UE, True),
        (USA, "extracomunitaria", "Operación no sujeta, art. 69.Uno.1º LIVA", C_EXTRA, False),
        (replace(ITALIA, tipo="autonomo"), "intracomunitaria", ISP, C_UE, True),
        (replace(ITALIA, tipo="particular", tax_id=None), "nacional", "", C_ES, False),
    ],
)
def test_what_a_client_implies_for_invoicing(
    client: Client, operacion: str, mencion: str, casillas: str, vies: bool
) -> None:
    assert (client.operacion, client.mencion, client.casillas, client.requiere_vies) == (
        operacion, mencion, casillas, vies,
    )  # fmt: skip


def test_validated_normalizes() -> None:
    c = validated(
        Client(" Cliente ", "it", "empresa", " it 0123.456-7 ", " Via 1 ", email=" a@b.it ", moneda="eur", notas=" n ")
    )
    assert (c.nombre, c.pais, c.tax_id, c.direccion, c.email, c.moneda, c.notas) == (
        "Cliente", "IT", "IT01234567", "Via 1", "a@b.it", "EUR", "n",
    )  # fmt: skip
    assert validated(replace(USA, tax_id="  ", email="")).tax_id is None
    assert validated(replace(USA, tax_id=None, email=" ")).email is None
    validated(Client("Juan Particular", "ES", "particular", None, ""))  # un particular puede no tener NIF
    validated(replace(ESPANA, retencion_pct=Decimal("7"), dias_pago=0))
    validated(replace(ESPANA, dias_pago=365))


@pytest.mark.parametrize(
    ("client", "message"),
    [
        (replace(USA, nombre=" "), "Falta el nombre"),
        (replace(USA, pais="USA"), "dos letras"),
        (replace(USA, pais="U1"), "dos letras"),
        (replace(USA, tipo="sociedad"), "empresa, autónomo o particular"),  # type: ignore[arg-type]
        (replace(USA, moneda="US"), "tres letras"),
        (replace(USA, email="sin-arroba"), "email no es válido"),
        (replace(ESPANA, retencion_pct=Decimal("10")), "0, 7 o 15"),
        (replace(USA, retencion_pct=Decimal("15")), "Solo retienen IRPF"),
        (replace(ESPANA, tipo="particular", retencion_pct=Decimal("15")), "Solo retienen IRPF"),
        (replace(ESPANA, dias_pago=-1), "entre 0 y 365"),
        (replace(ESPANA, dias_pago=366), "entre 0 y 365"),
        (replace(ESPANA, tax_id=None), "Falta el NIF o VAT"),
        (replace(ITALIA, tax_id=" "), "Falta el NIF o VAT"),
    ],
)
def test_invalid_clients(client: Client, message: str) -> None:
    with pytest.raises(FiscalRuleError, match=message):
        validated(client)


def test_client_issues() -> None:
    assert client_issues(ESPANA) == () and client_issues(USA) == ()
    assert client_issues(ITALIA) == ("VAT sin comprobar en VIES: sin esa validación no corresponde facturar sin IVA.",)
    assert client_issues(replace(ITALIA, vies_ok=True)) == ()
    assert client_issues(replace(ITALIA, vies_ok=False)) == (
        "El VAT no figura como válido en VIES: no corresponde la inversión del sujeto pasivo.",
    )
    assert client_issues(replace(USA, direccion="")) == ("Falta el domicilio: es un dato obligatorio de la factura.",)
    consumer = client_issues(replace(ITALIA, tipo="particular", tax_id=None))
    assert consumer == ("Cliente de la UE sin VAT de empresa: se le factura con IVA español. Revisar con un asesor.",)
    assert client_issues(replace(ESPANA, vinculada=True)) == (
        "Operación vinculada: el precio debe ser de mercado y conviene documentarlo.",
    )


# ── servicio ────────────────────────────────────────────────────────────────
async def test_codes_are_sequential_per_owner_and_lists_hide_archived() -> None:
    svc, _, _ = fake_clients(NOW)
    a = await svc.create("u1", ITALIA)
    b = await svc.create("u1", USA)
    other = await svc.create("u2", ESPANA)
    assert (a.codigo, b.codigo, other.codigo) == (1, 2, 1) and a.id != b.id
    archived = await svc.archive("u1", a.id)
    assert not archived.activo
    assert [c.codigo for c in await svc.list("u1")] == [2]
    assert [c.codigo for c in await svc.list("u1", include_archived=True)] == [1, 2]
    assert (await svc.archive("u1", a.id, activo=True)).activo
    assert (await svc.create("u1", ESPANA)).codigo == 3
    for action in (
        svc.get("u2", a.id),
        svc.archive("u2", a.id),
        svc.update("u2", a.id, USA),
        svc.check_vies("u2", a.id),
    ):
        with pytest.raises(NotFound, match="no existe"):
            await action
    with pytest.raises(Invalid, match="Falta el nombre"):
        await svc.create("u1", replace(USA, nombre=""))


async def test_vies_check_is_stored_and_reset_only_when_the_vat_changes() -> None:
    svc, _, vies = fake_clients(NOW)
    c = await svc.create("u1", ITALIA)
    checked = await svc.check_vies("u1", c.id)
    assert (checked.vies_ok, checked.vies_checked_at, checked.vies_nombre) == (True, NOW, "CLIENTE ITALIA S.R.L.")
    assert vies.asked == [("IT", "01234567890")]  # el prefijo del país no se manda dos veces

    same_vat = await svc.update("u1", c.id, replace(ITALIA, tax_id=" it 01234567890 ", direccion="Via Nuova 1"))
    assert (same_vat.vies_ok, same_vat.direccion, same_vat.codigo) == (True, "Via Nuova 1", 1)
    new_vat = await svc.update("u1", c.id, replace(ITALIA, tax_id="IT99999999999"))
    assert (new_vat.vies_ok, new_vat.vies_checked_at, new_vat.vies_nombre) == (None, None, None)
    invalid = await svc.check_vies("u1", c.id)
    assert (invalid.vies_ok, invalid.vies_nombre) == (False, None)
    moved = await svc.update("u1", c.id, replace(ITALIA, pais="FR", tax_id="IT99999999999"))
    assert moved.vies_ok is None


async def test_vies_only_applies_to_eu_companies_and_surfaces_outages() -> None:
    svc, _, vies = fake_clients(NOW)
    usa, es = await svc.create("u1", USA), await svc.create("u1", ESPANA)
    for c in (usa, es):
        with pytest.raises(Invalid, match="solo aplica a empresas de otros países de la UE"):
            await svc.check_vies("u1", c.id)
    it = await svc.create("u1", ITALIA)
    vies.down = True
    with pytest.raises(Invalid, match="VIES no respondió"):
        await svc.check_vies("u1", it.id)
    assert (await svc.get("u1", it.id)).vies_ok is None
    unprefixed = await svc.create("u1", replace(ITALIA, tax_id="01234567890"))
    vies.down = False
    assert (await svc.check_vies("u1", unprefixed.id)).vies_ok is True


async def test_saving_a_client_deleted_meanwhile_reports_not_found() -> None:
    svc, repo, _ = fake_clients(NOW)
    c = await svc.create("u1", ITALIA)
    original = repo.update_client

    async def gone(owner_id: str, client: Client) -> Client | None:
        return None

    repo.update_client = gone  # type: ignore[method-assign]
    with pytest.raises(NotFound, match="no existe"):
        await svc.archive("u1", c.id)
    repo.update_client = original  # type: ignore[method-assign]


# ── VIES (cliente HTTP con transporte falso) ────────────────────────────────
def vies_with(handler: Any) -> ViesClient:
    return ViesClient(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


async def test_vies_client_parses_valid_invalid_and_anonymous_names() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        number = request.url.path.rsplit("/", 1)[1]
        if number == "09503121007":
            return httpx.Response(200, json={"isValid": True, "userError": "VALID", "name": " ACME S.R.L. "})
        if number == "Y1234567X":
            return httpx.Response(200, json={"isValid": True, "userError": "VALID", "name": "---"})
        return httpx.Response(200, json={"isValid": False, "userError": "INVALID", "name": "---"})

    vies = vies_with(handler)
    assert await vies.check("IT", "09503121007") == VatCheck(True, "ACME S.R.L.")
    assert await vies.check("ES", "Y1234567X") == VatCheck(True, None)
    assert await vies.check("IT", "00000000000") == VatCheck(False, None)
    assert seen[0] == "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/09503121007"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500),
        httpx.Response(200, text="<html>mantenimiento</html>"),
        httpx.Response(200, json={"isValid": False, "userError": "MS_UNAVAILABLE"}),
    ],
)
async def test_vies_outages_are_reported_not_treated_as_invalid(response: httpx.Response) -> None:
    with pytest.raises(Invalid, match="VIES no respondió"):
        await vies_with(lambda _r: response).check("IT", "09503121007")

    def boom(_r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin red")

    with pytest.raises(Invalid, match="VIES no respondió"):
        await vies_with(boom).check("IT", "09503121007")


@pytest.mark.parametrize(
    ("country", "number"), [("IT", "../x"), ("it", "123"), ("ITA", "123"), ("IT", ""), ("IT", "1 2")]
)
async def test_vies_never_builds_a_url_from_unsafe_input(country: str, number: str) -> None:
    def fail(_r: httpx.Request) -> httpx.Response:
        raise AssertionError("no debería salir a la red")

    with pytest.raises(Invalid, match="formato"):
        await vies_with(fail).check(country, number)


async def test_vies_client_opens_and_closes_its_own_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    opened: list[httpx.AsyncClient] = []
    real = httpx.AsyncClient

    def factory(**kwargs: Any) -> httpx.AsyncClient:
        assert kwargs == {"timeout": 15.0}
        ok = httpx.Response(200, json={"isValid": True, "userError": "VALID", "name": "ACME"})
        opened.append(real(transport=httpx.MockTransport(lambda _r: ok)))
        return opened[-1]

    monkeypatch.setattr("fiscal.infrastructure.vies.httpx.AsyncClient", factory)
    assert await ViesClient().check("IT", "09503121007") == VatCheck(True, "ACME")
    assert len(opened) == 1 and opened[0].is_closed


def test_wiring_builds_the_service_with_postgres_and_vies() -> None:
    svc = build_clients(object())
    assert isinstance(svc._repo, PgClientRepository) and isinstance(svc._vies, ViesClient)


# ── agente ──────────────────────────────────────────────────────────────────
NUEVO: dict[str, Any] = {
    "id": None,
    "nombre": "Cliente Italia SRL",
    "pais": "IT",
    "tipo": "empresa",
    "tax_id": "IT01234567890",
    "direccion": "Via Esempio 28, Roma",
    "email": None,
    "moneda": "EUR",
    "retencion_pct": "0",
    "dias_pago": None,
    "vinculada": False,
    "notas": "",
}


async def test_agent_lists_clients_with_what_they_imply() -> None:
    agent, model, _ = await make(call("ver_clientes"), say("ok"), call("ver_clientes"), say("ok"))
    await agent.chat(PEDRO, [], "?")
    assert model.results()[0]["content"] == "Todavía no hay clientes cargados."
    await agent._clients.create(PEDRO, ITALIA)
    await agent._clients.create("u-ana", USA)
    await agent.chat(PEDRO, [], "?")
    (listed,) = json.loads(model.results()[0]["content"])
    assert (listed["codigo"], listed["operacion"], listed["requiere_vies"], listed["vies_ok"]) == (
        1, "intracomunitaria", True, None,
    )  # fmt: skip
    assert listed["mencion"].startswith("Inversión del sujeto pasivo") and len(listed["observaciones"]) == 1


async def test_agent_proposes_a_new_client_without_writing() -> None:
    agent, model, _ = await make(call("proponer_cliente", **NUEVO), say("Revisalo."))
    (p,) = (await agent.chat(PEDRO, [], "sumá a mi cliente de Italia")).proposals
    assert (p.kind, p.titulo) == ("client", "Nuevo cliente: Cliente Italia SRL")
    assert p.detalle == (
        "nombre: — → Cliente Italia SRL",
        "pais: — → IT",
        "tipo: — → empresa",
        "tax_id: — → IT01234567890",
        "direccion: — → Via Esempio 28, Roma",
        "moneda: — → EUR",
        "retencion_pct: — → 0",
        "operación: intracomunitaria (303: casilla 59 · modelo 349)",
        "mención en sus facturas: Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)",
    )
    assert p.payload == NUEVO
    assert await agent._clients.list(PEDRO) == []
    assert "Todavía no se guardó" in model.results()[0]["content"]


async def test_agent_proposes_changes_to_an_existing_client_and_reports_errors() -> None:
    agent, model, _ = await make(say("ok"))
    existing = await agent._clients.create(PEDRO, ESPANA)
    base = {**NUEVO, "nombre": "Web España SL", "pais": "ES", "tax_id": "B12345678", "direccion": "Calle Mayor 1"}
    agent2, model2, _ = await make(
        call("proponer_cliente", **{**base, "id": existing.id, "retencion_pct": "15", "vinculada": True}),
        call("proponer_cliente", **{**base, "id": existing.id, "retencion_pct": "15"}),
        call("proponer_cliente", **{**base, "id": "no-existe"}),
        call("proponer_cliente", **{**base, "retencion_pct": "mucho"}),
        call("proponer_cliente", **{**base, "tax_id": None}),
        say("ok"),
    )
    agent2._handlers.update(agent._handlers)  # mismo almacén de clientes
    (p,) = (await agent2.chat(PEDRO, [], "?")).proposals
    assert p.titulo == "Actualizar cliente Web España SL" and p.payload["id"] == existing.id
    assert p.detalle == ("vinculada: no → sí", "operación: nacional (303: casillas 07 (base) y 09 (cuota))")
    errors = [model2.results(i)[0] for i in range(2, 6)]
    assert all(e["is_error"] for e in errors)
    assert [e["content"] for e in errors] == [
        "La propuesta es igual al cliente actual: no hay nada que cambiar.",
        "Ese cliente no existe.",
        "retencion_pct debe ser un número.",
        "Falta el NIF o VAT: es obligatorio en la factura a una empresa o profesional de España o de la UE.",
    ]
    assert (await agent._clients.get(PEDRO, existing.id)).vinculada is False


async def test_client_proposal_shows_cleared_fields_as_a_dash() -> None:
    agent, _, _ = await make(say("ok"))
    existing = await agent._clients.create(PEDRO, replace(ESPANA, email="a@b.es", dias_pago=30))
    base = {**NUEVO, "nombre": "Web España SL", "pais": "ES", "tax_id": "B12345678", "direccion": "Calle Mayor 1"}
    agent2, _, _ = await make(call("proponer_cliente", **{**base, "id": existing.id, "retencion_pct": "15"}), say("ok"))
    agent2._handlers.update(agent._handlers)
    (p,) = (await agent2.chat(PEDRO, [], "?")).proposals
    assert p.detalle[:2] == ("email: a@b.es → —", "dias_pago: 30 → —")


# ── HTTP ────────────────────────────────────────────────────────────────────
BODY = {k: v for k, v in NUEVO.items() if k != "id"}


def test_client_endpoints_require_access() -> None:
    world = World()
    cases: list[tuple[str, str, dict[str, Any]]] = [
        ("get", "/fiscal/clients", {}),
        ("post", "/fiscal/clients", {"json": BODY}),
        ("put", "/fiscal/clients/x", {"json": BODY}),
        ("post", "/fiscal/clients/x/vies", {}),
        ("post", "/fiscal/clients/x/archive", {}),
    ]
    for method, url, kwargs in cases:
        assert getattr(world.client(), method)(url, **kwargs).status_code == 401
        assert getattr(world.client("ana@x.com"), method)(url, **kwargs).status_code == 403
    assert world.client_repo.clients == {}


def test_client_http_flow() -> None:
    world = World()
    c = world.client("pedro@x.com")
    assert c.get("/fiscal/clients").json() == []
    r = c.post("/fiscal/clients", json=BODY)
    assert r.status_code == 201
    created = r.json()
    assert (created["codigo"], created["operacion"], created["vies_ok"], created["activo"]) == (
        1, "intracomunitaria", None, True,
    )  # fmt: skip
    assert created["retencion_pct"] == "0" and created["casillas"] == "303: casilla 59 · modelo 349"
    cid = created["id"]

    checked = c.post(f"/fiscal/clients/{cid}/vies").json()
    assert (checked["vies_ok"], checked["vies_nombre"], checked["observaciones"]) == (True, "CLIENTE ITALIA S.R.L.", [])
    assert checked["vies_checked_at"] == "2026-10-01T10:00:00+00:00"

    updated = c.put(f"/fiscal/clients/{cid}", json={**BODY, "email": "pagos@cliente.it", "dias_pago": 30}).json()
    assert (updated["email"], updated["dias_pago"], updated["vies_ok"], updated["codigo"]) == (
        "pagos@cliente.it",
        30,
        True,
        1,
    )

    assert c.post("/fiscal/clients", json={**BODY, "nombre": ""}).status_code == 422
    assert c.post("/fiscal/clients", json={**BODY, "tipo": "sociedad"}).status_code == 422
    assert c.put("/fiscal/clients/no-existe", json=BODY).status_code == 404
    assert c.post("/fiscal/clients/no-existe/vies").status_code == 404
    usa = c.post("/fiscal/clients", json={**BODY, "nombre": "USA Corp", "pais": "US", "moneda": "USD"}).json()
    assert usa["codigo"] == 2 and c.post(f"/fiscal/clients/{usa['id']}/vies").status_code == 422

    assert c.post("/fiscal/clients/no-existe/archive").status_code == 404
    assert c.post(f"/fiscal/clients/{cid}/archive").json()["activo"] is False
    assert [x["codigo"] for x in c.get("/fiscal/clients").json()] == [2]
    assert [x["codigo"] for x in c.get("/fiscal/clients?archivados=true").json()] == [1, 2]
    assert c.post(f"/fiscal/clients/{cid}/archive?activo=true").json()["activo"] is True


def test_unknown_errors_map_to_400() -> None:
    from fiscal.application.errors import FiscalError
    from fiscal.infrastructure.api_clients import _http

    assert _http(FiscalError("x")).status_code == 400


# ── PostgreSQL ──────────────────────────────────────────────────────────────
DSN = os.getenv("FUTBOL_TEST_DSN")
BACKEND = Path(__file__).parents[2]


@pytest.fixture
async def pool() -> AsyncIterator[asyncpg.Pool]:
    if not DSN:
        pytest.skip("FUTBOL_TEST_DSN no configurado")
    assert "test" in DSN
    p = await asyncpg.create_pool(DSN, min_size=1, max_size=2)
    for folder in ("futbol", "fiscal"):
        for m in sorted((BACKEND / folder / "migrations").glob("*.sql")):
            await p.execute(m.read_text(encoding="utf-8"))
    await p.execute("TRUNCATE futbol.app_users CASCADE")
    yield p
    await p.close()


async def test_clients_against_postgres(pool: asyncpg.Pool) -> None:
    async def user(email: str) -> str:
        return str(await pool.fetchval("INSERT INTO futbol.app_users (email) VALUES ($1) RETURNING id", email))

    pedro, ana = await user("pedro@x.com"), await user("ana@x.com")
    repo = PgClientRepository(pool)
    a = await repo.add_client(pedro, ITALIA)
    b = await repo.add_client(pedro, replace(ESPANA, dias_pago=30, vinculada=True, notas="n", email="a@b.es"))
    theirs = await repo.add_client(ana, USA)
    assert (a.codigo, b.codigo, theirs.codigo) == (1, 2, 1)
    assert a == replace(ITALIA, id=a.id, codigo=1)
    assert b == replace(ESPANA, id=b.id, codigo=2, dias_pago=30, vinculada=True, notas="n", email="a@b.es")

    changed = replace(a, direccion="Via Nuova 1", vies_ok=True, vies_checked_at=NOW, vies_nombre="X", activo=False)
    assert await repo.update_client(pedro, changed) == changed
    assert await repo.get_client(pedro, a.id) == changed
    assert await repo.update_client(ana, changed) is None and await repo.get_client(ana, a.id) is None
    assert await repo.get_client(pedro, "no-es-uuid") is None
    assert await repo.update_client(pedro, replace(changed, id="no-es-uuid")) is None
    assert [c.codigo for c in await repo.list_clients(pedro)] == [1, 2]
    assert [c.nombre for c in await repo.list_clients(ana)] == ["Client USA Corp"]
