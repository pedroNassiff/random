"""Composición: arma los servicios fiscales con sus adaptadores a partir del entorno."""

from __future__ import annotations

import os
from pathlib import Path

import asyncpg

from fiscal.application.agent import FiscalAgent
from fiscal.application.clients import ClientService
from fiscal.application.documents import DocumentService, DocumentStore
from fiscal.application.invoices import InvoiceService
from fiscal.application.movements import MovementService
from fiscal.application.service import FiscalService
from fiscal.application.specs import SpecService
from fiscal.infrastructure.claude import ClaudeChatModel
from fiscal.infrastructure.pg import PgFiscalRepository
from fiscal.infrastructure.pg_clients import PgClientRepository
from fiscal.infrastructure.pg_invoices import PgInvoiceRepository
from fiscal.infrastructure.pg_movements import PgMovementRepository
from fiscal.infrastructure.pg_neo import PgNeoReader
from fiscal.infrastructure.pg_specs import PgSpecRepository
from fiscal.infrastructure.vies import ViesClient
from fiscal.infrastructure.xlsx import read_xlsx
from fiscal.infrastructure.storage import GcsDocumentStore, LocalDocumentStore


def build_service(pool: asyncpg.Pool) -> FiscalService:
    return FiscalService(PgFiscalRepository(pool))


def _store() -> DocumentStore:
    bucket = os.getenv("FISCAL_DOCS_BUCKET")
    if bucket:
        return GcsDocumentStore(bucket)
    # Sin bucket (desarrollo local): carpeta fuera de git (`data/` está ignorada).
    return LocalDocumentStore(Path(os.getenv("FISCAL_DOCS_DIR", "data/fiscal_docs")))


def build_documents(pool: asyncpg.Pool) -> DocumentService:
    return DocumentService(PgFiscalRepository(pool), _store())


def build_invoices(pool: asyncpg.Pool) -> InvoiceService:
    return InvoiceService(PgInvoiceRepository(pool))


def build_clients(pool: asyncpg.Pool) -> ClientService:
    return ClientService(PgClientRepository(pool), ViesClient())


def build_specs(pool: asyncpg.Pool) -> SpecService:
    return SpecService(PgSpecRepository(pool))


def build_movements(pool: asyncpg.Pool) -> MovementService:
    return MovementService(PgMovementRepository(pool), read_xlsx)


async def build_neo_pool() -> asyncpg.Pool | None:
    """Pool de NEO con el usuario `neo_reader` (fiscal/009). Sin NEO_DATABASE_URL, NEO no lee la base directo."""
    dsn = os.getenv("NEO_DATABASE_URL")
    if not dsn:
        return None
    # neo_reader tiene CONNECTION LIMIT 5: el pool se queda por debajo.
    pool: asyncpg.Pool = await asyncpg.create_pool(dsn, min_size=0, max_size=2)
    return pool


def build_agent(
    service: FiscalService,
    documents: DocumentService,
    invoices: InvoiceService,
    clients: ClientService,
    specs: SpecService,
    *,
    app_pool: asyncpg.Pool,
    neo_pool: asyncpg.Pool | None,
) -> FiscalAgent:
    reader = PgNeoReader(app_pool, neo_pool) if neo_pool is not None else None
    return FiscalAgent(service, ClaudeChatModel(), documents, invoices, clients, reader=reader, specs=specs)
