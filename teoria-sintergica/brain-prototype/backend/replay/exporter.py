"""Pure logic of the local replay-bundle exporter (no torch/mne imports at module level)."""

from __future__ import annotations

import contextlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Collection, Mapping, Protocol, Sequence

from .format import FPS, Manifest, SessionEntry, encode_timeline

MIN_RECORDED_ID = 0  # opt-in cut-off (--min-recorded-id); by default every recording is exported
DEFAULT_MODES = {"relax": "physionet_run2", "focus": "physionet_runs_6-10-14"}
RECORDED_TYPES = ("recorded", "recorded_sqlite")
_RECORDED_META_KEYS = ("db_id", "duration", "date", "notes", "sample_count", "avg_alpha", "avg_coherence")

Log = Callable[[str], None]
FetchJson = Callable[[str], bytes]


class ExportError(RuntimeError):
    """A session could not be turned into a timeline."""


class Player(Protocol):
    current_position: float
    total_duration: float
    window_duration: float
    is_playing: bool


class Playlist(Protocol):
    @property
    def sessions(self) -> list[dict[str, Any]]: ...

    current_index: int
    current_player: Any

    def load_session(self, index: int) -> Any: ...


class Brain(Protocol):
    @property
    def playlist(self) -> Playlist: ...

    session_player: Any
    session_mode_active: bool
    coherence_history: list[float]
    entropy_history: list[float]
    bands_history: dict[str, list[float]]
    plv_history: list[float]

    def next_state(self) -> dict[str, Any]: ...


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "-", text.lower()).strip("-") or "session"


def session_id_for(session: Mapping[str, Any]) -> str:
    """Stable, filesystem-safe id for a playlist entry."""
    kind = session.get("type")
    path = str(session.get("path", ""))
    if kind == "physionet":
        return slugify(path)
    if kind == "meditation":
        return "meditation-" + slugify(Path(path).stem)
    if kind in RECORDED_TYPES:
        return f"recorded-{session.get('db_id')}"
    return slugify(f"{kind}-{Path(path).stem or session.get('name', '')}")


def source_for(session: Mapping[str, Any]) -> str:
    return "recorded" if session.get("type") in RECORDED_TYPES else "dataset"


def _is_untrusted(session: Mapping[str, Any], min_recorded_id: int) -> bool:
    if session.get("type") not in RECORDED_TYPES:
        return False
    db_id = session.get("db_id")
    return not isinstance(db_id, int) or db_id < min_recorded_id


def _reset_smoothing(brain: Brain) -> None:
    brain.coherence_history = []
    brain.entropy_history = []
    brain.bands_history = {band: [] for band in ("delta", "theta", "alpha", "beta", "gamma")}
    brain.plv_history = []


def frame_count(player: Player) -> int:
    """Number of 5 Hz positions whose analysis window fits in the session."""
    usable = player.total_duration - player.window_duration
    return int(usable * FPS + 1e-9) + 1 if usable >= 0 else 0


def collect_frames(brain: Brain, player: Player, *, silence: bool = True) -> list[dict[str, Any]]:
    """Step a paused player through every 0.2 s position and gather `next_state()` frames."""
    brain.session_player = player
    brain.playlist.current_player = player
    brain.session_mode_active = True
    player.is_playing = False
    _reset_smoothing(brain)
    total = frame_count(player)
    if total == 0:
        raise ExportError("session is shorter than one analysis window")
    frames: list[dict[str, Any]] = []
    quiet = contextlib.redirect_stdout(io.StringIO()) if silence else contextlib.nullcontext()
    with quiet:
        for k in range(total):
            player.current_position = round(k / FPS, 3)
            frames.append(brain.next_state())
            if not brain.session_mode_active:
                raise ExportError(f"player fell back to dataset mode at {player.current_position}s")
    return frames


def _load_player(brain: Brain, index: int) -> Any:
    player = brain.playlist.load_session(index)
    if player is None or brain.playlist.current_index != index:
        raise ExportError("session failed to load")
    return player


def _entry_meta(session: Mapping[str, Any]) -> dict[str, Any]:
    if session.get("type") not in RECORDED_TYPES:
        return {}
    return {k: session[k] for k in _RECORDED_META_KEYS if k in session}


def export_session(brain: Brain, index: int, out_dir: Path) -> SessionEntry:
    """Export one playlist session to `frames/<id>.json.gz` and return its manifest entry."""
    session = brain.playlist.sessions[index]
    sid = session_id_for(session)
    player = _load_player(brain, index)
    frames = collect_frames(brain, player)
    relative = f"frames/{sid}.json.gz"
    target = out_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encode_timeline(frames, source_for(session)))
    return SessionEntry(
        id=sid,
        name=str(session.get("name", sid)),
        type=str(session.get("type", "")),
        category=str(session.get("category", "")),
        duration=float(player.total_duration),
        frames=len(frames),
        file=relative,
        meta=_entry_meta(session),
    )


def build_manifest(entries: Sequence[SessionEntry], now: datetime | None = None) -> Manifest:
    """Manifest whose relax/focus modes only point at sessions that were really exported."""
    stamp = (now or datetime.now(timezone.utc)).isoformat()
    exported = {e.id for e in entries}
    modes = {mode: sid for mode, sid in DEFAULT_MODES.items() if sid in exported}
    return Manifest(generated_at=stamp, sessions=tuple(entries), modes=modes)


def export_frames(
    brain: Brain,
    out_dir: Path,
    *,
    skip_recorded: bool = False,
    only: Collection[str] | None = None,
    min_recorded_id: int = MIN_RECORDED_ID,
    log: Log = print,
) -> list[SessionEntry]:
    """Export playlist sessions (optionally only some ids); a failing session is skipped with a warning."""
    entries: list[SessionEntry] = []
    sessions = list(brain.playlist.sessions)
    for index, session in enumerate(sessions):
        if skip_recorded and session.get("type") in RECORDED_TYPES:
            continue
        if only and session_id_for(session) not in only:
            continue
        if _is_untrusted(session, min_recorded_id):
            continue
        label = f"[{index + 1}/{len(sessions)}] {session.get('name')}"
        try:
            entry = export_session(brain, index, out_dir)
        except Exception as exc:  # noqa: BLE001 - one bad session must not abort the whole export
            log(f"  ! {label}: skipped ({exc})")
            continue
        entries.append(entry)
        log(f"  ✓ {label}: {entry.frames} frames ({entry.duration:.0f}s) -> {entry.file}")
    return entries


def write_manifest(out_dir: Path, manifest: Manifest) -> Path:
    path = out_dir / "manifest.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    path.write_bytes(manifest.to_json())
    return path


def _save_json(out_dir: Path, relative: str, payload: bytes) -> None:
    target = out_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)


def _fetch_success(fetch: FetchJson, url: str) -> tuple[bytes, dict[str, Any]]:
    payload = fetch(url)
    data = json.loads(payload)
    if not isinstance(data, dict) or data.get("status") == "error":
        raise ExportError(str(data.get("message") if isinstance(data, dict) else data))
    return payload, data


def _trusted(item: Any, key: str, min_session_id: int) -> bool:
    value = item.get(key) if isinstance(item, dict) else None
    return isinstance(value, int) and value >= min_session_id


def _filter_dashboard(dashboard: dict[str, Any], min_session_id: int) -> dict[str, Any]:
    """Drop untrusted early sessions (and their validations) so /doc never links to missing snapshots."""
    filtered = dict(dashboard)
    filtered["sessions"] = [x for x in dashboard.get("sessions", []) if _trusted(x, "id", min_session_id)]
    filtered["validations"] = [x for x in dashboard.get("validations", []) if _trusted(x, "session_id", min_session_id)]
    filtered["total_sessions"] = len(filtered["sessions"])
    filtered["total_validations"] = len(filtered["validations"])
    return filtered


def export_doc_snapshots(
    out_dir: Path, api: str, fetch: FetchJson, log: Log = print, min_session_id: int = MIN_RECORDED_ID
) -> int:
    """Save the three endpoints BrainDoc/SessionDetail consume; returns sessions saved.

    Per-session payloads are verbatim; the dashboard is only filtered to sessions >= min_session_id.
    """
    base = api.rstrip("/")
    _, raw = _fetch_success(fetch, f"{base}/doc/dashboard")
    dashboard = _filter_dashboard(raw, min_session_id)
    _save_json(out_dir, "doc/dashboard.json", json.dumps(dashboard).encode())
    saved = 0
    for recording in dashboard["sessions"]:
        rid = recording["id"]
        try:
            detail, _ = _fetch_success(fetch, f"{base}/doc/session/{rid}")
            metrics, _ = _fetch_success(fetch, f"{base}/sessions/{rid}/metrics")
        except Exception as exc:  # noqa: BLE001 - skip sessions whose doc data is unavailable
            log(f"  ! doc snapshot for session {rid} skipped ({exc})")
            continue
        _save_json(out_dir, f"doc/session/{rid}.json", detail)
        _save_json(out_dir, f"sessions/{rid}/metrics.json", metrics)
        saved += 1
        log(f"  ✓ doc snapshot for session {rid}")
    return saved
