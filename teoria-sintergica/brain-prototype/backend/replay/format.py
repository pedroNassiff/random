"""Wire format of the replay bundle, shared by the local exporter and the cloud runtime.

Stdlib only: the Cloud Run image has no numpy-heavy/EEG stack.
"""

from __future__ import annotations

import gzip
import json
import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

FORMAT_VERSION = 1
FPS = 5
BANDS = ("delta", "theta", "alpha", "beta", "gamma")
_FLOAT_COLUMNS = (
    ["coherence", "entropy", "frequency", "fx", "fy", "fz"] + [f"b_{b}" for b in BANDS] + [f"d_{b}" for b in BANDS]
)
COLUMNS = (*_FLOAT_COLUMNS, "plv", "state")


class BundleFormatError(ValueError):
    """The payload is not a valid replay bundle file."""


def _num(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return round(number, 4) if math.isfinite(number) else default


def _plv(value: Any) -> float | None:
    if value is None:
        return None
    number = _num(value, default=math.nan)
    return None if math.isnan(number) else number


def _row(frame: Mapping[str, Any]) -> dict[str, Any]:
    focal = frame.get("focal_point") or {}
    bands = frame.get("bands") or {}
    display = frame.get("bands_display") or bands
    row: dict[str, Any] = {
        "coherence": _num(frame.get("coherence"), 0.5),
        "entropy": _num(frame.get("entropy"), 0.5),
        "frequency": _num(frame.get("dominant_frequency"), 10.0),
        "fx": _num(focal.get("x")),
        "fy": _num(focal.get("y")),
        "fz": _num(focal.get("z")),
        "plv": _plv(frame.get("plv")),
        "state": str(frame.get("state") or "neutral"),
    }
    for band in BANDS:
        row[f"b_{band}"] = _num(bands.get(band))
        row[f"d_{band}"] = _num(display.get(band))
    return row


@dataclass(frozen=True)
class Timeline:
    """Columnar sequence of brain states sampled at FPS."""

    source: str
    columns: Mapping[str, list[Any]]

    def __len__(self) -> int:
        return len(self.columns["coherence"])

    def frame(self, index: int) -> dict[str, Any]:
        """Build the dict `SyntergicBrain.next_state()` would return for this frame."""
        col = self.columns
        return {
            "coherence": col["coherence"][index],
            "entropy": col["entropy"][index],
            "dominant_frequency": col["frequency"][index],
            "focal_point": {"x": col["fx"][index], "y": col["fy"][index], "z": col["fz"][index]},
            "bands": {b: col[f"b_{b}"][index] for b in BANDS},
            "bands_display": {b: col[f"d_{b}"][index] for b in BANDS},
            "plv": col["plv"][index],
            "state": col["state"][index],
            "source": self.source,
        }


def encode_timeline(frames: Sequence[Mapping[str, Any]], source: str) -> bytes:
    """Serialize state dicts into a gzip'd columnar JSON payload."""
    if not frames:
        raise BundleFormatError("cannot encode an empty timeline")
    rows = [_row(f) for f in frames]
    columns = {name: [r[name] for r in rows] for name in COLUMNS}
    body = {"version": FORMAT_VERSION, "fps": FPS, "source": source, "columns": columns}
    return gzip.compress(json.dumps(body, allow_nan=False, separators=(",", ":")).encode())


def _load_json(payload: bytes, *, compressed: bool) -> dict[str, Any]:
    try:
        raw = gzip.decompress(payload) if compressed else payload
        data = json.loads(raw)
    except (OSError, EOFError, ValueError) as exc:
        raise BundleFormatError(f"unreadable payload: {exc}") from exc
    if not isinstance(data, dict) or data.get("version") != FORMAT_VERSION:
        raise BundleFormatError(
            f"unsupported bundle version: {data.get('version') if isinstance(data, dict) else data!r}"
        )
    return data


def decode_timeline(payload: bytes) -> Timeline:
    """Parse and validate a timeline produced by `encode_timeline`."""
    data = _load_json(payload, compressed=True)
    columns = data.get("columns")
    if not isinstance(columns, dict) or any(name not in columns for name in COLUMNS):
        raise BundleFormatError("timeline is missing columns")
    lengths = {len(columns[name]) for name in COLUMNS}
    if len(lengths) != 1 or 0 in lengths:
        raise BundleFormatError("timeline columns are empty or have different lengths")
    return Timeline(source=str(data.get("source", "replay")), columns={n: columns[n] for n in COLUMNS})


@dataclass(frozen=True)
class SessionEntry:
    id: str
    name: str
    type: str
    category: str
    duration: float
    frames: int
    file: str
    meta: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Manifest:
    generated_at: str
    sessions: tuple[SessionEntry, ...]
    modes: Mapping[str, str]

    def to_json(self) -> bytes:
        body = {
            "version": FORMAT_VERSION,
            "fps": FPS,
            "generated_at": self.generated_at,
            "modes": dict(self.modes),
            "sessions": [
                {**{k: v for k, v in vars(s).items() if k != "meta"}, "meta": dict(s.meta)} for s in self.sessions
            ],
        }
        return json.dumps(body, allow_nan=False, indent=2, default=str).encode()

    @staticmethod
    def from_json(payload: bytes) -> Manifest:
        data = _load_json(payload, compressed=False)
        try:
            sessions = tuple(SessionEntry(**s) for s in data["sessions"])
            return Manifest(str(data["generated_at"]), sessions, dict(data["modes"]))
        except (KeyError, TypeError) as exc:
            raise BundleFormatError(f"invalid manifest: {exc}") from exc
