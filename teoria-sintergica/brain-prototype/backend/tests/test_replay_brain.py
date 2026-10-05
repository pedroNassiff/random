import pytest

from replay.brain import ReplayBrain
from replay.format import Manifest, SessionEntry
from replay.reader import MemoryReader

from _replay_helpers import build, entry, timeline_bytes

# ---------------------------------------------------------------- dataset modes


def test_dataset_mode_streams_frames_in_real_time_and_loops() -> None:
    brain, clock = build()
    assert brain.current_mode == "focus" and not brain.session_mode_active
    first = brain.next_state()
    assert first["source"] == "dataset" and first["session_timestamp"] == 0.0
    clock.now += 0.7
    later = brain.next_state()
    assert later["session_timestamp"] == pytest.approx(0.7)
    assert later["coherence"] == pytest.approx(0.5 + 3 / 1000)
    clock.now += 100  # capped to 1s per tick (WebSocket reconnect gap)
    assert brain.next_state()["session_timestamp"] == pytest.approx(1.7)
    for _ in range(20):
        clock.now += 1.0
        frame = brain.next_state()
    assert 0.0 <= frame["session_timestamp"] < 10.0  # 50 frames / 5 Hz => wraps at 10 s


def test_set_mode_switches_between_datasets_and_rejects_hardware_modes() -> None:
    brain, _ = build()
    assert brain.set_mode("relax") and brain.current_mode == "relax"
    assert brain.next_state()["session_progress"] == 0.0
    assert not brain.set_mode("muse", muse_connector=object())
    assert not brain.set_mode("nonsense")
    assert brain.current_mode == "relax"


def test_without_dataset_modes_brain_starts_in_session_mode() -> None:
    brain, _ = build(with_modes=False)
    assert brain.session_mode_active and brain.current_mode == "session"
    assert brain.next_state()["source"] == "dataset"
    assert not brain.set_mode("relax")


def test_brain_requires_sessions() -> None:
    with pytest.raises(ValueError):
        ReplayBrain(Manifest("t", (), {}), MemoryReader({}))


def test_modes_pointing_to_unknown_sessions_are_ignored() -> None:
    manifest = Manifest("t", (entry("only", 10),), {"relax": "ghost"})
    brain = ReplayBrain(manifest, MemoryReader({"frames/only.json.gz": timeline_bytes(10)}))
    assert brain.session_mode_active


# ---------------------------------------------------------------- session mode + playlist


def test_session_mode_controls_and_status() -> None:
    brain, clock = build()
    assert brain.set_mode("session") and brain.session_mode_active
    player = brain.session_player
    assert player.session_metadata["name"] == "Med" and player.is_playing
    clock.now += 0.4
    brain.next_state()
    player.set_speed(2.0)
    clock.now += 0.5
    brain.next_state()
    status = player.get_status()
    assert status["current_position"] == pytest.approx(1.4) and status["playback_speed"] == 2.0
    player.pause()
    clock.now += 5
    brain.next_state()
    assert player.get_status()["current_position"] == pytest.approx(1.4) and not player.is_playing
    player.seek(10.0)
    player.seek(999.0)  # out of range: ignored
    assert player.current_position == 10.0
    player.set_speed(99)
    assert player.playback_speed == 5.0
    player.play()
    player.restart()
    assert player.current_position == 0.0


def test_timeline_markers_include_minutes_for_long_sessions() -> None:
    long = entry("long", 3001)  # 600.2 s
    brain = ReplayBrain(Manifest("t", (long,), {}), MemoryReader({long.file: timeline_bytes(long.frames)}))
    labels = [m["label"] for m in brain.session_player.get_timeline_markers()]
    assert labels[0] == "Session Start" and "9min" in labels and labels[-1] == "Session End"
    short = build()[0].session_player.get_timeline_markers()
    assert [m["type"] for m in short] == ["start", "end"]


def test_playlist_lists_sessions_with_recorded_metadata() -> None:
    brain, _ = build()
    playlist = brain.get_playlist()
    assert [p["name"] for p in playlist] == ["Relax", "Focus", "Med", "Rec"]
    assert playlist[2]["is_current"] and not playlist[0]["is_current"]
    assert playlist[3]["db_id"] == 7 and playlist[3]["notes"] == "n" and "db_id" not in playlist[0]
    assert brain.get_current_playlist_info() == {
        "name": "Med",
        "index": 3,
        "total": 4,
        "category": "Cat",
        "type": "meditation",
    }
    brain.playlist.refresh_recorded_sessions()


def test_playlist_navigation_wraps_and_validates_index() -> None:
    brain, _ = build()
    assert brain.next_playlist_session()["name"] == "Rec"
    assert brain.next_playlist_session()["name"] == "Relax"
    assert brain.previous_playlist_session()["name"] == "Rec"
    assert brain.select_playlist_session(1)["name"] == "Focus"
    assert brain.select_playlist_session(-1) is None and brain.select_playlist_session(4) is None


def test_session_auto_advances_when_finished() -> None:
    brain, clock = build()
    brain.set_mode("session")
    brain.session_player.seek(19.5)  # med lasts 20 s; margin is 1 s
    frame = brain.next_state()
    assert brain.get_current_playlist_info()["name"] == "Rec"
    assert frame["source"] == "recorded" and brain.session_player.is_playing


def test_broken_timelines_are_reported_not_raised() -> None:
    brain, _ = build()
    brain._reader = MemoryReader({})  # noqa: SLF001 - simulate lost objects
    brain._timelines.clear()  # noqa: SLF001
    assert brain.select_playlist_session(0) is None
    brain._session_player = None  # noqa: SLF001
    assert not brain.set_mode("session")
    with pytest.raises(FileNotFoundError):
        brain.warm_up()


def test_timeline_cache_is_bounded_and_reused() -> None:
    brain, _ = build()
    for i in range(4):
        brain.select_playlist_session(i)
    assert len(brain._timelines) <= 4  # noqa: SLF001
    brain._timelines.clear()  # noqa: SLF001
    for e in brain.manifest.sessions:
        brain._timeline(e)  # noqa: SLF001
    brain._timeline(brain.manifest.sessions[-1])  # noqa: SLF001 - cache hit
    assert len(brain._timelines) == 4  # noqa: SLF001


def test_timeline_cache_evicts_least_recently_used() -> None:
    entries = tuple(entry(f"s{i}", 10) for i in range(5))
    reader = MemoryReader({e.file: timeline_bytes(10) for e in entries})
    brain = ReplayBrain(Manifest("t", entries, {}), reader)
    for e in entries:
        brain._timeline(e)  # noqa: SLF001
    assert list(brain._timelines) == ["s1", "s2", "s3", "s4"]  # noqa: SLF001


# ---------------------------------------------------------------- exact shapes


def test_get_status_exact_shape_and_values() -> None:
    brain, clock = build()
    brain.set_mode("session")
    player = brain.session_player
    clock.now += 2.0  # a single tick is capped to MAX_ADVANCE_SECONDS (1.0s)
    brain.next_state()

    status = player.get_status()

    assert set(status) == {
        "is_playing",
        "current_position",
        "total_duration",
        "progress_percent",
        "playback_speed",
        "session_metadata",
    }
    assert status["is_playing"] is True
    assert status["current_position"] == pytest.approx(1.0)
    assert status["total_duration"] == pytest.approx(20.0)  # med: 100 frames / 5 Hz
    assert status["progress_percent"] == pytest.approx(5.0)
    assert status["playback_speed"] == 1.0
    assert status["session_metadata"]["name"] == "Med"
    assert status["session_metadata"]["type"] == "meditation"
    assert status["session_metadata"]["category"] == "Cat"
    assert status["session_metadata"]["duration"] == pytest.approx(20.0)


def test_progress_percent_is_zero_for_zero_duration_player() -> None:
    e = entry("z", 0)
    e = SessionEntry(e.id, e.name, e.type, e.category, 0.0, 1, e.file)
    brain = ReplayBrain(Manifest("t", (e,), {}), MemoryReader({e.file: timeline_bytes(1)}))
    assert brain.session_player.progress_percent == 0.0
    assert brain.session_player.get_status()["progress_percent"] == 0.0


def test_metadata_merges_entry_fields_with_recorded_meta_and_meta_wins_on_conflict() -> None:
    brain, _ = build()
    brain.select_playlist_session(3)  # "rec"
    meta = brain.session_player.session_metadata
    assert meta["name"] == "Rec" and meta["type"] == "recorded" and meta["category"] == "Cat"
    assert meta["duration"] == 20.0  # meta["duration"] (entry.meta) overrides entry.duration
    assert meta["db_id"] == 7 and meta["date"] == "2026-01-01" and meta["notes"] == "n"


def test_get_playlist_exact_item_shape_per_type() -> None:
    brain, _ = build()
    playlist = brain.get_playlist()
    assert playlist[0] == {"index": 0, "name": "Relax", "type": "physionet", "category": "Cat", "is_current": False}
    assert playlist[2]["is_current"] is True  # med is the default session (meditation type)
    recorded = playlist[3]
    assert recorded["index"] == 3 and recorded["is_current"] is False
    assert recorded["db_id"] == 7 and recorded["duration"] == 20.0 and recorded["date"] == "2026-01-01"
    assert recorded["notes"] == "n"
    assert set(playlist[0]) == {"index", "name", "type", "category", "is_current"}
    assert set(recorded) >= {"index", "name", "type", "category", "is_current", "db_id", "duration", "date", "notes"}


def test_default_session_index_picks_first_meditation_else_zero() -> None:
    brain, _ = build()
    assert brain._index == 2  # noqa: SLF001 - "med" is index 2 in build()
    only_physio = ReplayBrain(
        Manifest("t", (entry("p", 10),), {}), MemoryReader({"frames/p.json.gz": timeline_bytes(10)})
    )
    assert only_physio._index == 0  # noqa: SLF001


def test_init_default_mode_prefers_focus_then_first_available_mode() -> None:
    brain, _ = build()
    assert brain.current_mode == "focus"
    only_relax = ReplayBrain(
        Manifest("t", (entry("relax", 10),), {"relax": "relax"}),
        MemoryReader({"frames/relax.json.gz": timeline_bytes(10)}),
    )
    assert only_relax.current_mode == "relax"


def test_init_state_flags_and_mode_filtering() -> None:
    brain, _ = build()
    assert brain.muse_mode_active is False
    assert brain.session_mode_active is False  # dataset modes exist, so it starts in a mode, not session
    assert brain._modes == {"relax": "relax", "focus": "focus"}  # noqa: SLF001


def test_set_mode_session_returns_true_and_activates_playing_player() -> None:
    brain, _ = build()
    brain.set_mode("focus")  # start elsewhere first
    assert brain.set_mode("session") is True
    assert brain.session_mode_active is True
    assert brain.session_player.is_playing is True
    assert brain.session_player.current_position == 0.0


def test_set_mode_dataset_returns_true_and_deactivates_session_mode() -> None:
    brain, _ = build()
    brain.set_mode("session")
    assert brain.set_mode("focus") is True
    assert brain.current_mode == "focus"
    assert brain.session_mode_active is False


@pytest.mark.parametrize("mode", ["muse", "nonexistent", ""])
def test_set_mode_rejects_unsupported_modes(mode: str) -> None:
    brain, _ = build()
    assert brain.set_mode(mode) is False


def test_timeline_markers_exact_minute_labels_and_times() -> None:
    long = entry("long", 3001)  # 600.2 s
    brain = ReplayBrain(Manifest("t", (long,), {}), MemoryReader({long.file: timeline_bytes(3001)}))
    markers = brain.session_player.get_timeline_markers()
    assert markers[0] == {"time": 0.0, "label": "Session Start", "type": "start"}
    assert markers[-1] == {"time": pytest.approx(600.2), "label": "Session End", "type": "end"}
    minute_markers = [m for m in markers if m["type"] == "marker"]
    assert [m["label"] for m in minute_markers] == [f"{i}min" for i in range(1, 10)]
    assert [m["time"] for m in minute_markers] == [pytest.approx(i * 60.0) for i in range(1, 10)]


def test_timeline_markers_boundary_at_exactly_600_seconds_has_no_minute_markers() -> None:
    exact = entry("exact", 3000)  # 600.0 s: not > 600, so no per-minute markers
    brain = ReplayBrain(Manifest("t", (exact,), {}), MemoryReader({exact.file: timeline_bytes(3000)}))
    markers = brain.session_player.get_timeline_markers()
    assert [m["type"] for m in markers] == ["start", "end"]


def test_timeline_markers_are_sorted_by_time() -> None:
    long = entry("long", 3001)
    brain = ReplayBrain(Manifest("t", (long,), {}), MemoryReader({long.file: timeline_bytes(3001)}))
    times = [m["time"] for m in brain.session_player.get_timeline_markers()]
    assert times == sorted(times)
