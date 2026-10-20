import gzip
import json
import math
from pathlib import Path

import pytest

from replay.bootstrap import build_cloud_runtime, open_reader
from replay.brain import ReplayBrain
from replay.docs import CACHE_TTL_SECONDS, DocSnapshots
from replay.format import BANDS, FPS, BundleFormatError, Manifest, decode_timeline, encode_timeline
from replay.gcs import GcsReader
from replay.reader import DirReader, MemoryReader
from replay.synthetic import LOOP_SECONDS, build_synthetic_bundle

from _replay_helpers import Clock, entry, make_frame, timeline_bytes

# ---------------------------------------------------------------- format


def test_timeline_roundtrip_reproduces_next_state_keys() -> None:
    timeline = decode_timeline(timeline_bytes(3))
    frame = timeline.frame(1)
    assert len(timeline) == 3
    assert frame["focal_point"] == {"x": 0.1, "y": 0.2, "z": 0.3}
    assert frame["bands"] == {b: 0.2 for b in BANDS}
    assert frame["source"] == "dataset" and frame["plv"] == 0.7 and frame["state"] == "relaxed"


def test_encoding_sanitizes_non_finite_and_missing_values() -> None:
    bad = make_frame(0, coherence=math.nan, plv=math.inf, state=None, focal_point=None, bands_display=None)
    frame = decode_timeline(encode_timeline([bad], "x")).frame(0)
    assert frame["coherence"] == 0.5 and frame["plv"] is None and frame["state"] == "neutral"
    assert frame["focal_point"] == {"x": 0.0, "y": 0.0, "z": 0.0}
    assert frame["bands_display"] == frame["bands"]
    assert decode_timeline(encode_timeline([make_frame(0, plv=None)], "x")).frame(0)["plv"] is None


@pytest.mark.parametrize(
    "payload",
    [
        b"not gzip",
        gzip.compress(b"not json"),
        gzip.compress(b"[1]"),
        gzip.compress(json.dumps({"version": 99}).encode()),
        gzip.compress(json.dumps({"version": 1, "columns": {"coherence": []}}).encode()),
    ],
)
def test_decode_rejects_invalid_payloads(payload: bytes) -> None:
    with pytest.raises(BundleFormatError):
        decode_timeline(payload)


def test_decode_rejects_empty_or_ragged_columns() -> None:
    good = json.loads(gzip.decompress(timeline_bytes(2)))
    ragged = {**good, "columns": {**good["columns"], "state": ["a"]}}
    with pytest.raises(BundleFormatError):
        decode_timeline(gzip.compress(json.dumps(ragged).encode()))
    with pytest.raises(BundleFormatError):
        encode_timeline([], "x")


def test_manifest_roundtrip_and_invalid() -> None:
    manifest = Manifest("t", (entry("a", 5, "recorded", db_id=1),), {"relax": "a"})
    assert Manifest.from_json(manifest.to_json()) == manifest
    with pytest.raises(BundleFormatError):
        Manifest.from_json(
            json.dumps({"version": 1, "sessions": [{"nope": 1}], "generated_at": "", "modes": {}}).encode()
        )
    with pytest.raises(BundleFormatError):
        Manifest.from_json(json.dumps({"version": 1}).encode())


# ---------------------------------------------------------------- readers


def test_dir_reader_reads_and_blocks_traversal(tmp_path: Path) -> None:
    root = tmp_path / "bundle"
    root.mkdir()
    (root / "a.txt").write_bytes(b"x")
    (tmp_path / "secret.txt").write_bytes(b"s")
    reader = DirReader(root)
    assert reader.read("a.txt") == b"x"
    with pytest.raises(FileNotFoundError, match=r"\.\./secret\.txt"):
        reader.read("../secret.txt")
    with pytest.raises(FileNotFoundError, match="^missing$"):
        MemoryReader({}).read("missing")


class FakeBlob:
    def __init__(self, data: bytes | None) -> None:
        self.data = data

    def exists(self) -> bool:
        return self.data is not None

    def download_as_bytes(self) -> bytes:
        assert self.data is not None
        return self.data


class FakeClient:
    def __init__(self, objects: dict[str, bytes]) -> None:
        self.objects = objects

    def bucket(self, name: str) -> "FakeClient":
        assert name == "bkt"
        return self

    def blob(self, name: str) -> FakeBlob:
        return FakeBlob(self.objects.get(name))


def test_gcs_reader_maps_prefix_and_missing_objects() -> None:
    reader = GcsReader("gs://bkt/replay/", client=FakeClient({"replay/manifest.json": b"m", "top": b"t"}))
    assert reader.read("manifest.json") == b"m"
    assert GcsReader("gs://bkt", client=FakeClient({"top": b"t"})).read("top") == b"t"
    with pytest.raises(FileNotFoundError):
        reader.read("nope")
    with pytest.raises(ValueError):
        GcsReader("s3://x", client=FakeClient({}))


# ---------------------------------------------------------------- synthetic + bootstrap


def test_synthetic_bundle_is_a_seamless_valid_replay() -> None:
    manifest, reader = build_synthetic_bundle()
    brain = ReplayBrain(manifest, reader)
    brain.warm_up()
    timeline = decode_timeline(reader.read(manifest.sessions[0].file))
    assert len(timeline) == LOOP_SECONDS * FPS
    assert timeline.frame(0)["coherence"] == pytest.approx(timeline.frame(len(timeline) - 1)["coherence"], abs=0.02)
    for name in ("relax", "focus"):
        brain.set_mode(name)
        frame = brain.next_state()
        assert frame["source"] == "synthetic"
        assert sum(frame["bands"].values()) == pytest.approx(1.0, abs=1e-3)
        assert 0.0 <= frame["coherence"] <= 1.0
    states = {
        decode_timeline(reader.read(s.file)).frame(i)["state"] for s in manifest.sessions for i in range(0, 600, 5)
    }
    assert {"meditation", "focused"} <= states


def write_bundle(root: Path) -> None:
    (root / "frames").mkdir(parents=True)
    e = entry("relax", 20)
    (root / e.file).write_bytes(timeline_bytes(20))
    (root / "manifest.json").write_bytes(Manifest("t", (e,), {"relax": "relax"}).to_json())
    (root / "doc").mkdir()
    (root / "doc/dashboard.json").write_text('{"status": "success", "sessions": []}')


def test_cloud_runtime_uses_real_bundle_when_available(tmp_path: Path) -> None:
    write_bundle(tmp_path)
    logs: list[str] = []
    runtime = build_cloud_runtime(str(tmp_path), log=logs.append)
    assert runtime.docs is not None and runtime.docs.dashboard() == {"status": "success", "sessions": []}
    assert runtime.brain.manifest.sessions[0].id == "relax"
    assert isinstance(open_reader(str(tmp_path)), DirReader)
    assert "loaded" in logs[0]


@pytest.mark.parametrize("broken", ["missing_dir", "corrupt", "no_uri"])
def test_cloud_runtime_degrades_to_synthetic(tmp_path: Path, broken: str) -> None:
    uri: str | None = str(tmp_path / "nope")
    if broken == "corrupt":
        write_bundle(tmp_path)
        (tmp_path / "frames/relax.json.gz").write_bytes(b"garbage")
        uri = str(tmp_path)
    if broken == "no_uri":
        uri = None
    logs: list[str] = []
    runtime = build_cloud_runtime(uri, log=logs.append)
    assert runtime.docs is None and runtime.brain.next_state()["source"] == "synthetic"
    assert "synthetic" in logs[0]


# ---------------------------------------------------------------- docs


def test_doc_snapshots_serve_and_cache_with_ttl() -> None:
    reads: list[str] = []

    class Counting(MemoryReader):
        def read(self, path: str) -> bytes:
            reads.append(path)
            return super().read(path)

    clock = Clock()
    reader = Counting(
        {
            "doc/dashboard.json": b'{"a": 1}',
            "doc/session/5.json": b'{"s": 5}',
            "sessions/5/metrics.json": b'{"m": 5}',
            "doc/session/6.json": b"[1]",
            "sessions/6/metrics.json": b"{broken",
        }
    )
    docs = DocSnapshots(reader, clock)
    assert docs.dashboard() == {"a": 1} and docs.dashboard() == {"a": 1}
    assert reads == ["doc/dashboard.json"]
    clock.now += CACHE_TTL_SECONDS + 1
    docs.dashboard()
    assert reads.count("doc/dashboard.json") == 2
    assert docs.session(5) == {"s": 5} and docs.metrics(5) == {"m": 5}
    assert docs.session(404) is None and docs.session(6) is None and docs.metrics(6) is None
