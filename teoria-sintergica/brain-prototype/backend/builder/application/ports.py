"""Puertos del builder. Infrastructure los implementa con git, gh, la gauntlet y el Agent SDK."""

from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from builder.domain.tracks import Track


@dataclass(frozen=True)
class SavedSpec:
    modulo: str
    version: int
    contenido: str


@dataclass(frozen=True)
class AgentTurn:
    ok: bool
    summary: str
    cost_usd: float


@dataclass(frozen=True)
class GauntletReport:
    ok: bool
    output: str


class SpecSource(Protocol):
    async def latest(self, modulo: str) -> SavedSpec | None: ...


class Workspace(Protocol):
    @property
    def root(self) -> Path: ...

    def changed_files(self) -> list[str]:
        """Archivos agregados o modificados respecto de la base, relativos a la raíz del repo."""
        ...

    def read(self, path: str) -> str: ...
    def commit(self, message: str) -> None: ...
    def push(self) -> None: ...


class Workspaces(Protocol):
    def create(self, branch: str, base: str) -> Workspace:
        """Worktree nuevo en la rama `branch` desde `base`. Error si la rama ya existe."""
        ...


class AgentSession(Protocol):
    async def send(self, prompt: str) -> AgentTurn: ...


class CodingAgent(Protocol):
    def session(self, root: Path) -> AbstractAsyncContextManager[AgentSession]: ...


class Gauntlet(Protocol):
    def run(self, root: Path, tracks: Sequence[Track]) -> GauntletReport: ...


class Publisher(Protocol):
    def open_draft_pr(self, root: Path, branch: str, base: str, title: str, body: str) -> str:
        """Abre el PR en draft y devuelve su URL."""
        ...
