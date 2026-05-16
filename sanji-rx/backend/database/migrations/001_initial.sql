-- SANJI-RX — Fase 0 migration
-- Crea la base de datos y todas las tablas del MVP.
-- Idempotente (IF NOT EXISTS / IF NOT EXISTS CHECK guardado en schema_version).

CREATE TABLE IF NOT EXISTS schema_version (
    version     INT PRIMARY KEY,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subjects ─────────────────────────────────────────────────────────────────
-- Un sujeto por despliegue inicial (Sanji), extensible a multi-sujeto.
CREATE TABLE IF NOT EXISTS subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    species         TEXT NOT NULL,
    birth_date      DATE,
    weight_kg       NUMERIC(4,2),
    sex             TEXT,                   -- male | female
    sterilized      BOOLEAN DEFAULT FALSE,
    baseline        JSONB,                  -- features pre-evento si existen
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Cohabitants ───────────────────────────────────────────────────────────────
-- Otros animales o personas del entorno relevantes para bienestar y co-regulación.
CREATE TABLE IF NOT EXISTS cohabitants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL,          -- 'feline' | 'human' | 'other'
    role            TEXT,                   -- 'sibling', 'caretaker_primary', etc.
    notes           TEXT
);

-- ── Clinical events ──────────────────────────────────────────────────────────
-- Eventos médicos importantes (convulsiones, visitas al vete, cambios de medicación).
CREATE TABLE IF NOT EXISTS clinical_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    -- 'seizure_focal' | 'seizure_generalized' | 'medication_change'
    -- 'vet_visit' | 'imaging' | 'isquemia' | 'hospitalization' | 'other'
    severity        INT CHECK (severity BETWEEN 0 AND 5),
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    notes           TEXT,
    evidence        JSONB,                  -- refs a clips, archivos
    detected_by     TEXT DEFAULT 'human',   -- 'human' | 'system'
    confidence      NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinical_events_subject_time
    ON clinical_events(subject_id, started_at DESC);

-- ── Medications ───────────────────────────────────────────────────────────────
-- Medicamentos activos y su historial.
CREATE TABLE IF NOT EXISTS medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- nombre comercial
    active_substance TEXT,                  -- ej: fenobarbital, marbofloxacina
    dose_mg         NUMERIC(8,3),           -- dosis en mg por toma
    dose_description TEXT,                  -- ej: '1/4 pastilla de 60mg'
    frequency_hours INT NOT NULL,           -- cada cuántas horas
    schedule_hours  INT[],                  -- ej: {8, 20} = 08:00 y 20:00
    route           TEXT DEFAULT 'oral',    -- oral | topical | injectable
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,            -- null = activo
    days_remaining  INT,                    -- null = indefinido
    prescribed_by   TEXT,
    notes           TEXT,
    serum_levels    JSONB,                  -- historial de mediciones
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medications_subject_active
    ON medications(subject_id) WHERE ended_at IS NULL;

-- ── Medication administrations ────────────────────────────────────────────────
-- Registro de cada toma: cuándo se dio, si se dio, observaciones.
CREATE TABLE IF NOT EXISTS medication_administrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id       UUID REFERENCES medications(id) ON DELETE CASCADE,
    subject_id          UUID REFERENCES subjects(id) ON DELETE CASCADE,
    scheduled_at        TIMESTAMPTZ NOT NULL,   -- cuándo correspondía darse
    given_at            TIMESTAMPTZ,            -- cuándo se dio (null = no dada aún)
    given               BOOLEAN DEFAULT FALSE,
    skipped             BOOLEAN DEFAULT FALSE,
    skipped_reason      TEXT,
    dose_given_mg       NUMERIC(8,3),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_med_admin_scheduled
    ON medication_administrations(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_admin_medication
    ON medication_administrations(medication_id, scheduled_at DESC);

-- ── Daily log ─────────────────────────────────────────────────────────────────
-- Bitácora diaria manual: los 7+1 vectores observables por el cuidador.
CREATE TABLE IF NOT EXISTS daily_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id          UUID REFERENCES subjects(id) ON DELETE CASCADE,
    log_date            DATE NOT NULL,

    -- Vector digestivo
    appetite_pct        INT CHECK (appetite_pct BETWEEN 0 AND 100),
    water_intake        TEXT,               -- 'none'|'low'|'normal'|'high'
    water_ml_est        INT,
    stool               TEXT,               -- 'none'|'normal'|'soft'|'diarrhea'|'hard'
    vomit_count         INT DEFAULT 0,

    -- Vector sensorial / neurológico observacional
    hyperesthesia_score INT CHECK (hyperesthesia_score BETWEEN 0 AND 5),
    -- 1 = sin reactividad, 5 = muy reactivo a estímulos mínimos
    seizure_suspected   BOOLEAN DEFAULT FALSE,
    seizure_notes       TEXT,

    -- Vector motor
    mobility_notes      TEXT,
    ataxia_observed     BOOLEAN DEFAULT FALSE,
    head_tilt_observed  BOOLEAN DEFAULT FALSE,

    -- Vector emocional / vincular
    social_score        INT CHECK (social_score BETWEEN 0 AND 5),
    -- 1 = retraído, 5 = muy sociable y explorador
    purr_observed       BOOLEAN,
    social_notes        TEXT,

    -- Vector sueño
    sleep_quality       INT CHECK (sleep_quality BETWEEN 0 AND 5),
    -- estimación del cuidador; 1 = muy fragmentado, 5 = largo y profundo
    sleep_notes         TEXT,

    -- Estado del cuidador (para co-regulación)
    caretaker_state     JSONB,
    -- ej: {"mood": 3, "stress": 2, "hrv_avg": null, "notes": "..."}

    -- Contexto ambiental
    environment_notes   TEXT,
    -- ruido externo, visitas, cambios en el entorno

    -- Observación libre
    observations        TEXT,

    -- Metadatos
    logged_by           TEXT DEFAULT 'pedro',
    logged_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_log_date
    ON daily_log(subject_id, log_date DESC);

-- ── Alerts ────────────────────────────────────────────────────────────────────
-- Alertas generadas por el sistema (medicación, banderas clínicas, tendencias).
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    level           TEXT NOT NULL,          -- 'info'|'warning'|'urgent'|'critical'
    kind            TEXT NOT NULL,
    -- 'medication_due' | 'medication_missed' | 'red_flag_clinical'
    -- 'trend_negative' | 'data_gap' | 'weekly_summary' | 'vet_reminder'
    message_es      TEXT NOT NULL,
    action_required_es TEXT,
    evidence_refs   JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,            -- null = no leída
    resolved_at     TIMESTAMPTZ,
    auto_resolved   BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_alerts_unread
    ON alerts(subject_id, created_at DESC) WHERE read_at IS NULL;

-- ── Weekly summaries ─────────────────────────────────────────────────────────
-- Resúmenes semanales generados por LLM o por reglas.
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    generated_by    TEXT DEFAULT 'rules',   -- 'rules' | 'llm'
    global_state    TEXT,                   -- 'stable_improving' | 'stable' | 'declining' | 'mixed'
    summary_es      TEXT,
    vector_scores   JSONB,                  -- {neurological: 78, sensorial: 65, ...}
    recommendations JSONB,                  -- array de recomendaciones
    medication_adherence NUMERIC(5,2),      -- porcentaje de tomas dadas / programadas
    raw_llm_output  JSONB,                  -- output completo del LLM guardado
    UNIQUE(subject_id, week_start)
);

INSERT INTO schema_version(version) VALUES (1) ON CONFLICT DO NOTHING;
