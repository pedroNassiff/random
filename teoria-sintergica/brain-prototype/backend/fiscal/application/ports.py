"""Puertos que implementa infrastructure."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from fiscal.domain.holidays import Holiday
from fiscal.domain.profile import TaxProfile
from fiscal.domain.status import Estado


@dataclass(frozen=True)
class StoredStatus:
    estado: Estado
    justificante: str | None


class FiscalRepository(Protocol):
    async def latest_profile(self, owner_id: str) -> TaxProfile | None: ...
    async def add_profile_version(self, owner_id: str, profile: TaxProfile) -> TaxProfile:
        """Inserta una versión nueva (nunca UPDATE) y la devuelve con su número de versión."""
        ...

    async def list_holidays(self) -> list[Holiday]: ...
    async def list_statuses(self, owner_id: str) -> dict[str, StoredStatus]: ...
    async def save_status(self, owner_id: str, key: str, status: StoredStatus, now: datetime) -> None: ...
