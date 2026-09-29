-- Fútbol Vaquero — M4: resultado de cada partido (spec §5). Idempotente.
-- Quién jugó realmente queda en match_teams (el admin corrige ausencias al cargar el resultado).

CREATE TABLE IF NOT EXISTS futbol.match_results (
    match_id     uuid PRIMARY KEY REFERENCES futbol.matches(id) ON DELETE CASCADE,
    goals_a      smallint NOT NULL CHECK (goals_a BETWEEN 0 AND 99),
    goals_b      smallint NOT NULL CHECK (goals_b BETWEEN 0 AND 99),
    notes        text NOT NULL DEFAULT '',
    recorded_by  uuid REFERENCES futbol.app_users(id) ON DELETE SET NULL,
    recorded_at  timestamptz NOT NULL DEFAULT now()
);
