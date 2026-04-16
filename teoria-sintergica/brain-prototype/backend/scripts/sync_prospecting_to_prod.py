#!/usr/bin/env python3
"""
sync_prospecting_to_prod.py
----------------------------
Sincroniza la base de datos de prospecting (SQLite) de LOCAL a PRODUCCIÓN.

Estrategia: INSERT OR REPLACE — actualiza filas existentes, inserta nuevas.
Los registros que sólo existen en prod no se tocan.

Tablas sincronizadas (en orden por dependencias FK):
  1. contacts
  2. pitch_logs
  3. prospect_groups
  4. prospect_group_items

Uso:
  python scripts/sync_prospecting_to_prod.py           # sync todo
  python scripts/sync_prospecting_to_prod.py --dry-run # sólo muestra el SQL generado
  python scripts/sync_prospecting_to_prod.py --tables contacts pitch_logs
"""

import os
import sys
import argparse
import sqlite3
import subprocess
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from database.prospecting_db import _SCHEMA

# ── Paths ──────────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.parent
LOCAL_DB    = BACKEND_DIR / "database" / "prospecting.db"

# Prod SSH config — reutiliza las mismas vars que sync_to_prod.py
PROD_SSH_HOST      = os.getenv("PROD_SSH_HOST",      "api.random-lab.es")
PROD_SSH_USER      = os.getenv("PROD_SSH_USER",      "root")
PROD_REMOTE_DB     = os.getenv("PROD_PROSPECTING_DB",
    "/home/brain/random/teoria-sintergica/brain-prototype/backend/database/prospecting.db")

# ── Colores ────────────────────────────────────────────────────────────────────
G  = "\033[0;32m"
Y  = "\033[1;33m"
R  = "\033[0;31m"
NC = "\033[0m"

def ok(msg):  print(f"{G}✓  {msg}{NC}")
def info(msg): print(f"{Y}→  {msg}{NC}")
def err(msg):  print(f"{R}✗  {msg}{NC}")


# ── SQL dump helpers ───────────────────────────────────────────────────────────

def _escape(val) -> str:
    """Escape a Python value for SQLite SQL literal."""
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    # Strings: escape single quotes
    return "'" + str(val).replace("'", "''") + "'"


def dump_contacts(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute("""
        SELECT id, company, tier, location, focus, linkedin_url, website,
               decision_maker, why, stage, follow_up_count, notes,
               last_action, next_action, responded, ai_analysis,
               scraped_content, scrape_ts, created_at
        FROM contacts
        ORDER BY id
    """)
    rows = cur.fetchall()
    stmts = []
    for r in rows:
        vals = ", ".join(_escape(v) for v in r)
        stmts.append(
            "INSERT OR REPLACE INTO contacts "
            "(id, company, tier, location, focus, linkedin_url, website, "
            "decision_maker, why, stage, follow_up_count, notes, "
            "last_action, next_action, responded, ai_analysis, "
            "scraped_content, scrape_ts, created_at) "
            f"VALUES ({vals});"
        )
    return rows, stmts


def dump_pitch_logs(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute("""
        SELECT tracking_id, contact_id, company, to_email, subject,
               pitch_type, sent_at, opens, clicks
        FROM pitch_logs
        ORDER BY sent_at
    """)
    rows = cur.fetchall()
    stmts = []
    for r in rows:
        vals = ", ".join(_escape(v) for v in r)
        stmts.append(
            "INSERT OR REPLACE INTO pitch_logs "
            "(tracking_id, contact_id, company, to_email, subject, "
            "pitch_type, sent_at, opens, clicks) "
            f"VALUES ({vals});"
        )
    return rows, stmts


def dump_prospect_groups(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute("""
        SELECT id, name, config, status, total_generated, total_accepted,
               model_used, created_at, updated_at
        FROM prospect_groups
        ORDER BY id
    """)
    rows = cur.fetchall()
    stmts = []
    for r in rows:
        vals = ", ".join(_escape(v) for v in r)
        stmts.append(
            "INSERT OR REPLACE INTO prospect_groups "
            "(id, name, config, status, total_generated, total_accepted, "
            "model_used, created_at, updated_at) "
            f"VALUES ({vals});"
        )
    return rows, stmts


def dump_group_items(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute("""
        SELECT id, group_id, contact_id, company, location, tier,
               decision_maker, linkedin_url, website, ai_score, fit_category,
               why, entry_vector, tags, status, created_at
        FROM prospect_group_items
        ORDER BY id
    """)
    rows = cur.fetchall()
    stmts = []
    for r in rows:
        vals = ", ".join(_escape(v) for v in r)
        stmts.append(
            "INSERT OR REPLACE INTO prospect_group_items "
            "(id, group_id, contact_id, company, location, tier, "
            "decision_maker, linkedin_url, website, ai_score, fit_category, "
            "why, entry_vector, tags, status, created_at) "
            f"VALUES ({vals});"
        )
    return rows, stmts


# ── Main ───────────────────────────────────────────────────────────────────────

DUMPERS = {
    "contacts":             dump_contacts,
    "pitch_logs":           dump_pitch_logs,
    "prospect_groups":      dump_prospect_groups,
    "prospect_group_items": dump_group_items,
}

ALL_TABLES = list(DUMPERS.keys())


def build_sql(tables: list[str]) -> tuple[str, dict]:
    if not LOCAL_DB.exists():
        err(f"Base de datos local no encontrada: {LOCAL_DB}")
        sys.exit(1)

    conn = sqlite3.connect(LOCAL_DB)
    counts = {}
    # Prepend schema so tables are created if they don't exist on prod
    lines = [_SCHEMA, "PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;", ""]

    for table in tables:
        rows, stmts = DUMPERS[table](conn)
        counts[table] = len(rows)
        if stmts:
            lines.append(f"-- {table} ({len(rows)} rows)")
            lines.extend(stmts)
            lines.append("")

    lines.append("COMMIT;")
    lines.append("PRAGMA foreign_keys=ON;")
    conn.close()
    return "\n".join(lines), counts


def apply_to_prod(sql: str) -> bool:
    """
    Sube el SQL a prod vía SCP + SSH y lo aplica con sqlite3.
    """
    remote = f"{PROD_SSH_USER}@{PROD_SSH_HOST}"

    # Escribir SQL a fichero temporal local
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql",
                                    prefix="prospecting_sync_",
                                    delete=False, encoding="utf-8") as f:
        f.write(sql)
        tmp_path = f.name

    remote_tmp = "/tmp/prospecting_sync.sql"

    try:
        # 1. SCP al servidor
        info(f"Subiendo SQL a {remote}:{remote_tmp} …")
        result = subprocess.run(
            ["scp", "-q", tmp_path, f"{remote}:{remote_tmp}"],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            err(f"SCP falló: {result.stderr.strip()}")
            return False
        ok("SQL subido")

        # 2. Aplicar vía SSH usando python3 (sqlite3 CLI puede no estar instalado)
        info(f"Aplicando en {PROD_REMOTE_DB} …")
        py_script = (
            f"import sqlite3, pathlib; "
            f"pathlib.Path('{PROD_REMOTE_DB}').parent.mkdir(parents=True, exist_ok=True); "
            f"conn = sqlite3.connect('{PROD_REMOTE_DB}'); "
            f"conn.executescript(open('{remote_tmp}').read()); "
            f"conn.close(); "
            f"print('ok')"
        )
        ssh_cmd = f"python3 -c \"{py_script}\" && rm -f '{remote_tmp}'"
        result = subprocess.run(
            ["ssh", "-q", remote, ssh_cmd],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            err(f"SSH/python3 falló: {result.stderr.strip()}")
            return False
        ok("SQL aplicado en prod")
        return True

    finally:
        Path(tmp_path).unlink(missing_ok=True)


def verify_prod(tables: list[str]):
    """Muestra los counts de las tablas en prod para verificar."""
    remote = f"{PROD_SSH_USER}@{PROD_SSH_HOST}"
    queries = "; ".join(
        f"SELECT '{t}', COUNT(*) FROM {t}"
        for t in tables
    )
    py_verify = (
        f"import sqlite3; conn = sqlite3.connect('{PROD_REMOTE_DB}'); "
        f"[print(r[0], r[1]) for q in ['{queries}'.split('; ')] for r in [conn.execute(x).fetchone() for x in q]]; "
        f"conn.close()"
    )
    # simpler: run each SELECT individually
    py_verify = (
        f"import sqlite3; conn=sqlite3.connect('{PROD_REMOTE_DB}'); "
        + "".join(
            f"print('{t}', conn.execute('SELECT COUNT(*) FROM {t}').fetchone()[0]); "
            for t in tables
        )
        + "conn.close()"
    )
    ssh_cmd = f"python3 -c \"{py_verify}\""
    result = subprocess.run(
        ["ssh", "-q", remote, ssh_cmd],
        capture_output=True, text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        print("\n  Prod counts:")
        for line in result.stdout.strip().splitlines():
            print(f"    {line}")
    else:
        info("No se pudo verificar counts en prod (continuar igual)")


def main():
    parser = argparse.ArgumentParser(
        description="Sincroniza prospecting SQLite de local a prod"
    )
    parser.add_argument(
        "--tables", nargs="+",
        choices=ALL_TABLES,
        default=ALL_TABLES,
        metavar="TABLE",
        help=f"Tablas a sincronizar (por defecto: todas). Opciones: {', '.join(ALL_TABLES)}"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Sólo genera y muestra el SQL, no lo envía a prod"
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  PROSPECTING CRM — SYNC LOCAL → PROD")
    print("=" * 60)
    print(f"  DB local:  {LOCAL_DB}")
    print(f"  DB prod:   {remote_db_display()}")
    print(f"  Tablas:    {', '.join(args.tables)}")
    print("=" * 60 + "\n")

    # Generar SQL
    info("Leyendo datos locales …")
    sql, counts = build_sql(args.tables)

    total = sum(counts.values())
    for table, n in counts.items():
        print(f"    {table:<30} {n:>4} rows")
    print()

    if total == 0:
        info("No hay datos que sincronizar.")
        return

    if args.dry_run:
        print("\n── DRY RUN — SQL generado ──────────────────────────────\n")
        print(sql)
        return

    # Aplicar en prod
    success = apply_to_prod(sql)
    if not success:
        err("Sync fallido.")
        sys.exit(1)

    # Verificar
    print()
    verify_prod(args.tables)

    print(f"\n{G}✅  Sync completado — {total} rows → prod{NC}\n")


def remote_db_display():
    return f"{PROD_SSH_USER}@{PROD_SSH_HOST}:{PROD_REMOTE_DB}"


if __name__ == "__main__":
    main()
