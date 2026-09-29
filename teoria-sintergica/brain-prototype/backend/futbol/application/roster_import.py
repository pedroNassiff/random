"""HU-08: carga inicial del plantel desde JSON (plantilla: docs/la-vaca-futbol/players.template.json).

Idempotente: un jugador existente (mismo email o, si no tiene email, mismo nombre) se actualiza en vez
de duplicarse, y los puntajes se sobrescriben. Los puntajes se cargan como del admin `rated_by`, así
cuentan con fuente `admin` hasta que haya 3 puntuaciones de pares (ALGORITHMS §1.2).
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, cast
from uuid import uuid4

from futbol.application.errors import Invalid
from futbol.application.ports import FutbolRepository
from futbol.domain.models import POSITIONS, Player, Position

_PLAYER_FIELDS = {"display_name", "nickname", "email", "preferred_position", "can_play_gk", "skills"}


@dataclass(frozen=True)
class PlayerSeed:
    display_name: str
    nickname: str | None
    email: str | None
    preferred_position: Position | None
    can_play_gk: bool
    skills: dict[str, int]


@dataclass(frozen=True)
class RosterFile:
    rated_by: str
    players: list[PlayerSeed]


@dataclass
class ImportReport:
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    ratings: int = 0
    warnings: list[str] = field(default_factory=list)


def _opt_str(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _parse_player(i: int, raw: Any, skill_keys: set[str], errors: list[str]) -> PlayerSeed | None:
    where = f"players[{i}]"
    if not isinstance(raw, dict):
        errors.append(f"{where}: tiene que ser un objeto")
        return None
    name = _opt_str(raw.get("display_name"))
    where = f"{where} ({name or 'sin nombre'})"
    errors.extend(f"{where}: campo desconocido '{k}'" for k in sorted(set(raw) - _PLAYER_FIELDS))
    if name is None:
        errors.append(f"{where}: falta display_name")
    position = raw.get("preferred_position")
    if position is not None and position not in POSITIONS:
        errors.append(f"{where}: puesto '{position}' inválido (POR, DEF, MED o DEL)")
    skills = raw.get("skills") or {}
    if not isinstance(skills, dict):
        errors.append(f"{where}: skills tiene que ser un objeto")
        skills = {}
    for key, value in skills.items():
        if key not in skill_keys:
            errors.append(f"{where}: skill desconocida '{key}'")
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 10:
            errors.append(f"{where}: {key}={value!r} tiene que ser un entero de 1 a 10")
    email = _opt_str(raw.get("email"))
    return PlayerSeed(
        display_name=name or "",
        nickname=_opt_str(raw.get("nickname")),
        email=email.lower() if email else None,
        preferred_position=cast("Position | None", position),
        can_play_gk=bool(raw.get("can_play_gk", position == "POR")),
        skills={k: v for k, v in skills.items() if isinstance(v, int)},
    )


def _check_duplicates(players: list[PlayerSeed], errors: list[str]) -> None:
    seen: set[str] = set()
    for p in players:
        key = p.email or p.display_name.lower()
        if key in seen:
            errors.append(f"jugador repetido: {p.email or p.display_name}")
        seen.add(key)


def parse_roster(data: Any, skill_keys: set[str]) -> RosterFile:
    """Valida todo el archivo y reporta todos los errores juntos."""
    errors: list[str] = []
    if not isinstance(data, dict):
        raise Invalid("El archivo tiene que ser un objeto con 'rated_by' y 'players'.")
    rated_by = _opt_str(data.get("rated_by"))
    if rated_by is None:
        errors.append("falta rated_by (email del admin que puntúa)")
    raw_players = data.get("players")
    if not isinstance(raw_players, list) or not raw_players:
        errors.append("players tiene que ser una lista con al menos un jugador")
        raw_players = []
    parsed = [_parse_player(i, raw, skill_keys, errors) for i, raw in enumerate(raw_players)]
    players = [p for p in parsed if p is not None]
    _check_duplicates(players, errors)
    if errors:
        raise Invalid("El archivo tiene errores:\n- " + "\n- ".join(errors))
    return RosterFile((rated_by or "").lower(), players)


class RosterImporter:
    def __init__(self, repo: FutbolRepository) -> None:
        self._repo = repo

    async def run(self, group_id: str, data: Any, *, dry_run: bool = False) -> ImportReport:
        skills = {s.key: s.id for s in await self._repo.list_skills(group_id) if s.is_active}
        roster = parse_roster(data, set(skills))
        rater_id = await self._rater(roster.rated_by)
        existing = await self._repo.list_players(group_id)
        report = ImportReport()
        for seed in roster.players:
            player = await self._upsert(group_id, seed, existing, report, dry_run)
            if player.id == rater_id and seed.skills:
                report.warnings.append(f"{seed.display_name}: es el mismo admin que puntúa, cuenta como autoevaluación")
            values = {skills[k]: v for k, v in seed.skills.items()}
            if values and not dry_run:
                await self._repo.upsert_ratings(rater_id, player.id, values)
            report.ratings += len(values)
        return report

    async def _rater(self, email: str) -> str:
        found = await self._repo.password_hash_for(email)
        actor = await self._repo.actor_for_user(found[0]) if found else None
        if actor is None or not actor.is_admin:
            raise Invalid(f"rated_by '{email}' tiene que ser un admin que ya entró a la app.")
        if actor.player_id is None:
            raise Invalid(
                f"rated_by '{email}' no está vinculado a un jugador: cargá un jugador con ese email y volvé a entrar."
            )
        return actor.player_id

    async def _upsert(
        self, group_id: str, seed: PlayerSeed, existing: list[Player], report: ImportReport, dry_run: bool
    ) -> Player:
        match = next(
            (
                p
                for p in existing
                if (seed.email and p.email == seed.email) or p.display_name.lower() == seed.display_name.lower()
            ),
            None,
        )
        fields = {
            "display_name": seed.display_name,
            "nickname": seed.nickname,
            "email": seed.email,
            "preferred_position": seed.preferred_position,
            "can_play_gk": seed.can_play_gk,
        }
        if match is None:
            report.created.append(seed.display_name)
            new = Player(str(uuid4()), is_guest=False, guest_level=None, active=True, **fields)  # type: ignore[arg-type]
            return new if dry_run else await self._repo.create_player(group_id, new)
        report.updated.append(seed.display_name)
        updated = replace(match, **fields)  # type: ignore[arg-type]
        return updated if dry_run else (await self._repo.update_player(group_id, updated) or updated)
