#!/usr/bin/env python3
"""Crea la tabla eeg_recordings en prod PostgreSQL (vía tunnel localhost:5433)."""
import psycopg2

conn = psycopg2.connect(
    host='localhost', port=5433,
    dbname='brain_prototype', user='brain_user', password='sintergic2024'
)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS eeg_recordings (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL DEFAULT '',
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    duration_seconds    FLOAT DEFAULT 0,
    device              TEXT DEFAULT 'muse2',
    device_address      TEXT DEFAULT '',
    sampling_rate       INTEGER DEFAULT 256,
    channels            TEXT[] DEFAULT ARRAY['TP9','AF7','AF8','TP10'],
    sample_count        INTEGER DEFAULT 0,
    metrics_count       INTEGER DEFAULT 0,
    calibration_passed  BOOLEAN DEFAULT FALSE,
    avg_signal_quality  FLOAT DEFAULT 0,
    notes               TEXT DEFAULT '',
    tags                TEXT[] DEFAULT '{}',
    recording_type      TEXT DEFAULT 'session',
    avg_coherence       FLOAT,
    avg_alpha           FLOAT,
    avg_theta           FLOAT,
    avg_beta            FLOAT,
    avg_gamma           FLOAT,
    avg_delta           FLOAT,
    peak_coherence      FLOAT,
    user_id             TEXT,
    practice_session_id TEXT
);
""")
conn.commit()

cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='eeg_recordings' ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print(f"✅ Tabla eeg_recordings lista con {len(cols)} columnas: {cols}")
conn.close()
