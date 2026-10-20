"""Casos de uso de ingresos y gastos: importar la planilla y resumir por categoría y mes."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from fiscal.application.errors import Invalid
from fiscal.domain.movements import Movement, MonthlySummary, Tipo, month_range, monthly_by_category
from fiscal.domain.sheet_import import ImportReport, import_sheets

MAX_MONTHS = 36


class MovementRepository(Protocol):
    async def upsert_movements(self, owner_id: str, movements: Sequence[Movement]) -> tuple[int, int]:
        """Inserta o actualiza por `fuente_ref`. Devuelve (nuevos, actualizados)."""
        ...

    async def list_movements(self, owner_id: str) -> list[Movement]: ...


SheetReader = Callable[[bytes], list[tuple[str, dict[str, str]]]]


@dataclass(frozen=True)
class ImportResult:
    report: ImportReport
    nuevos: int
    actualizados: int


@dataclass(frozen=True)
class SummaryView:
    summary: MonthlySummary
    personas: tuple[str, ...]
    """Personas que tienen movimientos de ese tipo (para el filtro)."""


class MovementService:
    def __init__(
        self,
        repo: MovementRepository,
        read_sheets: SheetReader,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repo
        self._read = read_sheets
        self._clock = clock

    async def import_sheet(self, owner_id: str, data: bytes) -> ImportResult:
        try:
            report = import_sheets(self._read(data))
        except ValueError as exc:
            raise Invalid(str(exc)) from exc
        if not report.meses:
            raise Invalid("No encontré pestañas de meses en el Excel (por ejemplo «enero 2026»).")
        nuevos, actualizados = await self._repo.upsert_movements(owner_id, report.movimientos)
        return ImportResult(report, nuevos, actualizados)

    async def summary(
        self, owner_id: str, *, tipo: Tipo = "gasto", personas: Sequence[str] = (), meses: int = 6
    ) -> SummaryView:
        if not 1 <= meses <= MAX_MONTHS:
            raise Invalid(f"Se pueden ver entre 1 y {MAX_MONTHS} meses.")
        movements = [m for m in await self._repo.list_movements(owner_id) if m.tipo == tipo]
        # Termina en el último mes con datos: si la planilla está al día, es el mes en curso.
        last = max((m.mes for m in movements), default=self._clock().date().replace(day=1))
        summary = monthly_by_category(movements, month_range(last, meses), tipo=tipo, personas=personas)
        return SummaryView(summary, tuple(sorted({m.persona for m in movements})))
