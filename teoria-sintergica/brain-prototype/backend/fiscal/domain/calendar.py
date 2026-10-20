"""Calendario fiscal generado desde el perfil: nunca se carga a mano.

`obligations_for(perfil, ejercicio, calendario)` devuelve las obligaciones devengadas en ese ejercicio
(el 4T, el 390 y la Renta vencen ya en el año siguiente). Cada una cita su fuente.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from fiscal.domain.deadlines import settle
from fiscal.domain.errors import MissingHolidays
from fiscal.domain.holidays import BusinessCalendar, is_weekend
from fiscal.domain.profile import TaxProfile

_FUENTE_303 = "RIVA art. 71.4"
_FUENTE_130 = "RIRPF art. 110"
_FUENTE_349 = "RIVA arts. 78-81 y Orden EHA/769/2010"
_FUENTE_390 = "RIVA art. 71.7 e instrucciones del modelo 390"
_FUENTE_RENTA = "LIRPF art. 97; fechas según la orden anual de la campaña"
_FUENTE_RETA = "LGSS art. 38 ter y Reglamento General de Recaudación de la Seguridad Social"

_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre")  # fmt: skip


@dataclass(frozen=True)
class Obligation:
    key: str
    modelo: str
    ejercicio: int
    periodo: str
    titulo: str
    vence_nominal: date
    vence: date
    provisional: bool
    condicional: bool
    nota: str
    fuente: str


@dataclass(frozen=True)
class _Quarter:
    periodo: str
    ends: tuple[int, int]
    due: tuple[int, int, int]
    """(año relativo al ejercicio, mes, día) del último día de presentación."""


_QUARTERS = (
    _Quarter("1T", (3, 31), (0, 4, 20)),
    _Quarter("2T", (6, 30), (0, 7, 20)),
    _Quarter("3T", (9, 30), (0, 10, 20)),
    _Quarter("4T", (12, 31), (1, 1, 30)),
)


def _obligation(
    cal: BusinessCalendar,
    modelo: str,
    ejercicio: int,
    periodo: str,
    titulo: str,
    nominal: date,
    fuente: str,
    *,
    nota: str = "",
    condicional: bool = False,
) -> Obligation:
    settled = settle(nominal, cal)
    return Obligation(
        key=f"{modelo}-{ejercicio}-{periodo}",
        modelo=modelo,
        ejercicio=ejercicio,
        periodo=periodo,
        titulo=titulo,
        vence_nominal=nominal,
        vence=settled.vence,
        provisional=settled.provisional,
        condicional=condicional,
        nota=nota,
        fuente=fuente,
    )


def _quarterly(profile: TaxProfile, ejercicio: int, cal: BusinessCalendar) -> list[Obligation]:
    out: list[Obligation] = []
    for q in _QUARTERS:
        if profile.fecha_alta > date(ejercicio, *q.ends):
            continue  # todavía no había actividad en ese trimestre
        nominal = date(ejercicio + q.due[0], q.due[1], q.due[2])
        label = f"{q.periodo} {ejercicio}"
        if profile.presenta_iva:
            out.append(_obligation(cal, "303", ejercicio, q.periodo, f"IVA {label}", nominal, _FUENTE_303))
        if profile.presenta_pago_fraccionado:
            out.append(
                _obligation(cal, "130", ejercicio, q.periodo, f"Pago fraccionado IRPF {label}", nominal, _FUENTE_130)
            )
        if profile.roi:
            out.append(
                _obligation(
                    cal,
                    "349",
                    ejercicio,
                    q.periodo,
                    f"Operaciones intracomunitarias {label}",
                    nominal,
                    _FUENTE_349,
                    nota="Solo se presenta si hubo operaciones con clientes de la UE en el trimestre.",
                    condicional=True,
                )
            )
    return out


def _annual(profile: TaxProfile, ejercicio: int, cal: BusinessCalendar) -> list[Obligation]:
    out: list[Obligation] = []
    if profile.presenta_iva:
        nominal = date(ejercicio + 1, 1, 30)
        out.append(
            _obligation(cal, "390", ejercicio, "anual", f"Resumen anual de IVA {ejercicio}", nominal, _FUENTE_390)
        )
    out.append(
        _obligation(
            cal,
            "100",
            ejercicio,
            "anual",
            f"Renta {ejercicio}",
            date(ejercicio + 1, 6, 30),
            _FUENTE_RENTA,
            nota="La campaña abre en abril; el día exacto de apertura lo fija la orden de cada año.",
        )
    )
    return out


def _last_business_day(year: int, month: int, cal: BusinessCalendar) -> tuple[date, bool]:
    last = (date(year, month, 28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    try:
        return cal.previous_business_day(last), False
    except MissingHolidays:
        while is_weekend(last):
            last -= timedelta(days=1)
        return last, True


def _reta(profile: TaxProfile, ejercicio: int, cal: BusinessCalendar) -> list[Obligation]:
    out: list[Obligation] = []
    for month in range(1, 13):
        if (ejercicio, month) < (profile.fecha_alta.year, profile.fecha_alta.month):
            continue
        day, provisional = _last_business_day(ejercicio, month, cal)
        out.append(
            Obligation(
                key=f"RETA-{ejercicio}-{month:02d}",
                modelo="RETA",
                ejercicio=ejercicio,
                periodo=f"{month:02d}",
                titulo=f"Cuota de autónomos de {_MESES[month - 1]} {ejercicio}",
                vence_nominal=day,
                vence=day,
                provisional=provisional,
                condicional=False,
                nota="Cargo domiciliado el último día hábil del mes: tiene que haber saldo en la cuenta.",
                fuente=_FUENTE_RETA,
            )
        )
    end = profile.tarifa_plana_hasta
    if end is not None and end.year == ejercicio:
        # Sin traslado a día hábil: la prórroga se pide antes de la fecha, no después.
        out.append(
            Obligation(
                key=f"RETA-{ejercicio}-tarifa-plana",
                modelo="RETA",
                ejercicio=ejercicio,
                periodo="tarifa-plana",
                titulo="Fin de la tarifa plana",
                vence_nominal=end,
                vence=end,
                provisional=False,
                condicional=False,
                nota="La prórroga de 12 meses hay que solicitarla antes de esta fecha y exige rendimientos "
                "netos previstos por debajo del SMI.",
                fuente=_FUENTE_RETA,
            )
        )
    return out


def obligations_for(profile: TaxProfile, ejercicio: int, cal: BusinessCalendar) -> list[Obligation]:
    """Obligaciones devengadas en `ejercicio`, ordenadas por vencimiento."""
    if ejercicio < profile.fecha_alta.year:
        return []
    items = _quarterly(profile, ejercicio, cal) + _annual(profile, ejercicio, cal) + _reta(profile, ejercicio, cal)
    return sorted(items, key=lambda o: (o.vence, o.key))
