"""Construir un módulo desde la sección Specs (solo en local: el lanzador existe con NEO_BUILDER=1)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from fiscal.application.errors import NotFound
from fiscal.application.specs import SpecService


@dataclass(frozen=True)
class BuildStatus:
    slug: str
    modulo: str
    estado: str
    """corriendo, pr_abierto, gauntlet_roja, migracion_destructiva, sin_cambios, agente_fallo, error, cancelado
    o interrumpido."""
    inicio: str
    log: tuple[str, ...] = ()
    rama: str | None = None
    intentos: int | None = None
    costo_usd: float | None = None
    pr_url: str | None = None
    detalle: str | None = None


class BuildLauncher(Protocol):
    @property
    def budget_usd(self) -> float: ...

    def start(self, modulo: str) -> BuildStatus:
        """Lanza el builder en segundo plano. `Invalid` si ya hay uno en curso para ese módulo."""
        ...

    def status(self) -> list[BuildStatus]: ...
    def cancel(self, slug: str) -> bool:
        """True si había una construcción en curso y se detuvo."""
        ...


class BuildService:
    def __init__(self, specs: SpecService, launcher: BuildLauncher | None) -> None:
        self._specs = specs
        self._launcher = launcher

    @property
    def available(self) -> bool:
        return self._launcher is not None

    @property
    def budget_usd(self) -> float:
        return self._launcher.budget_usd if self._launcher else 0

    def _require(self) -> BuildLauncher:
        if self._launcher is None:
            raise NotFound("El builder no está activo en este entorno (NEO_BUILDER=1, solo local).")
        return self._launcher

    def list(self) -> list[BuildStatus]:
        return self._launcher.status() if self._launcher else []

    async def start(self, owner_id: str, modulo: str) -> BuildStatus:
        launcher = self._require()
        spec = await self._specs.current(owner_id, modulo)
        if spec is None:
            raise NotFound(f"No hay una spec guardada para «{modulo.strip()}».")
        return launcher.start(spec.modulo)

    def cancel(self, slug: str) -> None:
        if not self._require().cancel(slug):
            raise NotFound("No hay una construcción en curso con ese nombre.")
