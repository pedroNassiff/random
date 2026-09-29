"""UC-05/06/07/13: propuestas del balanceador, ajuste manual, publicación y restricciones."""

from __future__ import annotations

from dataclasses import dataclass

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import (
    Actor,
    FutbolRepository,
    MatchRepository,
    ResultsRepository,
    StoredConstraint,
    TeamsRepository,
)
from futbol.domain.balancer import (
    BalancerConfig,
    BalancerPlayer,
    Constraint,
    ConstraintKind,
    Context,
    Evaluation,
    InfeasibleConstraintsError,
    Partition,
    build_context,
    evaluate_partition,
    propose,
)
from futbol.domain.config import GOALKEEPING_KEY
from futbol.domain.models import Match, Player
from futbol.domain.results import GOAL_RATE_WINDOW
from futbol.domain.share import teams_text
from futbol.domain.signups import ordered
from futbol.domain.skills import aggregate_skill_scores, composite
from futbol.domain.strength import prior_ratings

MIN_PLAYERS = 4


@dataclass(frozen=True)
class TeamPlayer:
    id: str
    display_name: str
    preferred_position: str | None
    strength: float | None
    """mu del jugador: solo para el admin (spec §2)."""


@dataclass(frozen=True)
class TeamsView:
    match: Match
    players: dict[str, TeamPlayer]
    proposals: list[Evaluation]
    published: Partition | None
    published_eval: Evaluation | None
    share_text: str | None


def _require_admin(actor: Actor) -> None:
    if not actor.is_admin:
        raise Forbidden("Solo el admin puede armar equipos.")


class TeamsService:
    def __init__(
        self,
        teams: TeamsRepository,
        matches: MatchRepository,
        roster: FutbolRepository,
        results: ResultsRepository | None = None,
    ) -> None:
        self._teams = teams
        self._matches = matches
        self._roster = roster
        self._results = results

    # ── contexto del balanceador ────────────────────────────────────────────
    async def _match(self, group_id: str, match_id: str) -> Match:
        match = await self._matches.get_match(group_id, match_id)
        if match is None:
            raise NotFound("Partido no encontrado.")
        return match

    async def _confirmed(self, match_id: str) -> list[str]:
        return [s.player_id for s in ordered(await self._matches.list_signups(match_id), "confirmed")]

    async def _context(self, group_id: str, match_id: str, player_ids: list[str]) -> Context:
        players = {p.id: p for p in await self._roster.list_players(group_id)}
        skills = [s for s in await self._roster.list_skills(group_id) if s.is_active]
        members = [pid for pid in player_ids if pid in players and not players[pid].is_guest]
        scores = aggregate_skill_scores(
            [s.to_skill() for s in skills], members, await self._roster.list_group_ratings(group_id)
        )
        core = [s.to_skill() for s in skills]
        guests = {
            pid: float(players[pid].guest_level or 5) for pid in player_ids if pid in players and pid not in members
        }
        ratings = prior_ratings({pid: composite(pid, core, scores) for pid in members}, guests)
        gk = next((s.id for s in skills if s.key == GOALKEEPING_KEY), None)
        rates = await self._results.goal_rates(group_id, GOAL_RATE_WINDOW) if self._results else {}
        balancer_players = [
            BalancerPlayer(
                id=pid,
                rating=ratings[pid],
                profile={s.key: scores[(pid, s.id)].value for s in skills if (pid, s.id) in scores},
                position=players[pid].preferred_position if pid in players else None,
                goalkeeping=scores[(pid, gk)].value if gk and (pid, gk) in scores else 1.0,
                goal_rate=rates.get(pid, 0.0),
            )
            for pid in player_ids
            if pid in ratings
        ]
        constraints = [Constraint(c.player_a, c.player_b, c.kind) for c in await self._teams.list_constraints(group_id)]
        return build_context(
            balancer_players,
            {s.key: s.weight for s in skills if s.key != GOALKEEPING_KEY},
            constraints,
            await self._teams.recent_partitions(group_id, match_id, BalancerConfig().k_repeat),
            BalancerConfig.from_overrides(await self._teams.balancer_overrides(group_id)),
        )

    def _names(self, players: dict[str, Player], ids: tuple[str, ...]) -> list[str]:
        return [players[i].display_name if i in players else "Jugador" for i in ids]

    # ── lectura ─────────────────────────────────────────────────────────────
    async def view(self, actor: Actor, match_id: str) -> TeamsView:
        match = await self._match(actor.group_id, match_id)
        published = await self._teams.published(match_id)
        roster = {p.id: p for p in await self._roster.list_players(actor.group_id)}
        involved = set(await self._confirmed(match_id)) | set(published.team_a + published.team_b if published else ())
        ctx = await self._context(actor.group_id, match_id, sorted(involved)) if involved else None
        published_eval = evaluate_partition(published, ctx) if published and ctx else None
        share = None
        if published and published_eval:
            cfg = await self._matches.get_schedule(actor.group_id)
            share = teams_text(match, cfg, self._names(roster, published.team_a), self._names(roster, published.team_b))
        players = {
            pid: TeamPlayer(
                pid,
                roster[pid].display_name if pid in roster else "Jugador",
                roster[pid].preferred_position if pid in roster else None,
                ctx.players[pid].rating.mu if actor.is_admin and ctx and pid in ctx.players else None,
            )
            for pid in involved
        }
        proposals = await self._teams.list_proposals(match_id) if actor.is_admin else []
        return TeamsView(match, players, proposals, published, published_eval, share)

    # ── admin ───────────────────────────────────────────────────────────────
    async def generate(self, actor: Actor, match_id: str) -> TeamsView:
        _require_admin(actor)
        await self._generate(actor.group_id, await self._match(actor.group_id, match_id))
        return await self.view(actor, match_id)

    async def _generate(self, group_id: str, match: Match) -> None:
        if match.status in ("played", "cancelled"):
            raise Invalid("Este partido ya no admite cambios.")
        confirmed = await self._confirmed(match.id)
        if len(confirmed) < MIN_PLAYERS:
            raise Invalid(f"Hacen falta al menos {MIN_PLAYERS} convocados para armar equipos.")
        ctx = await self._context(group_id, match.id, confirmed)
        try:
            proposals = propose(ctx)
        except InfeasibleConstraintsError as exc:
            raise Invalid(f"Las restricciones no se pueden cumplir: {'; '.join(exc.conflicts)}.") from exc
        await self._teams.save_proposals(match.id, proposals)

    async def generate_pending(self, group_id: str) -> int:
        """Cron: genera propuestas para los partidos cerrados que todavía no tienen."""
        done = 0
        for match_id in await self._teams.pending_matches(group_id):
            try:
                await self._generate(group_id, await self._match(group_id, match_id))
                done += 1
            except Invalid:
                continue  # pocos convocados o restricciones imposibles: lo resuelve el admin a mano
        return done

    async def _partition(self, match_id: str, team_a: list[str], team_b: list[str]) -> Partition:
        confirmed = set(await self._confirmed(match_id))
        a, b = set(team_a), set(team_b)
        if not a or not b or a & b or (a | b) != confirmed:
            raise Invalid("Los equipos tienen que repartir exactamente a los convocados, sin repetir.")
        return Partition(tuple(sorted(a)), tuple(sorted(b)))

    async def evaluate(self, actor: Actor, match_id: str, team_a: list[str], team_b: list[str]) -> Evaluation:
        """Recalcula diferencia, % y desglose tras un movimiento manual (UC-06)."""
        _require_admin(actor)
        await self._match(actor.group_id, match_id)
        partition = await self._partition(match_id, team_a, team_b)
        ctx = await self._context(actor.group_id, match_id, list(partition.team_a + partition.team_b))
        return evaluate_partition(partition, ctx)

    async def publish(self, actor: Actor, match_id: str, team_a: list[str], team_b: list[str]) -> TeamsView:
        _require_admin(actor)
        match = await self._match(actor.group_id, match_id)
        if match.status in ("played", "cancelled"):
            raise Invalid("Este partido ya no admite cambios.")
        await self._teams.publish(match_id, await self._partition(match_id, team_a, team_b))
        return await self.view(actor, match_id)

    # ── restricciones (UC-13) ───────────────────────────────────────────────
    async def constraints(self, actor: Actor) -> list[StoredConstraint]:
        _require_admin(actor)
        return await self._teams.list_constraints(actor.group_id)

    async def add_constraint(self, actor: Actor, a: str, b: str, kind: ConstraintKind) -> StoredConstraint:
        _require_admin(actor)
        if a == b:
            raise Invalid("Elegí dos jugadores distintos.")
        for pid in (a, b):
            if await self._roster.get_player(actor.group_id, pid) is None:
                raise NotFound("Jugador no encontrado.")
        existing = await self._teams.list_constraints(actor.group_id)
        if any({c.player_a, c.player_b} == {a, b} for c in existing):
            raise Invalid("Ya hay una restricción entre esos dos jugadores.")
        return await self._teams.add_constraint(actor.group_id, a, b, kind)

    async def delete_constraint(self, actor: Actor, constraint_id: str) -> None:
        _require_admin(actor)
        if not await self._teams.delete_constraint(actor.group_id, constraint_id):
            raise NotFound("Restricción no encontrada.")
