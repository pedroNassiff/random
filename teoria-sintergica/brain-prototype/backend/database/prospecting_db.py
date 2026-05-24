"""
Prospecting CRM — SQLite persistence layer.

Tables
------
contacts    — all contact/prospect data including AI analysis (stored as JSON)
pitch_logs  — every sent email + open events array (stored as JSON)

Auto-migrates from legacy JSON files on first access.
"""

import sqlite3
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

# ── Paths ──────────────────────────────────────────────────────────────────────
DB_PATH       = Path(__file__).parent / "prospecting.db"
LEGACY_CONTACTS = Path(__file__).parent.parent / "data" / "prospecting.json"
LEGACY_LOGS     = Path(__file__).parent.parent / "data" / "pitch_logs.json"

_lock = threading.Lock()


# ── Schema ─────────────────────────────────────────────────────────────────────
_SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    company        TEXT    NOT NULL,
    tier           INTEGER NOT NULL DEFAULT 3,
    location       TEXT    NOT NULL DEFAULT '',
    focus          TEXT    NOT NULL DEFAULT '',
    linkedin_url   TEXT    NOT NULL DEFAULT '',
    website        TEXT    NOT NULL DEFAULT '',
    decision_maker TEXT    NOT NULL DEFAULT '',
    why            TEXT    NOT NULL DEFAULT '',
    stage          TEXT    NOT NULL DEFAULT 'identificado',
    follow_up_count INTEGER NOT NULL DEFAULT 0,
    notes          TEXT    NOT NULL DEFAULT '',
    last_action    TEXT,
    next_action    TEXT,
    responded      INTEGER NOT NULL DEFAULT 0,  -- boolean
    ai_analysis    TEXT,   -- JSON blob
    ai_proposal      TEXT,   -- JSON blob (commercial proposal, second-stage AI)
    ai_proposal_chat  TEXT,   -- JSON array of {role, content} chat messages
    scraped_content   TEXT,  -- last scrape raw text
    scrape_ts      TEXT,   -- ISO timestamp of last scrape
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pitch_logs (
    tracking_id TEXT PRIMARY KEY,
    contact_id  INTEGER,
    company     TEXT    NOT NULL DEFAULT '',
    to_email    TEXT    NOT NULL DEFAULT '',
    subject     TEXT    NOT NULL DEFAULT '',
    pitch_type  TEXT    NOT NULL DEFAULT 'email',
    sent_at     TEXT    NOT NULL,
    opens       TEXT    NOT NULL DEFAULT '[]',  -- JSON array
    clicks      TEXT    NOT NULL DEFAULT '[]'   -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_pitch_logs_contact ON pitch_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage     ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tier      ON contacts(tier);

-- ── Prospect groups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_groups (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    config           TEXT    NOT NULL DEFAULT '{}',  -- JSON: search params used
    status           TEXT    NOT NULL DEFAULT 'draft',  -- draft | reviewed | completed
    total_generated  INTEGER NOT NULL DEFAULT 0,
    total_accepted   INTEGER NOT NULL DEFAULT 0,
    model_used       TEXT    NOT NULL DEFAULT '',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Prospect group items (pending prospects before kanban acceptance) ───────
CREATE TABLE IF NOT EXISTS prospect_group_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id       INTEGER NOT NULL,
    contact_id     INTEGER,     -- NULL until accepted into kanban
    company        TEXT    NOT NULL DEFAULT '',
    location       TEXT    NOT NULL DEFAULT '',
    tier           INTEGER NOT NULL DEFAULT 3,
    decision_maker TEXT    NOT NULL DEFAULT '',
    linkedin_url   TEXT    NOT NULL DEFAULT '',
    website        TEXT    NOT NULL DEFAULT '',
    ai_score       INTEGER NOT NULL DEFAULT 0,
    fit_category   TEXT    NOT NULL DEFAULT 'mid',   -- high | mid | low
    why            TEXT    NOT NULL DEFAULT '',
    entry_vector   TEXT    NOT NULL DEFAULT '{}',    -- JSON object
    tags           TEXT    NOT NULL DEFAULT '[]',    -- JSON array
    status         TEXT    NOT NULL DEFAULT 'pending',  -- pending | accepted | discarded
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id)   REFERENCES prospect_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_group_items_group  ON prospect_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_group_items_status ON prospect_group_items(status);
"""


# ── Connection ─────────────────────────────────────────────────────────────────
def _conn() -> sqlite3.Connection:
    """Return a thread-local connection with row_factory."""
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init_db():
    """Create tables + run JSON migration if needed."""
    with _lock:
        c = _conn()
        c.executescript(_SCHEMA)
        # Additive migrations for columns added after initial deploy
        for col, ddl in [
            ("ai_proposal",      "ALTER TABLE contacts ADD COLUMN ai_proposal TEXT"),
            ("ai_proposal_chat", "ALTER TABLE contacts ADD COLUMN ai_proposal_chat TEXT"),
        ]:
            existing = [r[1] for r in c.execute("PRAGMA table_info(contacts)").fetchall()]
            if col not in existing:
                c.execute(ddl)
        c.commit()
        _migrate_from_json(c)
        c.close()


# ── JSON → SQLite migration ────────────────────────────────────────────────────
def _migrate_from_json(c: sqlite3.Connection):
    """One-shot migration from legacy JSON files. Skips if DB already has data."""
    # ── contacts ──
    count = c.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    if count == 0 and LEGACY_CONTACTS.exists():
        try:
            contacts = json.loads(LEGACY_CONTACTS.read_text())
            for ct in contacts:
                c.execute("""
                    INSERT OR IGNORE INTO contacts
                    (id, company, tier, location, focus, linkedin_url, website,
                     decision_maker, why, stage, follow_up_count, notes,
                     last_action, next_action, responded, ai_analysis, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    ct.get("id"),
                    ct.get("company", ""),
                    ct.get("tier", 3),
                    ct.get("location", ""),
                    ct.get("focus", ""),
                    ct.get("linkedin_url", ""),
                    ct.get("website", ""),
                    ct.get("decision_maker", ""),
                    ct.get("why", ""),
                    ct.get("stage", "identificado"),
                    ct.get("follow_up_count", 0),
                    ct.get("notes", ""),
                    ct.get("last_action"),
                    ct.get("next_action"),
                    1 if ct.get("responded") else 0,
                    json.dumps(ct["ai_analysis"]) if ct.get("ai_analysis") else None,
                    ct.get("created_at", datetime.now().isoformat()),
                ))
            c.commit()
            # Keep JSON as backup; rename so migration won't re-run
            LEGACY_CONTACTS.rename(LEGACY_CONTACTS.with_suffix(".json.migrated"))
        except Exception as e:
            print(f"[prospecting_db] contacts migration error: {e}")

    # ── pitch_logs schema migration: drop NOT NULL + FK on contact_id ──
    try:
        col_info = c.execute("PRAGMA table_info(pitch_logs)").fetchall()
        contact_col = next((r for r in col_info if r["name"] == "contact_id"), None)
        # notnull=1 means the old schema — migrate to nullable
        if contact_col and contact_col["notnull"] == 1:
            c.executescript("""
                PRAGMA foreign_keys = OFF;
                CREATE TABLE pitch_logs_new (
                    tracking_id TEXT PRIMARY KEY,
                    contact_id  INTEGER,
                    company     TEXT NOT NULL DEFAULT '',
                    to_email    TEXT NOT NULL DEFAULT '',
                    subject     TEXT NOT NULL DEFAULT '',
                    pitch_type  TEXT NOT NULL DEFAULT 'email',
                    sent_at     TEXT NOT NULL,
                    opens       TEXT NOT NULL DEFAULT '[]',
                    clicks      TEXT NOT NULL DEFAULT '[]'
                );
                INSERT INTO pitch_logs_new SELECT
                    tracking_id, contact_id, company, to_email,
                    subject, pitch_type, sent_at, opens, clicks
                FROM pitch_logs;
                DROP TABLE pitch_logs;
                ALTER TABLE pitch_logs_new RENAME TO pitch_logs;
                CREATE INDEX IF NOT EXISTS idx_pitch_logs_contact ON pitch_logs(contact_id);
                PRAGMA foreign_keys = ON;
            """)
            c.commit()
            print("[prospecting_db] pitch_logs migrated: contact_id is now nullable")
    except Exception as e:
        print(f"[prospecting_db] pitch_logs schema migration error: {e}")

    # ── pitch logs legacy JSON ──
    log_count = c.execute("SELECT COUNT(*) FROM pitch_logs").fetchone()[0]
    if log_count == 0 and LEGACY_LOGS.exists():
        try:
            logs = json.loads(LEGACY_LOGS.read_text())
            for tid, item in logs.items():
                c.execute("""
                    INSERT OR IGNORE INTO pitch_logs
                    (tracking_id, contact_id, company, to_email, subject,
                     pitch_type, sent_at, opens, clicks)
                    VALUES (?,?,?,?,?,?,?,?,?)
                """, (
                    tid,
                    item.get("contact_id", 0),
                    item.get("company", ""),
                    item.get("to_email", ""),
                    item.get("subject", ""),
                    item.get("pitch_type", "email"),
                    item.get("sent_at", datetime.now().isoformat()),
                    json.dumps(item.get("opens", [])),
                    json.dumps(item.get("clicks", [])),
                ))
            c.commit()
            LEGACY_LOGS.rename(LEGACY_LOGS.with_suffix(".json.migrated"))
        except Exception as e:
            print(f"[prospecting_db] pitch_logs migration error: {e}")


# ── Row → dict helper ──────────────────────────────────────────────────────────
def _row_to_contact(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["responded"]    = bool(d["responded"])
    d["ai_analysis"]  = json.loads(d["ai_analysis"])  if d.get("ai_analysis")  else None
    d["ai_proposal"]      = json.loads(d["ai_proposal"])      if d.get("ai_proposal")      else None
    d["ai_proposal_chat"] = json.loads(d["ai_proposal_chat"]) if d.get("ai_proposal_chat") else None
    return d


def _row_to_log(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["opens"]  = json.loads(d["opens"])
    d["clicks"] = json.loads(d["clicks"])
    return d


# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS API
# ══════════════════════════════════════════════════════════════════════════════

def contacts_list() -> list[dict]:
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM contacts ORDER BY id").fetchall()
        c.close()
    return [_row_to_contact(r) for r in rows]


def contact_get(contact_id: int) -> Optional[dict]:
    with _lock:
        c = _conn()
        row = c.execute("SELECT * FROM contacts WHERE id=?", (contact_id,)).fetchone()
        c.close()
    return _row_to_contact(row) if row else None


def contact_create(data: dict) -> dict:
    with _lock:
        c = _conn()
        cur = c.execute("""
            INSERT INTO contacts
            (company, tier, location, focus, linkedin_url, website,
             decision_maker, why, stage, follow_up_count, notes,
             last_action, next_action, responded, ai_analysis, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data.get("company", ""),
            data.get("tier", 3),
            data.get("location", ""),
            data.get("focus", ""),
            data.get("linkedin_url", ""),
            data.get("website", ""),
            data.get("decision_maker", ""),
            data.get("why", ""),
            data.get("stage", "identificado"),
            data.get("follow_up_count", 0),
            data.get("notes", ""),
            data.get("last_action"),
            data.get("next_action"),
            1 if data.get("responded") else 0,
            json.dumps(data["ai_analysis"]) if data.get("ai_analysis") else None,
            data.get("created_at", datetime.now().isoformat()),
        ))
        c.commit()
        new_id = cur.lastrowid
        row = c.execute("SELECT * FROM contacts WHERE id=?", (new_id,)).fetchone()
        c.close()
    return _row_to_contact(row)


def contact_update(contact_id: int, data: dict) -> Optional[dict]:
    """Update only the provided fields."""
    if not data:
        return contact_get(contact_id)

    # Map Python field → SQL expression (handle ai_analysis JSON serialisation)
    col_map = {
        "company":        ("company",        lambda v: v),
        "tier":           ("tier",           lambda v: v),
        "location":       ("location",       lambda v: v),
        "focus":          ("focus",          lambda v: v),
        "linkedin_url":   ("linkedin_url",   lambda v: v),
        "website":        ("website",        lambda v: v),
        "decision_maker": ("decision_maker", lambda v: v),
        "why":            ("why",            lambda v: v),
        "stage":          ("stage",          lambda v: v),
        "follow_up_count":("follow_up_count",lambda v: v),
        "notes":          ("notes",          lambda v: v),
        "last_action":    ("last_action",    lambda v: v),
        "next_action":    ("next_action",    lambda v: v),
        "responded":      ("responded",      lambda v: 1 if v else 0),
        "ai_analysis":    ("ai_analysis",    lambda v: json.dumps(v) if v is not None else None),
        "ai_proposal":      ("ai_proposal",      lambda v: json.dumps(v) if v is not None else None),
        "ai_proposal_chat": ("ai_proposal_chat", lambda v: json.dumps(v) if v is not None else None),
        "scraped_content":  ("scraped_content",  lambda v: v),
        "scrape_ts":      ("scrape_ts",      lambda v: v),
    }

    sets, vals = [], []
    for k, v in data.items():
        if k in col_map:
            col, transform = col_map[k]
            sets.append(f"{col}=?")
            vals.append(transform(v))

    if not sets:
        return contact_get(contact_id)

    vals.append(contact_id)
    with _lock:
        c = _conn()
        c.execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id=?", vals)
        c.commit()
        row = c.execute("SELECT * FROM contacts WHERE id=?", (contact_id,)).fetchone()
        c.close()
    return _row_to_contact(row) if row else None


def contact_delete(contact_id: int) -> bool:
    with _lock:
        c = _conn()
        cur = c.execute("DELETE FROM contacts WHERE id=?", (contact_id,))
        c.commit()
        c.close()
    return cur.rowcount > 0


def contacts_reset(seed: list[dict]):
    """Wipe table and re-insert seed data."""
    with _lock:
        c = _conn()
        c.execute("DELETE FROM contacts")
        for ct in seed:
            c.execute("""
                INSERT INTO contacts
                (id, company, tier, location, focus, linkedin_url, website,
                 decision_maker, why, stage, follow_up_count, notes,
                 last_action, next_action, responded, ai_analysis, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                ct.get("id"), ct.get("company",""), ct.get("tier",3),
                ct.get("location",""), ct.get("focus",""),
                ct.get("linkedin_url",""), ct.get("website",""),
                ct.get("decision_maker",""), ct.get("why",""),
                ct.get("stage","identificado"), ct.get("follow_up_count",0),
                ct.get("notes",""), ct.get("last_action"), ct.get("next_action"),
                1 if ct.get("responded") else 0,
                json.dumps(ct["ai_analysis"]) if ct.get("ai_analysis") else None,
                ct.get("created_at", datetime.now().isoformat()),
            ))
        c.commit()
        c.close()


# ══════════════════════════════════════════════════════════════════════════════
# PITCH LOGS API
# ══════════════════════════════════════════════════════════════════════════════

def log_create(tracking_id: str, contact_id, company: str,
               to_email: str, subject: str, pitch_type: str, sent_at: str):
    # contact_id may be None when sending from audit without a linked contact
    contact_id = int(contact_id) if contact_id else None
    with _lock:
        c = _conn()
        c.execute("""
            INSERT OR REPLACE INTO pitch_logs
            (tracking_id, contact_id, company, to_email, subject, pitch_type, sent_at, opens, clicks)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (tracking_id, contact_id, company, to_email, subject, pitch_type, sent_at, "[]", "[]"))
        c.commit()
        c.close()


def log_append_open(tracking_id: str, open_event: dict) -> bool:
    """Append an open event. Returns False if tracking_id not found."""
    with _lock:
        c = _conn()
        row = c.execute("SELECT opens FROM pitch_logs WHERE tracking_id=?", (tracking_id,)).fetchone()
        if not row:
            c.close()
            return False
        opens = json.loads(row["opens"])
        opens.append(open_event)
        c.execute("UPDATE pitch_logs SET opens=? WHERE tracking_id=?",
                  (json.dumps(opens), tracking_id))
        c.commit()
        c.close()
    return True


def log_get(tracking_id: str) -> Optional[dict]:
    with _lock:
        c = _conn()
        row = c.execute("SELECT * FROM pitch_logs WHERE tracking_id=?", (tracking_id,)).fetchone()
        c.close()
    return _row_to_log(row) if row else None


def logs_by_contact(contact_id: int) -> list[dict]:
    with _lock:
        c = _conn()
        rows = c.execute(
            "SELECT * FROM pitch_logs WHERE contact_id=? ORDER BY sent_at DESC",
            (contact_id,)
        ).fetchall()
        c.close()
    return [_row_to_log(r) for r in rows]


def logs_all() -> list[dict]:
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM pitch_logs ORDER BY sent_at DESC").fetchall()
        c.close()
    return [_row_to_log(r) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
# PROSPECT GROUPS API
# ══════════════════════════════════════════════════════════════════════════════

def _row_to_group(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["config"] = json.loads(d["config"]) if d.get("config") else {}
    return d


def _row_to_group_item(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["entry_vector"] = json.loads(d["entry_vector"]) if d.get("entry_vector") else {}
    d["tags"]         = json.loads(d["tags"]) if d.get("tags") else []
    return d


def groups_list() -> list[dict]:
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM prospect_groups ORDER BY created_at DESC").fetchall()
        c.close()
    return [_row_to_group(r) for r in rows]


def group_get(group_id: int) -> Optional[dict]:
    with _lock:
        c = _conn()
        row = c.execute("SELECT * FROM prospect_groups WHERE id=?", (group_id,)).fetchone()
        c.close()
    return _row_to_group(row) if row else None


def group_create(name: str, config: dict, model_used: str) -> dict:
    with _lock:
        c = _conn()
        cur = c.execute("""
            INSERT INTO prospect_groups (name, config, model_used)
            VALUES (?,?,?)
        """, (name, json.dumps(config), model_used))
        c.commit()
        row = c.execute("SELECT * FROM prospect_groups WHERE id=?", (cur.lastrowid,)).fetchone()
        c.close()
    return _row_to_group(row)


def group_update(group_id: int, data: dict) -> Optional[dict]:
    allowed = {"name", "status", "total_generated", "total_accepted", "model_used", "config"}
    sets, vals = [], []
    for k, v in data.items():
        if k in allowed:
            sets.append(f"{k}=?")
            vals.append(json.dumps(v) if k == "config" else v)
    if not sets:
        return group_get(group_id)
    sets.append("updated_at=?")
    vals.append(datetime.now().isoformat())
    vals.append(group_id)
    with _lock:
        c = _conn()
        c.execute(f"UPDATE prospect_groups SET {', '.join(sets)} WHERE id=?", vals)
        c.commit()
        row = c.execute("SELECT * FROM prospect_groups WHERE id=?", (group_id,)).fetchone()
        c.close()
    return _row_to_group(row) if row else None


def group_delete(group_id: int) -> bool:
    with _lock:
        c = _conn()
        cur = c.execute("DELETE FROM prospect_groups WHERE id=?", (group_id,))
        c.commit()
        c.close()
    return cur.rowcount > 0


# ── Group items ────────────────────────────────────────────────────────────────

def group_items_list(group_id: int) -> list[dict]:
    with _lock:
        c = _conn()
        rows = c.execute(
            "SELECT * FROM prospect_group_items WHERE group_id=? ORDER BY ai_score DESC",
            (group_id,)
        ).fetchall()
        c.close()
    return [_row_to_group_item(r) for r in rows]


def group_item_create(group_id: int, data: dict) -> dict:
    with _lock:
        c = _conn()
        cur = c.execute("""
            INSERT INTO prospect_group_items
            (group_id, company, location, tier, decision_maker,
             linkedin_url, website, ai_score, fit_category,
             why, entry_vector, tags, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            group_id,
            data.get("company", ""),
            data.get("location", ""),
            data.get("tier", 3),
            data.get("decision_maker", ""),
            data.get("linkedin_url", ""),
            data.get("website", ""),
            data.get("ai_score", 0),
            data.get("fit_category", "mid"),
            data.get("why", ""),
            json.dumps(data.get("entry_vector", {})),
            json.dumps(data.get("tags", [])),
            data.get("status", "pending"),
        ))
        c.commit()
        row = c.execute("SELECT * FROM prospect_group_items WHERE id=?", (cur.lastrowid,)).fetchone()
        c.close()
    return _row_to_group_item(row)


def group_item_update(item_id: int, status: str, contact_id: Optional[int] = None) -> Optional[dict]:
    with _lock:
        c = _conn()
        if contact_id is not None:
            c.execute(
                "UPDATE prospect_group_items SET status=?, contact_id=? WHERE id=?",
                (status, contact_id, item_id)
            )
        else:
            c.execute(
                "UPDATE prospect_group_items SET status=? WHERE id=?",
                (status, item_id)
            )
        c.commit()
        row = c.execute("SELECT * FROM prospect_group_items WHERE id=?", (item_id,)).fetchone()
        c.close()
    return _row_to_group_item(row) if row else None

