"""Ingresos y gastos (movimientos): categorías y resumen mensual por categoría. Funciones puras."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

Tipo = Literal["gasto", "ingreso"]
OTROS = "Otros"

# Orden = prioridad: la primera categoría cuya palabra aparezca en el concepto gana.
CATEGORIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Vivienda (tu parte)", ("renta + servicios",)),
    ("Impuestos y Seguridad Social", ("irpf", "seguridad social", "ss", "multa", "autonomo")),
    ("Préstamos y devoluciones", ("prestamo", "devolucion")),
    ("Vivienda", ("renta", "rennta", "departamento", "alquiler", "ikea")),
    ("Suministros", ("luz", "gas", "agua", "internet", "movil", "orange", "modem")),
    ("Transporte", ("parking", "bicin", "taxi", "uber", "gasolina")),
    ("Viajes", ("pasaje", "vuelo", "viaje")),
    ("Mascotas", ("gato", "gatito", "arenita", "veterinario", "sanji")),
    ("Supermercado", ("aldi", "supermercado", "compra super", "mercadona")),
    (
        "Suscripciones y software",
        (
            "youtube",
            "netflix",
            "dazn",
            "spotify",
            "play",
            "google",
            "sonet",
            "copilot",
            "supermaven",
            "vercel",
            "criosant",
        ),
    ),  # fmt: skip
    ("Tecnología", ("portatil", "pc", "muse", "ordenador")),
    ("Salud y deporte", ("yoga", "gym", "futbol", "medico", "farmacia")),
    ("Formación", ("curso", "journey")),
    ("Ropa", ("ropa", "buzo", "zapa")),
    ("Ocio y regalos", ("regalo", "restaurant", "cumple", "weed", "fiesta")),
)


def _fold(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(plain.casefold().split())


def categorize(concepto: str, tipo: Tipo = "gasto") -> str:
    """Categoría por palabras clave. Los ingresos se agrupan por concepto (cliente o fuente)."""
    if tipo == "ingreso":
        return "Ingresos"
    text = _fold(concepto)
    tokens = set(re.findall(r"[a-z0-9]+", text))
    for name, words in CATEGORIES:
        # Las claves cortas ("ss", "pc") solo cuentan como palabra entera: "ss" no debe atrapar "pasaje".
        if any((w in tokens) if len(w) <= 3 else (w in text) for w in words):
            return name
    return OTROS


@dataclass(frozen=True)
class Movement:
    mes: date
    """Primer día del mes al que corresponde."""
    tipo: Tipo
    persona: str
    concepto: str
    categoria: str
    importe: Decimal
    moneda: str = "EUR"
    fuente: str = ""
    fuente_ref: str = ""
    """Referencia estable en el origen (p. ej. pestaña y celda): una reimportación actualiza en vez de duplicar."""
    id: str = ""


def month_range(last: date, count: int) -> list[date]:
    """`count` meses terminando en el de `last` (primer día de cada mes), del más viejo al más nuevo."""
    months: list[date] = []
    year, month = last.year, last.month
    for _ in range(count):
        months.append(date(year, month, 1))
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return months[::-1]


@dataclass(frozen=True)
class CategoryRow:
    categoria: str
    valores: tuple[Decimal, ...]
    total: Decimal
    promedio: Decimal
    variacion: Decimal | None
    """Último mes contra el anterior, en %; None si el anterior es 0."""
    conceptos: tuple[str, ...]


@dataclass(frozen=True)
class MonthlySummary:
    meses: tuple[date, ...]
    filas: tuple[CategoryRow, ...]
    totales: tuple[Decimal, ...]
    total: Decimal


def _variation(previous: Decimal, current: Decimal) -> Decimal | None:
    if previous == 0:
        return None
    return ((current - previous) / previous * 100).quantize(Decimal("0.1"))


def monthly_by_category(
    movements: Iterable[Movement], months: Sequence[date], *, tipo: Tipo = "gasto", personas: Sequence[str] = ()
) -> MonthlySummary:
    """Tabla categoría × mes. `personas` vacío = todas. Filas ordenadas por total, de mayor a menor."""
    index = {m: i for i, m in enumerate(months)}
    zero = Decimal("0.00")
    grid: dict[str, list[Decimal]] = {}
    names: dict[str, set[str]] = {}
    for mv in movements:
        if mv.tipo != tipo or mv.mes not in index or (personas and mv.persona not in personas):
            continue
        row = grid.setdefault(mv.categoria, [zero] * len(months))
        row[index[mv.mes]] += mv.importe.quantize(Decimal("0.01"))  # siempre en céntimos
        names.setdefault(mv.categoria, set()).add(mv.concepto)
    rows = [
        CategoryRow(
            categoria,
            tuple(values),
            sum(values, zero),
            (sum(values, zero) / len(months)).quantize(Decimal("0.01")) if months else zero,
            _variation(values[-2], values[-1]) if len(values) > 1 else None,
            tuple(sorted(names[categoria], key=str.casefold)),
        )
        for categoria, values in grid.items()
    ]
    rows.sort(key=lambda r: (-r.total, r.categoria))
    totals = tuple(sum((r.valores[i] for r in rows), zero) for i in range(len(months)))
    return MonthlySummary(tuple(months), tuple(rows), totals, sum(totals, zero))
