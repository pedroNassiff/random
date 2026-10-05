"""Casos de uso de clientes: alta, edición, archivo y comprobación del VAT en VIES."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Protocol

from fiscal.application.errors import Invalid, NotFound
from fiscal.domain.clients import Client, validated
from fiscal.domain.errors import FiscalRuleError


@dataclass(frozen=True)
class VatCheck:
    valid: bool
    name: str | None


class VatChecker(Protocol):
    async def check(self, country: str, number: str) -> VatCheck:
        """Consulta el registro VIES. Lanza Invalid si el servicio no responde."""
        ...


class ClientRepository(Protocol):
    async def add_client(self, owner_id: str, client: Client) -> Client:
        """Inserta el cliente con el siguiente código libre del dueño."""
        ...

    async def update_client(self, owner_id: str, client: Client) -> Client | None: ...
    async def get_client(self, owner_id: str, client_id: str) -> Client | None: ...
    async def list_clients(self, owner_id: str) -> list[Client]: ...


class ClientService:
    def __init__(
        self,
        repo: ClientRepository,
        vies: VatChecker,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repo
        self._vies = vies
        self._clock = clock

    @staticmethod
    def check(client: Client) -> Client:
        """Valida sin guardar (lo usa el agente para armar una propuesta)."""
        try:
            return validated(client)
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc

    async def list(self, owner_id: str, *, include_archived: bool = False) -> list[Client]:
        clients = await self._repo.list_clients(owner_id)
        return [c for c in clients if include_archived or c.activo]

    async def get(self, owner_id: str, client_id: str) -> Client:
        client = await self._repo.get_client(owner_id, client_id)
        if client is None:
            raise NotFound("Ese cliente no existe.")
        return client

    async def create(self, owner_id: str, client: Client) -> Client:
        return await self._repo.add_client(owner_id, self.check(client))

    async def update(self, owner_id: str, client_id: str, changes: Client) -> Client:
        """Reemplaza los datos editables; conserva código, estado y (si no cambió el VAT) la comprobación VIES."""
        current = await self.get(owner_id, client_id)
        merged = replace(
            changes,
            id=current.id,
            codigo=current.codigo,
            activo=current.activo,
            vies_ok=current.vies_ok,
            vies_checked_at=current.vies_checked_at,
            vies_nombre=current.vies_nombre,
        )
        clean = self.check(merged)
        # Una comprobación VIES solo vale para el VAT con que se hizo.
        if (clean.tax_id, clean.pais) != (current.tax_id, current.pais):
            clean = replace(clean, vies_ok=None, vies_checked_at=None, vies_nombre=None)
        return await self._save(owner_id, clean)

    async def archive(self, owner_id: str, client_id: str, *, activo: bool = False) -> Client:
        return await self._save(owner_id, replace(await self.get(owner_id, client_id), activo=activo))

    async def check_vies(self, owner_id: str, client_id: str) -> Client:
        client = await self.get(owner_id, client_id)
        if not client.requiere_vies or client.tax_id is None:
            raise Invalid("VIES solo aplica a empresas de otros países de la UE con VAT.")
        # El VAT puede venir con o sin el prefijo del país.
        number = client.tax_id.removeprefix(client.pais)
        result = await self._vies.check(client.pais, number)
        return await self._save(
            owner_id,
            replace(client, vies_ok=result.valid, vies_checked_at=self._clock(), vies_nombre=result.name),
        )

    async def _save(self, owner_id: str, client: Client) -> Client:
        saved = await self._repo.update_client(owner_id, client)
        if saved is None:
            raise NotFound("Ese cliente no existe.")
        return saved
