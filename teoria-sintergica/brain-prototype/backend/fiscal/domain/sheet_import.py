"""Importación de la planilla mensual de cuentas (una pestaña por mes) a movimientos.

Distribución de cada pestaña mensual, tal como la usa el caso piloto:
- Columna A/B: gastos personales de Pedro hasta la fila de total. Un rótulo "Gastos Emma" pasa a los de Emma.
- Columna E/F: servicios del hogar (renta, luz, agua…) hasta "total servicios".
- Columna I/J: ingresos; el rótulo "ingresos - Emma" pasa a los de Emma.
Se descarta lo que está debajo de los totales (cálculos de reparto y apuntes copiados de un mes a otro).
Puro: recibe las celdas ya leídas del archivo.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from fiscal.domain.movements import Movement, categorize

Cells = Mapping[str, str]
"""Celdas de una pestaña: referencia ("B12") → valor tal como viene en el archivo."""

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}  # fmt: skip
MAX_ROW = 60
FUENTE = "planilla"


@dataclass
class ImportReport:
    movimientos: list[Movement] = field(default_factory=list)
    meses: list[date] = field(default_factory=list)
    omitidas: list[str] = field(default_factory=list)
    """Pestañas que no son de un mes (viajes, notas)."""
    dudosos: list[str] = field(default_factory=list)
    """Filas con datos que no se importaron porque no está claro qué representan."""
    descuadres: list[str] = field(default_factory=list)
    """Meses en que la suma importada no coincide con el total escrito en la planilla."""


def _fold(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(plain.casefold().split())


def _number(value: str | None) -> Decimal | None:
    if value is None or not value.strip():
        return None
    try:
        return Decimal(value.strip().replace(",", "."))
    except InvalidOperation:
        return None


def _month_of(name: str) -> tuple[int, int | None] | None:
    """('octubre-2026') → (10, 2026); ('Octubre') → (10, None); None si la pestaña no es de un mes."""
    match = re.fullmatch(r"([a-z]+)[\s\-_]*(\d{4})?", _fold(name))
    if not match or match.group(1) not in MONTHS:
        return None
    return MONTHS[match.group(1)], int(match.group(2)) if match.group(2) else None


def assign_months(sheet_names: Sequence[str]) -> dict[str, date]:
    """Mes de cada pestaña. Las pestañas van de la más nueva a la más vieja; a las que no dicen el año se les
    infiere del vecino anterior (si el mes 'sube', se cruzó a un año antes)."""
    out: dict[str, date] = {}
    previous: date | None = None
    for name in sheet_names:
        parsed = _month_of(name)
        if parsed is None:
            continue
        month, year = parsed
        if year is None:
            if previous is None:
                continue
            year = previous.year if month < previous.month else previous.year - 1
        previous = date(year, month, 1)
        out[name] = previous
    return out


def _block(cells: Cells, label_col: str, value_col: str, rows: range) -> list[tuple[int, str | None, Decimal | None]]:
    return [
        (r, (cells.get(f"{label_col}{r}") or "").strip() or None, _number(cells.get(f"{value_col}{r}"))) for r in rows
    ]


def _personal(sheet: str, mes: date, cells: Cells, report: ImportReport) -> None:
    persona, total_row, items = "Pedro", None, []
    for row, label, value in _block(cells, "A", "B", range(2, MAX_ROW)):
        folded = _fold(label or "")
        if folded == "gastos emma":
            persona = "Emma"
            continue
        if value is not None and (label is None or folded in ("gastos pedro", "gastos")):
            total_row = (row, value)  # fila de total: lo que sigue son cálculos y apuntes viejos
            break
        if label and value is not None and folded not in ("gastos", "gastos pedro"):
            items.append((row, label, value, persona))
    for row, label, value, who in items:
        report.movimientos.append(
            Movement(mes, "gasto", who, label, categorize(label), value, fuente=FUENTE, fuente_ref=f"{sheet}!A{row}")
        )
    if total_row is not None:
        pedro = sum((v for _, _, v, who in items if who == "Pedro"), Decimal("0"))
        if pedro != total_row[1]:
            report.descuadres.append(
                f"{sheet}: gastos de Pedro suman {pedro} y la planilla dice {total_row[1]} (fila {total_row[0]})."
            )


def _household(sheet: str, mes: date, cells: Cells, report: ImportReport) -> None:
    for row, label, value in _block(cells, "E", "F", range(2, MAX_ROW)):
        folded = _fold(label or "")
        if folded.startswith("total") or folded == "viaje":
            break  # debajo vienen totales o apuntes de viajes ya pagados
        if label and value is not None and folded not in ("servicios", "servicio"):
            report.movimientos.append(
                Movement(
                    mes, "gasto", "Hogar", label, categorize(label), value, fuente=FUENTE, fuente_ref=f"{sheet}!E{row}"
                )
            )


def _income(sheet: str, mes: date, cells: Cells, report: ImportReport) -> None:
    persona = "Pedro"
    for row, label, value in _block(cells, "I", "J", range(2, MAX_ROW)):
        folded = _fold(label or "")
        if folded.startswith("gastos - ingresos"):
            break
        if folded.startswith("ingresos"):
            persona = "Emma" if "emma" in folded else persona
            if value is not None:  # "ingresos - Emma | 1792": el importe va en la misma fila
                report.movimientos.append(
                    Movement(
                        mes,
                        "ingreso",
                        persona,
                        f"Ingresos {persona}",
                        "Ingresos",
                        value,
                        fuente=FUENTE,
                        fuente_ref=f"{sheet}!I{row}",
                    )
                )
            continue
        if label is None:
            continue  # sin rótulo es un total parcial
        if value is None:
            note = (cells.get(f"K{row}") or cells.get(f"L{row}") or "").strip()
            if note:
                report.dudosos.append(f"{sheet}!I{row}: «{label}» sin importe en euros (nota: {note}).")
            continue
        report.movimientos.append(
            Movement(mes, "ingreso", persona, label, "Ingresos", value, fuente=FUENTE, fuente_ref=f"{sheet}!I{row}")
        )


def import_sheets(sheets: Sequence[tuple[str, Cells]]) -> ImportReport:
    """`sheets` en el orden del archivo (de la pestaña más nueva a la más vieja)."""
    report = ImportReport()
    months = assign_months([name for name, _ in sheets])
    for name, cells in sheets:
        mes = months.get(name)
        if mes is None:
            report.omitidas.append(name)
            continue
        report.meses.append(mes)
        _personal(name, mes, cells, report)
        _household(name, mes, cells, report)
        _income(name, mes, cells, report)
    report.meses.sort()
    return report
