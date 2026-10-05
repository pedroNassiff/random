"""Bundle readers (pure). The GCS-backed reader lives in `replay.gcs` (infrastructure)."""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Protocol


class BundleReader(Protocol):
    def read(self, path: str) -> bytes:
        """Return the bytes stored at a bundle-relative path; raise FileNotFoundError if absent."""
        ...


class DirReader:
    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def read(self, path: str) -> bytes:
        target = (self._root / path).resolve()
        if not target.is_relative_to(self._root):
            raise FileNotFoundError(path)
        return target.read_bytes()


class MemoryReader:
    def __init__(self, files: Mapping[str, bytes]) -> None:
        self._files = dict(files)

    def read(self, path: str) -> bytes:
        try:
            return self._files[path]
        except KeyError:
            raise FileNotFoundError(path) from None
