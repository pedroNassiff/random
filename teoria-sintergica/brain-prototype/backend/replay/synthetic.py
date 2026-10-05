"""Synthetic fallback bundle, used only when no real replay bundle can be loaded.

Keeps `brain` alive (never None) so the 3D model still animates. Every modulation period
divides the loop length, so the timeline wraps seamlessly.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Mapping

from .format import BANDS, FPS, Manifest, SessionEntry, encode_timeline
from .reader import BundleReader, MemoryReader

LOOP_SECONDS = 120
_PROFILES: Mapping[str, tuple[Mapping[str, float], float]] = {
    "relax": ({"delta": 0.22, "theta": 0.24, "alpha": 0.36, "beta": 0.12, "gamma": 0.06}, 0.72),
    "focus": ({"delta": 0.16, "theta": 0.14, "alpha": 0.18, "beta": 0.32, "gamma": 0.20}, 0.48),
}
_BASELINE = {"delta": 0.22, "theta": 0.20, "alpha": 0.22, "beta": 0.20, "gamma": 0.16}
_CENTRES = {"delta": 2.25, "theta": 6.0, "alpha": 10.5, "beta": 21.5, "gamma": 40.0}


def _wave(t: float, cycles: int, phase: float = 0.0) -> float:
    return math.sin(2 * math.pi * cycles * t / LOOP_SECONDS + phase)


def _normalize(values: Mapping[str, float]) -> dict[str, float]:
    total = sum(values.values()) or 1.0
    return {k: v / total for k, v in values.items()}


def _state(bands: Mapping[str, float]) -> str:
    if bands["alpha"] > 0.35:
        return "meditation"
    if bands["alpha"] > 0.22:
        return "relaxed"
    if bands["beta"] > 0.17 or bands["gamma"] > 0.10:
        return "focused"
    return "transitioning"


def _frame(mode: str, t: float) -> dict[str, Any]:
    profile, coherence_centre = _PROFILES[mode]
    bands = _normalize({b: profile[b] * (1 + 0.25 * _wave(t, 3 + i, i * 1.3)) for i, b in enumerate(BANDS)})
    display = _normalize({b: 0.6 * _BASELINE[b] + 0.4 * bands[b] for b in BANDS})
    coherence = min(1.0, max(0.0, coherence_centre + 0.12 * _wave(t, 2, 0.5)))
    return {
        "coherence": coherence,
        "entropy": 1.0 - 0.8 * coherence,
        "dominant_frequency": sum(_CENTRES[b] * bands[b] for b in BANDS),
        "focal_point": {"x": 0.5 * _wave(t, 2), "y": 0.3 + 0.3 * _wave(t, 1, 1.0), "z": 0.5 * _wave(t, 3)},
        "bands": bands,
        "bands_display": display,
        "plv": 0.95 * coherence,
        "state": _state(bands),
    }


def build_synthetic_bundle() -> tuple[Manifest, BundleReader]:
    files: dict[str, bytes] = {}
    sessions = []
    for mode in _PROFILES:
        frames = [_frame(mode, i / FPS) for i in range(LOOP_SECONDS * FPS)]
        path = f"frames/synthetic_{mode}.json.gz"
        files[path] = encode_timeline(frames, source="synthetic")
        sessions.append(
            SessionEntry(
                f"synthetic_{mode}",
                f"Synthetic - {mode.title()}",
                "synthetic",
                "Synthetic",
                LOOP_SECONDS,
                len(frames),
                path,
            )
        )
    modes = {mode: f"synthetic_{mode}" for mode in _PROFILES}
    manifest = Manifest(datetime.now(timezone.utc).isoformat(), tuple(sessions), modes)
    return manifest, MemoryReader(files)
