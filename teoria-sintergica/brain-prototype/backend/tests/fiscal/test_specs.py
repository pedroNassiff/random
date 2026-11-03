"""La spec aprobada queda guardada: dominio, servicio, tool de NEO, HTTP y Postgres.

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § La spec aprobada queda guardada.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast

import asyncpg
import pytest

from fiscal.application.errors import Invalid
from fiscal.application.specs import SpecService
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.specs import escenarios, validated_spec
from fiscal.infrastructure.pg_specs import PgSpecRepository
from fiscal.infrastructure.wiring import build_specs
from tests.fiscal.fakes import fake_specs
from tests.fiscal.test_agent_infra import World
from tests.fiscal.test_application_agent import PEDRO, call, make, say
from tests.fiscal.test_clients import pool  # noqa: F401 - pool es fixture

NOW = datetime(2026, 11, 3, 10, tzinfo=UTC)
SPEC = """Modelo de datos: cuenta, deuda, persona.

Característica: Finanzas familiares
  Escenario: Cargar una cuenta
    Cuando pulso +
    Entonces se abre el formulario de alta
  Escenario: Editar una deuda
    Cuando pulso el lápiz
    Entonces se abre el formulario con los datos
"""


@pytest.fixture(autouse=True)
def _insecure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")


# ── dominio ─────────────────────────────────────────────────────────────────
def test_a_spec_is_trimmed_and_counts_its_scenarios() -> None:
    spec = validated_spec("  Finanzas familiares ", f"\n{SPEC}\n\n")
    assert spec.modulo == "Finanzas familiares" and spec.contenido == SPEC.strip()
    assert escenarios(spec.contenido) == 2
    assert escenarios("Característica: x\n  Esquema del escenario: y\n  Escenario: z") == 2


@pytest.mark.parametrize(
    ("modulo", "contenido", "message"),
    [
        ("", SPEC, "nombre del módulo"),
        ("x" * 81, SPEC, "nombre del módulo"),
        ("Finanzas", "Modelo de datos sin criterios", "Característica"),
        ("Finanzas", "Característica: x\n sin escenarios", "Escenario"),
        ("Finanzas", SPEC + "x" * 20000, "demasiado larga"),
    ],
)
def test_invalid_specs(modulo: str, contenido: str, message: str) -> None:
    with pytest.raises(FiscalRuleError, match=message):
        validated_spec(modulo, contenido)


# ── servicio ────────────────────────────────────────────────────────────────
async def test_each_approved_change_is_a_new_version_and_lists_show_the_latest() -> None:
    times = iter(NOW + timedelta(minutes=i) for i in range(10))
    service, repo = fake_specs(lambda: next(times))
    v1 = await service.save(PEDRO, "Finanzas familiares", SPEC)
    assert (v1.version, v1.estado, v1.created_at) == (1, "pendiente", NOW)
    other = await service.save(PEDRO, "Proyectos", SPEC)
    v2 = await service.save(PEDRO, "finanzas FAMILIARES", SPEC + "  Escenario: Borrar\n")
    assert v2.version == 2 and v2.modulo == "finanzas FAMILIARES"
    assert [(s.modulo, s.version) for s in await service.list(PEDRO)] == [
        ("finanzas FAMILIARES", 2),
        (other.modulo, 1),
    ]
    assert await service.list("u-ana") == []
    assert (await service.current(PEDRO, " Finanzas Familiares ")) == v2
    assert len(repo.rows[PEDRO]) == 3  # no se pisa ninguna versión


async def test_saving_the_same_spec_again_is_rejected() -> None:
    service, _ = fake_specs(lambda: NOW)
    await service.save(PEDRO, "Proyectos", SPEC)
    with pytest.raises(Invalid, match="igual"):
        await service.save(PEDRO, "proyectos", SPEC)


# ── tool de NEO ─────────────────────────────────────────────────────────────
async def test_neo_proposes_a_new_spec_without_saving_it() -> None:
    agent, model, _ = await make(
        call("proponer_spec", modulo="Finanzas familiares", contenido=SPEC), say("Revisala y guardala.")
    )
    specs = agent._specs
    assert specs is not None
    reply = await agent.chat(PEDRO, [], "el borrador está bien")
    [p] = reply.proposals
    assert (p.kind, p.titulo) == ("spec", "Spec: Finanzas familiares")
    assert p.detalle == ("módulo: Finanzas familiares", "escenarios: 2", "versión: nueva")
    assert p.payload == {"modulo": "Finanzas familiares", "contenido": SPEC.strip()}
    assert await specs.list(PEDRO) == []  # proponer no guarda
    assert model.results(1)[0]["is_error"] is False


async def test_neo_says_when_a_spec_replaces_a_version_or_did_not_change() -> None:
    agent, model, _ = await make(
        call("proponer_spec", modulo="proyectos", contenido=SPEC + "  Escenario: Otro\n"),
        call("proponer_spec", modulo="Proyectos", contenido=SPEC),
        call("proponer_spec", modulo="Proyectos", contenido="sin criterios"),
        say("listo"),
    )
    assert agent._specs is not None
    await agent._specs.save(PEDRO, "Proyectos", SPEC)
    reply = await agent.chat(PEDRO, [], "cambiemos la spec")
    [p] = reply.proposals
    assert p.detalle[1:] == ("escenarios: 3", "versión: reemplaza la versión 1")
    same, invalid = model.results(2)[0], model.results(3)[0]
    assert same["is_error"] is True and "igual" in same["content"]
    assert invalid["is_error"] is True and "Característica" in invalid["content"]


async def test_without_specs_the_tool_is_not_available() -> None:
    from fiscal.application.builder_tools import BuilderTools

    out = await BuilderTools(None).handlers()["proponer_spec"](PEDRO, {"modulo": "x", "contenido": SPEC})
    assert out.is_error and "no está disponible" in str(out.content)


# ── HTTP ────────────────────────────────────────────────────────────────────
def test_spec_endpoints_require_access() -> None:
    world = World()
    body = {"modulo": "Proyectos", "contenido": SPEC}
    for method, kwargs in (("get", {}), ("post", {"json": body})):
        assert getattr(world.client(), method)("/fiscal/specs", **kwargs).status_code == 401
        assert getattr(world.client("ana@x.com"), method)("/fiscal/specs", **kwargs).status_code == 403
    assert world.spec_repo.rows == {}


def test_spec_http_flow() -> None:
    world = World()
    c = world.client("pedro@x.com")
    assert c.get("/fiscal/specs").json() == []
    r = c.post("/fiscal/specs", json={"modulo": "Proyectos", "contenido": SPEC})
    assert r.status_code == 201
    created = r.json()
    assert {k: created[k] for k in ("modulo", "version", "estado", "escenarios")} == {
        "modulo": "Proyectos",
        "version": 1,
        "estado": "pendiente",
        "escenarios": 2,
    }
    assert created["contenido"] == SPEC.strip() and created["creada"].startswith("2026-10-01")
    assert c.post("/fiscal/specs", json={"modulo": "Proyectos", "contenido": SPEC}).status_code == 422
    assert c.post("/fiscal/specs", json={"modulo": "Proyectos", "contenido": "sin criterios"}).status_code == 422
    assert c.post("/fiscal/specs", json={"modulo": "", "contenido": SPEC}).status_code == 422
    assert [s["version"] for s in c.get("/fiscal/specs").json()] == [1]


def test_wiring_builds_specs_with_postgres() -> None:
    pool_stub = cast(asyncpg.Pool, object())
    service = build_specs(pool_stub)
    assert isinstance(service, SpecService)
    assert isinstance(service._repo, PgSpecRepository) and service._repo._pool is pool_stub


# ── PostgreSQL ──────────────────────────────────────────────────────────────
async def test_specs_against_postgres(pool: asyncpg.Pool) -> None:  # noqa: F811
    async def user(email: str) -> str:
        return str(await pool.fetchval("INSERT INTO futbol.app_users (email) VALUES ($1) RETURNING id", email))

    pedro, ana = await user("pedro@x.com"), await user("ana@x.com")
    repo = PgSpecRepository(pool)
    spec = validated_spec("Proyectos", SPEC)
    v1 = await repo.add_version(pedro, spec, NOW)
    v2 = await repo.add_version(pedro, validated_spec("PROYECTOS", SPEC + "  Escenario: z\n"), NOW)
    theirs = await repo.add_version(ana, spec, NOW)
    assert (v1.version, v2.version, theirs.version) == (1, 2, 1)
    assert (v1.modulo, v1.contenido, v1.estado, v1.created_at) == ("Proyectos", SPEC.strip(), "pendiente", NOW)
    assert await repo.current(pedro, "proyectos") == v2
    assert await repo.current(pedro, "Otro") is None
    other = await repo.add_version(pedro, validated_spec("Finanzas", SPEC), NOW + timedelta(hours=1))
    assert [(s.modulo, s.version) for s in await repo.latest(pedro)] == [("Finanzas", 1), ("PROYECTOS", 2)]
    assert other.id != v1.id
    assert [s.id for s in await repo.latest(ana)] == [theirs.id]
