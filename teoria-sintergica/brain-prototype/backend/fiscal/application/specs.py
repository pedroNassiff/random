"""Specs guardadas: cada cambio aprobado es una versión nueva, nunca se pisa la anterior."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, Protocol

from fiscal.application.errors import Invalid
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.specs import Spec, validated_spec

SpecEstado = Literal["pendiente"]


@dataclass(frozen=True)
class StoredSpec:
    id: str
    modulo: str
    contenido: str
    version: int
    estado: SpecEstado
    created_at: datetime


class SpecRepository(Protocol):
    async def add_version(self, owner_id: str, spec: Spec, now: datetime) -> StoredSpec:
        """Inserta la versión siguiente del módulo (el nombre se compara sin mayúsculas)."""
        ...

    async def current(self, owner_id: str, modulo: str) -> StoredSpec | None: ...
    async def latest(self, owner_id: str) -> list[StoredSpec]:
        """La última versión de cada módulo, la más reciente primero."""
        ...


class SpecService:
    def __init__(self, repo: SpecRepository, *, clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self._repo = repo
        self._clock = clock

    @staticmethod
    def check(modulo: str, contenido: str) -> Spec:
        try:
            return validated_spec(modulo, contenido)
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc

    async def current(self, owner_id: str, modulo: str) -> StoredSpec | None:
        return await self._repo.current(owner_id, modulo.strip())

    async def list(self, owner_id: str) -> list[StoredSpec]:
        return await self._repo.latest(owner_id)

    async def save(self, owner_id: str, modulo: str, contenido: str) -> StoredSpec:
        spec = self.check(modulo, contenido)
        current = await self.current(owner_id, spec.modulo)
        if current is not None and current.contenido == spec.contenido:
            raise Invalid("La spec es igual a la versión guardada: no hay nada que cambiar.")
        return await self._repo.add_version(owner_id, spec, self._clock())
