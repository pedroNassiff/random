"""Perfil fiscal del autónomo y las obligaciones que se derivan de él."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from datetime import date
from typing import Literal, get_args

from fiscal.domain.errors import FiscalRuleError

RegimenIva = Literal["general", "recargo_equivalencia", "exento"]
RegimenIrpf = Literal["directa_simplificada", "directa_normal", "objetiva"]

_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
_NIE_PREFIX = {"X": "0", "Y": "1", "Z": "2"}
_NIF_RE = re.compile(r"^([XYZ]\d{7}|\d{8})([A-Z])$")
_IAE_RE = re.compile(r"^\d{1,4}(\.\d{1,2})?$")


@dataclass(frozen=True)
class TaxProfile:
    nif: str
    fecha_alta: date
    iae: str
    regimen_iva: RegimenIva
    regimen_irpf: RegimenIrpf
    roi: bool
    tarifa_plana_hasta: date | None
    domicilio_fiscal: str
    municipio: str
    comunidad: str
    version: int = 0

    @property
    def presenta_iva(self) -> bool:
        """Modelos 303 y 390: solo en régimen general."""
        return self.regimen_iva == "general"

    @property
    def presenta_pago_fraccionado(self) -> bool:
        """Modelo 130: estimación directa (la objetiva usa el 131, fuera de alcance)."""
        return self.regimen_irpf in ("directa_simplificada", "directa_normal")


def normalize_nif(nif: str) -> str:
    """DNI o NIE en mayúsculas y sin separadores, con la letra de control verificada."""
    clean = re.sub(r"[\s.-]", "", nif).upper()
    match = _NIF_RE.match(clean)
    if match is None:
        raise FiscalRuleError("El NIF debe ser un DNI (8 dígitos y letra) o un NIE (X/Y/Z, 7 dígitos y letra).")
    digits, letter = match.groups()
    number = int(_NIE_PREFIX.get(digits[0], digits[0]) + digits[1:])
    if _DNI_LETTERS[number % len(_DNI_LETTERS)] != letter:
        raise FiscalRuleError("La letra del NIF no coincide con el número.")
    return clean


def _required(value: str, label: str) -> str:
    clean = value.strip()
    if not clean:
        raise FiscalRuleError(f"Falta {label}.")
    return clean


def validated(profile: TaxProfile) -> TaxProfile:
    """Devuelve el perfil normalizado o lanza FiscalRuleError con el primer dato inválido."""
    if profile.regimen_iva not in get_args(RegimenIva):
        raise FiscalRuleError("Régimen de IVA desconocido.")
    if profile.regimen_irpf not in get_args(RegimenIrpf):
        raise FiscalRuleError("Régimen de IRPF desconocido.")
    iae = profile.iae.strip()
    if not _IAE_RE.match(iae):
        raise FiscalRuleError("El epígrafe IAE debe ser numérico (por ejemplo, 763).")
    if profile.tarifa_plana_hasta is not None and profile.tarifa_plana_hasta <= profile.fecha_alta:
        raise FiscalRuleError("La tarifa plana debe terminar después de la fecha de alta.")
    return replace(
        profile,
        nif=normalize_nif(profile.nif),
        iae=iae,
        domicilio_fiscal=_required(profile.domicilio_fiscal, "el domicilio fiscal"),
        municipio=_required(profile.municipio, "el municipio"),
        comunidad=_required(profile.comunidad, "la comunidad autónoma"),
    )
