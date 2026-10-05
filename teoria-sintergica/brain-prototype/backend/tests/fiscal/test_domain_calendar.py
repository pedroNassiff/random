"""Calendario generado desde el perfil (spec § Calendario y notificaciones)."""

from __future__ import annotations

from dataclasses import replace
from datetime import date

import pytest

from fiscal.domain.calendar import Obligation, obligations_for
from fiscal.domain.holidays import BusinessCalendar
from tests.fiscal.helpers import PILOTO, barcelona

CAL = barcelona()


def by_key(items: list[Obligation]) -> dict[str, Obligation]:
    return {o.key: o for o in items}


def test_pilot_2026_has_every_obligation_exactly_once() -> None:
    items = obligations_for(PILOTO, 2026, CAL)
    keys = [o.key for o in items]
    assert len(keys) == len(set(keys)) == 4 * 3 + 2 + 12 + 1
    assert [o.vence for o in items] == sorted(o.vence for o in items)
    assert {o.ejercicio for o in items} == {2026}


@pytest.mark.parametrize(
    ("periodo", "vence"),
    [("1T", date(2026, 4, 20)), ("2T", date(2026, 7, 20)), ("3T", date(2026, 10, 20))],
)
def test_quarterly_models_share_the_due_date(periodo: str, vence: date) -> None:
    items = by_key(obligations_for(PILOTO, 2026, CAL))
    for modelo in ("303", "130", "349"):
        o = items[f"{modelo}-2026-{periodo}"]
        assert (o.vence_nominal, o.vence, o.provisional, o.periodo, o.modelo) == (vence, vence, False, periodo, modelo)


def test_fourth_quarter_and_annual_fall_in_the_next_year_and_are_provisional_without_holidays() -> None:
    items = by_key(obligations_for(PILOTO, 2026, CAL))
    for key in ("303-2026-4T", "130-2026-4T", "349-2026-4T", "390-2026-anual"):
        o = items[key]
        # 30/01/2027 es sábado y 2027 no tiene festivos cargados: lunes 1/02, marcado provisional.
        assert (o.vence_nominal, o.vence, o.provisional) == (date(2027, 1, 30), date(2027, 2, 1), True)
    renta = items["100-2026-anual"]
    assert (renta.vence_nominal, renta.vence, renta.provisional) == (date(2027, 6, 30), date(2027, 6, 30), True)
    assert "abril" in renta.nota


def test_titles_sources_and_conditional_349() -> None:
    items = by_key(obligations_for(PILOTO, 2026, CAL))
    assert items["303-2026-3T"].titulo == "IVA 3T 2026" and items["303-2026-3T"].fuente == "RIVA art. 71.4"
    assert items["130-2026-3T"].titulo == "Pago fraccionado IRPF 3T 2026"
    assert items["130-2026-3T"].fuente == "RIRPF art. 110"
    o349 = items["349-2026-3T"]
    assert o349.condicional and "clientes de la UE" in o349.nota and "EHA/769/2010" in o349.fuente
    assert not items["303-2026-3T"].condicional and items["303-2026-3T"].nota == ""
    assert items["390-2026-anual"].titulo == "Resumen anual de IVA 2026"
    assert items["100-2026-anual"].titulo == "Renta 2026"
    assert all(o.fuente for o in items.values())


def test_weekend_and_holiday_due_dates_move_to_next_business_day() -> None:
    # Ejercicio 2025: el 4T vence el viernes 30/01/2026, hábil.
    items = by_key(obligations_for(PILOTO, 2025, CAL))
    assert items["303-2025-4T"].vence == date(2026, 1, 30) and not items["303-2025-4T"].provisional
    assert items["100-2025-anual"].vence == date(2026, 6, 30)
    # Con el 20/10/2026 festivo, el 3T pasa al 21.
    cal = BusinessCalendar([date(2026, 10, 20)], [2026])
    o = by_key(obligations_for(PILOTO, 2026, cal))["303-2026-3T"]
    assert (o.vence_nominal, o.vence, o.provisional) == (date(2026, 10, 20), date(2026, 10, 21), False)


def test_only_quarters_with_activity_are_generated() -> None:
    keys = set(by_key(obligations_for(PILOTO, 2025, CAL)))
    assert keys == {
        "303-2025-4T",
        "130-2025-4T",
        "349-2025-4T",
        "390-2025-anual",
        "100-2025-anual",
        "RETA-2025-12",
    }
    assert obligations_for(PILOTO, 2024, CAL) == []


@pytest.mark.parametrize(
    ("alta", "first"),
    [
        (date(2026, 3, 31), "1T"),  # alta el último día del trimestre: ese trimestre ya obliga
        (date(2026, 4, 1), "2T"),
        (date(2026, 6, 30), "2T"),
        (date(2026, 7, 1), "3T"),
        (date(2026, 10, 1), "4T"),
        (date(2026, 12, 31), "4T"),
    ],
)
def test_first_quarter_depends_on_the_registration_date(alta: date, first: str) -> None:
    profile = replace(PILOTO, fecha_alta=alta, tarifa_plana_hasta=None)
    quarters = sorted(o.periodo for o in obligations_for(profile, 2026, CAL) if o.modelo == "303")
    assert quarters[0] == first and quarters[-1] == "4T"


def test_regime_decides_which_models_exist() -> None:
    def modelos(**change: object) -> set[str]:
        return {o.modelo for o in obligations_for(replace(PILOTO, **change), 2026, CAL)}  # type: ignore[arg-type]

    assert modelos() == {"303", "130", "349", "390", "100", "RETA"}
    assert modelos(regimen_iva="exento") == {"130", "349", "100", "RETA"}
    assert modelos(regimen_irpf="objetiva") == {"303", "349", "390", "100", "RETA"}
    assert modelos(roi=False) == {"303", "130", "390", "100", "RETA"}


def test_reta_is_charged_on_the_last_business_day_of_each_month() -> None:
    items = by_key(obligations_for(PILOTO, 2026, CAL))
    expected = {
        "01": date(2026, 1, 30),
        "02": date(2026, 2, 27),
        "05": date(2026, 5, 29),  # el 31 es domingo
        "10": date(2026, 10, 30),
        "12": date(2026, 12, 31),
    }
    for month, day in expected.items():
        o = items[f"RETA-2026-{month}"]
        assert (o.vence, o.vence_nominal, o.provisional, o.condicional) == (day, day, False, False)
    assert items["RETA-2026-10"].titulo == "Cuota de autónomos de octubre 2026"
    assert items["RETA-2026-01"].titulo == "Cuota de autónomos de enero 2026"
    assert items["RETA-2026-12"].titulo == "Cuota de autónomos de diciembre 2026"
    assert "saldo" in items["RETA-2026-10"].nota and items["RETA-2026-10"].periodo == "10"


def test_reta_month_end_skips_holidays_and_starts_the_month_of_registration() -> None:
    cal = BusinessCalendar([date(2026, 4, 30)], [2026])
    profile = replace(PILOTO, fecha_alta=date(2026, 4, 15), tarifa_plana_hasta=None)
    reta = [o for o in obligations_for(profile, 2026, cal) if o.modelo == "RETA"]
    assert [o.periodo for o in reta] == [f"{m:02d}" for m in range(4, 13)]
    assert reta[0].vence == date(2026, 4, 29)


def test_reta_without_holidays_falls_back_to_last_weekday_and_is_provisional() -> None:
    items = by_key(obligations_for(PILOTO, 2025, CAL))
    assert (items["RETA-2025-12"].vence, items["RETA-2025-12"].provisional) == (date(2025, 12, 31), True)
    y2027 = by_key(obligations_for(PILOTO, 2027, CAL))
    assert (y2027["RETA-2027-01"].vence, y2027["RETA-2027-01"].provisional) == (date(2027, 1, 29), True)  # 31 = dom
    assert (y2027["RETA-2027-02"].vence, y2027["RETA-2027-02"].provisional) == (date(2027, 2, 26), True)  # 28 = dom


def test_end_of_flat_rate_is_not_shifted_and_belongs_to_its_year() -> None:
    o = by_key(obligations_for(PILOTO, 2026, CAL))["RETA-2026-tarifa-plana"]
    # 05/12/2026 es sábado: no se traslada, la prórroga se pide antes.
    assert (o.vence, o.vence_nominal, o.provisional, o.condicional) == (
        date(2026, 12, 5),
        date(2026, 12, 5),
        False,
        False,
    )
    assert o.titulo == "Fin de la tarifa plana" and "prórroga" in o.nota and o.periodo == "tarifa-plana"
    assert "RETA-2027-tarifa-plana" not in by_key(obligations_for(PILOTO, 2027, CAL))
    assert "RETA-2025-tarifa-plana" not in by_key(obligations_for(PILOTO, 2025, CAL))
    without = replace(PILOTO, tarifa_plana_hasta=None)
    assert "RETA-2026-tarifa-plana" not in by_key(obligations_for(without, 2026, CAL))
