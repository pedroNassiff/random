"""Aplica las migraciones de `<schema>/migrations/*.sql` que falten, en orden, una transacción por archivo.

    cd teoria-sintergica/brain-prototype/backend
    venv/bin/python -m futbol.infrastructure.migrate --dry-run     # muestra cuáles faltan
    venv/bin/python -m futbol.infrastructure.migrate               # las aplica
    venv/bin/python -m futbol.infrastructure.migrate --baseline    # marca todas como aplicadas sin correrlas
                                                                   # (bases migradas a mano antes del runner)
    venv/bin/python -m futbol.infrastructure.migrate --schema fiscal   # otro schema (default: futbol)

Registra lo aplicado en `<schema>.schema_migrations`, así una migración no se repite (p. ej. la 006 pisa el
calendario del grupo). DSN: `--dsn`, o ANALYTICS_DATABASE_URL / DATABASE_URL del entorno o del .env.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import asyncpg

BACKEND_DIR = Path(__file__).resolve().parents[2]
# Schemas con migraciones propias. `fiscal` referencia futbol.app_users: migrar futbol primero.
SCHEMAS = ("futbol", "fiscal")
MIGRATIONS_DIR = BACKEND_DIR / "futbol" / "migrations"

_BOOTSTRAP = """
CREATE SCHEMA IF NOT EXISTS {schema};
CREATE TABLE IF NOT EXISTS {schema}.schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
"""


def _checked(schema: str) -> str:
    """El nombre del schema se interpola en SQL: solo se aceptan los de la lista."""
    if schema not in SCHEMAS:
        raise ValueError(f"schema desconocido: {schema}")
    return schema


def migration_files(directory: Path = MIGRATIONS_DIR) -> list[Path]:
    return sorted(directory.glob("*.sql"))


async def pending(conn: asyncpg.Connection, files: list[Path], schema: str = "futbol") -> list[Path]:
    schema = _checked(schema)
    await conn.execute(_BOOTSTRAP.format(schema=schema))
    done = {r["version"] for r in await conn.fetch(f"SELECT version FROM {schema}.schema_migrations")}  # nosec B608
    return [f for f in files if f.name not in done]


async def migrate(
    dsn: str,
    *,
    dry_run: bool = False,
    baseline: bool = False,
    files: list[Path] | None = None,
    schema: str = "futbol",
) -> list[str]:
    """Devuelve los nombres de las migraciones aplicadas (o que se aplicarían, con dry_run)."""
    conn = await asyncpg.connect(dsn)
    try:
        schema = _checked(schema)
        default_files = migration_files(BACKEND_DIR / schema / "migrations")
        todo = await pending(conn, files if files is not None else default_files, schema)
        if dry_run:
            return [f.name for f in todo]
        for f in todo:
            async with conn.transaction():
                if not baseline:
                    await conn.execute(f.read_text(encoding="utf-8"))
                await conn.execute(
                    f"INSERT INTO {schema}.schema_migrations (version) VALUES ($1)",  # nosec B608
                    f.name,
                )
        return [f.name for f in todo]
    finally:
        await conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Migraciones por schema (futbol, fiscal).")
    parser.add_argument("--dsn")
    parser.add_argument("--schema", choices=SCHEMAS, default="futbol")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--baseline", action="store_true")
    args = parser.parse_args(argv)
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:  # pragma: no cover - python-dotenv está en requirements
        pass
    dsn = args.dsn or os.getenv("ANALYTICS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not dsn:
        print("Falta --dsn o DATABASE_URL (o ANALYTICS_DATABASE_URL).", file=sys.stderr)
        return 2
    try:
        names = asyncio.run(migrate(dsn, dry_run=args.dry_run, baseline=args.baseline, schema=args.schema))
    except (asyncpg.PostgresError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    verb = "Pendientes" if args.dry_run else ("Marcadas como aplicadas" if args.baseline else "Aplicadas")
    print(f"{verb}: {len(names)}" + "".join(f"\n  {n}" for n in names))
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
