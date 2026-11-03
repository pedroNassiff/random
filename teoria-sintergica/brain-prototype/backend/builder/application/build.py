"""Caso de uso: construir un módulo a partir de su spec guardada, con la gauntlet como juez."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from builder.application.ports import (
    AgentSession,
    CodingAgent,
    Gauntlet,
    GauntletReport,
    Publisher,
    SavedSpec,
    SpecSource,
    Workspace,
    Workspaces,
)
from builder.domain.migrations import destructive_statements
from builder.domain.naming import branch_for
from builder.domain.prompts import build_prompt, fix_prompt
from builder.domain.tracks import tracks_for

MAX_ATTEMPTS = 3
Outcome = Literal["pr_abierto", "gauntlet_roja", "migracion_destructiva", "sin_cambios", "agente_fallo"]
CO_AUTHOR = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"


class BuildError(Exception):
    """El pedido no se puede empezar (p. ej. no hay spec guardada)."""


@dataclass(frozen=True)
class BuildResult:
    outcome: Outcome
    branch: str
    attempts: int
    cost_usd: float
    detail: str
    pr_url: str | None = None


@dataclass
class _Run:
    spec: SavedSpec
    branch: str
    workspace: Workspace
    cost: float = 0.0
    attempts: int = 0

    def result(self, outcome: Outcome, detail: str, pr_url: str | None = None) -> BuildResult:
        return BuildResult(outcome, self.branch, self.attempts, round(self.cost, 4), detail, pr_url)


class BuildService:
    def __init__(
        self,
        specs: SpecSource,
        workspaces: Workspaces,
        agent: CodingAgent,
        gauntlet: Gauntlet,
        publisher: Publisher,
        *,
        max_attempts: int = MAX_ATTEMPTS,
    ) -> None:
        self._specs = specs
        self._workspaces = workspaces
        self._agent = agent
        self._gauntlet = gauntlet
        self._publisher = publisher
        self._max = max_attempts

    async def build(self, modulo: str, base: str) -> BuildResult:
        spec = await self._specs.latest(modulo.strip())
        if spec is None:
            raise BuildError(f"No hay una spec guardada para «{modulo}». Guardala desde NEO primero.")
        branch = branch_for(spec.modulo)
        run = _Run(spec, branch, self._workspaces.create(branch, base))
        async with self._agent.session(run.workspace.root) as session:
            prompt = build_prompt(spec.modulo, spec.version, spec.contenido)
            while True:
                stop = await self._attempt(run, session, prompt)
                if isinstance(stop, BuildResult):
                    return stop
                if stop.ok:
                    break
                if run.attempts >= self._max:
                    return run.result("gauntlet_roja", stop.output[-4000:])
                prompt = fix_prompt(run.attempts + 1, self._max, stop.output)
        return self._publish(run, base)

    async def _attempt(self, run: _Run, session: AgentSession, prompt: str) -> BuildResult | GauntletReport:
        run.attempts += 1
        turn = await session.send(prompt)
        run.cost += turn.cost_usd
        if not turn.ok:
            return run.result("agente_fallo", turn.summary)
        changed = run.workspace.changed_files()
        if not changed:
            return run.result("sin_cambios", "El agente terminó sin cambiar ningún archivo.")
        destructive = [
            f"{path}: {statement}"
            for path in changed
            if "/migrations/" in path and path.endswith(".sql")
            for statement in destructive_statements(run.workspace.read(path))
        ]
        if destructive:
            return run.result("migracion_destructiva", "\n".join(destructive))
        return self._gauntlet.run(run.workspace.root, tracks_for(changed))

    def _publish(self, run: _Run, base: str) -> BuildResult:
        title = f"feat(neo): módulo {run.spec.modulo} (builder)"
        body = (
            f"Construido por el builder de NEO desde la spec «{run.spec.modulo}» versión {run.spec.version}.\n\n"
            f"- Intentos de la gauntlet: {run.attempts} de {self._max}, en verde.\n"
            f"- Costo del agente: US$ {run.cost:.2f}.\n\n"
            "Revisá el diff y la gauntlet de CI antes de sacarlo de draft.\n\n"
            "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
        )
        message = (
            f"{title}\n\nSpec: {run.spec.modulo}, versión {run.spec.version}. "
            f"Gauntlet en verde al intento {run.attempts}.\n\n{CO_AUTHOR}"
        )
        run.workspace.commit(message)
        run.workspace.push()
        url = self._publisher.open_draft_pr(run.workspace.root, run.branch, base, title, body)
        return run.result("pr_abierto", "Gauntlet en verde.", url)
