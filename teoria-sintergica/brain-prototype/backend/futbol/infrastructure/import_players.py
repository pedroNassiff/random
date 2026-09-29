"""CLI: importa el plantel desde JSON.

    cd teoria-sintergica/brain-prototype/backend
    venv/bin/python -m futbol.infrastructure.import_players ../../../docs/la-vaca-futbol/players.json --dry-run
    venv/bin/python -m futbol.infrastructure.import_players ../../../docs/la-vaca-futbol/players.json

Usa la misma BBDD que el backend (ANALYTICS_DATABASE_URL o DATABASE_URL del .env).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg

from futbol.application.errors import FutbolError
from futbol.application.roster_import import ImportReport, RosterImporter
from futbol.infrastructure.pg_repository import PgFutbolRepository


def format_report(report: ImportReport, dry_run: bool) -> str:
    lines = ["SIMULACIÓN (no se guardó nada)" if dry_run else "Importación completa"]
    lines.append(f"  creados:      {len(report.created)} {', '.join(report.created)}".rstrip())
    lines.append(f"  actualizados: {len(report.updated)} {', '.join(report.updated)}".rstrip())
    lines.append(f"  puntajes:     {report.ratings}")
    lines.extend(f"  aviso: {w}" for w in report.warnings)
    return "\n".join(lines)


async def run(path: Path, dsn: str, dry_run: bool) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2)
    try:
        repo = PgFutbolRepository(pool)
        report = await RosterImporter(repo).run(await repo.default_group_id(), data, dry_run=dry_run)
        return format_report(report, dry_run)
    finally:
        await pool.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Importa jugadores y puntajes iniciales de Fútbol Vaquero.")
    parser.add_argument("path", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="valida y muestra qué haría, sin guardar")
    args = parser.parse_args(argv)
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:  # pragma: no cover - python-dotenv está en requirements
        pass
    dsn = os.getenv("ANALYTICS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not dsn:
        print("Falta DATABASE_URL (o ANALYTICS_DATABASE_URL) en el entorno / .env", file=sys.stderr)
        return 2
    try:
        print(asyncio.run(run(args.path, dsn, args.dry_run)))
    except (FutbolError, json.JSONDecodeError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
