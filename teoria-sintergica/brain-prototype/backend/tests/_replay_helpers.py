"""Shared fixtures for the replay test suite (not collected by pytest: no test_ prefix)."""

from __future__ import annotations

from typing import Any

from replay.brain import ReplayBrain
from replay.format import BANDS, FPS, Manifest, SessionEntry, encode_timeline
from replay.reader import MemoryReader


class Clock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


def make_frame(i: int, **over: Any) -> dict[str, Any]:
    frame = {
        "coherence": 0.5 + i / 1000,
        "entropy": 0.4,
        "dominant_frequency": 10.0,
        "focal_point": {"x": 0.1, "y": 0.2, "z": 0.3},
        "bands": {b: 0.2 for b in BANDS},
        "bands_display": {b: 0.2 for b in BANDS},
        "plv": 0.7,
        "state": "relaxed",
    }
    frame.update(over)
    return frame


def timeline_bytes(n: int, source: str = "dataset") -> bytes:
    return encode_timeline([make_frame(i) for i in range(n)], source)


def entry(sid: str, n: int, type_: str = "physionet", **meta: Any) -> SessionEntry:
    return SessionEntry(sid, sid.title(), type_, "Cat", n / FPS, n, f"frames/{sid}.json.gz", meta)


def build(clock: Clock | None = None, with_modes: bool = True) -> tuple[ReplayBrain, Clock]:
    clock = clock or Clock()
    entries = (
        entry("relax", 50),
        entry("focus", 50),
        entry("med", 100, "meditation"),
        entry("rec", 100, "recorded", db_id=7, duration=20.0, date="2026-01-01", notes="n"),
    )
    files = {e.file: timeline_bytes(e.frames, "recorded" if e.type == "recorded" else "dataset") for e in entries}
    modes = {"relax": "relax", "focus": "focus"} if with_modes else {}
    return ReplayBrain(Manifest("now", entries, modes), MemoryReader(files), clock), clock
