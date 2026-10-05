"""Casos de uso de facturas emitidas: registrar, anular y resumir por trimestre."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from fiscal.application.errors import Invalid, NotFound
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.invoices import Invoice, QuarterSummary, numbering_issues, quarter_summary, validated

_TZ = ZoneInfo("Europe/Madrid")


class InvoiceRepository(Protocol):
    async def add_invoice(self, owner_id: str, invoice: Invoice) -> Invoice: ...
    async def list_invoices(self, owner_id: str) -> list[Invoice]: ...
    async def void_invoice(self, owner_id: str, invoice_id: str) -> bool:
        """Marca la factura como anulada. False si no existe para ese dueño."""
        ...


@dataclass(frozen=True)
class InvoiceOverview:
    ejercicio: int
    invoices: tuple[Invoice, ...]
    numeracion: tuple[str, ...]


class InvoiceService:
    def __init__(self, repo: InvoiceRepository, *, clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self._repo = repo
        self._clock = clock

    def check(self, invoice: Invoice) -> Invoice:
        """Valida sin guardar (lo usa el agente para armar una propuesta)."""
        try:
            return validated(invoice, self._clock().astimezone(_TZ).date())
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc

    async def add(self, owner_id: str, invoice: Invoice) -> Invoice:
        return await self._repo.add_invoice(owner_id, self.check(invoice))

    async def void(self, owner_id: str, invoice_id: str) -> None:
        if not await self._repo.void_invoice(owner_id, invoice_id):
            raise NotFound("Esa factura no existe.")

    async def overview(self, owner_id: str, ejercicio: int) -> InvoiceOverview:
        """Facturas expedidas en el ejercicio, por número, con las incidencias de numeración."""
        mine = [i for i in await self._repo.list_invoices(owner_id) if i.fecha.year == ejercicio]
        mine.sort(key=lambda i: (i.serie, i.numero, i.fecha))
        return InvoiceOverview(ejercicio, tuple(mine), numbering_issues(mine))

    async def summary(self, owner_id: str, ejercicio: int, trimestre: int) -> QuarterSummary:
        try:
            return quarter_summary(await self._repo.list_invoices(owner_id), ejercicio, trimestre)
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc
