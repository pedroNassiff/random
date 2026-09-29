"""UC-04: partido de la semana, inscripción y cron (spec §3)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import Actor, FutbolRepository, MatchRepository, TeamsRepository
from futbol.domain.models import Match, Player, Position, Signup, SignupStatus
from futbol.domain.schedule import ScheduleConfig, describe_close, plan_tick, signup_open
from futbol.domain.share import signup_text
from futbol.domain.signups import join, leave, ordered

_LOOKBACK = timedelta(days=14)
_FINISHED = ("played", "cancelled")


@dataclass(frozen=True)
class SignupView:
    player_id: str
    display_name: str
    preferred_position: Position | None
    late_withdrawal: bool


@dataclass(frozen=True)
class MatchView:
    match: Match
    capacity: int
    signup_open: bool
    closes_text: str
    confirmed: list[SignupView]
    waitlist: list[SignupView]
    my_status: SignupStatus | None
    share_text: str


@dataclass(frozen=True)
class TickResult:
    group_id: str
    closed: int
    created: bool


class MatchService:
    def __init__(
        self,
        matches: MatchRepository,
        roster: FutbolRepository,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        *,
        app_url: str = "http://localhost:5173/vaca-futbolera",
        teams: TeamsRepository | None = None,
    ) -> None:
        self._matches = matches
        self._roster = roster
        self._clock = clock
        self._app_url = app_url
        self._teams = teams

    # ── cron ────────────────────────────────────────────────────────────────
    async def tick(self, group_id: str) -> TickResult:
        now = self._clock()
        cfg = await self._matches.get_schedule(group_id)
        plan = plan_tick(now, cfg, await self._matches.recent_matches(group_id, now - _LOOKBACK))
        if plan.close_ids:
            await self._matches.close_matches(plan.close_ids)
        if plan.create is not None:
            await self._matches.create_match(group_id, plan.create)
        return TickResult(group_id, len(plan.close_ids), plan.create is not None)

    async def tick_all(self) -> list[TickResult]:
        return [await self.tick(g) for g in await self._matches.list_group_ids()]

    # ── lectura ─────────────────────────────────────────────────────────────
    async def current(self, actor: Actor) -> MatchView | None:
        """Partido en curso. Corre el tick antes, así la home no depende de que el cron haya pasado."""
        await self.tick(actor.group_id)
        match = await self._matches.current_match(actor.group_id)
        if match is None:
            return None
        return await self._view(actor, match, await self._matches.list_signups(match.id))

    async def _view(self, actor: Actor, match: Match, signups: list[Signup]) -> MatchView:
        cfg = await self._matches.get_schedule(actor.group_id)
        players = {p.id: p for p in await self._roster.list_players(actor.group_id)}
        mine = next((s.status for s in signups if s.player_id == actor.player_id), None)
        confirmed = _views(ordered(signups, "confirmed"), players)
        waitlist = _views(ordered(signups, "waitlist"), players)
        is_open = signup_open(match, self._clock())
        share = signup_text(
            match,
            cfg,
            link=self._app_url,
            confirmed=[v.display_name for v in confirmed],
            waitlist=[v.display_name for v in waitlist],
            signup_open=is_open,
        )
        return MatchView(
            match=match,
            capacity=cfg.capacity,
            signup_open=is_open,
            closes_text=describe_close(match, cfg),
            confirmed=confirmed,
            waitlist=waitlist,
            my_status=None if mine == "withdrawn" else mine,
            share_text=share,
        )

    # ── inscripción ─────────────────────────────────────────────────────────
    async def join(self, actor: Actor, match_id: str, player_id: str | None = None) -> MatchView:
        match, cfg, target = await self._prepare(actor, match_id, player_id)
        if not actor.is_admin and not signup_open(match, self._clock()):
            raise Invalid(f"La inscripción cerró {describe_close(match, cfg)}. Pedile al admin que te agregue.")
        now = self._clock()
        signups = await self._matches.mutate_signups(match.id, lambda _m, s: join(s, target, now, cfg.capacity))
        await self._invalidate_proposals(match.id)
        return await self._view(actor, match, signups)

    async def leave(self, actor: Actor, match_id: str, player_id: str | None = None) -> MatchView:
        match, _cfg, target = await self._prepare(actor, match_id, player_id)
        late = not signup_open(match, self._clock())
        signups = await self._matches.mutate_signups(match.id, lambda _m, s: leave(s, target, late=late))
        await self._invalidate_proposals(match.id)
        return await self._view(actor, match, signups)

    async def _invalidate_proposals(self, match_id: str) -> None:
        """Cambió la lista de convocados: las propuestas viejas ya no sirven (spec §3)."""
        if self._teams is not None:
            await self._teams.delete_proposals(match_id)

    async def _prepare(self, actor: Actor, match_id: str, player_id: str | None) -> tuple[Match, ScheduleConfig, str]:
        target = await self._target(actor, player_id)
        match = await self._matches.get_match(actor.group_id, match_id)
        if match is None:
            raise NotFound("Partido no encontrado.")
        if match.status in _FINISHED:
            raise Invalid("Este partido ya no admite cambios.")
        return match, await self._matches.get_schedule(actor.group_id), target

    async def _target(self, actor: Actor, player_id: str | None) -> str:
        """Un miembro solo se anota o se baja a sí mismo; el admin, a cualquiera (spec §2)."""
        if player_id is None or player_id == actor.player_id:
            if actor.player_id is None:
                raise Forbidden("Tu usuario todavía no está vinculado a un jugador. Pedile al admin que te agregue.")
            return actor.player_id
        if not actor.is_admin:
            raise Forbidden("Solo podés anotarte o bajarte a vos mismo.")
        player = await self._roster.get_player(actor.group_id, player_id)
        if player is None or not player.active:
            raise NotFound("Jugador no encontrado.")
        return player.id


def _views(signups: list[Signup], players: dict[str, Player]) -> list[SignupView]:
    out = []
    for s in signups:
        p = players.get(s.player_id)
        name = p.display_name if p else "Jugador"
        out.append(SignupView(s.player_id, name, p.preferred_position if p else None, s.late_withdrawal))
    return out
