"""CLI: replica en otra base (producción) los datos del dashboard de un usuario de la base local.

    cd teoria-sintergica/brain-prototype/backend
    venv/bin/python -m fiscal.infrastructure.replicate --target-dsn "…" --bucket random-507414-fiscal-docs --dry-run
    venv/bin/python -m fiscal.infrastructure.replicate --target-dsn "…" --bucket random-507414-fiscal-docs --replace

Copia perfil fiscal, estados de obligaciones, documentos (filas y archivos), clientes, facturas, movimientos
e historial del chat. El usuario se busca por email en las dos bases: en destino se crea si no existe (con el
mismo hash de contraseña). Los festivos los siembran las migraciones. Usá scripts/push_local_to_prod.sh, que
abre el proxy a Cloud SQL y arma el DSN de producción.

Sin --replace no pisa nada: si el usuario ya tiene datos en destino, aborta y muestra las cantidades. Con
--replace borra los datos de ese usuario en destino y copia los locales, todo en una transacción. Los archivos
se suben antes de la transacción (son idempotentes: la clave es dueño + sha256).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import asyncpg

from fiscal.infrastructure.storage import GcsDocumentStore, LocalDocumentStore

# Orden de inserción: `invoices.documento_id` referencia a `documents`. Se borra en orden inverso.
TABLES = (
    "tax_profiles",
    "obligation_status",
    "documents",
    "clients",
    "invoices",
    "movements",
    "chat_messages",
)
# Columnas que no se copian: la genera la secuencia del destino.
_SKIP = {"chat_messages": ("id",)}
_ORDER = {"chat_messages": "id", "tax_profiles": "version", "obligation_status": "key"}


class ReplicateError(Exception):
    pass


class Store(Protocol):
    async def put(self, key: str, data: bytes, media_type: str) -> None: ...

    async def get(self, key: str) -> bytes: ...


@dataclass
class Plan:
    email: str
    source_owner: str
    target_owner: str | None
    rows: dict[str, list[dict[str, Any]]]
    target_counts: dict[str, int]
    user: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> list[str]:
        lines = [f"usuario {self.email}: " + ("existe en destino" if self.target_owner else "se crea en destino")]
        width = max(len(t) for t in TABLES)
        lines.append(f"  {'tabla':<{width}}  local  destino")
        lines.extend(f"  {t:<{width}}  {len(self.rows[t]):>5}  {self.target_counts.get(t, 0):>7}" for t in TABLES)
        return lines


def rekey(table: str, row: dict[str, Any], source_owner: str, target_owner: str) -> dict[str, Any]:
    """Fila lista para el destino: otro dueño, y en documentos la clave del archivo con ese dueño."""
    out = {k: v for k, v in row.items() if k not in _SKIP.get(table, ())}
    out["owner_id"] = target_owner
    if table == "documents":
        key = str(row["storage_key"])
        prefix = f"{source_owner}/"
        if not key.startswith(prefix):
            raise ReplicateError(f"documento {row['id']}: clave inesperada {key}")
        out["storage_key"] = f"{target_owner}/{key[len(prefix) :]}"
    return out


async def _migrations(conn: asyncpg.Connection, schema: str) -> set[str]:
    exists = await conn.fetchval("SELECT to_regclass($1)", f"{schema}.schema_migrations")
    if exists is None:
        return set()
    return {r["version"] for r in await conn.fetch(f"SELECT version FROM {schema}.schema_migrations")}  # nosec B608


async def check_migrations(source: asyncpg.Connection, target: asyncpg.Connection) -> None:
    for schema in ("futbol", "fiscal"):
        missing = await _migrations(source, schema) - await _migrations(target, schema)
        if missing:
            raise ReplicateError(
                f"faltan migraciones de {schema} en destino: {', '.join(sorted(missing))}. "
                f"Corré: python -m futbol.infrastructure.migrate --schema {schema} --dsn …"
            )


async def _owner(conn: asyncpg.Connection, email: str) -> asyncpg.Record | None:
    row: asyncpg.Record | None = await conn.fetchrow(
        "SELECT id, password_hash, password_updated_at FROM futbol.app_users WHERE email = $1", email
    )
    return row


async def _read(conn: asyncpg.Connection, table: str, owner: str) -> list[dict[str, Any]]:
    order = _ORDER.get(table, "created_at")
    rows = await conn.fetch(
        f"SELECT * FROM fiscal.{table} WHERE owner_id = $1 ORDER BY {order}",  # nosec B608 - tabla de TABLES
        owner,
    )
    return [dict(r) for r in rows]


async def _count(conn: asyncpg.Connection, table: str, owner: str) -> int:
    n: int = await conn.fetchval(f"SELECT count(*) FROM fiscal.{table} WHERE owner_id = $1", owner)  # nosec B608
    return n


async def build_plan(source: asyncpg.Connection, target: asyncpg.Connection, email: str) -> Plan:
    await check_migrations(source, target)
    src = await _owner(source, email)
    if src is None:
        raise ReplicateError(f"{email} no existe en la base local")
    dst = await _owner(target, email)
    source_owner = str(src["id"])
    target_owner = str(dst["id"]) if dst else None
    rows = {t: await _read(source, t, source_owner) for t in TABLES}
    counts = {t: await _count(target, t, target_owner) for t in TABLES} if target_owner else {}
    user = {"password_hash": src["password_hash"], "password_updated_at": src["password_updated_at"]}
    return Plan(email, source_owner, target_owner, rows, counts, user)


async def upload_documents(plan: Plan, target_owner: str, source: Store, target: Store) -> int:
    for doc in plan.rows["documents"]:
        data = await source.get(str(doc["storage_key"]))
        new_key = rekey("documents", doc, plan.source_owner, target_owner)["storage_key"]
        await target.put(new_key, data, str(doc["media_type"]))
    return len(plan.rows["documents"])


async def _ensure_user(target: asyncpg.Connection, plan: Plan) -> str:
    if plan.target_owner:
        return plan.target_owner
    created = await target.fetchval(
        "INSERT INTO futbol.app_users (email, password_hash, password_updated_at) VALUES ($1, $2, $3) RETURNING id",
        plan.email,
        plan.user["password_hash"],
        plan.user["password_updated_at"],
    )
    return str(created)


async def write(target: asyncpg.Connection, plan: Plan, target_owner: str, *, replace: bool) -> None:
    async with target.transaction():
        if replace:
            for table in reversed(TABLES):
                await target.execute(f"DELETE FROM fiscal.{table} WHERE owner_id = $1", target_owner)  # nosec B608
        for table in TABLES:
            records = [rekey(table, r, plan.source_owner, target_owner) for r in plan.rows[table]]
            if records:
                columns = list(records[0])
                await target.copy_records_to_table(
                    table,
                    schema_name="fiscal",
                    columns=columns,
                    records=[tuple(r[c] for c in columns) for r in records],
                )


async def replicate(
    source: asyncpg.Connection,
    target: asyncpg.Connection,
    email: str,
    stores: tuple[Store, Store],
    *,
    dry_run: bool = False,
    replace: bool = False,
) -> list[str]:
    """Devuelve las líneas del informe. Con dry_run no escribe nada en destino."""
    plan = await build_plan(source, target, email)
    lines = plan.summary()
    if any(plan.target_counts.values()) and not replace:
        raise ReplicateError("\n".join([*lines, "el usuario ya tiene datos en destino: usá --replace para pisarlos"]))
    if dry_run:
        return ["SIMULACIÓN (no se escribió nada)", *lines]
    target_owner = await _ensure_user(target, plan)
    uploaded = await upload_documents(plan, target_owner, *stores)
    await write(target, plan, target_owner, replace=replace)
    return ["Replicación completa", *lines, f"  archivos subidos: {uploaded}"]


def target_store(bucket: str | None, docs_dir: Path | None) -> Store:
    if bucket:
        token = os.getenv("GOOGLE_OAUTH_ACCESS_TOKEN")
        if not token:
            return GcsDocumentStore(bucket)
        from google.cloud import storage  # type: ignore[import-untyped,unused-ignore]
        from google.oauth2.credentials import Credentials

        return GcsDocumentStore(
            bucket,
            storage.Client(project=os.getenv("GCP_PROJECT"), credentials=Credentials(token)),  # type: ignore[no-untyped-call]
        )
    if docs_dir:
        return LocalDocumentStore(docs_dir)
    raise ReplicateError("indicá --bucket (producción) o --target-docs-dir")


async def run(args: argparse.Namespace, source_dsn: str) -> list[str]:
    stores = (LocalDocumentStore(args.docs_dir), target_store(args.bucket, args.target_docs_dir))
    source = await asyncpg.connect(source_dsn)
    try:
        target = await asyncpg.connect(args.target_dsn)
        try:
            return await replicate(source, target, args.email, stores, dry_run=args.dry_run, replace=args.replace)
        finally:
            await target.close()
    finally:
        await source.close()


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replica los datos del dashboard de un usuario local en otra base.")
    parser.add_argument("--target-dsn", required=True, help="base destino (producción vía cloud-sql-proxy)")
    parser.add_argument("--source-dsn", help="base local (default: ANALYTICS_DATABASE_URL / DATABASE_URL del .env)")
    parser.add_argument("--email", default="signal@random-lab.es")
    parser.add_argument("--docs-dir", type=Path, default=Path(os.getenv("FISCAL_DOCS_DIR", "data/fiscal_docs")))
    parser.add_argument("--bucket", help="bucket GCS de documentos en destino")
    parser.add_argument("--target-docs-dir", type=Path, help="carpeta de documentos en destino (en vez de bucket)")
    parser.add_argument("--dry-run", action="store_true", help="muestra qué copiaría, sin escribir")
    parser.add_argument("--replace", action="store_true", help="borra los datos del usuario en destino antes")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:  # pragma: no cover - python-dotenv está en requirements
        pass
    source_dsn = args.source_dsn or os.getenv("ANALYTICS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not source_dsn:
        print("Falta --source-dsn (o DATABASE_URL en el .env)", file=sys.stderr)
        return 2
    try:
        print("\n".join(asyncio.run(run(args, source_dsn))))
    except ReplicateError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
