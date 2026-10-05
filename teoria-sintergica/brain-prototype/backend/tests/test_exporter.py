from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from replay.exporter import (
    ExportError,
    build_manifest,
    collect_frames,
    export_doc_snapshots,
    export_frames,
    export_session,
    frame_count,
    session_id_for,
    slugify,
    source_for,
    write_manifest,
)
from replay.format import Manifest, decode_timeline


class FakePlayer:
    def __init__(self, total: float = 4.0, window: float = 2.0) -> None:
        self.total_duration = total
        self.window_duration = window
        self.current_position = 0.0
        self.is_playing = True


class FakePlaylist:
    def __init__(self, sessions: list[dict[str, Any]], players: dict[int, Any]) -> None:
        self.sessions = sessions
        self.players = players
        self.current_index = 0
        self.current_player: Any = None

    def load_session(self, index: int) -> Any:
        player = self.players.get(index)
        self.current_index = index if player is not None else index + 1
        return player


class FakeBrain:
    def __init__(self, sessions: list[dict[str, Any]], players: dict[int, Any], drop_at: float | None = None) -> None:
        self.playlist = FakePlaylist(sessions, players)
        self.session_player: Any = None
        self.session_mode_active = False
        self.coherence_history: list[float] = [1.0]
        self.entropy_history: list[float] = [1.0]
        self.bands_history: dict[str, list[float]] = {"delta": [1.0]}
        self.plv_history: list[float] = [1.0]
        self.drop_at = drop_at

    def next_state(self) -> dict[str, Any]:
        position = self.session_player.current_position
        print("noisy get_status output")
        if self.drop_at is not None and position >= self.drop_at:
            self.session_mode_active = False
        return {
            "coherence": position / 10,
            "entropy": 0.5,
            "dominant_frequency": 10.0,
            "focal_point": {"x": position, "y": 0.0, "z": 0.0},
            "bands": {"delta": 0.2, "theta": 0.2, "alpha": 0.2, "beta": 0.2, "gamma": 0.2},
            "state": "relaxed",
            "plv": None,
        }


PHYSIO = {"name": "Eyes Closed", "path": "physionet_run2", "type": "physionet", "category": "Relaxation"}
MEDITATION = {
    "name": "Sub 001",
    "path": "/x/data/meditation/sub-001_meditation.edf",
    "type": "meditation",
    "category": "M",
}
RECORDED = {
    "name": "Rec",
    "path": "recorded:7",
    "type": "recorded",
    "category": "Mis Grabaciones",
    "db_id": 7,
    "duration": 3.0,
    "date": "2026-01-02T03:04:05",
    "notes": "n",
    "sample_count": 10,
    "avg_alpha": 0.3,
    "avg_coherence": 0.6,
}


def test_slugify_is_filesystem_safe() -> None:
    assert slugify("Hello World/ÁB!") == "hello-world-b"
    assert slugify("!!!") == "session"


def test_session_ids_per_type() -> None:
    assert session_id_for(PHYSIO) == "physionet_run2"
    assert session_id_for({"type": "physionet", "path": "physionet_runs_6-10-14"}) == "physionet_runs_6-10-14"
    assert session_id_for(MEDITATION) == "meditation-sub-001_meditation"
    assert session_id_for(RECORDED) == "recorded-7"
    assert session_id_for({"type": "recorded_sqlite", "db_id": 3}) == "recorded-3"
    assert session_id_for({"type": "custom", "path": "/a/My File.edf", "name": "x"}) == "custom-my-file"
    assert session_id_for({"type": "custom", "path": "", "name": "Named"}) == "custom-named"


def test_source_for() -> None:
    assert source_for(PHYSIO) == "dataset"
    assert source_for(MEDITATION) == "dataset"
    assert source_for(RECORDED) == "recorded"


def test_frame_count_counts_window_fitting_positions() -> None:
    assert frame_count(FakePlayer(total=4.0, window=2.0)) == 11  # t = 0.0 .. 2.0 step 0.2
    assert frame_count(FakePlayer(total=2.0, window=2.0)) == 1
    assert frame_count(FakePlayer(total=1.0, window=2.0)) == 0


def test_collect_frames_steps_paused_player_and_resets_smoothing(capsys: pytest.CaptureFixture[str]) -> None:
    brain = FakeBrain([PHYSIO], {0: FakePlayer()})
    player = brain.playlist.players[0]

    frames = collect_frames(brain, player)

    assert len(frames) == 11
    assert [round(f["focal_point"]["x"], 3) for f in frames[:3]] == [0.0, 0.2, 0.4]
    assert player.is_playing is False
    assert brain.session_mode_active is True
    assert brain.playlist.current_player is player and brain.session_player is player
    assert brain.coherence_history == [] and brain.plv_history == [] and brain.bands_history["alpha"] == []
    assert capsys.readouterr().out == ""


def test_collect_frames_can_leave_stdout_alone(capsys: pytest.CaptureFixture[str]) -> None:
    brain = FakeBrain([PHYSIO], {0: FakePlayer(total=2.0)})
    collect_frames(brain, brain.playlist.players[0], silence=False)
    assert "noisy" in capsys.readouterr().out


def test_collect_frames_rejects_too_short_session() -> None:
    brain = FakeBrain([PHYSIO], {0: FakePlayer(total=1.0)})
    with pytest.raises(ExportError, match="shorter"):
        collect_frames(brain, brain.playlist.players[0])


def test_collect_frames_detects_fallback_to_dataset_mode() -> None:
    brain = FakeBrain([PHYSIO], {0: FakePlayer()}, drop_at=1.0)
    with pytest.raises(ExportError, match="fell back"):
        collect_frames(brain, brain.playlist.players[0])


def test_export_session_writes_decodable_timeline_and_meta(tmp_path: Path) -> None:
    brain = FakeBrain([PHYSIO, RECORDED], {0: FakePlayer(), 1: FakePlayer(total=3.0)})

    entry = export_session(brain, 1, tmp_path)

    assert (entry.id, entry.file, entry.frames, entry.duration) == ("recorded-7", "frames/recorded-7.json.gz", 6, 3.0)
    assert entry.meta["db_id"] == 7 and entry.meta["avg_coherence"] == 0.6
    timeline = decode_timeline((tmp_path / entry.file).read_bytes())
    assert len(timeline) == 6 and timeline.source == "recorded"
    assert export_session(brain, 0, tmp_path).meta == {}


def test_export_session_fails_when_player_missing_or_index_differs(tmp_path: Path) -> None:
    brain = FakeBrain([PHYSIO], {})
    with pytest.raises(ExportError, match="failed to load"):
        export_session(brain, 0, tmp_path)


def test_export_frames_isolates_failures_and_can_skip_recorded(tmp_path: Path) -> None:
    logs: list[str] = []
    players = {0: FakePlayer(), 2: FakePlayer(total=3.0)}
    brain = FakeBrain([PHYSIO, MEDITATION, RECORDED], players)

    entries = export_frames(brain, tmp_path, min_recorded_id=0, log=logs.append)

    assert [e.id for e in entries] == ["physionet_run2", "recorded-7"]
    assert any("skipped" in line and "Sub 001" in line for line in logs)
    only_datasets = export_frames(brain, tmp_path / "b", skip_recorded=True, log=logs.append)
    assert [e.id for e in only_datasets] == ["physionet_run2"]
    only_recorded = export_frames(brain, tmp_path / "c", only={"recorded-7"}, min_recorded_id=0, log=logs.append)
    assert [e.id for e in only_recorded] == ["recorded-7"]


def test_build_and_write_manifest_roundtrip(tmp_path: Path) -> None:
    brain = FakeBrain([PHYSIO, RECORDED], {0: FakePlayer(), 1: FakePlayer()})
    entries = export_frames(brain, tmp_path, min_recorded_id=0, log=lambda _: None)
    now = datetime(2026, 5, 1, tzinfo=timezone.utc)

    manifest = build_manifest(entries, now=now)
    path = write_manifest(tmp_path / "out", manifest)

    assert manifest.modes == {"relax": "physionet_run2"}  # focus session was not exported
    assert manifest.generated_at == now.isoformat()
    assert Manifest.from_json(path.read_bytes()) == manifest
    assert build_manifest(entries).generated_at


def _fetcher(routes: dict[str, Any]) -> Any:
    def fetch(url: str) -> bytes:
        value = routes[url.removeprefix("http://api")]
        if isinstance(value, Exception):
            raise value
        return json.dumps(value).encode()

    return fetch


def test_export_doc_snapshots_saves_verbatim_payloads(tmp_path: Path) -> None:
    dashboard = {
        "status": "success",
        "sessions": [{"id": 18}, {"id": None}, {"id": 25}],
        "validations": [{"session_id": 18}, {"session_id": 25}],
        "total_sessions": 3,
        "total_validations": 2,
    }
    routes = {
        "/doc/dashboard": dashboard,
        "/doc/session/18": {"status": "success", "k": 1},
        "/sessions/18/metrics": {"status": "success", "metrics": [1]},
        "/doc/session/25": {"status": "success"},
        "/sessions/25/metrics": {"status": "error", "message": "no metrics"},
    }
    logs: list[str] = []

    saved = export_doc_snapshots(tmp_path, "http://api/", _fetcher(routes), log=logs.append, min_session_id=0)

    assert saved == 1
    saved_dashboard = json.loads((tmp_path / "doc/dashboard.json").read_bytes())
    assert saved_dashboard["sessions"] == [{"id": 18}, {"id": 25}]
    assert saved_dashboard["total_sessions"] == 2 and saved_dashboard["total_validations"] == 2
    assert json.loads((tmp_path / "doc/session/18.json").read_bytes()) == routes["/doc/session/18"]
    assert json.loads((tmp_path / "sessions/18/metrics.json").read_bytes()) == routes["/sessions/18/metrics"]
    assert not (tmp_path / "doc/session/25.json").exists()
    assert any("25" in line and "skipped" in line for line in logs)


def test_export_doc_snapshots_fails_when_dashboard_errors(tmp_path: Path) -> None:
    routes = {"/doc/dashboard": {"status": "error", "message": "db down"}}
    with pytest.raises(ExportError, match="db down"):
        export_doc_snapshots(tmp_path, "http://api", _fetcher(routes))
    with pytest.raises(ExportError):
        export_doc_snapshots(tmp_path, "http://api", _fetcher({"/doc/dashboard": [1]}))


def test_min_recorded_id_excludes_early_recordings_when_requested(tmp_path: Path) -> None:
    early = {**RECORDED, "db_id": 19, "path": "recorded:19"}
    late = {**RECORDED, "db_id": 20, "path": "recorded:20"}
    legacy = {"name": "old", "path": "sqlite:x", "type": "recorded_sqlite", "category": "L", "db_id": "x"}
    brain = FakeBrain([early, late, legacy, PHYSIO], {i: FakePlayer() for i in range(4)})

    entries = export_frames(brain, tmp_path, min_recorded_id=20, log=lambda _: None)

    assert [e.id for e in entries] == ["recorded-20", "physionet_run2"]


def test_all_recordings_are_exported_by_default(tmp_path: Path) -> None:
    early = {**RECORDED, "db_id": 3, "path": "recorded:3"}
    brain = FakeBrain([early, PHYSIO], {i: FakePlayer() for i in range(2)})

    entries = export_frames(brain, tmp_path, log=lambda _: None)

    assert [e.id for e in entries] == ["recorded-3", "physionet_run2"]


def test_doc_snapshots_drop_sessions_below_min_id_from_dashboard(tmp_path: Path) -> None:
    dashboard = {
        "status": "success",
        "sessions": [{"id": 5}, {"id": 21}],
        "validations": [{"session_id": 5}, {"session_id": 21}, "junk"],
        "protocol_logs": [{"filename": "x"}],
    }
    routes = {
        "/doc/dashboard": dashboard,
        "/doc/session/21": {"status": "success"},
        "/sessions/21/metrics": {"status": "success"},
    }

    saved = export_doc_snapshots(tmp_path, "http://api", _fetcher(routes), log=lambda _: None, min_session_id=20)

    result = json.loads((tmp_path / "doc/dashboard.json").read_bytes())
    assert saved == 1
    assert result["sessions"] == [{"id": 21}] and result["validations"] == [{"session_id": 21}]
    assert result["protocol_logs"] == [{"filename": "x"}]
    assert not (tmp_path / "doc/session/5.json").exists()


def test_reset_smoothing_clears_all_histories_exactly() -> None:
    from replay.exporter import _reset_smoothing

    brain = FakeBrain([PHYSIO], {0: FakePlayer()})
    brain.coherence_history = [1.0, 2.0]
    brain.entropy_history = [3.0]
    brain.plv_history = [4.0]
    brain.bands_history = {"delta": [1.0], "theta": [2.0], "alpha": [3.0], "beta": [4.0], "gamma": [5.0]}

    _reset_smoothing(brain)

    assert brain.coherence_history == []
    assert brain.entropy_history == []
    assert brain.plv_history == []
    assert brain.bands_history == {"delta": [], "theta": [], "alpha": [], "beta": [], "gamma": []}
    assert set(brain.bands_history) == {"delta", "theta", "alpha", "beta", "gamma"}


def test_write_manifest_writes_exact_bytes_at_manifest_json(tmp_path: Path) -> None:
    from replay.exporter import write_manifest

    manifest = build_manifest([], now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    out_dir = tmp_path / "nested" / "out"

    path = write_manifest(out_dir, manifest)

    assert path == out_dir / "manifest.json"
    assert path.read_bytes() == manifest.to_json()


@pytest.mark.parametrize(
    ("session", "expected"),
    [
        ({"type": "physionet", "path": "physionet_run2"}, "physionet_run2"),
        ({"type": "meditation", "path": "/a/b/Sub 001.edf"}, "meditation-sub-001"),
        ({"type": "recorded", "db_id": 42}, "recorded-42"),
        ({"type": "recorded_sqlite", "db_id": "9"}, "recorded-9"),
        ({"type": "custom", "path": "/x/y/My File.edf", "name": "ignored"}, "custom-my-file"),
        ({"type": "custom", "path": "", "name": "Named One"}, "custom-named-one"),
        ({"type": None, "path": "", "name": ""}, "none"),
    ],
)
def test_session_id_for_exact_ids(session: dict[str, Any], expected: str) -> None:
    assert session_id_for(session) == expected


def test_export_session_uses_player_total_duration_not_session_field(tmp_path: Path) -> None:
    # RECORDED declares duration=3.0 but the *player* reports its own total_duration; the
    # manifest entry must reflect the player, matching what was actually encoded.
    stale = {**RECORDED, "duration": 999.0}
    brain = FakeBrain([stale], {0: FakePlayer(total=3.0)})

    entry = export_session(brain, 0, tmp_path)

    assert entry.duration == 3.0
    assert entry.meta["duration"] == 999.0  # meta is copied verbatim from the session dict


def test_export_frames_reports_index_and_total_in_progress_log(tmp_path: Path) -> None:
    logs: list[str] = []
    brain = FakeBrain([PHYSIO, MEDITATION], {0: FakePlayer(), 1: FakePlayer()})

    export_frames(brain, tmp_path, log=logs.append)

    assert logs[0].startswith("  ✓ [1/2] Eyes Closed:")
    assert logs[1].startswith("  ✓ [2/2] Sub 001:")
    assert "11 frames" in logs[0] and "(4s)" in logs[0]
