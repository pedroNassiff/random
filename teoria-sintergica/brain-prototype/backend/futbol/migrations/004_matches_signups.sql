-- Fútbol Vaquero — M2: partidos e inscripción (spec §5). Idempotente.

CREATE TABLE IF NOT EXISTS futbol.matches (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id         uuid NOT NULL REFERENCES futbol.groups(id) ON DELETE CASCADE,
    starts_at        timestamptz NOT NULL,
    signup_closes_at timestamptz NOT NULL,
    status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'closed', 'teams_published', 'played', 'cancelled')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (signup_closes_at <= starts_at),
    UNIQUE (group_id, starts_at)   -- el cron es idempotente: nunca dos partidos a la misma hora
);
CREATE INDEX IF NOT EXISTS idx_futbol_matches_group_starts ON futbol.matches (group_id, starts_at);

CREATE TABLE IF NOT EXISTS futbol.signups (
    match_id        uuid NOT NULL REFERENCES futbol.matches(id) ON DELETE CASCADE,
    player_id       uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    status          text NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'withdrawn')),
    late_withdrawal boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL,          -- momento de llegada: define el orden de la espera
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_futbol_signups_match ON futbol.signups (match_id, status, created_at);
