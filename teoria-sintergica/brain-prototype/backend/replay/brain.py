"""ReplayBrain: serves precomputed brain states through the `SyntergicBrain` interface.

Runs anywhere (stdlib only) — this is what the Cloud Run image uses instead of the
torch/mne pipeline. States come from a bundle produced locally by the exporter.
"""

from __future__ import annotations

import logging
import time
from collections import OrderedDict
from typing import Any, Callable, Mapping

from .format import FPS, BundleFormatError, Manifest, SessionEntry, Timeline, decode_timeline
from .reader import BundleReader

logger = logging.getLogger(__name__)

Clock = Callable[[], float]
MAX_ADVANCE_SECONDS = 1.0
AUTO_ADVANCE_MARGIN = 1.0
TIMELINE_CACHE_SIZE = 4
_LOAD_ERRORS = (FileNotFoundError, BundleFormatError)


class ReplayPlayer:
    """Real-time player over a Timeline; mirrors the public API of `SessionPlayer`."""

    def __init__(self, timeline: Timeline, metadata: Mapping[str, Any], clock: Clock, playing: bool = False) -> None:
        self._timeline = timeline
        self._clock = clock
        self.total_duration = len(timeline) / FPS
        self.session_metadata: dict[str, Any] = dict(metadata)
        self.current_position = 0.0
        self.is_playing = playing
        self.playback_speed = 1.0
        self._last_tick: float | None = clock() if playing else None

    @property
    def progress_percent(self) -> float:
        return self.current_position / self.total_duration * 100 if self.total_duration > 0 else 0.0

    @property
    def finished(self) -> bool:
        return self.current_position >= self.total_duration - AUTO_ADVANCE_MARGIN

    def _advance(self) -> None:
        if self.is_playing and self._last_tick is not None:
            now = self._clock()
            elapsed = min(now - self._last_tick, MAX_ADVANCE_SECONDS)
            self.current_position += elapsed * self.playback_speed
            self._last_tick = now
        if self.current_position >= self.total_duration:
            self.current_position = 0.0

    def next_frame(self) -> dict[str, Any]:
        self._advance()
        index = min(int(self.current_position * FPS), len(self._timeline) - 1)
        frame = self._timeline.frame(index)
        frame["session_timestamp"] = self.current_position
        frame["session_progress"] = self.progress_percent
        return frame

    def play(self) -> None:
        self.is_playing = True
        self._last_tick = self._clock()

    def pause(self) -> None:
        self.is_playing = False
        self._last_tick = None

    def restart(self) -> None:
        self.current_position = 0.0
        self._last_tick = self._clock() if self.is_playing else None

    def seek(self, position_seconds: float) -> None:
        if 0 <= position_seconds <= self.total_duration:
            self.current_position = position_seconds

    def set_speed(self, speed: float) -> None:
        self.playback_speed = max(0.1, min(5.0, speed))

    def get_status(self) -> dict[str, Any]:
        return {
            "is_playing": self.is_playing,
            "current_position": self.current_position,
            "total_duration": self.total_duration,
            "progress_percent": self.progress_percent,
            "playback_speed": self.playback_speed,
            "session_metadata": self.session_metadata,
        }

    def get_timeline_markers(self) -> list[dict[str, Any]]:
        markers: list[dict[str, Any]] = [
            {"time": 0.0, "label": "Session Start", "type": "start"},
            {"time": self.total_duration, "label": "Session End", "type": "end"},
        ]
        if self.total_duration > 600:
            markers += [
                {"time": minute * 60.0, "label": f"{minute}min", "type": "marker"}
                for minute in range(1, int(self.total_duration // 60))
            ]
        return sorted(markers, key=lambda m: m["time"])


class _StaticPlaylist:
    """Recorded sessions are baked into the bundle, so there is nothing to refresh."""

    def refresh_recorded_sessions(self) -> None:
        return None


class ReplayBrain:
    """Drop-in for `SyntergicBrain` in environments without the EEG/ML stack."""

    def __init__(self, manifest: Manifest, reader: BundleReader, clock: Clock = time.monotonic) -> None:
        if not manifest.sessions:
            raise ValueError("replay bundle has no sessions")
        self.manifest = manifest
        self._reader = reader
        self._clock = clock
        self._entries = {s.id: s for s in manifest.sessions}
        self._modes = {m: sid for m, sid in manifest.modes.items() if sid in self._entries}
        self._timelines: OrderedDict[str, Timeline] = OrderedDict()
        self._mode_players: dict[str, ReplayPlayer] = {}
        self._session_player: ReplayPlayer | None = None
        self._index = self._default_session_index()
        self.playlist = _StaticPlaylist()
        self.muse_mode_active = False
        self.session_mode_active = not self._modes
        self.current_mode = (
            "session" if not self._modes else ("focus" if "focus" in self._modes else next(iter(self._modes)))
        )

    def _default_session_index(self) -> int:
        for index, session in enumerate(self.manifest.sessions):
            if session.type == "meditation":
                return index
        return 0

    def _timeline(self, entry: SessionEntry) -> Timeline:
        cached = self._timelines.get(entry.id)
        if cached is not None:
            self._timelines.move_to_end(entry.id)
            return cached
        timeline = decode_timeline(self._reader.read(entry.file))
        self._timelines[entry.id] = timeline
        while len(self._timelines) > TIMELINE_CACHE_SIZE:
            self._timelines.popitem(last=False)
        return timeline

    @staticmethod
    def _metadata(entry: SessionEntry) -> dict[str, Any]:
        return {
            "name": entry.name,
            "type": entry.type,
            "category": entry.category,
            "duration": entry.duration,
            **entry.meta,
        }

    def _make_player(self, entry: SessionEntry, playing: bool) -> ReplayPlayer:
        return ReplayPlayer(self._timeline(entry), self._metadata(entry), self._clock, playing=playing)

    def warm_up(self) -> None:
        """Load every dataset-mode timeline now so a broken bundle fails at boot, not mid-stream."""
        for session_id in self._modes.values():
            self._timeline(self._entries[session_id])

    @property
    def session_player(self) -> ReplayPlayer:
        if self._session_player is None:
            self._session_player = self._make_player(self.manifest.sessions[self._index], playing=False)
        return self._session_player

    def _mode_player(self, mode: str) -> ReplayPlayer:
        if mode not in self._mode_players:
            entry = self._entries[self._modes[mode]]
            self._mode_players[mode] = self._make_player(entry, playing=True)
        return self._mode_players[mode]

    def set_mode(self, mode: str, muse_connector: Any = None) -> bool:
        if mode == "session":
            try:
                player = self.session_player
            except _LOAD_ERRORS as exc:
                logger.warning("cannot load session for replay: %s", exc)
                return False
            self.session_mode_active = True
            player.restart()
            player.play()
            return True
        if mode in self._modes:
            self.current_mode = mode
            self.session_mode_active = False
            return True
        return False

    def next_state(self) -> dict[str, Any]:
        if not self.session_mode_active:
            return self._mode_player(self.current_mode).next_frame()
        if self.session_player.finished:
            self.next_playlist_session()
        return self.session_player.next_frame()

    def get_playlist(self) -> list[dict[str, Any]]:
        items = []
        for index, session in enumerate(self.manifest.sessions):
            item: dict[str, Any] = {
                "index": index,
                "name": session.name,
                "type": session.type,
                "category": session.category,
                "is_current": index == self._index,
            }
            if session.type in ("recorded", "recorded_sqlite"):
                item.update(session.meta)
            items.append(item)
        return items

    def get_current_playlist_info(self) -> dict[str, Any]:
        session = self.manifest.sessions[self._index]
        return {
            "name": session.name,
            "index": self._index + 1,
            "total": len(self.manifest.sessions),
            "category": session.category,
            "type": session.type,
        }

    def select_playlist_session(self, index: int) -> dict[str, Any] | None:
        if not 0 <= index < len(self.manifest.sessions):
            return None
        try:
            player = self._make_player(self.manifest.sessions[index], playing=self.session_mode_active)
        except _LOAD_ERRORS as exc:
            logger.warning("cannot load playlist session %s: %s", index, exc)
            return None
        self._index = index
        self._session_player = player
        return self.get_current_playlist_info()

    def next_playlist_session(self) -> dict[str, Any] | None:
        return self.select_playlist_session((self._index + 1) % len(self.manifest.sessions))

    def previous_playlist_session(self) -> dict[str, Any] | None:
        return self.select_playlist_session((self._index - 1) % len(self.manifest.sessions))
