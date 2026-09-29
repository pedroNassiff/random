"""Inscripción con cupo y lista de espera por orden de llegada (spec §3, UC-04). Puro."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from datetime import datetime

from futbol.domain.models import Signup, SignupStatus


def _is_active(s: Signup) -> bool:
    return s.status != "withdrawn"


def ordered(signups: Sequence[Signup], status: SignupStatus) -> list[Signup]:
    """Orden de llegada; el id desempata para que sea determinista."""
    return sorted((s for s in signups if s.status == status), key=lambda s: (s.created_at, s.player_id))


def join(signups: Sequence[Signup], player_id: str, now: datetime, capacity: int) -> list[Signup]:
    """Anota al jugador: convocado si hay cupo, si no a la espera. Idempotente si ya estaba anotado.

    Volver a anotarse después de bajarse cuenta como llegada nueva (va al final).
    """
    current = next((s for s in signups if s.player_id == player_id), None)
    if current is not None and _is_active(current):
        return list(signups)
    confirmed = sum(1 for s in signups if s.status == "confirmed")
    status: SignupStatus = "confirmed" if confirmed < capacity else "waitlist"
    return [s for s in signups if s.player_id != player_id] + [Signup(player_id, status, now)]


def leave(signups: Sequence[Signup], player_id: str, *, late: bool) -> list[Signup]:
    """Baja del jugador. Si era convocado, sube el primero de la espera.

    `late` (después del cierre) marca `late_withdrawal`: dato informativo, no afecta el rating.
    """
    current = next((s for s in signups if s.player_id == player_id), None)
    if current is None or not _is_active(current):
        return list(signups)
    was_confirmed = current.status == "confirmed"
    out = [
        replace(s, status="withdrawn", late_withdrawal=late and was_confirmed) if s.player_id == player_id else s
        for s in signups
    ]
    return _promote_first(out) if was_confirmed else out


def _promote_first(signups: list[Signup]) -> list[Signup]:
    waiting = ordered(signups, "waitlist")
    if not waiting:
        return signups
    first = waiting[0].player_id
    return [replace(s, status="confirmed") if s.player_id == first else s for s in signups]
