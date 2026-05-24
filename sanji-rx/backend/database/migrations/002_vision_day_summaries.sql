-- ── Vision day summaries ──────────────────────────────────────────────────────
-- Persiste el análisis conjunto del día generado por Claude.
-- UPSERT por log_date — una sola síntesis por día (la última generada).
CREATE TABLE IF NOT EXISTS vision_day_summaries (
    log_date        DATE PRIMARY KEY,
    summary         TEXT NOT NULL,
    image_count     INT,
    model_used      TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);
