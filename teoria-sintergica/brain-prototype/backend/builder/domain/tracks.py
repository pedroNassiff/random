"""Qué tracks de la gauntlet corresponde correr según los archivos que tocó el agente."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal

from builder.domain.policy import BACKEND

Track = Literal["python", "dashboard"]


def tracks_for(paths: Iterable[str]) -> tuple[Track, ...]:
    changed = list(paths)
    found: list[Track] = []
    if any(p.startswith(f"{BACKEND}/") for p in changed):
        found.append("python")
    if any(p.startswith("src/") or p in ("package.json", "package-lock.json") for p in changed):
        found.append("dashboard")
    return tuple(found)
