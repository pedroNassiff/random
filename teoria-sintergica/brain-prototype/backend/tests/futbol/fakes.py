"""Repositorio y mailer en memoria para tests de application/API."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime
from uuid import uuid4

from futbol.application.ports import Actor, SignupMutation, StoredConstraint
from futbol.domain.balancer import ConstraintKind, Evaluation, Partition
from futbol.domain.models import Match, Player, Role, Signup, SkillInfo
from futbol.domain.results import MatchResult, PlayedMatch
from futbol.domain.schedule import MatchWindow, ScheduleConfig
from futbol.domain.skills import SkillRating

GROUP = "g1"


@dataclass
class FakeMailer:
    sent: list[tuple[str, str]] = field(default_factory=list)

    async def send_magic_link(self, email: str, link: str) -> None:
        self.sent.append((email, link))

    @property
    def last_token(self) -> str:
        return self.sent[-1][1].split("token=")[1]


@dataclass
class FakeRepo:
    users: dict[str, str] = field(default_factory=dict)  # email -> id
    members: dict[str, Role] = field(default_factory=dict)  # user_id -> role
    links: dict[str, tuple[str, datetime, bool]] = field(default_factory=dict)
    sessions: dict[str, tuple[str, datetime]] = field(default_factory=dict)
    skills: dict[str, SkillInfo] = field(default_factory=dict)
    players: dict[str, Player] = field(default_factory=dict)
    player_user: dict[str, str] = field(default_factory=dict)  # player_id -> user_id
    ratings: dict[tuple[str, str, str], int] = field(default_factory=dict)  # (skill, player, rater)
    passwords: dict[str, str] = field(default_factory=dict)  # user_id -> hash

    # helpers de test
    def add_player(self, name: str, *, email: str | None = None, **kw: object) -> Player:
        p = Player(str(uuid4()), name, None, email, None, False, False, None, True)
        p = replace(p, **kw)  # type: ignore[arg-type]
        self.players[p.id] = p
        return p

    def add_skill(self, key: str, weight: float = 1.0, active: bool = True) -> SkillInfo:
        s = SkillInfo(str(uuid4()), key, key.title(), "", weight, active, len(self.skills))
        self.skills[s.id] = s
        return s

    # auth
    async def email_known(self, email: str) -> bool:
        return email in self.users or any(p.email == email for p in self.players.values())

    async def save_magic_link(self, token_hash: str, email: str, expires_at: datetime) -> None:
        self.links[token_hash] = (email, expires_at, False)

    async def consume_magic_link(self, token_hash: str, now: datetime) -> str | None:
        link = self.links.get(token_hash)
        if link is None or link[2] or link[1] <= now:
            return None
        self.links[token_hash] = (link[0], link[1], True)
        return link[0]

    async def get_or_create_user(self, email: str) -> str:
        return self.users.setdefault(email, str(uuid4()))

    async def default_group_id(self) -> str:
        return GROUP

    async def ensure_membership(self, group_id: str, user_id: str, role: Role, promote: bool) -> None:
        if user_id not in self.members or promote:
            self.members[user_id] = role if promote or user_id not in self.members else self.members[user_id]

    async def link_player_by_email(self, group_id: str, user_id: str, email: str) -> None:
        if user_id in self.player_user.values():
            return
        for p in self.players.values():
            if p.email == email and p.id not in self.player_user:
                self.player_user[p.id] = user_id
                return

    async def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        self.sessions[token_hash] = (user_id, expires_at)

    def _actor(self, user_id: str) -> Actor | None:
        if user_id not in self.members:
            return None
        email = next(e for e, u in self.users.items() if u == user_id)
        player = next((p for p, u in self.player_user.items() if u == user_id), None)
        return Actor(user_id, GROUP, self.members[user_id], email, player, user_id in self.passwords)

    async def actor_for_session(self, token_hash: str, now: datetime) -> Actor | None:
        s = self.sessions.get(token_hash)
        return self._actor(s[0]) if s and s[1] > now else None

    async def actor_for_user(self, user_id: str) -> Actor | None:
        return self._actor(user_id)

    async def delete_session(self, token_hash: str) -> None:
        self.sessions.pop(token_hash, None)

    async def password_hash_for(self, email: str) -> tuple[str, str | None] | None:
        user_id = self.users.get(email)
        return None if user_id is None else (user_id, self.passwords.get(user_id))

    async def set_password_hash(self, user_id: str, password_hash: str, now: datetime) -> None:
        self.passwords[user_id] = password_hash

    # skills
    async def list_skills(self, group_id: str) -> list[SkillInfo]:
        return sorted(self.skills.values(), key=lambda s: (s.sort_order, s.key))

    async def create_skill(self, group_id: str, skill: SkillInfo) -> SkillInfo:
        self.skills[skill.id] = skill
        return skill

    async def update_skill(self, group_id: str, skill: SkillInfo) -> SkillInfo | None:
        if skill.id not in self.skills:
            return None
        self.skills[skill.id] = skill
        return skill

    # players
    async def list_players(self, group_id: str) -> list[Player]:
        return sorted(self.players.values(), key=lambda p: p.display_name.lower())

    async def get_player(self, group_id: str, player_id: str) -> Player | None:
        return self.players.get(player_id)

    async def create_player(self, group_id: str, player: Player) -> Player:
        self.players[player.id] = player
        return player

    async def update_player(self, group_id: str, player: Player) -> Player | None:
        if player.id not in self.players:
            return None
        self.players[player.id] = player
        return player

    # ratings
    async def list_group_ratings(self, group_id: str) -> list[SkillRating]:
        out = []
        for (skill, player, rater), value in self.ratings.items():
            user = self.player_user.get(rater)
            admin = user is not None and self.members.get(user) == "admin"
            out.append(SkillRating(skill, player, rater, value, admin))
        return out

    async def list_ratings_by(self, rater_player_id: str, player_id: str) -> dict[str, int]:
        return {s: v for (s, p, r), v in self.ratings.items() if r == rater_player_id and p == player_id}

    async def upsert_ratings(self, rater_player_id: str, player_id: str, values: dict[str, int]) -> None:
        for skill_id, v in values.items():
            self.ratings[(skill_id, player_id, rater_player_id)] = v


@dataclass
class FakeMatchRepo:
    """Partidos e inscripciones en memoria."""

    schedule: ScheduleConfig = field(default_factory=ScheduleConfig)
    matches: dict[str, Match] = field(default_factory=dict)
    signups: dict[str, dict[str, Signup]] = field(default_factory=dict)

    def add_match(self, window: MatchWindow, status: str = "open") -> Match:
        m = Match(str(uuid4()), window.starts_at, window.signup_closes_at, status)  # type: ignore[arg-type]
        self.matches[m.id] = m
        return m

    async def list_group_ids(self) -> list[str]:
        return [GROUP]

    async def get_schedule(self, group_id: str) -> ScheduleConfig:
        return self.schedule

    async def recent_matches(self, group_id: str, since: datetime) -> list[Match]:
        return sorted((m for m in self.matches.values() if m.starts_at >= since), key=lambda m: m.starts_at)

    async def create_match(self, group_id: str, window: MatchWindow) -> None:
        if all(m.starts_at != window.starts_at for m in self.matches.values()):
            self.add_match(window)

    async def close_matches(self, match_ids: tuple[str, ...]) -> None:
        for mid in match_ids:
            if self.matches[mid].status == "open":
                self.matches[mid] = replace(self.matches[mid], status="closed")

    async def current_match(self, group_id: str) -> Match | None:
        active = [m for m in self.matches.values() if m.status in ("open", "closed", "teams_published")]
        return min(active, key=lambda m: m.starts_at, default=None)

    async def get_match(self, group_id: str, match_id: str) -> Match | None:
        return self.matches.get(match_id)

    async def list_signups(self, match_id: str) -> list[Signup]:
        return list(self.signups.get(match_id, {}).values())

    async def mutate_signups(self, match_id: str, mutation: SignupMutation) -> list[Signup]:
        after = mutation(self.matches[match_id], await self.list_signups(match_id))
        self.signups[match_id] = {s.player_id: s for s in after}
        return after


@dataclass
class FakeTeamsRepo:
    matches: FakeMatchRepo
    overrides: dict[str, object] | None = None
    proposals: dict[str, list[Evaluation]] = field(default_factory=dict)
    teams: dict[str, Partition] = field(default_factory=dict)
    constraints: dict[str, StoredConstraint] = field(default_factory=dict)

    async def balancer_overrides(self, group_id: str) -> dict[str, object] | None:
        return self.overrides

    async def save_proposals(self, match_id: str, proposals: list[Evaluation]) -> None:
        self.proposals[match_id] = list(proposals)

    async def list_proposals(self, match_id: str) -> list[Evaluation]:
        return self.proposals.get(match_id, [])

    async def delete_proposals(self, match_id: str) -> None:
        self.proposals.pop(match_id, None)

    async def publish(self, match_id: str, partition: Partition) -> None:
        self.teams[match_id] = partition
        m = self.matches.matches[match_id]
        self.matches.matches[match_id] = replace(m, status="teams_published")

    async def published(self, match_id: str) -> Partition | None:
        return self.teams.get(match_id)

    async def recent_partitions(self, group_id: str, before_match_id: str, limit: int) -> list[Partition]:
        start = self.matches.matches[before_match_id].starts_at
        earlier = sorted(
            (m for m in self.matches.matches.values() if m.starts_at < start and m.id in self.teams),
            key=lambda m: m.starts_at,
            reverse=True,
        )
        return [self.teams[m.id] for m in earlier[:limit]]

    async def pending_matches(self, group_id: str) -> list[str]:
        return [
            m.id
            for m in self.matches.matches.values()
            if m.status == "closed" and m.id not in self.proposals and m.id not in self.teams
        ]

    async def list_constraints(self, group_id: str) -> list[StoredConstraint]:
        return list(self.constraints.values())

    async def add_constraint(self, group_id: str, a: str, b: str, kind: ConstraintKind) -> StoredConstraint:
        c = StoredConstraint(str(uuid4()), a, b, kind)
        self.constraints[c.id] = c
        return c

    async def delete_constraint(self, group_id: str, constraint_id: str) -> bool:
        return self.constraints.pop(constraint_id, None) is not None


@dataclass
class FakeResultsRepo:
    matches: FakeMatchRepo
    teams: FakeTeamsRepo
    results: dict[str, MatchResult] = field(default_factory=dict)
    recorded_by: dict[str, str] = field(default_factory=dict)
    goals: dict[str, dict[str, int]] = field(default_factory=dict)

    async def get_result(self, match_id: str) -> MatchResult | None:
        return self.results.get(match_id)

    async def save_result(
        self, match_id: str, result: MatchResult, lineup: Partition, recorded_by: str, player_goals: Mapping[str, int]
    ) -> None:
        self.teams.teams[match_id] = lineup
        self.results[match_id] = result
        self.recorded_by[match_id] = recorded_by
        self.goals[match_id] = dict(player_goals)
        self.matches.matches[match_id] = replace(self.matches.matches[match_id], status="played")

    async def player_goals(self, match_id: str) -> dict[str, int]:
        return dict(self.goals.get(match_id, {}))

    async def goal_rates(self, group_id: str, window: int) -> dict[str, float]:
        played = sorted(
            (m for m in self.matches.matches.values() if m.status == "played" and m.id in self.goals),
            key=lambda m: m.starts_at,
            reverse=True,
        )
        per_player: dict[str, list[int]] = {}
        for m in played:
            for pid, g in self.goals[m.id].items():
                if len(per_player.setdefault(pid, [])) < window:
                    per_player[pid].append(g)
        return {pid: sum(v) / len(v) for pid, v in per_player.items()}

    async def history(self, group_id: str, limit: int) -> list[PlayedMatch]:
        played = sorted(
            (m for m in self.matches.matches.values() if m.status == "played" and m.id in self.results),
            key=lambda m: m.starts_at,
            reverse=True,
        )
        return [
            PlayedMatch(m, self.results[m.id], self.teams.teams.get(m.id, Partition((), ())), self.goals.get(m.id, {}))
            for m in played[:limit]
        ]
