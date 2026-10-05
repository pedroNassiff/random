"""Estado de una obligación y avisos previos al vencimiento (T−15, T−5, T−1, T)."""

from __future__ import annotations

from datetime import date
from typing import Literal, get_args

from fiscal.domain.errors import FiscalRuleError

Estado = Literal["pendiente", "preparado", "presentado", "pagado"]
Aviso = Literal["sin_aviso", "T-15", "T-5", "T-1", "T", "vencida"]

ESTADOS: tuple[Estado, ...] = get_args(Estado)
CERRADOS: frozenset[Estado] = frozenset({"presentado", "pagado"})
MAX_JUSTIFICANTE = 500
_T15, _T5, _T1 = 15, 5, 1


def is_closed(estado: Estado) -> bool:
    return estado in CERRADOS


def validate_status(estado: str, justificante: str | None) -> tuple[Estado, str | None]:
    """Una obligación solo se cierra (presentada o pagada) con su justificante."""
    if estado not in ESTADOS:
        raise FiscalRuleError("Estado desconocido.")
    clean = (justificante or "").strip()
    if len(clean) > MAX_JUSTIFICANTE:
        raise FiscalRuleError(f"El justificante puede tener hasta {MAX_JUSTIFICANTE} caracteres.")
    if estado in CERRADOS and not clean:
        raise FiscalRuleError("Para cerrarla hace falta el justificante (CSV o número de referencia).")
    return estado, clean or None


def alert_stage(vence: date, today: date, estado: Estado) -> Aviso:
    """Etapa de aviso que corresponde hoy. Una obligación cerrada no avisa."""
    if is_closed(estado):
        return "sin_aviso"
    left = (vence - today).days
    if left < 0:
        return "vencida"
    if left == 0:
        return "T"
    if left <= _T1:
        return "T-1"
    if left <= _T5:
        return "T-5"
    if left <= _T15:
        return "T-15"
    return "sin_aviso"
