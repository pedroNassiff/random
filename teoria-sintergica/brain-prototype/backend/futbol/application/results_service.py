"""UC-08 (cargar resultado) y pestaña Partidos (historial)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import Actor, FutbolRepository, MatchRepository, ResultsRepository, TeamsRepository
from futbol.domain.balancer import Partition
from futbol.domain.models import Match, Player
from futbol.domain.results import MatchResult, is_close, player_goals_error, valid_goals
from futbol.domain.schedule import next_window
from futbol.domain.signups import ordered

HISTORY_LIMIT = 100


@dataclass(frozen=True)
class LineupPlayer:
    id: str
    display_name: str
    preferred_position: str | None
    goals: int | None = None


@dataclass(frozen=True)
class HistoryEntry:
    match: Match
    result: MatchResult
    close: bool
    team_a: list[LineupPlayer]
    team_b: list[LineupPlayer]


@dataclass(frozen=True)
class ResultForm:
    """Lo que necesita la pantalla de carga: equipos propuestos (publicados o convocados) y resultado previo."""

    match: Match
    team_a: list[LineupPlayer]
    team_b: list[LineupPlayer]
    result: MatchResult | None
    roster: list[LineupPlayer]


def _require_admin(actor: Actor) -> None:
    if not actor.is_admin:
        raise Forbidden("Solo el admin puede cargar resultados.")


class ResultsService:
    def __init__(
        self,
        results: ResultsRepository,
        matches: MatchRepository,
        teams: TeamsRepository,
        roster: FutbolRepository,
    ) -> None:
        self._results = results
        self._matches = matches
        self._teams = teams
        self._roster = roster

    async def _players(self, group_id: str) -> dict[str, Player]:
        return {p.id: p for p in await self._roster.list_players(group_id)}

    @staticmethod
    def _lineup(
        ids: tuple[str, ...] | list[str], players: dict[str, Player], goals: Mapping[str, int] | None = None
    ) -> list[LineupPlayer]:
        g = goals or {}
        return sorted(
            (
                LineupPlayer(i, players[i].display_name, players[i].preferred_position, g.get(i))
                if i in players
                else LineupPlayer(i, "Jugador", None, g.get(i))
                for i in ids
            ),
            key=lambda p: p.display_name.lower(),
        )

    async def _match(self, group_id: str, match_id: str) -> Match:
        match = await self._matches.get_match(group_id, match_id)
        if match is None:
            raise NotFound("Partido no encontrado.")
        return match

    # ── historial (todos) ───────────────────────────────────────────────────
    async def history(self, actor: Actor) -> list[HistoryEntry]:
        players = await self._players(actor.group_id)
        return [
            HistoryEntry(
                p.match,
                p.result,
                is_close(p.result),
                self._lineup(p.lineup.team_a, players, p.goals),
                self._lineup(p.lineup.team_b, players, p.goals),
            )
            for p in await self._results.history(actor.group_id, HISTORY_LIMIT)
        ]

    # ── carga (admin) ───────────────────────────────────────────────────────
    async def form(self, actor: Actor, match_id: str) -> ResultForm:
        _require_admin(actor)
        match = await self._match(actor.group_id, match_id)
        players = await self._players(actor.group_id)
        published = await self._teams.published(match_id)
        if published is not None:
            a, b = published.team_a, published.team_b
        else:  # sin equipos publicados: todos los convocados arrancan en A y el admin los reparte
            a, b = tuple(s.player_id for s in ordered(await self._matches.list_signups(match_id), "confirmed")), ()
        active = [p.id for p in players.values() if p.active]
        goals = await self._results.player_goals(match_id)
        return ResultForm(
            match,
            self._lineup(a, players, goals),
            self._lineup(b, players, goals),
            await self._results.get_result(match_id),
            self._lineup(active, players),
        )

    async def record(
        self,
        actor: Actor,
        match_id: str,
        result: MatchResult,
        team_a: list[str],
        team_b: list[str],
        player_goals: Mapping[str, int] | None = None,
    ) -> ResultForm:
        """Guarda quién jugó (y sus goles, opcional) y el resultado; pasa a `played` y abre el partido siguiente."""
        _require_admin(actor)
        match = await self._match(actor.group_id, match_id)
        if match.status == "cancelled":
            raise Invalid("El partido está cancelado.")
        if not (valid_goals(result.goals_a) and valid_goals(result.goals_b)):
            raise Invalid("Los goles van de 0 a 99.")
        lineup = await self._validate_lineup(actor.group_id, team_a, team_b)
        goals = dict(player_goals or {})
        if (error := player_goals_error(result, lineup, goals)) is not None:
            raise Invalid(error)
        await self._results.save_result(match_id, result, lineup, actor.user_id, goals)
        await self._open_next(actor.group_id, match)
        return await self.form(actor, match_id)

    async def _validate_lineup(self, group_id: str, team_a: list[str], team_b: list[str]) -> Partition:
        a, b = set(team_a), set(team_b)
        if not a or not b:
            raise Invalid("Cada equipo necesita al menos un jugador.")
        if a & b:
            raise Invalid("Un jugador no puede estar en los dos equipos.")
        players = await self._players(group_id)
        if not (a | b) <= set(players):
            raise NotFound("Jugador no encontrado.")
        return Partition(tuple(sorted(a)), tuple(sorted(b)))

    async def _open_next(self, group_id: str, match: Match) -> None:
        """Spec §3: cargar el resultado abre la inscripción del partido siguiente, sin esperar al cron."""
        cfg = await self._matches.get_schedule(group_id)
        await self._matches.create_match(group_id, next_window(match.starts_at + timedelta(minutes=1), cfg))
