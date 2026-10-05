"""Casos de uso del Gestor Autónomo: perfil, calendario generado y motor de plazos.

Orquesta el dominio; no calcula nada por su cuenta. Todo dato pertenece a un `owner_id` (el usuario
logueado) y nunca se cruza con el de otro.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from fiscal.application.errors import Invalid, NotFound
from fiscal.application.ports import FiscalRepository, StoredStatus
from fiscal.domain.calendar import Obligation, obligations_for
from fiscal.domain.deadlines import Deadline, apremio_deadline, business_days_deadline
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.holidays import NACIONAL, BusinessCalendar, build_calendar
from fiscal.domain.profile import TaxProfile, validated
from fiscal.domain.status import Aviso, Estado, alert_stage, validate_status

DeadlineKind = Literal["dias_habiles", "apremio"]
_TZ = ZoneInfo("Europe/Madrid")
_PENDING = StoredStatus("pendiente", None)


@dataclass(frozen=True)
class CalendarItem:
    obligation: Obligation
    estado: Estado
    justificante: str | None
    aviso: Aviso
    dias_restantes: int


@dataclass(frozen=True)
class CalendarView:
    hoy: date
    items: tuple[CalendarItem, ...]
    festivos_cargados: tuple[int, ...]


class FiscalService:
    def __init__(self, repo: FiscalRepository, *, clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self._repo = repo
        self._clock = clock

    def today(self) -> date:
        return self._clock().astimezone(_TZ).date()

    async def get_profile(self, owner_id: str) -> TaxProfile | None:
        return await self._repo.latest_profile(owner_id)

    async def save_profile(self, owner_id: str, profile: TaxProfile) -> TaxProfile:
        """Cada guardado crea una versión nueva del perfil."""
        try:
            clean = validated(profile)
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc
        if clean.fecha_alta > self.today():
            raise Invalid("La fecha de alta no puede ser futura.")
        return await self._repo.add_profile_version(owner_id, clean)

    async def _require_profile(self, owner_id: str) -> TaxProfile:
        profile = await self._repo.latest_profile(owner_id)
        if profile is None:
            raise NotFound("Primero cargá tu perfil fiscal.")
        return profile

    async def _business_calendar(self, profile: TaxProfile) -> BusinessCalendar:
        territorios = (NACIONAL, profile.comunidad, profile.municipio)
        return build_calendar(await self._repo.list_holidays(), territorios)

    async def _obligations(self, profile: TaxProfile, cal: BusinessCalendar, today: date) -> list[Obligation]:
        """Desde el año de alta hasta el ejercicio en curso: una obligación abierta nunca desaparece."""
        out: list[Obligation] = []
        for ejercicio in range(profile.fecha_alta.year, today.year + 1):
            out.extend(obligations_for(profile, ejercicio, cal))
        return sorted(out, key=lambda o: (o.vence, o.key))

    @staticmethod
    def _item(obligation: Obligation, status: StoredStatus, today: date) -> CalendarItem:
        return CalendarItem(
            obligation,
            status.estado,
            status.justificante,
            alert_stage(obligation.vence, today, status.estado),
            (obligation.vence - today).days,
        )

    async def calendar(self, owner_id: str) -> CalendarView:
        profile = await self._require_profile(owner_id)
        today = self.today()
        cal = await self._business_calendar(profile)
        statuses = await self._repo.list_statuses(owner_id)
        items = tuple(
            self._item(o, statuses.get(o.key, _PENDING), today) for o in await self._obligations(profile, cal, today)
        )
        return CalendarView(today, items, tuple(sorted(cal.years)))

    async def set_status(self, owner_id: str, key: str, estado: str, justificante: str | None) -> CalendarItem:
        """Cambia el estado de una obligación del calendario. Cerrarla exige justificante."""
        profile = await self._require_profile(owner_id)
        today = self.today()
        cal = await self._business_calendar(profile)
        obligation = next((o for o in await self._obligations(profile, cal, today) if o.key == key), None)
        if obligation is None:
            raise NotFound("Esa obligación no está en tu calendario.")
        try:
            status = StoredStatus(*validate_status(estado, justificante))
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc
        await self._repo.save_status(owner_id, key, status, self._clock())
        return self._item(obligation, status, today)

    async def deadline(self, owner_id: str, kind: DeadlineKind, notificado: date, dias: int | None = None) -> Deadline:
        """Plazo desde una notificación, con los festivos del domicilio fiscal del perfil."""
        profile = await self._require_profile(owner_id)
        if notificado > self.today():
            raise Invalid("La fecha de notificación no puede ser futura.")
        cal = await self._business_calendar(profile)
        try:
            if kind == "apremio":
                return apremio_deadline(notificado, cal)
            if dias is None:
                raise Invalid("Indicá cuántos días hábiles da la notificación.")
            return business_days_deadline(notificado, dias, cal)
        except FiscalRuleError as exc:
            raise Invalid(str(exc)) from exc
