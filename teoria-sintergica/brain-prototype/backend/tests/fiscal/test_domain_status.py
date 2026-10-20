"""Estados de una obligación y avisos T−15 / T−5 / T−1 / T."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.status import ESTADOS, MAX_JUSTIFICANTE, alert_stage, is_closed, validate_status

VENCE = date(2026, 10, 20)


def test_states_and_which_ones_close() -> None:
    assert ESTADOS == ("pendiente", "preparado", "presentado", "pagado")
    assert [is_closed(e) for e in ESTADOS] == [False, False, True, True]


@pytest.mark.parametrize("estado", ["pendiente", "preparado"])
def test_open_states_do_not_need_receipt(estado: str) -> None:
    assert validate_status(estado, None) == (estado, None)
    assert validate_status(estado, "   ") == (estado, None)
    assert validate_status(estado, " nota ") == (estado, "nota")


@pytest.mark.parametrize("estado", ["presentado", "pagado"])
def test_closing_requires_receipt(estado: str) -> None:
    for missing in (None, "", "   "):
        with pytest.raises(FiscalRuleError, match="justificante"):
            validate_status(estado, missing)
    assert validate_status(estado, " CSV-ABC123 ") == (estado, "CSV-ABC123")


def test_unknown_state_and_too_long_receipt() -> None:
    with pytest.raises(FiscalRuleError, match="Estado desconocido"):
        validate_status("archivado", "x")
    assert validate_status("pagado", "x" * MAX_JUSTIFICANTE)[1] == "x" * MAX_JUSTIFICANTE
    with pytest.raises(FiscalRuleError, match="hasta 500"):
        validate_status("pagado", "x" * (MAX_JUSTIFICANTE + 1))


@pytest.mark.parametrize(
    ("days_left", "aviso"),
    [
        (30, "sin_aviso"),
        (16, "sin_aviso"),
        (15, "T-15"),
        (6, "T-15"),
        (5, "T-5"),
        (2, "T-5"),
        (1, "T-1"),
        (0, "T"),
        (-1, "vencida"),
        (-40, "vencida"),
    ],
)
def test_alert_stage_boundaries(days_left: int, aviso: str) -> None:
    today = VENCE - timedelta(days=days_left)
    assert alert_stage(VENCE, today, "pendiente") == aviso
    assert alert_stage(VENCE, today, "preparado") == aviso


@pytest.mark.parametrize("estado", ["presentado", "pagado"])
@pytest.mark.parametrize("days_left", [10, 0, -5])
def test_closed_obligations_never_alert(estado: str, days_left: int) -> None:
    assert alert_stage(VENCE, VENCE - timedelta(days=days_left), estado) == "sin_aviso"  # type: ignore[arg-type]
