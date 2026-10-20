"""Casos de uso: perfil versionado, calendario con estado y avisos, y plazos."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from fiscal.application.errors import Invalid, NotFound
from fiscal.application.ports import StoredStatus
from fiscal.application.service import CalendarItem, FiscalService
from tests.fiscal.fakes import FakeFiscalRepo
from tests.fiscal.helpers import PILOTO

PEDRO, ANA = "u-pedro", "u-ana"
NOW = datetime(2026, 10, 1, 10, tzinfo=UTC)


class Clock:
    def __init__(self, now: datetime = NOW) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


async def make(now: datetime = NOW, *, with_profile: bool = True) -> tuple[FiscalService, FakeFiscalRepo, Clock]:
    repo, clock = FakeFiscalRepo(), Clock(now)
    svc = FiscalService(repo, clock=clock)
    if with_profile:
        await svc.save_profile(PEDRO, PILOTO)
    return svc, repo, clock


def item(items: tuple[CalendarItem, ...], key: str) -> CalendarItem:
    return next(i for i in items if i.obligation.key == key)


async def test_profile_is_versioned_and_never_overwritten() -> None:
    svc, repo, _ = await make(with_profile=False)
    assert await svc.get_profile(PEDRO) is None
    v1 = await svc.save_profile(PEDRO, replace(PILOTO, nif=" 12.345.678-z "))
    v2 = await svc.save_profile(PEDRO, replace(PILOTO, roi=False))
    assert (v1.version, v1.nif, v1.roi) == (1, "12345678Z", True)
    assert (v2.version, v2.roi) == (2, False)
    assert [p.version for p in repo.profiles[PEDRO]] == [1, 2] and repo.profiles[PEDRO][0].roi
    assert await svc.get_profile(PEDRO) == v2
    assert await svc.get_profile(ANA) is None


async def test_invalid_profile_is_rejected_and_not_stored() -> None:
    svc, repo, _ = await make(with_profile=False)
    with pytest.raises(Invalid, match="letra del NIF"):
        await svc.save_profile(PEDRO, replace(PILOTO, nif="12345678A"))
    with pytest.raises(Invalid, match="no puede ser futura"):
        await svc.save_profile(PEDRO, replace(PILOTO, fecha_alta=date(2026, 10, 2), tarifa_plana_hasta=None))
    assert repo.profiles == {}
    # Hoy mismo sí es una fecha de alta válida.
    today = await svc.save_profile(PEDRO, replace(PILOTO, fecha_alta=date(2026, 10, 1), tarifa_plana_hasta=None))
    assert today.version == 1


async def test_today_uses_madrid_time_not_utc() -> None:
    # 30/09 23:30 UTC ya es 1/10 en Madrid.
    svc, _, _ = await make(datetime(2026, 9, 30, 23, 30, tzinfo=UTC))
    assert (await svc.calendar(PEDRO)).hoy == date(2026, 10, 1)


async def test_calendar_needs_a_profile() -> None:
    svc, _, _ = await make(with_profile=False)
    with pytest.raises(NotFound, match="perfil fiscal"):
        await svc.calendar(PEDRO)
    with pytest.raises(NotFound, match="perfil fiscal"):
        await svc.set_status(PEDRO, "303-2026-3T", "preparado", None)
    with pytest.raises(NotFound, match="perfil fiscal"):
        await svc.deadline(PEDRO, "apremio", date(2026, 9, 16))


async def test_calendar_spans_from_registration_year_to_current_year_sorted() -> None:
    svc, _, _ = await make()
    view = await svc.calendar(PEDRO)
    assert view.hoy == date(2026, 10, 1) and view.festivos_cargados == (2026,)
    assert {i.obligation.ejercicio for i in view.items} == {2025, 2026}
    dates = [i.obligation.vence for i in view.items]
    assert dates == sorted(dates) and len(view.items) == 6 + 27
    assert all(i.estado == "pendiente" and i.justificante is None for i in view.items)


async def test_calendar_alerts_match_the_spec_example_for_october_2026() -> None:
    svc, _, _ = await make()
    items = (await svc.calendar(PEDRO)).items
    q3 = item(items, "303-2026-3T")
    assert (q3.obligation.vence, q3.dias_restantes, q3.aviso) == (date(2026, 10, 20), 19, "sin_aviso")
    assert item(items, "303-2026-2T").aviso == "vencida" and item(items, "303-2026-2T").dias_restantes == -73
    assert item(items, "303-2026-4T").aviso == "sin_aviso"


@pytest.mark.parametrize(("day", "aviso"), [(5, "T-15"), (15, "T-5"), (19, "T-1"), (20, "T"), (21, "vencida")])
async def test_alert_escalates_as_the_due_date_approaches(day: int, aviso: str) -> None:
    svc, _, _ = await make(datetime(2026, 10, day, 10, tzinfo=UTC))
    assert item((await svc.calendar(PEDRO)).items, "130-2026-3T").aviso == aviso


async def test_closing_an_obligation_requires_receipt_and_silences_the_alert() -> None:
    svc, repo, _ = await make()
    with pytest.raises(Invalid, match="justificante"):
        await svc.set_status(PEDRO, "303-2026-2T", "presentado", " ")
    assert repo.statuses == {}

    prepared = await svc.set_status(PEDRO, "303-2026-2T", "preparado", None)
    assert (prepared.estado, prepared.aviso, prepared.justificante) == ("preparado", "vencida", None)

    closed = await svc.set_status(PEDRO, "303-2026-2T", "presentado", " CSV-123 ")
    assert (closed.estado, closed.justificante, closed.aviso, closed.dias_restantes) == (
        "presentado",
        "CSV-123",
        "sin_aviso",
        -73,
    )
    assert repo.statuses[PEDRO]["303-2026-2T"] == StoredStatus("presentado", "CSV-123")
    assert repo.saved_at == [NOW, NOW]
    stored = item((await svc.calendar(PEDRO)).items, "303-2026-2T")
    assert (stored.estado, stored.justificante, stored.aviso) == ("presentado", "CSV-123", "sin_aviso")


async def test_status_rejects_unknown_state_and_unknown_obligation() -> None:
    svc, repo, _ = await make()
    with pytest.raises(Invalid, match="Estado desconocido"):
        await svc.set_status(PEDRO, "303-2026-2T", "archivado", None)
    for key in ("303-2030-1T", "303-2024-4T", "inventada"):
        with pytest.raises(NotFound, match="no está en tu calendario"):
            await svc.set_status(PEDRO, key, "preparado", None)
    assert repo.statuses == {}


async def test_data_is_isolated_per_owner() -> None:
    svc, _, _ = await make()
    await svc.save_profile(ANA, replace(PILOTO, roi=False))
    await svc.set_status(PEDRO, "303-2026-2T", "pagado", "CSV-1")
    ana = (await svc.calendar(ANA)).items
    assert item(ana, "303-2026-2T").estado == "pendiente"
    assert not any(i.obligation.modelo == "349" for i in ana)
    assert any(i.obligation.modelo == "349" for i in (await svc.calendar(PEDRO)).items)


async def test_deadline_uses_the_holidays_of_the_profile_address() -> None:
    svc, _, _ = await make()
    apremio = await svc.deadline(PEDRO, "apremio", date(2026, 9, 16))
    assert (apremio.vence, apremio.fuente) == (date(2026, 10, 5), "LGT art. 62.5")
    req = await svc.deadline(PEDRO, "dias_habiles", date(2026, 9, 21), 10)
    assert req.vence == date(2026, 10, 6)  # salta La Mercè (Barcelona)
    # Mismo requerimiento con domicilio fuera de Barcelona: sin festivos de ese municipio no se adivina.
    await svc.save_profile(PEDRO, replace(PILOTO, municipio="Girona"))
    with pytest.raises(Invalid, match="No hay festivos cargados para 2026"):
        await svc.deadline(PEDRO, "dias_habiles", date(2026, 9, 21), 10)


async def test_deadline_input_rules() -> None:
    svc, _, _ = await make()
    with pytest.raises(Invalid, match="no puede ser futura"):
        await svc.deadline(PEDRO, "apremio", date(2026, 10, 2))
    assert (await svc.deadline(PEDRO, "dias_habiles", date(2026, 10, 1), 1)).vence == date(2026, 10, 2)
    with pytest.raises(Invalid, match="cuántos días hábiles"):
        await svc.deadline(PEDRO, "dias_habiles", date(2026, 9, 21))
    with pytest.raises(Invalid, match="entre 1 y 120"):
        await svc.deadline(PEDRO, "dias_habiles", date(2026, 9, 21), 0)
    # `dias` se ignora en apremio.
    assert (await svc.deadline(PEDRO, "apremio", date(2026, 9, 16), 99)).vence == date(2026, 10, 5)


async def test_calendar_without_holidays_for_the_address_is_all_provisional() -> None:
    svc, _, _ = await make()
    await svc.save_profile(PEDRO, replace(PILOTO, municipio="Girona"))
    view = await svc.calendar(PEDRO)
    assert view.festivos_cargados == ()
    assert all(i.obligation.provisional for i in view.items if i.obligation.periodo != "tarifa-plana")
