"""Almacén de documentos: bucket privado de GCS en la nube, carpeta local en desarrollo."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from fiscal.application.errors import NotFound


class GcsDocumentStore:
    def __init__(self, bucket: str, client: Any | None = None) -> None:
        if client is None:
            from google.cloud import storage  # type: ignore[import-untyped,unused-ignore]

            client = storage.Client()
        self._bucket = client.bucket(bucket)

    # El cliente de GCS es síncrono: cada operación corre en un hilo para no bloquear el event loop.
    async def put(self, key: str, data: bytes, media_type: str) -> None:
        await asyncio.to_thread(self._bucket.blob(key).upload_from_string, data, content_type=media_type)

    async def get(self, key: str) -> bytes:
        blob = self._bucket.blob(key)
        if not await asyncio.to_thread(blob.exists):
            raise NotFound("El documento ya no está en el almacén.")
        data: bytes = await asyncio.to_thread(blob.download_as_bytes)
        return data

    async def delete(self, key: str) -> None:
        blob = self._bucket.blob(key)
        if await asyncio.to_thread(blob.exists):
            await asyncio.to_thread(blob.delete)


class LocalDocumentStore:
    """Mismo contrato que el bucket, sobre una carpeta. Solo para desarrollo y tests."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def _path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if not path.is_relative_to(self._root):
            raise NotFound("Clave de documento inválida.")
        return path

    async def put(self, key: str, data: bytes, media_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise NotFound("El documento ya no está en el almacén.")
        return path.read_bytes()

    async def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)
