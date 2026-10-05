"""Facturas en el agente y por HTTP: proponer sin guardar, consultar y resumir."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

import pytest

from tests.fiscal.helpers import PILOTO
from tests.fiscal.test_agent_infra import World
from tests.fiscal.test_application_agent import PEDRO, call, make, say
from tests.fiscal.test_invoices import italia, usa

FACTURA: dict[str, Any] = {
    "serie": "",
    "numero": 12,
    "fecha": "2026-07-02",
    "fecha_devengo": None,
    "cliente": "Cliente Italia SRL",
    "cliente_pais": "IT",
    "cliente_tax_id": "IT01234567890",
    "cliente_empresa": True,
    "concepto": "Desarrollo de software | 50 % entrega",
    "moneda": "EUR",
    "importe": "975.00",
    "tipo_cambio": "1",
    "tipo_iva": "0",
    "retencion_pct": "0",
    "mencion": "Operación exenta de IVA en virtud del art. 69",
    "documento_id": None,
}


async def test_invoice_proposal_records_it_as_issued_and_never_writes() -> None:
    agent, model, _ = await make(call("proponer_factura", **FACTURA), say("Revisala."))
    reply = await agent.chat(PEDRO, [], "registrá esta factura")
    (p,) = reply.proposals
    assert (p.kind, p.titulo) == ("invoice", "Registrar factura 12/2026 — Cliente Italia SRL")
    assert p.detalle == (
        "fecha: 02/07/2026 (devengo 02/07/2026, 3T)",
        "cliente: Cliente Italia SRL (IT) — operación intracomunitaria",
        "importe: 975.00 EUR → base 975.00 €",
        "IVA 0%: 0.00 €",
        "retención 0%: 0.00 €",
        '⚠ Mención incorrecta: debe decir "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)".',
    )
    # El payload conserva la mención tal como se emitió: no se corrige en silencio.
    assert p.payload == {**FACTURA, "fecha_devengo": "2026-07-02"}
    assert (await agent._invoices.overview(PEDRO, 2026)).invoices == ()
    result = model.results()[0]
    assert result["is_error"] is False and "rectificativa" in result["content"]


async def test_clean_invoice_proposal_has_no_warning_hint() -> None:
    ok = {**FACTURA, "mencion": "Inversión del sujeto pasivo", "fecha_devengo": "2026-06-20"}
    agent, model, _ = await make(call("proponer_factura", **ok), say("ok"))
    (p,) = (await agent.chat(PEDRO, [], "?")).proposals
    assert p.detalle[0] == "fecha: 02/07/2026 (devengo 20/06/2026, 2T)" and not any("⚠" in d for d in p.detalle)
    assert model.results()[0]["content"].endswith("espera su confirmación.")


async def test_invoice_proposal_errors_go_back_to_the_model() -> None:
    agent, model, _ = await make(
        call("proponer_factura", **{**FACTURA, "fecha": "2 de julio"}),
        call("proponer_factura", **{**FACTURA, "importe": "mil"}),
        call("proponer_factura", **{**FACTURA, "fecha_devengo": "ayer"}),
        call("proponer_factura", **{**FACTURA, "numero": 0}),
        call("proponer_factura", **{**FACTURA, "fecha": "2026-12-01"}),
        say("ok"),
    )
    reply = await agent.chat(PEDRO, [], "?")
    errors = [model.results(i)[0] for i in range(1, 6)]
    assert all(e["is_error"] for e in errors) and reply.proposals == ()
    assert [e["content"] for e in errors] == [
        "fecha debe ser una fecha aaaa-mm-dd.",
        "importe debe ser un número.",
        "fecha_devengo debe ser una fecha aaaa-mm-dd.",
        "El número de factura debe ser 1 o mayor.",
        "La factura no puede tener fecha futura.",
    ]


async def test_agent_reads_invoices_and_quarter_summary() -> None:
    agent, model, _ = await make(
        call("ver_facturas", ejercicio=2026), call("resumen_trimestre", ejercicio=2026, trimestre=2),
        call("resumen_trimestre", ejercicio=2026, trimestre=7), say("ok"),
    )  # fmt: skip
    await agent._invoices.add(PEDRO, usa(11, date(2026, 6, 29), mencion="exenta"))
    await agent._invoices.add(PEDRO, italia(12, date(2026, 7, 2)))
    await agent._invoices.add("u-ana", italia(1, date(2026, 6, 1)))
    await agent.chat(PEDRO, [], "?")

    listed = json.loads(model.results(1)[0]["content"])
    assert [f["numero"] for f in listed["facturas"]] == [11, 12] and listed["ejercicio"] == 2026
    first = listed["facturas"][0]
    assert (first["operacion"], first["base"], first["trimestre"], first["total"]) == (
        "extracomunitaria", "1840.00", 2, "1840.00",
    )  # fmt: skip
    assert first["observaciones"] == ['Mención incorrecta: debe decir "Operación no sujeta, art. 69.Uno.1º LIVA".']
    assert listed["incidencias_numeracion"] == ["Serie única 2026: faltan los números 1, 2, 3, 4, 5, 6, 7, 8, 9, 10."]

    summary = json.loads(model.results(2)[0]["content"])
    assert summary["operaciones"][2] == {
        "operacion": "extracomunitaria",
        "casillas": "303: casilla 120",
        "base": "1840.00",
        "cuota_iva": "0.00",
        "retencion": "0.00",
        "facturas": ["11/2026 Client USA Corp"],
    }
    assert summary["clientes_ue"] == [] and summary["con_observaciones"] == 1
    assert model.results(3)[0]["is_error"] and "1, 2, 3 o 4" in model.results(3)[0]["content"]


async def test_onboarding_counts_registered_invoices() -> None:
    agent, model, _ = await make(call("ver_pasos"), say("ok"))
    await agent._invoices.add(PEDRO, italia(12, date(2026, 7, 2)))
    await agent.chat(PEDRO, [], "?")
    steps = {s["clave"]: s for s in json.loads(model.results()[0]["content"])["pasos"]}
    assert steps["facturas"]["estado"] == "hecho" and "Registradas este año: 1." in steps["facturas"]["detalle"]


# ── HTTP ────────────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def _insecure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")


def test_invoice_endpoints_require_access() -> None:
    world = World()
    for method, url, body in [
        ("get", "/fiscal/invoices?ejercicio=2026", None),
        ("post", "/fiscal/invoices", FACTURA),
        ("post", "/fiscal/invoices/x/void", None),
        ("get", "/fiscal/invoices/summary?ejercicio=2026&trimestre=2", None),
    ]:
        kwargs = {} if body is None else {"json": body}
        assert getattr(world.client(), method)(url, **kwargs).status_code == 401
        assert getattr(world.client("ana@x.com"), method)(url, **kwargs).status_code == 403
    assert world.invoice_repo.invoices == {}


def test_invoice_http_flow() -> None:
    world = World()
    c = world.client("pedro@x.com")
    assert c.get("/fiscal/invoices?ejercicio=2026").json() == {"ejercicio": 2026, "invoices": [], "numeracion": []}

    r = c.post("/fiscal/invoices", json=FACTURA)
    assert r.status_code == 201
    created = r.json()
    assert (created["operacion"], created["trimestre"], created["base"], created["anulada"]) == (
        "intracomunitaria", 3, "975.00", False,
    )  # fmt: skip
    assert created["fecha_devengo"] == "2026-07-02" and len(created["observaciones"]) == 1 and created["id"]
    usd = {**FACTURA, "numero": 11, "fecha": "2026-06-29", "cliente_pais": "US", "moneda": "USD", "importe": 2000,
           "tipo_cambio": "0.92", "mencion": "Operación no sujeta, art. 69.Uno.1º LIVA"}  # fmt: skip
    assert c.post("/fiscal/invoices", json=usd).json()["base"] == "1840.00"

    listed = c.get("/fiscal/invoices?ejercicio=2026").json()
    assert [i["numero"] for i in listed["invoices"]] == [11, 12] and len(listed["numeracion"]) == 1

    s = c.get("/fiscal/invoices/summary?ejercicio=2026&trimestre=2").json()
    assert s["operaciones"][2]["base"] == "1840.00" and s["operaciones"][1]["base"] == "0.00"
    assert c.get("/fiscal/invoices/summary?ejercicio=2026&trimestre=5").status_code == 422

    assert c.post("/fiscal/invoices", json={**FACTURA, "numero": 0}).status_code == 422
    assert c.post("/fiscal/invoices", json={**FACTURA, "fecha": "ayer"}).status_code == 422
    assert c.post("/fiscal/invoices/no-existe/void").status_code == 404
    assert c.post(f"/fiscal/invoices/{created['id']}/void").status_code == 204
    after = c.get("/fiscal/invoices?ejercicio=2026").json()
    assert [i["anulada"] for i in after["invoices"]] == [False, True]


def test_unknown_fiscal_errors_map_to_400() -> None:
    from fiscal.application.errors import FiscalError, Invalid
    from fiscal.infrastructure.api_invoices import _http

    assert (_http(FiscalError("x")).status_code, _http(Invalid("x")).status_code) == (400, 422)


async def test_onboarding_endpoint_reports_steps_and_next_one() -> None:
    world = World()
    assert world.client().get("/fiscal/onboarding").status_code == 401
    assert world.client("ana@x.com").get("/fiscal/onboarding").status_code == 403
    c = world.client("pedro@x.com")
    first = c.get("/fiscal/onboarding").json()
    assert first["siguiente"] == "perfil"
    assert [(p["clave"], p["estado"]) for p in first["pasos"]] == [
        ("perfil", "pendiente"),
        ("tarifa_plana", "opcional"),
        ("facturas", "pendiente"),
        ("justificantes", "pendiente"),
        ("notificaciones", "opcional"),
    ]
    assert "036 o 037" in first["pasos"][0]["documento"]

    owner = next(u for e, u in world.app.state.accounts._repo.users.items() if e == "pedro@x.com")
    await world.service.save_profile(owner, PILOTO)
    await world.invoices.add(owner, italia(12, date(2026, 7, 2)))
    after = c.get("/fiscal/onboarding").json()
    steps = {p["clave"]: p for p in after["pasos"]}
    assert after["siguiente"] == "justificantes"
    assert (steps["perfil"]["estado"], steps["facturas"]["estado"]) == ("hecho", "hecho")
    assert "IVA 2T 2026" in steps["justificantes"]["detalle"]
