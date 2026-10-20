"""Réplica de los datos del dashboard a otra base. La parte de Postgres se salta si no hay FUTBOL_TEST_DSN."""

from __future__ import annotations

import argparse
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import asyncpg
import pytest

from fiscal.infrastructure import replicate as rep
from fiscal.infrastructure.replicate import ReplicateError, rekey, replicate
from fiscal.infrastructure.storage import LocalDocumentStore

DSN = os.getenv("FUTBOL_TEST_DSN")
BACKEND = Path(__file__).parents[2]
MIGRATIONS = [
    *sorted((BACKEND / "futbol" / "migrations").glob("*.sql")),
    *sorted((BACKEND / "fiscal" / "migrations").glob("*.sql")),
]
EMAIL = "pedro@x.com"
SRC = "11111111-1111-1111-1111-111111111111"
DST = "22222222-2222-2222-2222-222222222222"
SHA = "a" * 64
needs_pg = pytest.mark.skipif(not DSN, reason="FUTBOL_TEST_DSN no configurado")


# ── sin base ────────────────────────────────────────────────────────────────
def test_rekey_changes_owner_storage_key_and_drops_serial_ids() -> None:
    doc = rekey("documents", {"id": "d", "owner_id": SRC, "storage_key": f"{SRC}/{SHA}"}, SRC, DST)
    assert doc == {"id": "d", "owner_id": DST, "storage_key": f"{DST}/{SHA}"}
    msg = rekey("chat_messages", {"id": 7, "owner_id": SRC, "text": "hola"}, SRC, DST)
    assert msg == {"owner_id": DST, "text": "hola"}
    assert rekey("clients", {"id": "c", "owner_id": SRC}, SRC, DST) == {"id": "c", "owner_id": DST}


def test_rekey_rejects_a_document_key_of_another_owner() -> None:
    with pytest.raises(ReplicateError, match="clave inesperada"):
        rekey("documents", {"id": "d", "owner_id": SRC, "storage_key": f"otro/{SHA}"}, SRC, DST)


def test_target_store(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    built: list[tuple[str, Any]] = []
    clients: list[dict[str, Any]] = []

    def gcs(bucket: str, client: Any = None) -> Any:
        built.append((bucket, client))
        return "gcs"

    def client(**kw: Any) -> Any:
        clients.append(kw)
        return "client"

    monkeypatch.setattr(rep, "GcsDocumentStore", gcs)
    monkeypatch.setattr("google.cloud.storage.Client", client)
    monkeypatch.delenv("GOOGLE_OAUTH_ACCESS_TOKEN", raising=False)
    rep.target_store("b", None)
    monkeypatch.setenv("GOOGLE_OAUTH_ACCESS_TOKEN", "tok")
    rep.target_store("b", None)
    assert built == [("b", None), ("b", "client")]
    assert clients[0]["credentials"].token == "tok"

    assert isinstance(rep.target_store(None, tmp_path), LocalDocumentStore)
    with pytest.raises(ReplicateError, match="--bucket"):
        rep.target_store(None, None)


def test_main(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.delenv("ANALYTICS_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
    assert rep.main(["--target-dsn", "t"]) == 2

    async def ok(args: argparse.Namespace, dsn: str) -> list[str]:
        assert dsn == "src" and args.email == "signal@random-lab.es" and not args.replace
        return ["listo"]

    monkeypatch.setattr(rep, "run", ok)
    assert rep.main(["--target-dsn", "t", "--source-dsn", "src"]) == 0
    assert capsys.readouterr().out == "listo\n"

    async def fail(args: argparse.Namespace, dsn: str) -> list[str]:
        raise ReplicateError("roto")

    monkeypatch.setattr(rep, "run", fail)
    monkeypatch.setenv("DATABASE_URL", "src")
    assert rep.main(["--target-dsn", "t"]) == 1
    assert "Error: roto" in capsys.readouterr().err


# ── Postgres ────────────────────────────────────────────────────────────────
async def _fresh(dsn: str) -> asyncpg.Connection:
    conn = await asyncpg.connect(dsn)
    for m in MIGRATIONS:
        await conn.execute(m.read_text(encoding="utf-8"))
    for schema in ("futbol", "fiscal"):
        await conn.execute(f"CREATE TABLE IF NOT EXISTS {schema}.schema_migrations (version text PRIMARY KEY)")
        await conn.execute(f"TRUNCATE {schema}.schema_migrations")
    tables = ", ".join(f"fiscal.{t}" for t in rep.TABLES)
    await conn.execute(f"TRUNCATE futbol.app_users, {tables} CASCADE")
    return conn


@pytest.fixture
async def dbs() -> AsyncIterator[tuple[asyncpg.Connection, asyncpg.Connection]]:
    assert DSN and "test" in DSN, "el DSN de test debe apuntar a una DB con 'test' en el nombre"
    base, _, name = DSN.rpartition("/")
    target_dsn = f"{base}/{name}_target"
    admin = await asyncpg.connect(DSN)
    if not await admin.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", f"{name}_target"):
        await admin.execute(f'CREATE DATABASE "{name}_target"')
    await admin.close()
    source, target = await _fresh(DSN), await _fresh(target_dsn)
    yield source, target
    await source.close()
    await target.close()


async def _seed(conn: asyncpg.Connection, store: LocalDocumentStore) -> None:
    await conn.execute("INSERT INTO futbol.app_users (id, email, password_hash) VALUES ($1, $2, 'hash')", SRC, EMAIL)
    await conn.execute(
        "INSERT INTO fiscal.tax_profiles (owner_id, version, nif, fecha_alta, iae, regimen_iva, regimen_irpf, "
        "domicilio_fiscal, municipio, comunidad) VALUES ($1, 1, 'X1234567L', '2026-01-01', '763', 'general', "
        "'directa_simplificada', 'C/ Mar 1', 'Barcelona', 'Cataluña')",
        SRC,
    )
    await conn.execute(
        "INSERT INTO fiscal.obligation_status (owner_id, key, estado) VALUES ($1, '303-2026-3T', 'preparado')", SRC
    )
    await store.put(f"{SRC}/{SHA}", b"%PDF-1", "application/pdf")
    doc = await conn.fetchval(
        "INSERT INTO fiscal.documents (owner_id, name, media_type, size_bytes, sha256, storage_key) "
        "VALUES ($1, '036.pdf', 'application/pdf', 6, $2, $3) RETURNING id",
        SRC,
        SHA,
        f"{SRC}/{SHA}",
    )
    await conn.execute(
        "INSERT INTO fiscal.clients (owner_id, codigo, nombre, pais, tipo) VALUES ($1, 1, 'ACME', 'US', 'empresa')",
        SRC,
    )
    await conn.execute(
        "INSERT INTO fiscal.invoices (owner_id, numero, fecha, fecha_devengo, cliente, cliente_pais, concepto, "
        "moneda, importe, tipo_cambio, tipo_iva, retencion_pct, documento_id) VALUES ($1, 1, '2026-10-01', "
        "'2026-10-01', 'ACME', 'US', 'Diseño', 'USD', 1000, 0.9, 0, 0, $2)",
        SRC,
        doc,
    )
    await conn.execute(
        "INSERT INTO fiscal.movements (owner_id, mes, tipo, persona, concepto, categoria, importe, fuente_ref) "
        "VALUES ($1, '2026-10-01', 'gasto', 'Pedro', 'Hosting', 'web', 12.5, 'hoja:1')",
        SRC,
    )
    for kind, text in (("user", "hola"), ("assistant", "¿En qué te ayudo?")):
        await conn.execute(
            "INSERT INTO fiscal.chat_messages (owner_id, kind, text, proposals) VALUES ($1, $2, $3, '[{\"a\": 1}]')",
            SRC,
            kind,
            text,
        )
    await conn.execute("INSERT INTO fiscal.schema_migrations VALUES ('001_fiscal_schema.sql')")


async def _counts(conn: asyncpg.Connection, owner: str) -> dict[str, int]:
    return {t: await rep._count(conn, t, owner) for t in rep.TABLES}


@needs_pg
async def test_replicates_into_a_new_user_and_uploads_documents(
    dbs: tuple[asyncpg.Connection, asyncpg.Connection], tmp_path: Path
) -> None:
    source, target = dbs
    local, remote = LocalDocumentStore(tmp_path / "local"), LocalDocumentStore(tmp_path / "remote")
    await _seed(source, local)

    with pytest.raises(ReplicateError, match="faltan migraciones de fiscal en destino: 001_fiscal_schema.sql"):
        await replicate(source, target, EMAIL, (local, remote))
    await target.execute("INSERT INTO fiscal.schema_migrations VALUES ('001_fiscal_schema.sql')")
    with pytest.raises(ReplicateError, match="no existe en la base local"):
        await replicate(source, target, "nadie@x.com", (local, remote))

    dry = await replicate(source, target, EMAIL, (local, remote), dry_run=True)
    assert dry[0].startswith("SIMULACIÓN") and "se crea en destino" in dry[1]
    assert await target.fetchval("SELECT count(*) FROM futbol.app_users") == 0

    report = await replicate(source, target, EMAIL, (local, remote))
    assert report[0] == "Replicación completa" and report[-1] == "  archivos subidos: 1"
    user = await target.fetchrow("SELECT id, password_hash FROM futbol.app_users WHERE email = $1", EMAIL)
    owner = str(user["id"])
    assert owner != SRC and user["password_hash"] == "hash"
    assert await _counts(target, owner) == await _counts(source, SRC)
    assert await remote.get(f"{owner}/{SHA}") == b"%PDF-1"
    key, inv_doc = await target.fetchrow(
        "SELECT d.storage_key, i.documento_id = d.id FROM fiscal.documents d JOIN fiscal.invoices i ON true"
    )
    assert key == f"{owner}/{SHA}" and inv_doc is True
    texts = await target.fetch("SELECT text, proposals FROM fiscal.chat_messages ORDER BY id")
    assert [r["text"] for r in texts] == ["hola", "¿En qué te ayudo?"] and texts[0]["proposals"] == '[{"a": 1}]'


@needs_pg
async def test_existing_data_needs_replace_and_replace_is_idempotent(
    dbs: tuple[asyncpg.Connection, asyncpg.Connection], tmp_path: Path
) -> None:
    source, target = dbs
    local, remote = LocalDocumentStore(tmp_path / "local"), LocalDocumentStore(tmp_path / "remote")
    await _seed(source, local)
    await target.execute("INSERT INTO fiscal.schema_migrations VALUES ('001_fiscal_schema.sql')")
    await target.execute("INSERT INTO futbol.app_users (id, email, password_hash) VALUES ($1, $2, 'prod')", DST, EMAIL)
    await target.execute(
        "INSERT INTO fiscal.chat_messages (owner_id, kind, text) VALUES ($1, 'user', 'creado en prod')", DST
    )

    with pytest.raises(ReplicateError, match="usá --replace") as exc:
        await replicate(source, target, EMAIL, (local, remote))
    assert "existe en destino" in str(exc.value)

    for _ in range(2):
        await replicate(source, target, EMAIL, (local, remote), replace=True)
        assert await _counts(target, DST) == await _counts(source, SRC)
    assert await target.fetchval("SELECT password_hash FROM futbol.app_users WHERE id = $1", DST) == "prod"
    assert not await target.fetchval("SELECT count(*) FROM fiscal.chat_messages WHERE text = 'creado en prod'")


@needs_pg
async def test_run_connects_with_dsns(dbs: tuple[asyncpg.Connection, asyncpg.Connection], tmp_path: Path) -> None:
    source, target = dbs
    local = LocalDocumentStore(tmp_path / "local")
    await _seed(source, local)
    await target.execute("INSERT INTO fiscal.schema_migrations VALUES ('001_fiscal_schema.sql')")
    assert DSN
    base, _, name = DSN.rpartition("/")
    args = rep.parse_args(
        ["--target-dsn", f"{base}/{name}_target", "--email", EMAIL, "--docs-dir", str(tmp_path / "local"),
         "--target-docs-dir", str(tmp_path / "remote"), "--dry-run"]
    )  # fmt: skip
    assert (await rep.run(args, DSN))[0].startswith("SIMULACIÓN")
