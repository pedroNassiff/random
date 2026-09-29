"""Entidades del dominio: jugadores, skills, partidos e inscripciones."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from futbol.domain.skills import Skill

Position = Literal["POR", "DEF", "MED", "DEL"]
POSITIONS: tuple[Position, ...] = ("POR", "DEF", "MED", "DEL")
Role = Literal["admin", "member"]
MatchStatus = Literal["open", "closed", "teams_published", "played", "cancelled"]
SignupStatus = Literal["confirmed", "waitlist", "withdrawn"]


@dataclass(frozen=True)
class Player:
    id: str
    display_name: str
    nickname: str | None
    email: str | None
    preferred_position: Position | None
    can_play_gk: bool
    is_guest: bool
    guest_level: int | None
    active: bool


@dataclass(frozen=True)
class SkillInfo:
    id: str
    key: str
    name: str
    description: str
    weight: float
    is_active: bool
    sort_order: int

    def to_skill(self) -> Skill:
        return Skill(self.id, self.key, self.weight, self.is_active)


@dataclass(frozen=True)
class Match:
    id: str
    starts_at: datetime
    signup_closes_at: datetime
    status: MatchStatus


@dataclass(frozen=True)
class Signup:
    player_id: str
    status: SignupStatus
    created_at: datetime
    late_withdrawal: bool = False
