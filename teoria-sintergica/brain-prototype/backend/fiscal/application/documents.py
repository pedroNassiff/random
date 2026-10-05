"""Documentos guardados: contenido en un almacén de objetos, metadatos en la base.

Se guardan una vez por contenido (sha256) y por dueño, así el agente puede releerlos sin que la
persona los vuelva a subir.
"""

from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from fiscal.application.attachments import Attachment, decode
from fiscal.application.errors import NotFound


@dataclass(frozen=True)
class StoredDocument:
    id: str
    name: str
    media_type: str
    size_bytes: int
    sha256: str
    storage_key: str
    created_at: datetime


class DocumentStore(Protocol):
    async def put(self, key: str, data: bytes, media_type: str) -> None: ...
    async def get(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...


class DocumentRepository(Protocol):
    async def upsert_document(self, owner_id: str, doc: StoredDocument) -> StoredDocument:
        """Inserta el documento; si el dueño ya tiene ese sha256, devuelve el existente."""
        ...

    async def list_documents(self, owner_id: str) -> list[StoredDocument]: ...
    async def get_document(self, owner_id: str, document_id: str) -> StoredDocument | None: ...
    async def delete_document(self, owner_id: str, document_id: str) -> None: ...


class DocumentService:
    def __init__(
        self,
        repo: DocumentRepository,
        store: DocumentStore,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repo
        self._store = store
        self._clock = clock

    async def save(self, owner_id: str, attachment: Attachment) -> StoredDocument:
        raw = decode(attachment)
        digest = hashlib.sha256(raw).hexdigest()
        # La clave incluye al dueño: dos usuarios con el mismo archivo no comparten objeto.
        key = f"{owner_id}/{digest}"
        await self._store.put(key, raw, attachment.media_type)
        name = attachment.name.strip() or "documento"
        doc = StoredDocument("", name, attachment.media_type, len(raw), digest, key, self._clock())
        return await self._repo.upsert_document(owner_id, doc)

    async def list(self, owner_id: str) -> list[StoredDocument]:
        return await self._repo.list_documents(owner_id)

    async def read(self, owner_id: str, document_id: str) -> tuple[StoredDocument, bytes]:
        doc = await self._repo.get_document(owner_id, document_id)
        if doc is None:
            raise NotFound("Ese documento no existe.")
        return doc, await self._store.get(doc.storage_key)

    async def read_base64(self, owner_id: str, document_id: str) -> tuple[StoredDocument, str]:
        doc, raw = await self.read(owner_id, document_id)
        return doc, base64.b64encode(raw).decode()

    async def delete(self, owner_id: str, document_id: str) -> None:
        doc = await self._repo.get_document(owner_id, document_id)
        if doc is None:
            raise NotFound("Ese documento no existe.")
        await self._repo.delete_document(owner_id, document_id)
        await self._store.delete(doc.storage_key)
