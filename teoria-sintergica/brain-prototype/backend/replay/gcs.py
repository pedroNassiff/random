"""Infrastructure: read a replay bundle from a GCS prefix (gs://bucket/prefix)."""

from __future__ import annotations

from typing import Any


class GcsReader:
    def __init__(self, uri: str, client: Any | None = None) -> None:
        if not uri.startswith("gs://"):
            raise ValueError(f"not a gs:// uri: {uri!r}")
        bucket_name, _, prefix = uri[len("gs://") :].partition("/")
        if client is None:
            from google.cloud import storage  # type: ignore[import-untyped,unused-ignore]

            client = storage.Client()
        self._bucket = client.bucket(bucket_name)
        self._prefix = prefix.strip("/")

    def read(self, path: str) -> bytes:
        name = f"{self._prefix}/{path}" if self._prefix else path
        blob = self._bucket.blob(name)
        if not blob.exists():
            raise FileNotFoundError(name)
        data: bytes = blob.download_as_bytes()
        return data
