"""Infrastructure wiring: pick a bundle source and build the cloud runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .brain import ReplayBrain
from .docs import DocSnapshots
from .format import Manifest
from .gcs import GcsReader
from .reader import BundleReader, DirReader
from .synthetic import build_synthetic_bundle


@dataclass(frozen=True)
class CloudRuntime:
    brain: ReplayBrain
    docs: DocSnapshots | None


def open_reader(uri: str) -> BundleReader:
    return GcsReader(uri) if uri.startswith("gs://") else DirReader(Path(uri))


def build_cloud_runtime(uri: str | None, log: Callable[[str], None] = print) -> CloudRuntime:
    """Real replay bundle when `uri` loads cleanly; otherwise the synthetic fallback (docs disabled)."""
    if uri:
        try:
            reader = open_reader(uri)
            brain = ReplayBrain(Manifest.from_json(reader.read("manifest.json")), reader)
            brain.warm_up()
            log(f"✓ Replay bundle loaded from {uri} ({len(brain.manifest.sessions)} sessions)")
            return CloudRuntime(brain, DocSnapshots(reader))
        except Exception as exc:  # any boot-time failure (auth, network, format) must degrade, never crash
            log(f"⚠️  Replay bundle unavailable ({exc!r}) — using synthetic fallback")
    else:
        log("⚠️  REPLAY_BUNDLE_URI not set — using synthetic fallback")
    manifest, reader = build_synthetic_bundle()
    return CloudRuntime(ReplayBrain(manifest, reader), None)
