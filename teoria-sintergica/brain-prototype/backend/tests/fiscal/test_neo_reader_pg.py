"""Lectura directa de NEO contra PostgreSQL real: solo SELECT, solo filas del dueño. Se salta sin FUTBOL_TEST_DSN.

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Producción.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import date
from urllib.parse import urlsplit

import asyncpg
import pytest

from fiscal.application.errors import Invalid
from fiscal.infrastructure.pg_invoices import PgInvoiceRepository
from fiscal.infrastructure.pg_neo import PgNeoReader
from futbol.infrastructure.migrate import set_neo_password
from tests.fiscal.helpers import PILOTO
from tests.fiscal.test_fiscal_pg import DSN, _user, pool  # noqa: F401 - pool es fixture
from tests.fiscal.test_invoices import italia, usa

pytestmark = pytest.mark.skipif(not DSN, reason="FUTBOL_TEST_DSN no configurado")


def _neo_dsn() -> str:
    url = urlsplit(DSN or "")
    return url._replace(netloc=f"neo_reader:neo_test@{url.hostname}:{url.port or 5432}").geturl()


@pytest.fixture
async def neo(pool: asyncpg.Pool) -> AsyncIterator[asyncpg.Pool]:  # noqa: F811
    async with pool.acquire() as conn:
        assert await set_neo_password(conn, _neo_dsn())
        assert not await set_neo_password(conn, None)
    p = await asyncpg.create_pool(_neo_dsn(), min_size=1, max_size=1)
    yield p
    await p.close()


async def _two_owners(db: asyncpg.Pool) -> tuple[str, str]:
    pedro, otro = await _user(db, "pedro@test.dev"), await _user(db, "otro@test.dev")
    invoices = PgInvoiceRepository(db)
    await invoices.add_invoice(pedro, italia(9, date(2026, 6, 1)))
    await invoices.add_invoice(otro, usa(8, date(2026, 5, 1)))
    return pedro, otro


async def test_reads_only_the_owner_rows(pool: asyncpg.Pool, neo: asyncpg.Pool) -> None:  # noqa: F811
    pedro, otro = await _two_owners(pool)
    reader = PgNeoReader(pool, neo)

    mine = await reader.query(pedro, "SELECT numero, cliente FROM fiscal.invoices")
    assert (mine.columnas, mine.filas, mine.truncado) == (("numero", "cliente"), ((9, "Cliente Italia SRL"),), False)
    theirs = await reader.query(otro, "SELECT numero FROM fiscal.invoices WHERE owner_id <> fiscal.neo_owner()")
    assert theirs.filas == ()


async def test_cannot_change_the_owner_from_the_query(pool: asyncpg.Pool, neo: asyncpg.Pool) -> None:  # noqa: F811
    pedro, otro = await _two_owners(pool)
    reader = PgNeoReader(pool, neo)
    hijack = f"SELECT set_config('neo.owner_id', '{otro}', true), numero FROM fiscal.invoices"
    assert [r[1] for r in (await reader.query(pedro, hijack)).filas] == [9]
    # Volver al usuario de la sesión no escala: la sesión ya es neo_reader.
    back = await reader.query(pedro, "SELECT set_config('role', session_user, true), current_user")
    assert back.filas == (("neo_reader", "neo_reader"),)
    escape = (
        "SELECT set_config('role', session_user, true), query_to_xml('SELECT * FROM futbol.app_users', true, false, '')"
    )
    app_user = await pool.fetchval("SELECT current_user")
    for sql in ("SELECT * FROM fiscal.neo_sessions", f"SELECT set_config('role', '{app_user}', true)", escape):
        with pytest.raises(Invalid, match="permission denied"):
            await reader.query(pedro, sql)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO fiscal.clients (owner_id) VALUES (gen_random_uuid()) RETURNING *",
        "UPDATE fiscal.invoices SET numero = 1 RETURNING *",
        "DELETE FROM fiscal.invoices RETURNING *",
        "SELECT 1; DELETE FROM fiscal.invoices",
        "DROP TABLE fiscal.invoices",
        "WITH x AS (DELETE FROM fiscal.invoices RETURNING *) SELECT * FROM x",
    ],
)
async def test_rejects_anything_but_a_select(pool: asyncpg.Pool, neo: asyncpg.Pool, sql: str) -> None:  # noqa: F811
    pedro, _ = await _two_owners(pool)
    with pytest.raises(Invalid):
        await PgNeoReader(pool, neo).query(pedro, sql)
    assert await pool.fetchval("SELECT count(*) FROM fiscal.invoices") == 2


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT nif FROM fiscal.tax_profiles",
        "SELECT * FROM futbol.auth_sessions",
        "SELECT * FROM futbol.magic_links",
        "SELECT * FROM futbol.app_users",
    ],
)
async def test_secrets_are_not_readable(pool: asyncpg.Pool, neo: asyncpg.Pool, sql: str) -> None:  # noqa: F811
    pedro, _ = await _two_owners(pool)
    with pytest.raises(Invalid, match="permission denied"):
        await PgNeoReader(pool, neo).query(pedro, sql)


async def test_profile_without_nif_and_shared_holidays(pool: asyncpg.Pool, neo: asyncpg.Pool) -> None:  # noqa: F811
    from fiscal.infrastructure.pg import PgFiscalRepository

    pedro, _ = await _two_owners(pool)
    await PgFiscalRepository(pool).add_profile_version(pedro, PILOTO)
    reader = PgNeoReader(pool, neo)
    profile = await reader.query(pedro, "SELECT iae, comunidad FROM fiscal.tax_profiles")
    assert profile.filas == ((PILOTO.iae, PILOTO.comunidad),)
    await reader.query(pedro, "SELECT count(*) FROM fiscal.holidays")


async def test_limits_rows_and_time(pool: asyncpg.Pool, neo: asyncpg.Pool) -> None:  # noqa: F811
    pedro, _ = await _two_owners(pool)
    reader = PgNeoReader(pool, neo, max_rows=3, timeout_ms=200)
    many = await reader.query(pedro, "SELECT g FROM generate_series(1, 10) AS g;")
    assert (len(many.filas), many.truncado) == (3, True)
    with pytest.raises(Invalid, match="timeout|cancel"):
        await reader.query(pedro, "SELECT pg_sleep(2)")
    # No queda dueño asignado a la conexión de NEO entre consultas.
    assert await pool.fetchval("SELECT count(*) FROM fiscal.neo_sessions") == 0
    assert (await reader.query(pedro, "SELECT fiscal.neo_owner()")).filas[0][0] is not None
    assert await neo.fetchval("SELECT fiscal.neo_owner()") is None


async def test_neo_connection_cannot_write_even_outside_the_reader(neo: asyncpg.Pool) -> None:
    with pytest.raises(asyncpg.PostgresError):
        await neo.execute("INSERT INTO fiscal.neo_sessions (pid, owner_id) VALUES (1, gen_random_uuid())")
    assert await neo.fetchval("SHOW default_transaction_read_only") == "on"
