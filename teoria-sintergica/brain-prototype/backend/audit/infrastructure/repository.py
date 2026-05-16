"""
audit/infrastructure/repository.py

SQLite persistence for audit entities.
Extends the existing prospecting.db — same file, new tables.
Auto-migrates on import (idempotent).
"""
import sqlite3
import json
import threading
from pathlib import Path
from typing import Optional

from ..domain.entities import AuditRun, ProbeResult, Finding, AuditReport
from ..domain.enums import AuditStatus, ProbeStatus, SKU

# Same DB file as the prospecting CRM
_DB_PATH = Path(__file__).parent.parent.parent / "database" / "prospecting.db"
_lock = threading.Lock()

# ── Schema ─────────────────────────────────────────────────────────────────────
_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_runs (
    id          TEXT PRIMARY KEY,
    contact_id  INTEGER,
    root_url    TEXT NOT NULL,
    sku         TEXT NOT NULL DEFAULT 'health_check',
    status      TEXT NOT NULL DEFAULT 'pending',
    trigger     TEXT NOT NULL DEFAULT 'manual',
    config      TEXT NOT NULL DEFAULT '{}',
    started_at  TEXT,
    finished_at TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_contact ON audit_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_audit_runs_status  ON audit_runs(status);

CREATE TABLE IF NOT EXISTS probe_results (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    probe_key   TEXT NOT NULL,
    status      TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 0,
    raw_data    TEXT DEFAULT '{}',
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_probe_results_run ON probe_results(run_id);

CREATE TABLE IF NOT EXISTS audit_findings (
    id                  TEXT PRIMARY KEY,
    run_id              TEXT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    probe_key           TEXT NOT NULL,
    category            TEXT NOT NULL,
    severity            TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    evidence            TEXT DEFAULT '{}',
    impact_eur_monthly  REAL,
    impact_confidence   TEXT DEFAULT 'low',
    fix_effort          TEXT,
    cwe                 TEXT,
    cvss_score          REAL,
    refs                TEXT DEFAULT '[]',
    priority_score      REAL DEFAULT 0.0,
    remediation         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_findings_run      ON audit_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_category ON audit_findings(category);

CREATE TABLE IF NOT EXISTS audit_reports (
    id              TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    overall_score   INTEGER NOT NULL DEFAULT 0,
    score_breakdown TEXT NOT NULL DEFAULT '{}',
    executive_md    TEXT DEFAULT '',
    pdf_gcs_path    TEXT,
    generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_run ON audit_reports(run_id);
"""

# ── Contact field migration ────────────────────────────────────────────────────
_MIGRATIONS = [
    "ALTER TABLE contacts ADD COLUMN audit_type TEXT",
    "ALTER TABLE contacts ADD COLUMN email TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE audit_findings ADD COLUMN remediation TEXT",
]


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_audit_db() -> None:
    """Create audit tables + migrate contacts table. Idempotent."""
    with _lock:
        conn = _conn()
        try:
            conn.executescript(_SCHEMA)
            for migration in _MIGRATIONS:
                try:
                    conn.execute(migration)
                    conn.commit()
                except sqlite3.OperationalError:
                    pass  # column already exists
            conn.commit()
        finally:
            conn.close()


# ── Write ──────────────────────────────────────────────────────────────────────

def save_run(run: AuditRun) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO audit_runs
                   (id, contact_id, root_url, sku, status, trigger, config,
                    started_at, finished_at, error, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    run.id, run.contact_id, run.root_url, run.sku.value,
                    run.status.value, run.trigger, json.dumps(run.config),
                    run.started_at, run.finished_at, run.error, run.created_at,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def save_probe_results(results: list[ProbeResult]) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.executemany(
                """INSERT OR REPLACE INTO probe_results
                   (id, run_id, probe_key, status, duration_ms, raw_data, error, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                [
                    (
                        r.id, r.run_id, r.probe_key, r.status.value,
                        r.duration_ms, json.dumps(r.raw_data), r.error, r.created_at,
                    )
                    for r in results
                ],
            )
            conn.commit()
        finally:
            conn.close()


def save_findings(findings: list[Finding]) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.executemany(
                """INSERT OR REPLACE INTO audit_findings
                   (id, run_id, probe_key, category, severity, title, description,
                    evidence, impact_eur_monthly, impact_confidence, fix_effort,
                    cwe, cvss_score, refs, priority_score, remediation)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [
                    (
                        f.id, f.run_id, f.probe_key, f.category.value, f.severity.value,
                        f.title, f.description,
                        json.dumps(f.evidence), f.impact_eur_monthly,
                        f.impact_confidence.value if f.impact_confidence else "low",
                        f.fix_effort.value if f.fix_effort else None,
                        f.cwe, f.cvss_score,
                        json.dumps(f.refs), f.priority_score, f.remediation,
                    )
                    for f in findings
                ],
            )
            conn.commit()
        finally:
            conn.close()


def save_report(report: AuditReport) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO audit_reports
                   (id, run_id, overall_score, score_breakdown, executive_md,
                    pdf_gcs_path, generated_at, version)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    report.id, report.run_id, report.overall_score,
                    json.dumps(report.score_breakdown),
                    report.executive_md, report.pdf_gcs_path,
                    report.generated_at, report.version,
                ),
            )
            conn.commit()
        finally:
            conn.close()


# ── Read ───────────────────────────────────────────────────────────────────────

def get_run(run_id: str) -> Optional[dict]:
    with _lock:
        conn = _conn()
        try:
            row = conn.execute(
                "SELECT * FROM audit_runs WHERE id = ?", (run_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def list_runs(contact_id: Optional[int] = None, limit: int = 50) -> list[dict]:
    with _lock:
        conn = _conn()
        try:
            if contact_id is not None:
                rows = conn.execute(
                    "SELECT * FROM audit_runs WHERE contact_id = ? ORDER BY created_at DESC LIMIT ?",
                    (contact_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM audit_runs ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def get_findings(run_id: str) -> list[dict]:
    with _lock:
        conn = _conn()
        try:
            rows = conn.execute(
                "SELECT * FROM audit_findings WHERE run_id = ? ORDER BY priority_score DESC",
                (run_id,),
            ).fetchall()
            result = []
            for row in rows:
                d = dict(row)
                d["evidence"] = json.loads(d.get("evidence") or "{}")
                d["refs"]     = json.loads(d.get("refs") or "[]")
                result.append(d)
            return result
        finally:
            conn.close()


def get_report(run_id: str) -> Optional[dict]:
    with _lock:
        conn = _conn()
        try:
            row = conn.execute(
                "SELECT * FROM audit_reports WHERE run_id = ? ORDER BY version DESC LIMIT 1",
                (run_id,),
            ).fetchone()
            if not row:
                return None
            d = dict(row)
            d["score_breakdown"] = json.loads(d.get("score_breakdown") or "{}")
            return d
        finally:
            conn.close()


def get_run_with_summary(run_id: str) -> Optional[dict]:
    """Returns run + report + finding count in one call."""
    run = get_run(run_id)
    if not run:
        return None
    run["config"] = json.loads(run.get("config") or "{}")

    with _lock:
        conn = _conn()
        try:
            count_row = conn.execute(
                "SELECT COUNT(*) as cnt FROM audit_findings WHERE run_id = ?", (run_id,)
            ).fetchone()
            run["finding_count"] = count_row["cnt"] if count_row else 0

            sev_rows = conn.execute(
                """SELECT severity, COUNT(*) as cnt
                   FROM audit_findings WHERE run_id = ?
                   GROUP BY severity""",
                (run_id,),
            ).fetchall()
            run["severity_counts"] = {r["severity"]: r["cnt"] for r in sev_rows}
        finally:
            conn.close()

    run["report"] = get_report(run_id)
    return run
