"""Spec de un módulo del dashboard: lo que NEO arma conversando y el builder va a construir."""

from __future__ import annotations

import re
from dataclasses import dataclass

from fiscal.domain.errors import FiscalRuleError

MAX_MODULO = 80
MAX_CONTENIDO = 20000
_ESCENARIO = re.compile(r"^\s*(Escenario|Esquema del escenario)\s*:", re.MULTILINE)
_CARACTERISTICA = re.compile(r"^\s*Característica\s*:", re.MULTILINE)


@dataclass(frozen=True)
class Spec:
    modulo: str
    contenido: str


def escenarios(contenido: str) -> int:
    return len(_ESCENARIO.findall(contenido))


def validated_spec(modulo: str, contenido: str) -> Spec:
    """La spec sin espacios de más. Exige criterios en Gherkin: al menos una Característica y un Escenario."""
    modulo, contenido = modulo.strip(), contenido.strip()
    if not modulo or len(modulo) > MAX_MODULO:
        raise FiscalRuleError(f"El nombre del módulo es obligatorio y tiene como mucho {MAX_MODULO} caracteres.")
    if len(contenido) > MAX_CONTENIDO:
        raise FiscalRuleError(f"La spec es demasiado larga: como mucho {MAX_CONTENIDO} caracteres.")
    if not _CARACTERISTICA.search(contenido):
        raise FiscalRuleError("La spec necesita los criterios de aceptación en Gherkin: falta la Característica.")
    if not escenarios(contenido):
        raise FiscalRuleError("La spec necesita al menos un Escenario en Gherkin.")
    return Spec(modulo, contenido)
