-- Fútbol Vaquero — M3: propuestas del balanceador, equipos publicados/jugados y restricciones (spec §5).
-- Idempotente.

CREATE TABLE IF NOT EXISTS futbol.team_proposals (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    uuid NOT NULL REFERENCES futbol.matches(id) ON DELETE CASCADE,
    rank        smallint NOT NULL,
    team_a      uuid[] NOT NULL,
    team_b      uuid[] NOT NULL,
    cost        numeric NOT NULL,
    win_prob_a  numeric NOT NULL,
    breakdown   jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (match_id, rank)
);

-- Lo que se jugó (o se publicó) realmente: al publicar se copia la propuesta elegida;
-- al cargar el resultado (M4) el admin corrige ausencias o cambios.
CREATE TABLE IF NOT EXISTS futbol.match_teams (
    match_id         uuid NOT NULL REFERENCES futbol.matches(id) ON DELETE CASCADE,
    player_id        uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    team             text NOT NULL CHECK (team IN ('A', 'B')),
    minutes_fraction numeric NOT NULL DEFAULT 1,
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS futbol.player_constraints (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id  uuid NOT NULL REFERENCES futbol.groups(id) ON DELETE CASCADE,
    player_a  uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    player_b  uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    kind      text NOT NULL CHECK (kind IN ('apart', 'together')),
    CHECK (player_a <> player_b)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_futbol_constraints_pair
    ON futbol.player_constraints (group_id, LEAST(player_a, player_b), GREATEST(player_a, player_b));
