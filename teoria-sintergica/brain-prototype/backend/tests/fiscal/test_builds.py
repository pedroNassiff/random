"""Botón Construir (solo local): lanzar el builder como proceso aparte, seguirlo y cancelarlo.

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Botón Construir.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import pytest

from fiscal.application.builds import BuildService, BuildStatus
from fiscal.application.errors import Invalid, NotFound
from fiscal.infrastructure.local_builds import LocalBuildLauncher
from fiscal.infrastructure.wiring import build_builds
from tests.fiscal.fakes import fake_specs
from tests.fiscal.test_agent_infra import World
from tests.fiscal.test_application_agent import PEDRO
from tests.fiscal.test_specs import SPEC

NOW = datetime(2026, 11, 3, 10, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _insecure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")


class FakeLauncher:
    budget_usd = 20.0

    def __init__(self) -> None:
        self.started: list[str] = []
        self.statuses: list[BuildStatus] = []
        self.cancelled: list[str] = []

    def start(self, modulo: str) -> BuildStatus:
        self.started.append(modulo)
        status = BuildStatus("finanzas", modulo, "corriendo", NOW.isoformat())
        self.statuses.append(status)
        return status

    def status(self) -> list[BuildStatus]:
        return list(self.statuses)

    def cancel(self, slug: str) -> bool:
        self.cancelled.append(slug)
        return slug == "finanzas"


# ── servicio ─────────────────────────────────────────────────────────────────
async def test_start_needs_a_saved_spec_and_builds_its_saved_name() -> None:
    specs, _ = fake_specs(lambda: NOW)
    launcher = FakeLauncher()
    service = BuildService(specs, launcher)
    assert service.available and service.budget_usd == 20.0
    with pytest.raises(NotFound, match="No hay una spec guardada"):
        await service.start(PEDRO, "Finanzas")
    await specs.save(PEDRO, "Finanzas", SPEC)
    status = await service.start(PEDRO, " finanzas ")
    assert launcher.started == ["Finanzas"] and status.estado == "corriendo"
    assert service.list() == [status]
    service.cancel("finanzas")
    with pytest.raises(NotFound):
        service.cancel("otra")


async def test_without_builder_nothing_can_be_launched() -> None:
    specs, _ = fake_specs(lambda: NOW)
    await specs.save(PEDRO, "Finanzas", SPEC)
    service = BuildService(specs, None)
    assert not service.available and service.list() == [] and service.budget_usd == 0
    with pytest.raises(NotFound, match="no está activo"):
        await service.start(PEDRO, "Finanzas")
    with pytest.raises(NotFound):
        service.cancel("finanzas")


# ── lanzador real (con un proceso que simula al builder) ─────────────────────
FAKE_BUILDER = """
import json, sys, time
args = sys.argv[1:]
status = args[args.index("--status-file") + 1]
print("Construyendo", args[0], "desde", args[args.index("--base") + 1], flush=True)
if args[0] == "Lento":
    time.sleep(30)
json.dump({"estado": "pr_abierto", "rama": "neo/x", "intentos": 1, "costo_usd": 2.5,
           "pr_url": "https://pr/1", "detalle": "Gauntlet en verde."}, open(status, "w"))
"""


def _launcher(tmp_path: Path) -> LocalBuildLauncher:
    script = tmp_path / "fake_builder.py"
    script.write_text(FAKE_BUILDER)
    return LocalBuildLauncher(
        tmp_path / "builds",
        cwd=tmp_path,
        base="feat/x",
        budget_usd=7,
        command=[sys.executable, "-u", str(script)],
        clock=lambda: NOW,
    )


def _wait(launcher: LocalBuildLauncher, slug: str, estado: str) -> BuildStatus:
    for _ in range(100):
        found = next((s for s in launcher.status() if s.slug == slug), None)
        if found and found.estado == estado:
            return found
        time.sleep(0.05)
    raise AssertionError(f"{slug} no llegó a {estado}: {launcher.status()}")


def test_launcher_runs_the_builder_and_reads_its_result(tmp_path: Path) -> None:
    launcher = _launcher(tmp_path)
    started = launcher.start("Finanzas familiares")
    assert (started.slug, started.estado, started.inicio) == ("finanzas-familiares", "corriendo", NOW.isoformat())
    done = _wait(launcher, "finanzas-familiares", "pr_abierto")
    assert (done.pr_url, done.costo_usd, done.intentos, done.rama) == ("https://pr/1", 2.5, 1, "neo/x")
    assert done.log == ("Construyendo Finanzas familiares desde feat/x",)
    assert done.modulo == "Finanzas familiares" and done.inicio == NOW.isoformat()


def test_one_build_per_module_and_cancel(tmp_path: Path) -> None:
    launcher = _launcher(tmp_path)
    launcher.start("Lento")
    with pytest.raises(Invalid, match="Ya hay una construcción en curso"):
        launcher.start("Lento")
    assert launcher.cancel("lento") is True
    cancelled = _wait(launcher, "lento", "cancelado")
    assert cancelled.detalle == "Cancelada desde el dashboard."
    assert launcher.cancel("lento") is False and launcher.cancel("nunca") is False


def test_a_build_that_dies_without_a_result_is_interrupted(tmp_path: Path) -> None:
    builds = tmp_path / "builds"
    builds.mkdir()
    (builds / "x.json").write_text(json.dumps({"modulo": "X", "estado": "corriendo", "pid": 999_999, "inicio": "t"}))
    (builds / "roto.json").write_text("{no es json")
    [status] = _launcher(tmp_path).status()
    assert (status.slug, status.estado, status.log) == ("x", "interrumpido", ())


def test_wiring_only_enables_the_builder_with_neo_builder(monkeypatch: pytest.MonkeyPatch) -> None:
    specs, _ = fake_specs(lambda: NOW)
    monkeypatch.delenv("NEO_BUILDER", raising=False)
    assert not build_builds(specs).available
    monkeypatch.setenv("NEO_BUILDER", "1")
    monkeypatch.setenv("NEO_BUILDER_BASE", "feat/neo-builder-local")
    service = build_builds(specs)
    assert service.available and service.budget_usd == 20.0


# ── HTTP ─────────────────────────────────────────────────────────────────────
def test_build_endpoints() -> None:
    world = World()
    assert world.client().get("/fiscal/builds").status_code == 401
    c = world.client("pedro@x.com")
    assert c.get("/fiscal/builds").json() == {"disponible": False, "presupuesto_usd": 0, "builds": []}
    assert c.post("/fiscal/builds", json={"modulo": "Finanzas"}).status_code == 404

    launcher = FakeLauncher()
    world.app.state.fiscal_builds = BuildService(world.specs, launcher)
    assert c.post("/fiscal/builds", json={"modulo": "Finanzas"}).status_code == 404  # sin spec guardada
    assert c.post("/fiscal/specs", json={"modulo": "Finanzas", "contenido": SPEC}).status_code == 201
    r = c.post("/fiscal/builds", json={"modulo": "Finanzas"})
    assert r.status_code == 202 and r.json()["estado"] == "corriendo"
    view = c.get("/fiscal/builds").json()
    assert view["disponible"] is True and view["presupuesto_usd"] == 20.0
    assert [b["modulo"] for b in view["builds"]] == ["Finanzas"]
    assert c.post("/fiscal/builds/finanzas/cancel").status_code == 204
    assert c.post("/fiscal/builds/otra/cancel").status_code == 404


def test_starting_twice_is_a_conflict() -> None:
    world = World()

    class Busy(FakeLauncher):
        def start(self, modulo: str) -> BuildStatus:
            raise Invalid("Ya hay una construcción en curso para este módulo.")

    world.app.state.fiscal_builds = BuildService(world.specs, Busy())
    c = world.client("pedro@x.com")
    c.post("/fiscal/specs", json={"modulo": "Finanzas", "contenido": SPEC})
    r = c.post("/fiscal/builds", json={"modulo": "Finanzas"})
    assert r.status_code == 409 and "en curso" in r.json()["detail"]
