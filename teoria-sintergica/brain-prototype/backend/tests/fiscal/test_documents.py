"""Documentos guardados: servicio, almacenes (carpeta local y GCS con cliente falso) y cableado."""

from __future__ import annotations

import base64
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from fiscal.application.attachments import Attachment
from fiscal.application.errors import Invalid, NotFound
from fiscal.infrastructure.storage import GcsDocumentStore, LocalDocumentStore
from fiscal.infrastructure.pg_invoices import PgInvoiceRepository
from fiscal.infrastructure.wiring import _store, build_documents, build_invoices
from tests.fiscal.fakes import fake_documents

NOW = datetime(2026, 10, 1, 10, tzinfo=UTC)
PDF = b"%PDF-1.4 uno"
PEDRO, ANA = "u-pedro", "u-ana"


def att(name: str, raw: bytes, media_type: str = "application/pdf") -> Attachment:
    return Attachment(name, media_type, base64.b64encode(raw).decode())


async def test_save_stores_object_and_metadata_under_the_owner() -> None:
    svc, repo, store = fake_documents(NOW)
    doc = await svc.save(PEDRO, att(" 036.pdf ", PDF))
    digest = hashlib.sha256(PDF).hexdigest()
    assert (doc.name, doc.media_type, doc.size_bytes, doc.sha256) == ("036.pdf", "application/pdf", len(PDF), digest)
    assert doc.storage_key == f"{PEDRO}/{digest}" and doc.created_at == NOW and doc.id
    assert store.objects == {f"{PEDRO}/{digest}": (PDF, "application/pdf")}
    assert await svc.list(PEDRO) == [doc] and await svc.list(ANA) == []


async def test_same_content_is_stored_once_per_owner() -> None:
    svc, repo, store = fake_documents(NOW)
    first = await svc.save(PEDRO, att("036.pdf", PDF))
    again = await svc.save(PEDRO, att("copia.pdf", PDF))
    assert again == first and len(repo.docs[PEDRO]) == 1 and len(store.objects) == 1
    other = await svc.save(ANA, att("036.pdf", PDF))
    assert other.id != first.id and other.storage_key != first.storage_key and len(store.objects) == 2
    different = await svc.save(PEDRO, att("otro.pdf", PDF + b"!"))
    assert different.id != first.id and len(repo.docs[PEDRO]) == 2


async def test_invalid_files_are_never_stored() -> None:
    svc, repo, store = fake_documents(NOW)
    with pytest.raises(Invalid, match="no coincide"):
        await svc.save(PEDRO, att("falso.pdf", b"\x89PNG\r\n\x1a\n"))
    assert repo.docs == {} and store.objects == {}
    assert (await svc.save(PEDRO, att("  ", PDF))).name == "documento"


async def test_read_and_delete_are_scoped_to_the_owner() -> None:
    svc, repo, store = fake_documents(NOW)
    doc = await svc.save(PEDRO, att("036.pdf", PDF))
    assert await svc.read(PEDRO, doc.id) == (doc, PDF)
    assert await svc.read_base64(PEDRO, doc.id) == (doc, base64.b64encode(PDF).decode())
    for call in (svc.read, svc.read_base64, svc.delete):
        with pytest.raises(NotFound, match="no existe"):
            await call(ANA, doc.id)
        with pytest.raises(NotFound):
            await call(PEDRO, "otro-id")
    assert len(store.objects) == 1
    await svc.delete(PEDRO, doc.id)
    assert await svc.list(PEDRO) == [] and store.objects == {}


async def test_metadata_without_object_reports_missing() -> None:
    svc, _, store = fake_documents(NOW)
    doc = await svc.save(PEDRO, att("036.pdf", PDF))
    store.objects.clear()
    with pytest.raises(NotFound, match="ya no está en el almacén"):
        await svc.read(PEDRO, doc.id)


# ── almacén local ───────────────────────────────────────────────────────────
async def test_local_store_roundtrip(tmp_path: Path) -> None:
    store = LocalDocumentStore(tmp_path / "docs")
    await store.put("u1/abc", PDF, "application/pdf")
    assert (tmp_path / "docs" / "u1" / "abc").read_bytes() == PDF
    assert await store.get("u1/abc") == PDF
    await store.put("u1/abc", b"nuevo", "application/pdf")
    assert await store.get("u1/abc") == b"nuevo"
    await store.delete("u1/abc")
    await store.delete("u1/abc")  # idempotente
    with pytest.raises(NotFound, match="ya no está"):
        await store.get("u1/abc")
    with pytest.raises(NotFound):
        await store.get("u1")  # una carpeta no es un documento


@pytest.mark.parametrize("key", ["../fuera", "u1/../../fuera", "/etc/passwd"])
async def test_local_store_never_leaves_its_folder(tmp_path: Path, key: str) -> None:
    store = LocalDocumentStore(tmp_path / "docs")
    for operation in (store.get(key), store.put(key, b"x", "application/pdf"), store.delete(key)):
        with pytest.raises(NotFound, match="inválida"):
            await operation
    assert not (tmp_path / "fuera").exists()


# ── GCS ─────────────────────────────────────────────────────────────────────
class FakeBlob:
    def __init__(self, bucket: FakeBucket, key: str) -> None:
        self.bucket, self.key = bucket, key

    def upload_from_string(self, data: bytes, content_type: str) -> None:
        self.bucket.objects[self.key] = (data, content_type)

    def exists(self) -> bool:
        return self.key in self.bucket.objects

    def download_as_bytes(self) -> bytes:
        return self.bucket.objects[self.key][0]

    def delete(self) -> None:
        del self.bucket.objects[self.key]


class FakeBucket:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def blob(self, key: str) -> FakeBlob:
        return FakeBlob(self, key)


class FakeGcsClient:
    def __init__(self) -> None:
        self.buckets: dict[str, FakeBucket] = {}

    def bucket(self, name: str) -> FakeBucket:
        return self.buckets.setdefault(name, FakeBucket())


async def test_gcs_store_roundtrip() -> None:
    client = FakeGcsClient()
    store = GcsDocumentStore("random-fiscal-docs", client)
    await store.put("u1/abc", PDF, "application/pdf")
    assert client.buckets["random-fiscal-docs"].objects == {"u1/abc": (PDF, "application/pdf")}
    assert await store.get("u1/abc") == PDF
    await store.delete("u1/abc")
    await store.delete("u1/abc")  # idempotente
    assert client.buckets["random-fiscal-docs"].objects == {}
    with pytest.raises(NotFound, match="ya no está"):
        await store.get("u1/abc")


def test_wiring_picks_bucket_or_local_folder(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("FISCAL_DOCS_BUCKET", raising=False)
    monkeypatch.setenv("FISCAL_DOCS_DIR", str(tmp_path / "docs"))
    local = _store()
    assert isinstance(local, LocalDocumentStore) and local._root == (tmp_path / "docs").resolve()
    monkeypatch.delenv("FISCAL_DOCS_DIR")
    default = _store()
    assert isinstance(default, LocalDocumentStore) and default._root == Path("data/fiscal_docs").resolve()
    assert isinstance(build_documents(object())._store, LocalDocumentStore)
    assert isinstance(build_invoices(object())._repo, PgInvoiceRepository)

    created: dict[str, Any] = {}

    class Client:
        def bucket(self, name: str) -> str:
            created["bucket"] = name
            return name

    import google.cloud.storage as gcs  # type: ignore[import-untyped,unused-ignore]

    monkeypatch.setattr(gcs, "Client", Client)
    monkeypatch.setenv("FISCAL_DOCS_BUCKET", "random-fiscal-docs")
    assert isinstance(_store(), GcsDocumentStore) and created == {"bucket": "random-fiscal-docs"}
