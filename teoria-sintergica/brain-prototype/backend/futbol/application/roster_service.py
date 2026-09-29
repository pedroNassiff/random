"""UC-01/02/03: jugadores, skills dinámicas y puntuación anónima."""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from uuid import uuid4

from futbol.application.errors import Forbidden, Invalid, NotFound
from futbol.application.ports import Actor, FutbolRepository
from futbol.domain.models import POSITIONS, Player, SkillInfo
from futbol.domain.skills import SkillScore, aggregate_skill_scores, composite

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")


SkillBreakdown = dict[str, float | int | str | None]
"""Por skill: name, value, n_raters, source y self_value (autoevaluación, None si no hay)."""


@dataclass(frozen=True)
class PlayerScoring:
    """Solo lo ve el admin (spec §2)."""

    composite: float
    skills: dict[str, SkillBreakdown] = field(default_factory=dict)


@dataclass(frozen=True)
class PlayerListing:
    player: Player
    scoring: PlayerScoring | None


def _breakdown(
    player_id: str,
    skills: list[SkillInfo],
    scores: dict[tuple[str, str], SkillScore],
    self_values: dict[tuple[str, str], int],
) -> dict[str, SkillBreakdown]:
    """Desglose por skill activa. La autoevaluación se muestra al admin pero no se agrega (ALGORITHMS §1.2)."""
    return {
        s.key: {
            "name": s.name,
            "value": scores[(player_id, s.id)].value,
            "n_raters": scores[(player_id, s.id)].n_raters,
            "source": scores[(player_id, s.id)].source,
            "self_value": self_values.get((player_id, s.id)),
        }
        for s in skills
        if s.is_active
    }


def _require_admin(actor: Actor) -> None:
    if not actor.is_admin:
        raise Forbidden("Solo el admin puede hacer esto.")


def _validate_player(p: Player) -> None:
    if not p.display_name.strip():
        raise Invalid("El jugador necesita un nombre.")
    if p.preferred_position is not None and p.preferred_position not in POSITIONS:
        raise Invalid("Puesto inválido. Usá POR, DEF, MED o DEL.")
    if p.is_guest and p.guest_level is None:
        raise Invalid("Un invitado necesita nivel general de 1 a 10.")
    if not p.is_guest and p.guest_level is not None:
        raise Invalid("Solo los invitados tienen nivel general fijo.")
    if p.guest_level is not None and not 1 <= p.guest_level <= 10:
        raise Invalid("El nivel del invitado va de 1 a 10.")


def _validate_skill(s: SkillInfo) -> None:
    if not _KEY_RE.match(s.key):
        raise Invalid("La clave va en minúsculas, sin espacios (ej. juego_aereo).")
    if not s.name.strip():
        raise Invalid("La skill necesita un nombre.")
    if not 0 <= s.weight <= 3:
        raise Invalid("El peso va de 0 a 3.")


class RosterService:
    def __init__(self, repo: FutbolRepository) -> None:
        self._repo = repo

    # ── skills ──────────────────────────────────────────────────────────────
    async def list_skills(self, actor: Actor) -> list[SkillInfo]:
        skills = await self._repo.list_skills(actor.group_id)
        return skills if actor.is_admin else [s for s in skills if s.is_active]

    async def create_skill(self, actor: Actor, skill: SkillInfo) -> SkillInfo:
        _require_admin(actor)
        skill = replace(skill, id=str(uuid4()))
        _validate_skill(skill)
        if any(s.key == skill.key for s in await self._repo.list_skills(actor.group_id)):
            raise Invalid("Ya existe una skill con esa clave.")
        return await self._repo.create_skill(actor.group_id, skill)

    async def update_skill(self, actor: Actor, skill: SkillInfo) -> SkillInfo:
        """La clave es inmutable y las skills nunca se borran: se desactivan."""
        _require_admin(actor)
        current = next((s for s in await self._repo.list_skills(actor.group_id) if s.id == skill.id), None)
        if current is None:
            raise NotFound("Skill no encontrada.")
        skill = replace(skill, key=current.key)
        _validate_skill(skill)
        updated = await self._repo.update_skill(actor.group_id, skill)
        if updated is None:
            raise NotFound("Skill no encontrada.")
        return updated

    # ── players ─────────────────────────────────────────────────────────────
    async def list_players(self, actor: Actor) -> list[PlayerListing]:
        players = await self._repo.list_players(actor.group_id)
        if not actor.is_admin:
            return [PlayerListing(p, None) for p in players if p.active]
        skills = await self._repo.list_skills(actor.group_id)
        ratings = await self._repo.list_group_ratings(actor.group_id)
        scored = [p.id for p in players if p.active and not p.is_guest]
        core = [s.to_skill() for s in skills]
        scores = aggregate_skill_scores(core, scored, ratings)
        self_values = {(r.player_id, r.skill_id): r.value for r in ratings if r.rater_player_id == r.player_id}
        listings = []
        for p in players:
            if p.id in scored:
                scoring = PlayerScoring(composite(p.id, core, scores), _breakdown(p.id, skills, scores, self_values))
                listings.append(PlayerListing(p, scoring))
            else:
                listings.append(PlayerListing(p, PlayerScoring(float(p.guest_level or 0)) if p.is_guest else None))
        return listings

    async def create_player(self, actor: Actor, player: Player) -> Player:
        _require_admin(actor)
        player = replace(player, id=str(uuid4()), email=player.email.strip().lower() if player.email else None)
        _validate_player(player)
        return await self._repo.create_player(actor.group_id, player)

    async def update_player(self, actor: Actor, player: Player) -> Player:
        _require_admin(actor)
        player = replace(player, email=player.email.strip().lower() if player.email else None)
        _validate_player(player)
        updated = await self._repo.update_player(actor.group_id, player)
        if updated is None:
            raise NotFound("Jugador no encontrado.")
        return updated

    # ── ratings ─────────────────────────────────────────────────────────────
    async def my_ratings(self, actor: Actor, player_id: str) -> dict[str, int]:
        """Un miembro solo ve los valores que él mismo puso (spec §2)."""
        if actor.player_id is None:
            return {}
        return await self._repo.list_ratings_by(actor.player_id, player_id)

    async def rate(self, actor: Actor, player_id: str, values: dict[str, int]) -> None:
        if actor.player_id is None:
            raise Forbidden("Tu usuario todavía no está vinculado a un jugador. Pedile al admin que te agregue.")
        target = await self._repo.get_player(actor.group_id, player_id)
        if target is None or not target.active:
            raise NotFound("Jugador no encontrado.")
        if target.is_guest:
            raise Invalid("A los invitados no se les puntúan skills.")
        active = {s.id for s in await self._repo.list_skills(actor.group_id) if s.is_active}
        if not values or not set(values) <= active:
            raise Invalid("Puntuá solo skills activas del grupo.")
        if any(not 1 <= v <= 10 for v in values.values()):
            raise Invalid("Los puntajes van de 1 a 10.")
        await self._repo.upsert_ratings(actor.player_id, player_id, values)
