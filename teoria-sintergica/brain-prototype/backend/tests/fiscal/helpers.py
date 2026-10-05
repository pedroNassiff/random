"""Datos compartidos por los tests fiscales: el caso piloto de la spec y los festivos sembrados."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from fiscal.domain.holidays import BusinessCalendar, Holiday, build_calendar
from fiscal.domain.profile import TaxProfile

MIGRATIONS = Path(__file__).parents[2] / "fiscal" / "migrations"
TERRITORIOS = ("ES", "Cataluña", "Barcelona")
_ROW = re.compile(r"\('(\d{4})-(\d{2})-(\d{2})', '([^']+)', '([^']+)'\)")


def seeded_holidays() -> list[Holiday]:
    """Los festivos tal cual están en las migraciones: los tests calculan con el dato de producción."""
    out: list[Holiday] = []
    for path in sorted(MIGRATIONS.glob("*holidays*.sql")):
        for y, m, d, territorio, nombre in _ROW.findall(path.read_text(encoding="utf-8")):
            out.append(Holiday(date(int(y), int(m), int(d)), territorio, nombre))
    return out


def barcelona() -> BusinessCalendar:
    return build_calendar(seeded_holidays(), TERRITORIOS)


# Caso piloto de la spec. El NIF es de ejemplo (12345678Z), no un dato real.
PILOTO = TaxProfile(
    nif="12345678Z",
    fecha_alta=date(2025, 12, 5),
    iae="763",
    regimen_iva="general",
    regimen_irpf="directa_simplificada",
    roi=True,
    tarifa_plana_hasta=date(2026, 12, 5),
    domicilio_fiscal="Carrer de l'Exemple 1",
    municipio="Barcelona",
    comunidad="Cataluña",
)
