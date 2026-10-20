"""Motor de plazos: funciones puras `f(fechas, calendario) → resultado + traza`.

Cada resultado cita la norma que lo produce. Nunca lee el reloj ni adivina festivos.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from fiscal.domain.errors import FiscalRuleError, MissingHolidays
from fiscal.domain.holidays import BusinessCalendar, next_weekday

MAX_BUSINESS_DAYS = 120
_APREMIO_FIRST_HALF_LAST_DAY = 15
_APREMIO_SAME_MONTH_DUE = 20
_APREMIO_NEXT_MONTH_DUE = 5


@dataclass(frozen=True)
class Deadline:
    vence: date
    fuente: str
    traza: tuple[str, ...]


@dataclass(frozen=True)
class Settled:
    """Fecha nominal trasladada al siguiente día hábil. `provisional` = año sin festivos cargados."""

    vence: date
    provisional: bool


def _fmt(day: date) -> str:
    return day.strftime("%d/%m/%Y")


def business_days_deadline(notificado: date, dias: int, cal: BusinessCalendar) -> Deadline:
    """Plazo de `dias` hábiles contados desde el día siguiente a la notificación."""
    if not 1 <= dias <= MAX_BUSINESS_DAYS:
        raise FiscalRuleError(f"El plazo debe estar entre 1 y {MAX_BUSINESS_DAYS} días hábiles.")
    day, counted, skipped = notificado, 0, 0
    while counted < dias:
        day += timedelta(days=1)
        if cal.is_business_day(day):
            counted += 1
        else:
            skipped += 1
    return Deadline(
        day,
        "Ley 39/2015 art. 30.2 y 30.3",
        (
            f"Notificación: {_fmt(notificado)}. El cómputo empieza el día siguiente.",
            f"Se cuentan {dias} días hábiles; se saltan {skipped} inhábiles (sábados, domingos y festivos).",
            f"Último día del plazo: {_fmt(day)}.",
        ),
    )


def apremio_deadline(notificado: date, cal: BusinessCalendar) -> Deadline:
    """Plazo de pago de una providencia de apremio según la quincena en que se notifica."""
    if notificado.day <= _APREMIO_FIRST_HALF_LAST_DAY:
        nominal = notificado.replace(day=_APREMIO_SAME_MONTH_DUE)
        regla = f"Notificada entre los días 1 y 15: se paga hasta el día {_APREMIO_SAME_MONTH_DUE} del mismo mes."
    else:
        first_of_next = (notificado.replace(day=1) + timedelta(days=32)).replace(day=1)
        nominal = first_of_next.replace(day=_APREMIO_NEXT_MONTH_DUE)
        regla = (
            "Notificada entre el día 16 y fin de mes: "
            f"se paga hasta el día {_APREMIO_NEXT_MONTH_DUE} del mes siguiente."
        )
    vence = cal.next_business_day(nominal)
    traza = [f"Notificación: {_fmt(notificado)}.", regla]
    if vence != nominal:
        traza.append(f"El {_fmt(nominal)} es inhábil: pasa al siguiente día hábil.")
    traza.append(f"Último día de pago: {_fmt(vence)}.")
    return Deadline(vence, "LGT art. 62.5", tuple(traza))


def settle(nominal: date, cal: BusinessCalendar) -> Settled:
    """Traslada un vencimiento al siguiente día hábil. Si algún año tocado no tiene festivos cargados,
    solo salta fines de semana y lo marca provisional."""
    try:
        return Settled(cal.next_business_day(nominal), provisional=False)
    except MissingHolidays:
        return Settled(next_weekday(nominal), provisional=True)
