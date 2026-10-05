"""Motor de plazos: Ley 39/2015 art. 30 (días hábiles) y LGT art. 62.5 (apremio)."""

from __future__ import annotations

from datetime import date

import pytest

from fiscal.domain.deadlines import (
    MAX_BUSINESS_DAYS,
    Settled,
    apremio_deadline,
    business_days_deadline,
    settle,
)
from fiscal.domain.errors import FiscalRuleError, MissingHolidays
from tests.fiscal.helpers import barcelona

CAL = barcelona()


@pytest.mark.parametrize(
    ("notificado", "dias", "vence"),
    [
        (date(2026, 10, 5), 1, date(2026, 10, 6)),  # el cómputo empieza el día siguiente
        (date(2026, 10, 2), 1, date(2026, 10, 5)),  # notificado en viernes
        (date(2026, 10, 3), 1, date(2026, 10, 5)),  # notificado en sábado
        (date(2026, 10, 5), 5, date(2026, 10, 13)),  # salta el fin de semana y el 12/10
        (date(2026, 9, 21), 10, date(2026, 10, 6)),  # requerimiento de 10 días: salta La Mercè
        (date(2026, 9, 10), 10, date(2026, 9, 28)),  # salta la Diada y La Mercè
        (date(2026, 12, 1), 15, date(2026, 12, 23)),  # salta el 8/12 (el 6 cae en domingo)
    ],
)
def test_business_days_deadline(notificado: date, dias: int, vence: date) -> None:
    result = business_days_deadline(notificado, dias, CAL)
    assert result.vence == vence
    assert result.fuente == "Ley 39/2015 art. 30.2 y 30.3"


def test_business_days_trace_explains_the_count() -> None:
    result = business_days_deadline(date(2026, 9, 21), 10, CAL)
    assert result.traza == (
        "Notificación: 21/09/2026. El cómputo empieza el día siguiente.",
        "Se cuentan 10 días hábiles; se saltan 5 inhábiles (sábados, domingos y festivos).",
        "Último día del plazo: 06/10/2026.",
    )


@pytest.mark.parametrize("dias", [0, -1, MAX_BUSINESS_DAYS + 1])
def test_business_days_out_of_range(dias: int) -> None:
    with pytest.raises(FiscalRuleError, match="entre 1 y 120"):
        business_days_deadline(date(2026, 10, 5), dias, CAL)


def test_business_days_accepts_the_maximum() -> None:
    assert business_days_deadline(date(2026, 1, 1), MAX_BUSINESS_DAYS, CAL).vence.year == 2026


def test_business_days_never_guess_into_an_uncovered_year() -> None:
    with pytest.raises(MissingHolidays, match="2027"):
        business_days_deadline(date(2026, 12, 28), 10, CAL)


@pytest.mark.parametrize(
    ("notificado", "vence"),
    [
        (date(2026, 8, 1), date(2026, 8, 20)),  # primera quincena → día 20 del mismo mes
        (date(2026, 8, 15), date(2026, 8, 20)),  # el 15 todavía es primera quincena
        (date(2026, 8, 16), date(2026, 9, 7)),  # el 16 ya es segunda: 5/09 es sábado → lunes 7
        (date(2026, 9, 15), date(2026, 9, 21)),  # 20/09 es domingo → lunes 21
        (date(2026, 9, 16), date(2026, 10, 5)),  # caso de la spec: apremio fracciones 5 y 6
        (date(2026, 9, 30), date(2026, 10, 5)),
        (date(2026, 1, 31), date(2026, 2, 5)),  # mes de 31 días
        (date(2026, 2, 28), date(2026, 3, 5)),  # febrero
        (date(2026, 11, 20), date(2026, 12, 7)),  # 5/12 sábado, 6/12 domingo festivo → lunes 7
    ],
)
def test_apremio_deadline(notificado: date, vence: date) -> None:
    result = apremio_deadline(notificado, CAL)
    assert result.vence == vence and result.fuente == "LGT art. 62.5"


def test_apremio_trace_mentions_the_shift_only_when_it_happens() -> None:
    plain = apremio_deadline(date(2026, 9, 16), CAL).traza
    assert plain == (
        "Notificación: 16/09/2026.",
        "Notificada entre el día 16 y fin de mes: se paga hasta el día 5 del mes siguiente.",
        "Último día de pago: 05/10/2026.",
    )
    shifted = apremio_deadline(date(2026, 9, 15), CAL).traza
    assert shifted == (
        "Notificación: 15/09/2026.",
        "Notificada entre los días 1 y 15: se paga hasta el día 20 del mismo mes.",
        "El 20/09/2026 es inhábil: pasa al siguiente día hábil.",
        "Último día de pago: 21/09/2026.",
    )


def test_apremio_crossing_into_an_uncovered_year_raises() -> None:
    with pytest.raises(MissingHolidays, match="2027"):
        apremio_deadline(date(2026, 12, 16), CAL)


def test_settle_shifts_to_business_day_and_flags_uncovered_years() -> None:
    assert settle(date(2026, 10, 20), CAL) == Settled(date(2026, 10, 20), provisional=False)
    assert settle(date(2026, 10, 10), CAL) == Settled(date(2026, 10, 13), provisional=False)
    assert settle(date(2027, 1, 30), CAL) == Settled(date(2027, 2, 1), provisional=True)  # sábado
    assert settle(date(2027, 1, 29), CAL) == Settled(date(2027, 1, 29), provisional=True)
