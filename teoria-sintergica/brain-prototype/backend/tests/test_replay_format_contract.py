from __future__ import annotations

import gzip
import json
import math

import pytest

from replay.format import (
    BANDS,
    COLUMNS,
    FORMAT_VERSION,
    FPS,
    BundleFormatError,
    Manifest,
    SessionEntry,
    decode_timeline,
    encode_timeline,
)


def make_frame(i: int, **over: object) -> dict[str, object]:
    frame = {
        "coherence": 0.111111 + i,
        "entropy": 0.222222,
        "dominant_frequency": 12.3456789,
        "focal_point": {"x": 0.1, "y": -0.2, "z": 0.3},
        "bands": {"delta": 0.11, "theta": 0.12, "alpha": 0.13, "beta": 0.14, "gamma": 0.15},
        "bands_display": {"delta": 0.21, "theta": 0.22, "alpha": 0.23, "beta": 0.24, "gamma": 0.25},
        "plv": 0.456789,
        "state": "focused",
    }
    frame.update(over)
    return frame


def test_constants() -> None:
    assert FORMAT_VERSION == 1 and FPS == 5
    assert BANDS == ("delta", "theta", "alpha", "beta", "gamma")
    assert set(COLUMNS) == {
        "coherence",
        "entropy",
        "frequency",
        "fx",
        "fy",
        "fz",
        "plv",
        "state",
        *[f"b_{b}" for b in BANDS],
        *[f"d_{b}" for b in BANDS],
    }


def test_row_rounds_to_four_decimals_and_maps_fields() -> None:
    timeline = decode_timeline(encode_timeline([make_frame(0)], "dataset"))
    frame = timeline.frame(0)
    assert frame["coherence"] == 0.1111
    assert frame["entropy"] == 0.2222
    assert frame["dominant_frequency"] == 12.3457
    assert frame["focal_point"] == {"x": 0.1, "y": -0.2, "z": 0.3}
    assert frame["plv"] == 0.4568
    assert frame["bands"] == {"delta": 0.11, "theta": 0.12, "alpha": 0.13, "beta": 0.14, "gamma": 0.15}
    assert frame["bands_display"] == {"delta": 0.21, "theta": 0.22, "alpha": 0.23, "beta": 0.24, "gamma": 0.25}


@pytest.mark.parametrize(
    ("override", "field", "expected"),
    [
        ({"coherence": None}, "coherence", 0.5),
        ({"coherence": math.nan}, "coherence", 0.5),
        ({"coherence": math.inf}, "coherence", 0.5),
        ({"coherence": "nope"}, "coherence", 0.5),
        ({"entropy": None}, "entropy", 0.5),
        ({"dominant_frequency": None}, "dominant_frequency", 10.0),
        ({"focal_point": None}, "focal_point", {"x": 0.0, "y": 0.0, "z": 0.0}),
        ({"focal_point": {}}, "focal_point", {"x": 0.0, "y": 0.0, "z": 0.0}),
        ({"bands": None}, "bands", dict.fromkeys(BANDS, 0.0)),
        (
            {"bands_display": None},
            "bands_display",
            {"delta": 0.11, "theta": 0.12, "alpha": 0.13, "beta": 0.14, "gamma": 0.15},
        ),
        ({"state": None}, "state", "neutral"),
        ({"state": ""}, "state", "neutral"),
        ({"plv": None}, "plv", None),
        ({"plv": math.nan}, "plv", None),
        ({"plv": math.inf}, "plv", None),
    ],
)
def test_row_defaults_for_missing_or_invalid_values(override: dict[str, object], field: str, expected: object) -> None:
    frame = decode_timeline(encode_timeline([make_frame(0, **override)], "x")).frame(0)
    assert frame[field] == expected


def test_bands_display_falls_back_to_bands_when_absent() -> None:
    frame = decode_timeline(encode_timeline([make_frame(0, bands_display=None)], "x")).frame(0)
    assert frame["bands_display"] == frame["bands"]


def test_encode_rejects_empty_and_round_trips_source() -> None:
    with pytest.raises(BundleFormatError, match="empty"):
        encode_timeline([], "dataset")
    timeline = decode_timeline(encode_timeline([make_frame(0), make_frame(1)], "recorded"))
    assert timeline.source == "recorded"
    assert len(timeline) == 2


def test_encode_output_is_gzip_of_versioned_json() -> None:
    payload = encode_timeline([make_frame(0)], "dataset")
    body = json.loads(gzip.decompress(payload))
    assert body["version"] == FORMAT_VERSION
    assert body["fps"] == FPS
    assert body["source"] == "dataset"
    assert set(body["columns"]) == set(COLUMNS)
    assert body["columns"]["coherence"] == [0.1111]


@pytest.mark.parametrize(
    ("payload", "match"),
    [
        (b"not gzip at all", "unreadable"),
        (gzip.compress(b"{not json"), "unreadable"),
        (gzip.compress(b"[1, 2, 3]"), "unsupported bundle version"),
        (gzip.compress(json.dumps({"version": 2, "columns": {}}).encode()), "unsupported bundle version"),
        (gzip.compress(json.dumps({"version": FORMAT_VERSION}).encode()), "missing columns"),
        (
            gzip.compress(
                json.dumps({"version": FORMAT_VERSION, "columns": {c: [] for c in COLUMNS if c != "state"}}).encode()
            ),
            "missing columns",
        ),
        (
            gzip.compress(json.dumps({"version": FORMAT_VERSION, "columns": {c: [] for c in COLUMNS}}).encode()),
            "empty or have different lengths",
        ),
        (
            gzip.compress(
                json.dumps(
                    {"version": FORMAT_VERSION, "columns": {c: ([1] if c != "state" else []) for c in COLUMNS}}
                ).encode()
            ),
            "empty or have different lengths",
        ),
    ],
)
def test_decode_rejects_each_invalid_shape(payload: bytes, match: str) -> None:
    with pytest.raises(BundleFormatError, match=match):
        decode_timeline(payload)


def test_decode_defaults_missing_source_to_replay() -> None:
    good = json.loads(gzip.decompress(encode_timeline([make_frame(0)], "dataset")))
    del good["source"]
    timeline = decode_timeline(gzip.compress(json.dumps(good).encode()))
    assert timeline.source == "replay"


def test_timeline_len_and_frame_use_matching_index() -> None:
    timeline = decode_timeline(encode_timeline([make_frame(0), make_frame(1), make_frame(2)], "dataset"))
    assert len(timeline) == 3
    assert timeline.frame(0)["coherence"] == 0.1111
    assert timeline.frame(2)["coherence"] == 2.1111
    assert timeline.frame(1)["source"] == "dataset"


def test_timeline_frame_shape_matches_next_state_contract() -> None:
    frame = decode_timeline(encode_timeline([make_frame(0)], "muse2")).frame(0)
    assert set(frame) == {
        "coherence",
        "entropy",
        "dominant_frequency",
        "focal_point",
        "bands",
        "bands_display",
        "plv",
        "state",
        "source",
    }
    assert frame["source"] == "muse2"


def entry(id_: str = "a", **kw: object) -> SessionEntry:
    base = dict(name="A", type="physionet", category="Cat", duration=1.0, frames=5, file="frames/a.json.gz")
    base.update(kw)
    return SessionEntry(id=id_, **base)  # type: ignore[arg-type]


def test_manifest_to_json_shape_and_defaults() -> None:
    manifest = Manifest("2026-01-01T00:00:00+00:00", (entry(),), {"relax": "a"})
    body = json.loads(manifest.to_json())
    assert body["version"] == FORMAT_VERSION
    assert body["fps"] == FPS
    assert body["generated_at"] == "2026-01-01T00:00:00+00:00"
    assert body["modes"] == {"relax": "a"}
    assert body["sessions"] == [
        {
            "id": "a",
            "name": "A",
            "type": "physionet",
            "category": "Cat",
            "duration": 1.0,
            "frames": 5,
            "file": "frames/a.json.gz",
            "meta": {},
        }
    ]


def test_manifest_to_json_preserves_meta() -> None:
    body = json.loads(Manifest("t", (entry(meta={"db_id": 7, "notes": "n"}),), {}).to_json())
    assert body["sessions"][0]["meta"] == {"db_id": 7, "notes": "n"}


def test_manifest_roundtrip_is_exact() -> None:
    manifest = Manifest("t", (entry("a", meta={"db_id": 1}), entry("b", name="B")), {"relax": "a", "focus": "b"})
    assert Manifest.from_json(manifest.to_json()) == manifest


@pytest.mark.parametrize(
    "payload",
    [
        json.dumps({"version": 2, "sessions": [], "generated_at": "t", "modes": {}}).encode(),
        json.dumps({"version": FORMAT_VERSION}).encode(),
        json.dumps({"version": FORMAT_VERSION, "sessions": "nope", "generated_at": "t", "modes": {}}).encode(),
        json.dumps({"version": FORMAT_VERSION, "sessions": [{"id": "a"}], "generated_at": "t", "modes": {}}).encode(),
        b"not json",
    ],
)
def test_manifest_from_json_rejects_invalid_payloads(payload: bytes) -> None:
    with pytest.raises(BundleFormatError):
        Manifest.from_json(payload)


def test_manifest_from_json_does_not_gzip_decompress() -> None:
    # Manifest is plain JSON on disk (unlike per-session timelines); feeding gzip must fail cleanly.
    with pytest.raises(BundleFormatError):
        Manifest.from_json(encode_timeline([make_frame(0)], "x"))
