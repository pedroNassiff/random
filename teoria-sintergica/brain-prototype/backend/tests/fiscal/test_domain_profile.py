"""Perfil fiscal: validación y obligaciones que derivan del régimen."""

from __future__ import annotations

from dataclasses import replace
from datetime import date

import pytest

from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.profile import normalize_nif, validated
from tests.fiscal.helpers import PILOTO


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("12345678Z", "12345678Z"),
        (" 12.345.678-z ", "12345678Z"),
        ("00000000T", "00000000T"),
        ("X1234567L", "X1234567L"),
        ("y1234567x", "Y1234567X"),
        ("Z1234567R", "Z1234567R"),
    ],
)
def test_normalize_nif_accepts_dni_and_nie(raw: str, clean: str) -> None:
    assert normalize_nif(raw) == clean


@pytest.mark.parametrize("raw", ["12345678A", "X1234567A", "Y1234567L"])
def test_nif_with_wrong_control_letter(raw: str) -> None:
    with pytest.raises(FiscalRuleError, match="letra del NIF"):
        normalize_nif(raw)


@pytest.mark.parametrize("raw", ["", "1234567Z", "123456789Z", "B12345678", "W1234567L", "12345678", "12345678ZZ"])
def test_nif_with_wrong_shape(raw: str) -> None:
    with pytest.raises(FiscalRuleError, match="DNI"):
        normalize_nif(raw)


def test_validated_normalizes_text_fields() -> None:
    p = validated(replace(PILOTO, nif="12.345.678-z", iae=" 763 ", municipio=" Barcelona ", comunidad=" Cataluña "))
    assert (p.nif, p.iae, p.municipio, p.comunidad) == ("12345678Z", "763", "Barcelona", "Cataluña")
    assert p.domicilio_fiscal == PILOTO.domicilio_fiscal and p.fecha_alta == PILOTO.fecha_alta


@pytest.mark.parametrize("iae", ["763", "7", "8999", "763.1", "763.12"])
def test_valid_iae(iae: str) -> None:
    assert validated(replace(PILOTO, iae=iae)).iae == iae


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"regimen_iva": "otro"}, "Régimen de IVA"),
        ({"regimen_irpf": "otro"}, "Régimen de IRPF"),
        ({"iae": ""}, "epígrafe IAE"),
        ({"iae": "abc"}, "epígrafe IAE"),
        ({"iae": "12345"}, "epígrafe IAE"),
        ({"iae": "763.123"}, "epígrafe IAE"),
        ({"tarifa_plana_hasta": date(2025, 12, 5)}, "tarifa plana"),
        ({"tarifa_plana_hasta": date(2025, 12, 4)}, "tarifa plana"),
        ({"domicilio_fiscal": "  "}, "Falta el domicilio fiscal"),
        ({"municipio": ""}, "Falta el municipio"),
        ({"comunidad": ""}, "Falta la comunidad autónoma"),
        ({"nif": "nope"}, "DNI"),
    ],
)
def test_invalid_profiles(change: dict[str, object], message: str) -> None:
    with pytest.raises(FiscalRuleError, match=message):
        validated(replace(PILOTO, **change))  # type: ignore[arg-type]


def test_tarifa_plana_is_optional_and_may_end_the_day_after_alta() -> None:
    assert validated(replace(PILOTO, tarifa_plana_hasta=None)).tarifa_plana_hasta is None
    assert validated(replace(PILOTO, tarifa_plana_hasta=date(2025, 12, 6))).tarifa_plana_hasta == date(2025, 12, 6)


@pytest.mark.parametrize(
    ("regimen", "presenta"), [("general", True), ("recargo_equivalencia", False), ("exento", False)]
)
def test_only_general_regime_files_vat(regimen: str, presenta: bool) -> None:
    assert replace(PILOTO, regimen_iva=regimen).presenta_iva is presenta  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("regimen", "presenta"), [("directa_simplificada", True), ("directa_normal", True), ("objetiva", False)]
)
def test_only_direct_estimation_files_130(regimen: str, presenta: bool) -> None:
    assert replace(PILOTO, regimen_irpf=regimen).presenta_pago_fraccionado is presenta  # type: ignore[arg-type]
