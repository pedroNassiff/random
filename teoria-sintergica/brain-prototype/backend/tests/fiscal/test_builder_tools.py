"""NEO como constructor: lee la base con `consultar_bd`, conoce los módulos y arma la spec conversando.

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md
§ Módulo e instancia, § Cómo pregunta NEO, § Producción (Leer cualquier módulo).
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

from fiscal.application.agent import FiscalAgent
from fiscal.application.agent_tools import SYSTEM_PROMPT, TOOLS
from fiscal.application.builder_tools import MODULOS, BuilderTools, QueryResult
from fiscal.application.errors import Invalid
from fiscal.application.service import FiscalService
from tests.fiscal.fakes import FakeFiscalRepo, fake_clients, fake_documents, fake_invoices
from tests.fiscal.test_application_agent import NOW, PEDRO, ScriptedModel, call, say


class FakeReader:
    def __init__(self, result: QueryResult | None = None, error: str | None = None) -> None:
        self.result = result or QueryResult(("n",), ((1,),), False)
        self.error = error
        self.calls: list[tuple[str, str]] = []

    async def query(self, owner_id: str, sql: str) -> QueryResult:
        self.calls.append((owner_id, sql))
        if self.error:
            raise Invalid(self.error)
        return self.result


def _agent(model: ScriptedModel, reader: FakeReader | None) -> FiscalAgent:
    return FiscalAgent(
        FiscalService(FakeFiscalRepo(), clock=lambda: NOW),
        model,
        fake_documents(NOW)[0],
        fake_invoices(NOW)[0],
        fake_clients(NOW)[0],
        reader=reader,
    )


# ── consultar_bd ─────────────────────────────────────────────────────────────
async def test_consultar_bd_runs_as_the_owner_and_returns_rows_as_objects() -> None:
    reader = FakeReader(
        QueryResult(("numero", "fecha", "base"), ((12, date(2026, 9, 1), Decimal("2000.00")),), truncado=False)
    )
    out = await BuilderTools(reader).handlers()["consultar_bd"](PEDRO, {"sql": "SELECT numero FROM fiscal.invoices"})
    assert reader.calls == [(PEDRO, "SELECT numero FROM fiscal.invoices")]
    assert not out.is_error
    assert json.loads(str(out.content)) == {
        "filas": [{"numero": 12, "fecha": "2026-09-01", "base": "2000.00"}],
        "total": 1,
        "truncado": False,
    }


async def test_consultar_bd_warns_when_the_result_was_truncated() -> None:
    reader = FakeReader(QueryResult(("n",), tuple((i,) for i in range(3)), truncado=True))
    out = await BuilderTools(reader).handlers()["consultar_bd"](PEDRO, {"sql": "SELECT 1"})
    data = json.loads(str(out.content))
    assert data["truncado"] is True and data["total"] == 3
    assert "acotá" in data["aviso"]


async def test_consultar_bd_rejects_an_empty_query_without_touching_the_database() -> None:
    reader = FakeReader()
    out = await BuilderTools(reader).handlers()["consultar_bd"](PEDRO, {"sql": "  ;  "})
    assert out.is_error and reader.calls == []


async def test_consultar_bd_without_a_reader_says_it_is_not_available() -> None:
    out = await BuilderTools(None).handlers()["consultar_bd"](PEDRO, {"sql": "SELECT 1"})
    assert out.is_error and "no está disponible" in str(out.content)


async def test_agent_returns_database_errors_to_the_model_as_tool_errors() -> None:
    reader = FakeReader(error='La consulta falló: relation "x" does not exist')
    model = ScriptedModel(call("consultar_bd", sql="SELECT * FROM x"), say("No existe esa tabla."))
    reply = await _agent(model, reader).chat(PEDRO, [], "¿qué hay en x?")
    assert reply.text == "No existe esa tabla."
    [result] = model.results()
    assert result["is_error"] is True and "does not exist" in result["content"]


async def test_agent_without_reader_still_answers() -> None:
    model = ScriptedModel(call("consultar_bd", sql="SELECT 1"), say("Hoy no puedo leer la base."))
    reply = await _agent(model, None).chat(PEDRO, [], "contame")
    assert reply.text == "Hoy no puedo leer la base."
    assert model.results()[0]["is_error"] is True


# ── ver_modulos ──────────────────────────────────────────────────────────────
async def test_ver_modulos_lists_the_deployed_modules_with_their_tables() -> None:
    out = await BuilderTools(None).handlers()["ver_modulos"](PEDRO, {})
    data = json.loads(str(out.content))
    nombres = [m["nombre"] for m in data["modulos"]]
    assert nombres == [m.nombre for m in MODULOS]
    assert {"Impuestos", "Ingresos y gastos", "Clientes"} <= set(nombres)
    assert "Proyectos" not in nombres  # todavía no existe: el pedido de ITEC es primero un módulo
    clientes = next(m for m in data["modulos"] if m["nombre"] == "Clientes")
    assert clientes["tablas"] == ["fiscal.clients"] and clientes["ruta"].startswith("/dashboard")
    assert "information_schema.columns" in data["columnas"]


def test_every_module_table_is_readable_by_neo_reader() -> None:
    """Las tablas que anuncia ver_modulos son las que la migración 009 le abre a neo_reader."""
    with open("fiscal/migrations/009_neo_reader.sql", encoding="utf-8") as f:
        migration = f.read()
    for modulo in MODULOS:
        for tabla in modulo.tablas:
            nombre = tabla.removeprefix("fiscal.")
            assert f"'{nombre}'" in migration or f"GRANT SELECT ON {tabla} TO neo_reader" in migration, tabla


# ── esquemas y prompt ────────────────────────────────────────────────────────
def test_builder_tools_are_registered_with_closed_schemas() -> None:
    by_name = {t["name"]: t for t in TOOLS}
    sql = by_name["consultar_bd"]["input_schema"]
    assert sql["required"] == ["sql"] and sql["additionalProperties"] is False
    assert "SELECT" in by_name["consultar_bd"]["description"]
    assert by_name["ver_modulos"]["input_schema"]["properties"] == {}


def test_prompt_makes_neo_the_dashboard_builder() -> None:
    assert "constructor del dashboard" in SYSTEM_PROMPT
    # Módulo o instancia, dicho antes de proponer.
    assert "módulo" in SYSTEM_PROMPT and "instancia" in SYSTEM_PROMPT and "`ver_modulos`" in SYSTEM_PROMPT
    # Propone y pregunta a la vez: borrador + a lo sumo 3 preguntas con recomendación, junta lo repetido.
    assert "borrador" in SYSTEM_PROMPT and "a lo sumo 3 preguntas" in SYSTEM_PROMPT
    assert "recomendada" in SYSTEM_PROMPT and "lo que se repite" in SYSTEM_PROMPT
    # Spec cerrada → Gherkin para aprobar; nunca dice que construyó algo.
    assert "Gherkin" in SYSTEM_PROMPT and "nunca digas que" in SYSTEM_PROMPT
    # Lee él mismo antes de mandar al usuario a revisar.
    assert "`consultar_bd`" in SYSTEM_PROMPT
