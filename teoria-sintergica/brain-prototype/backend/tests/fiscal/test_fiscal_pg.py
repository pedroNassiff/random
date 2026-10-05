"""Integración contra PostgreSQL real (schemas `fiscal` y cuentas). Se salta si no hay FUTBOL_TEST_DSN.

Usa la misma DB dedicada de test que Fútbol Vaquero (nunca la de desarrollo).
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import asyncpg
import pytest

from accounts.application.credentials import hash_password
from accounts.application.errors import Unauthorized
from accounts.application.session_service import SessionService
from accounts.infrastructure.pg import PgAccountRepository
from fiscal.application.documents import StoredDocument
from fiscal.application.ports import StoredStatus
from fiscal.infrastructure.pg import PgFiscalRepository
from fiscal.infrastructure.pg_invoices import PgInvoiceRepository
from tests.fiscal.helpers import PILOTO, seeded_holidays
from tests.fiscal.test_invoices import inv, italia, usa

DSN = os.getenv("FUTBOL_TEST_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="FUTBOL_TEST_DSN no configurado")
BACKEND = Path(__file__).parents[2]
MIGRATIONS = [
    *sorted((BACKEND / "futbol" / "migrations").glob("*.sql")),
    *sorted((BACKEND / "fiscal" / "migrations").glob("*.sql")),
]
NOW = datetime(2026, 10, 1, 10, tzinfo=UTC)


@pytest.fixture
async def pool() -> AsyncIterator[asyncpg.Pool]:
    assert DSN and "test" in DSN, "el DSN de test debe apuntar a una DB con 'test' en el nombre"
    p = await asyncpg.create_pool(DSN, min_size=1, max_size=3)
    for m in MIGRATIONS:
        await p.execute(m.read_text(encoding="utf-8"))
    await p.execute(
        "TRUNCATE futbol.app_users, fiscal.tax_profiles, fiscal.obligation_status, "
        "fiscal.documents, fiscal.invoices CASCADE"
    )
    yield p
    await p.close()


async def _user(pool: asyncpg.Pool, email: str, password: str | None = None) -> str:
    row = await pool.fetchrow(
        "INSERT INTO futbol.app_users (email, password_hash) VALUES ($1, $2) RETURNING id",
        email,
        hash_password(password) if password else None,
    )
    return str(row["id"])


async def test_shared_session_against_postgres(pool: asyncpg.Pool) -> None:
    user_id = await _user(pool, "pedro@x.com", "correcta-123")
    await _user(pool, "sin-clave@x.com")
    repo = PgAccountRepository(pool)
    assert await repo.password_hash_for("nadie@x.com") is None
    assert await repo.password_hash_for("sin-clave@x.com") == (await _user_id(pool, "sin-clave@x.com"), None)
    svc = SessionService(repo, clock=lambda: NOW)
    session, identity = await svc.login("pedro@x.com", "correcta-123")
    assert identity.user_id == user_id
    assert await svc.identity_for(session) == identity
    assert await repo.identity_for_session("no-existe", NOW) is None
    late = SessionService(repo, clock=lambda: NOW + timedelta(days=31))
    with pytest.raises(Unauthorized, match="venció"):
        await late.identity_for(session)
    await svc.logout(session)
    with pytest.raises(Unauthorized, match="venció"):
        await svc.identity_for(session)


async def _user_id(pool: asyncpg.Pool, email: str) -> str:
    return str(await pool.fetchval("SELECT id FROM futbol.app_users WHERE email = $1", email))


async def test_profile_versions_are_append_only_and_per_owner(pool: asyncpg.Pool) -> None:
    pedro, ana = await _user(pool, "pedro@x.com"), await _user(pool, "ana@x.com")
    repo = PgFiscalRepository(pool)
    assert await repo.latest_profile(pedro) is None
    v1 = await repo.add_profile_version(pedro, PILOTO)
    v2 = await repo.add_profile_version(pedro, replace(PILOTO, roi=False, tarifa_plana_hasta=None))
    assert v1 == replace(PILOTO, version=1)
    assert (v2.version, v2.roi, v2.tarifa_plana_hasta) == (2, False, None)
    assert await repo.latest_profile(pedro) == v2
    assert await pool.fetchval("SELECT count(*) FROM fiscal.tax_profiles") == 2
    assert await repo.latest_profile(ana) is None
    assert (await repo.add_profile_version(ana, PILOTO)).version == 1


async def test_seeded_holidays_and_status_upsert(pool: asyncpg.Pool) -> None:
    pedro, ana = await _user(pool, "pedro@x.com"), await _user(pool, "ana@x.com")
    repo = PgFiscalRepository(pool)
    stored = await repo.list_holidays()
    assert sorted(stored, key=lambda h: (h.day, h.territorio)) == sorted(
        seeded_holidays(), key=lambda h: (h.day, h.territorio)
    )
    assert stored[0].day == date(2026, 1, 1)

    await repo.save_status(pedro, "303-2026-2T", StoredStatus("preparado", None), NOW)
    await repo.save_status(pedro, "303-2026-2T", StoredStatus("presentado", "CSV-1"), NOW)
    assert await repo.list_statuses(pedro) == {"303-2026-2T": StoredStatus("presentado", "CSV-1")}
    assert await repo.list_statuses(ana) == {}
    with pytest.raises(asyncpg.CheckViolationError):
        await repo.save_status(pedro, "130-2026-2T", StoredStatus("pagado", None), NOW)


async def test_documents_are_deduplicated_per_owner_and_scoped(pool: asyncpg.Pool) -> None:
    pedro, ana = await _user(pool, "pedro@x.com"), await _user(pool, "ana@x.com")
    repo = PgFiscalRepository(pool)
    doc = StoredDocument("", "036.pdf", "application/pdf", 12, "a" * 64, f"{pedro}/{'a' * 64}", NOW)
    first = await repo.upsert_document(pedro, doc)
    again = await repo.upsert_document(pedro, replace(doc, name="copia.pdf", created_at=NOW + timedelta(days=1)))
    assert first == replace(doc, id=first.id) and again == first
    newer = await repo.upsert_document(
        pedro, replace(doc, name="just.pdf", sha256="b" * 64, created_at=NOW + timedelta(hours=1))
    )
    assert [d.name for d in await repo.list_documents(pedro)] == ["just.pdf", "036.pdf"]
    assert (await repo.upsert_document(ana, doc)).id != first.id

    assert await repo.get_document(pedro, first.id) == first
    assert await repo.get_document(ana, first.id) is None
    assert await repo.get_document(pedro, "no-es-uuid") is None
    await repo.delete_document(ana, first.id)  # no borra lo ajeno
    assert await repo.get_document(pedro, first.id) == first
    await repo.delete_document(pedro, first.id)
    await repo.delete_document(pedro, "no-es-uuid")
    assert [d.id for d in await repo.list_documents(pedro)] == [newer.id]


async def test_invoices_roundtrip_void_and_document_link(pool: asyncpg.Pool) -> None:
    pedro, ana = await _user(pool, "pedro@x.com"), await _user(pool, "ana@x.com")
    repo, docs = PgInvoiceRepository(pool), PgFiscalRepository(pool)
    doc = await docs.upsert_document(
        pedro, StoredDocument("", "f.pdf", "application/pdf", 12, "c" * 64, f"{pedro}/{'c' * 64}", NOW)
    )
    usd = await repo.add_invoice(pedro, replace(usa(11, date(2026, 6, 29)), documento_id=doc.id))
    eur = await repo.add_invoice(pedro, replace(italia(12, date(2026, 7, 2)), documento_id="no-es-uuid"))
    theirs = await repo.add_invoice(ana, replace(inv(1, date(2026, 1, 5)), documento_id=doc.id))  # doc ajeno
    assert usd == replace(usa(11, date(2026, 6, 29)), id=usd.id, documento_id=doc.id)
    assert (
        str(usd.tipo_cambio) == "0.92" and str(eur.tipo_cambio) == "1" and usd.base == usa(11, date(2026, 6, 29)).base
    )
    assert eur.documento_id is None and theirs.documento_id is None

    assert [i.numero for i in await repo.list_invoices(pedro)] == [11, 12]
    assert not await repo.void_invoice(ana, usd.id) and not await repo.void_invoice(pedro, "no-es-uuid")
    assert await repo.void_invoice(pedro, usd.id)
    assert [i.anulada for i in await repo.list_invoices(pedro)] == [True, False]
    # Duplicar un número no falla en la base: el registro refleja lo emitido y el dominio lo señala.
    await repo.add_invoice(pedro, italia(12, date(2026, 7, 3)))
    assert len(await repo.list_invoices(pedro)) == 3
