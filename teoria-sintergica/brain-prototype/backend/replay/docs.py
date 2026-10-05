"""Read-only snapshots of what /lab/brain/doc consumes (dashboard, session detail, session metrics)."""

from __future__ import annotations

import json
import time
from typing import Any, Callable

from .reader import BundleReader

CACHE_TTL_SECONDS = 300.0


class DocSnapshots:
    def __init__(self, reader: BundleReader, clock: Callable[[], float] = time.monotonic) -> None:
        self._reader = reader
        self._clock = clock
        self._cache: dict[str, tuple[float, dict[str, Any] | None]] = {}

    def dashboard(self) -> dict[str, Any] | None:
        return self._load("doc/dashboard.json")

    def session(self, session_id: int) -> dict[str, Any] | None:
        return self._load(f"doc/session/{int(session_id)}.json")

    def metrics(self, session_id: int) -> dict[str, Any] | None:
        return self._load(f"sessions/{int(session_id)}/metrics.json")

    def _load(self, path: str) -> dict[str, Any] | None:
        now = self._clock()
        cached = self._cache.get(path)
        if cached is not None and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]
        data = self._read(path)
        self._cache[path] = (now, data)
        return data

    def _read(self, path: str) -> dict[str, Any] | None:
        try:
            data = json.loads(self._reader.read(path))
        except (FileNotFoundError, ValueError):
            return None
        return data if isinstance(data, dict) else None
