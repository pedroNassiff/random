"""Errores de reglas fiscales (dominio puro)."""

from __future__ import annotations


class FiscalRuleError(ValueError):
    """Dato o combinación que viola una regla del dominio fiscal."""


class MissingHolidays(FiscalRuleError):
    """Se pidió un cálculo en días hábiles para un año sin festivos cargados: no se adivina."""

    def __init__(self, year: int) -> None:
        super().__init__(f"No hay festivos cargados para {year}: no se puede calcular el plazo en días hábiles.")
        self.year = year
