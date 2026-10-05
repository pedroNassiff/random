"""Repositorio fiscal en memoria."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime
from uuid import uuid4

from fiscal.application.clients import ClientService, VatCheck
from fiscal.application.documents import DocumentService, StoredDocument
from fiscal.application.errors import Invalid, NotFound
from fiscal.application.invoices import InvoiceService
from fiscal.application.ports import StoredStatus
from fiscal.domain.clients import Client
from fiscal.domain.holidays import Holiday
from fiscal.domain.invoices import Invoice
from fiscal.domain.profile import TaxProfile
from tests.fiscal.helpers import seeded_holidays


@dataclass
class FakeFiscalRepo:
    profiles: dict[str, list[TaxProfile]] = field(default_factory=dict)
    statuses: dict[str, dict[str, StoredStatus]] = field(default_factory=dict)
    holidays: list[Holiday] = field(default_factory=seeded_holidays)
    saved_at: list[datetime] = field(default_factory=list)

    async def latest_profile(self, owner_id: str) -> TaxProfile | None:
        versions = self.profiles.get(owner_id)
        return versions[-1] if versions else None

    async def add_profile_version(self, owner_id: str, profile: TaxProfile) -> TaxProfile:
        versions = self.profiles.setdefault(owner_id, [])
        stored = replace(profile, version=len(versions) + 1)
        versions.append(stored)
        return stored

    async def list_holidays(self) -> list[Holiday]:
        return list(self.holidays)

    async def list_statuses(self, owner_id: str) -> dict[str, StoredStatus]:
        return dict(self.statuses.get(owner_id, {}))

    async def save_status(self, owner_id: str, key: str, status: StoredStatus, now: datetime) -> None:
        self.statuses.setdefault(owner_id, {})[key] = status
        self.saved_at.append(now)


@dataclass
class FakeDocumentRepo:
    docs: dict[str, list[StoredDocument]] = field(default_factory=dict)

    async def upsert_document(self, owner_id: str, doc: StoredDocument) -> StoredDocument:
        mine = self.docs.setdefault(owner_id, [])
        existing = next((d for d in mine if d.sha256 == doc.sha256), None)
        if existing is not None:
            return existing
        stored = replace(doc, id=str(uuid4()))
        mine.append(stored)
        return stored

    async def list_documents(self, owner_id: str) -> list[StoredDocument]:
        return sorted(self.docs.get(owner_id, []), key=lambda d: d.created_at, reverse=True)

    async def get_document(self, owner_id: str, document_id: str) -> StoredDocument | None:
        return next((d for d in self.docs.get(owner_id, []) if d.id == document_id), None)

    async def delete_document(self, owner_id: str, document_id: str) -> None:
        self.docs[owner_id] = [d for d in self.docs.get(owner_id, []) if d.id != document_id]


@dataclass
class FakeStore:
    objects: dict[str, tuple[bytes, str]] = field(default_factory=dict)

    async def put(self, key: str, data: bytes, media_type: str) -> None:
        self.objects[key] = (data, media_type)

    async def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise NotFound("El documento ya no está en el almacén.")
        return self.objects[key][0]

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


def fake_documents(now: datetime) -> tuple[DocumentService, FakeDocumentRepo, FakeStore]:
    repo, store = FakeDocumentRepo(), FakeStore()
    return DocumentService(repo, store, clock=lambda: now), repo, store


@dataclass
class FakeInvoiceRepo:
    invoices: dict[str, list[Invoice]] = field(default_factory=dict)

    async def add_invoice(self, owner_id: str, invoice: Invoice) -> Invoice:
        stored = replace(invoice, id=str(uuid4()))
        self.invoices.setdefault(owner_id, []).append(stored)
        return stored

    async def list_invoices(self, owner_id: str) -> list[Invoice]:
        return list(self.invoices.get(owner_id, []))

    async def void_invoice(self, owner_id: str, invoice_id: str) -> bool:
        mine = self.invoices.get(owner_id, [])
        for i, inv in enumerate(mine):
            if inv.id == invoice_id:
                mine[i] = replace(inv, anulada=True)
                return True
        return False


def fake_invoices(now: datetime) -> tuple[InvoiceService, FakeInvoiceRepo]:
    repo = FakeInvoiceRepo()
    return InvoiceService(repo, clock=lambda: now), repo


@dataclass
class FakeClientRepo:
    clients: dict[str, list[Client]] = field(default_factory=dict)

    async def add_client(self, owner_id: str, client: Client) -> Client:
        mine = self.clients.setdefault(owner_id, [])
        stored = replace(client, id=str(uuid4()), codigo=max((c.codigo for c in mine), default=0) + 1)
        mine.append(stored)
        return stored

    async def update_client(self, owner_id: str, client: Client) -> Client | None:
        mine = self.clients.get(owner_id, [])
        for i, c in enumerate(mine):
            if c.id == client.id:
                mine[i] = client
                return client
        return None

    async def get_client(self, owner_id: str, client_id: str) -> Client | None:
        return next((c for c in self.clients.get(owner_id, []) if c.id == client_id), None)

    async def list_clients(self, owner_id: str) -> list[Client]:
        return sorted(self.clients.get(owner_id, []), key=lambda c: c.codigo)


@dataclass
class FakeVies:
    """Registro VIES de mentira: VAT → nombre. `down` simula el servicio caído."""

    registry: dict[str, str] = field(default_factory=lambda: {"IT01234567890": "CLIENTE ITALIA S.R.L."})
    down: bool = False
    asked: list[tuple[str, str]] = field(default_factory=list)

    async def check(self, country: str, number: str) -> VatCheck:
        self.asked.append((country, number))
        if self.down:
            raise Invalid("VIES no respondió. Probá de nuevo en unos minutos.")
        name = self.registry.get(country + number)
        return VatCheck(name is not None, name)


def fake_clients(now: datetime) -> tuple[ClientService, FakeClientRepo, FakeVies]:
    repo, vies = FakeClientRepo(), FakeVies()
    return ClientService(repo, vies, clock=lambda: now), repo, vies
