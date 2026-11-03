"""Builder local: el orquestador con fakes (spec, worktree, agente, gauntlet y PR).

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Builder local.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from builder.application.build import CO_AUTHOR, BuildError, BuildService
from builder.application.ports import AgentSession, AgentTurn, GauntletReport, SavedSpec
from builder.domain.policy import BACKEND
from builder.domain.tracks import Track

SPEC = SavedSpec("Finanzas familiares", 2, "Característica: Finanzas\n  Escenario: Cargar una cuenta")
MIGRATION = f"{BACKEND}/fiscal/migrations/011_finanzas.sql"
PAGE = "src/dashboard/pages/FinanzasPage.tsx"


@dataclass
class FakeSpecs:
    specs: dict[str, SavedSpec] = field(default_factory=lambda: {"finanzas familiares": SPEC})

    async def latest(self, modulo: str) -> SavedSpec | None:
        return self.specs.get(modulo.lower())


@dataclass
class FakeWorkspace:
    files: dict[str, str] = field(default_factory=dict)
    commits: list[str] = field(default_factory=list)
    pushed: bool = False

    @property
    def root(self) -> Path:
        return Path("/tmp/neo-builds/finanzas-familiares")

    def changed_files(self) -> list[str]:
        return sorted(self.files)

    def read(self, path: str) -> str:
        return self.files[path]

    def commit(self, message: str) -> None:
        self.commits.append(message)

    def push(self) -> None:
        self.pushed = True


@dataclass
class FakeWorkspaces:
    workspace: FakeWorkspace = field(default_factory=FakeWorkspace)
    created: list[tuple[str, str]] = field(default_factory=list)

    def create(self, branch: str, base: str) -> FakeWorkspace:
        self.created.append((branch, base))
        return self.workspace


@dataclass
class FakeAgent:
    """Cada turno escribe archivos en el worktree y devuelve un resultado."""

    workspace: FakeWorkspace
    turns: list[tuple[dict[str, str], AgentTurn]]
    prompts: list[str] = field(default_factory=list)
    roots: list[Path] = field(default_factory=list)

    @asynccontextmanager
    async def session(self, root: Path) -> AsyncIterator[AgentSession]:
        self.roots.append(root)
        yield self

    async def send(self, prompt: str) -> AgentTurn:
        self.prompts.append(prompt)
        files, turn = self.turns.pop(0)
        self.workspace.files.update(files)
        return turn


@dataclass
class FakeGauntlet:
    reports: list[GauntletReport]
    runs: list[tuple[Track, ...]] = field(default_factory=list)

    def run(self, root: Path, tracks: Sequence[Track]) -> GauntletReport:
        self.runs.append(tuple(tracks))
        return self.reports.pop(0)


@dataclass
class FakePublisher:
    opened: list[tuple[str, str, str, str]] = field(default_factory=list)

    def open_draft_pr(self, root: Path, branch: str, base: str, title: str, body: str) -> str:
        self.opened.append((branch, base, title, body))
        return "https://github.com/pedroNassiff/random/pull/99"


OK = AgentTurn(True, "Listo: migración 011, FinanzasPage.", 1.25)
GREEN, RED = GauntletReport(True, "todo en verde"), GauntletReport(False, "FAILED tests/fiscal/test_finanzas.py")
CODE = {MIGRATION: "CREATE TABLE IF NOT EXISTS fiscal.cuentas (id uuid);", PAGE: "export {}"}


def make(
    turns: list[tuple[dict[str, str], AgentTurn]], reports: list[GauntletReport]
) -> tuple[BuildService, FakeWorkspaces, FakeAgent, FakeGauntlet, FakePublisher]:
    workspaces = FakeWorkspaces()
    agent = FakeAgent(workspaces.workspace, turns)
    gauntlet, publisher = FakeGauntlet(reports), FakePublisher()
    return BuildService(FakeSpecs(), workspaces, agent, gauntlet, publisher), workspaces, agent, gauntlet, publisher


async def test_green_gauntlet_commits_pushes_and_opens_a_draft_pr() -> None:
    service, workspaces, agent, gauntlet, publisher = make([(CODE, OK)], [GREEN])
    result = await service.build(" finanzas familiares ", "main")
    assert (result.outcome, result.branch, result.attempts, result.cost_usd) == (
        "pr_abierto",
        "neo/finanzas-familiares",
        1,
        1.25,
    )
    assert result.pr_url == "https://github.com/pedroNassiff/random/pull/99"
    assert workspaces.created == [("neo/finanzas-familiares", "main")]
    assert agent.roots == [workspaces.workspace.root]
    assert "versión 2" in agent.prompts[0] and SPEC.contenido in agent.prompts[0]
    assert gauntlet.runs == [("python", "dashboard")]
    [message] = workspaces.workspace.commits
    assert message.startswith("feat(neo): módulo Finanzas familiares (builder)") and message.endswith(CO_AUTHOR)
    assert workspaces.workspace.pushed
    [(branch, base, title, body)] = publisher.opened
    assert (branch, base) == ("neo/finanzas-familiares", "main") and "Finanzas familiares" in title
    assert "1 de 3" in body and "US$ 1.25" in body


async def test_red_gauntlet_goes_back_to_the_agent_in_the_same_session() -> None:
    service, workspaces, agent, gauntlet, _ = make([(CODE, OK), ({}, OK)], [RED, GREEN])
    result = await service.build("Finanzas familiares", "main")
    assert (result.outcome, result.attempts, result.cost_usd) == ("pr_abierto", 2, 2.5)
    assert len(agent.roots) == 1  # una sola sesión
    assert "intento 2 de 3" in agent.prompts[1] and RED.output in agent.prompts[1]
    assert len(gauntlet.runs) == 2


async def test_three_red_gauntlets_stop_without_pushing() -> None:
    service, workspaces, agent, gauntlet, publisher = make([(CODE, OK), ({}, OK), ({}, OK)], [RED, RED, RED])
    result = await service.build("Finanzas familiares", "main")
    assert (result.outcome, result.attempts) == ("gauntlet_roja", 3)
    assert RED.output in result.detail and result.pr_url is None
    assert workspaces.workspace.commits == [] and not workspaces.workspace.pushed and publisher.opened == []
    assert "intento 3 de 3" in agent.prompts[2]


async def test_destructive_migration_stops_before_the_gauntlet() -> None:
    code = {**CODE, MIGRATION: "ALTER TABLE fiscal.clients DROP COLUMN notas;"}
    service, workspaces, _, gauntlet, publisher = make([(code, OK)], [])
    result = await service.build("Finanzas familiares", "main")
    assert result.outcome == "migracion_destructiva"
    assert "011_finanzas.sql: ALTER TABLE fiscal.clients DROP COLUMN notas" in result.detail
    assert gauntlet.runs == [] and not workspaces.workspace.pushed and publisher.opened == []


async def test_an_agent_that_changes_nothing_or_fails_stops() -> None:
    service, *_ = make([({}, OK)], [])
    assert (await service.build("Finanzas familiares", "main")).outcome == "sin_cambios"
    failed = AgentTurn(False, "error_max_budget_usd", 20.0)
    service, workspaces, *_ = make([(CODE, failed)], [])
    result = await service.build("Finanzas familiares", "main")
    assert (result.outcome, result.detail, result.cost_usd) == ("agente_fallo", "error_max_budget_usd", 20.0)
    assert not workspaces.workspace.pushed


async def test_without_a_saved_spec_no_branch_is_created() -> None:
    service, workspaces, *_ = make([], [])
    with pytest.raises(BuildError, match="No hay una spec guardada"):
        await service.build("Proyectos", "main")
    assert workspaces.created == []
