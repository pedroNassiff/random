-- Fútbol Vaquero — schema M0/M1 (auth propia + jugadores + skills dinámicas)
-- Spec: docs/la-vaca-futbol/spec.md §5. Idempotente. Vive en el schema `futbol`
-- de la BBDD de Random. Sin RLS: los permisos los aplica la API (rol admin/member).

CREATE SCHEMA IF NOT EXISTS futbol;

-- ── Auth propia (reemplaza Supabase magic link) ─────────────────────────────
CREATE TABLE IF NOT EXISTS futbol.app_users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE CHECK (email = lower(email)),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Solo se guarda el hash SHA-256 del token; el token en claro viaja por email.
CREATE TABLE IF NOT EXISTS futbol.magic_links (
    token_hash  text PRIMARY KEY,
    email       text NOT NULL,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_futbol_magic_links_email ON futbol.magic_links (email, created_at DESC);

CREATE TABLE IF NOT EXISTS futbol.auth_sessions (
    token_hash  text PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_futbol_auth_sessions_user ON futbol.auth_sessions (user_id);

-- ── Grupo y membresía ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS futbol.groups (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    timezone            text NOT NULL DEFAULT 'Europe/Madrid',
    match_weekday       int  NOT NULL DEFAULT 3,
    match_time          time NOT NULL DEFAULT '20:00',
    signup_close_weekday int NOT NULL DEFAULT 0,
    signup_close_time   time NOT NULL DEFAULT '23:59',
    generate_weekday    int  NOT NULL DEFAULT 2,
    generate_time       time NOT NULL DEFAULT '12:00',
    capacity            int  NOT NULL DEFAULT 16,
    balancer_config     jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS futbol.group_members (
    group_id uuid NOT NULL REFERENCES futbol.groups(id) ON DELETE CASCADE,
    user_id  uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    role     text NOT NULL CHECK (role IN ('admin', 'member')),
    PRIMARY KEY (group_id, user_id)
);

-- ── Jugadores ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS futbol.players (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id           uuid NOT NULL REFERENCES futbol.groups(id) ON DELETE CASCADE,
    user_id            uuid REFERENCES futbol.app_users(id) ON DELETE SET NULL,
    display_name       text NOT NULL,
    nickname           text,
    email              text CHECK (email IS NULL OR email = lower(email)),
    preferred_position text CHECK (preferred_position IN ('GK', 'DEF', 'MID', 'FWD')),
    can_play_gk        boolean NOT NULL DEFAULT false,
    is_guest           boolean NOT NULL DEFAULT false,
    guest_level        smallint CHECK (guest_level BETWEEN 1 AND 10),
    active             boolean NOT NULL DEFAULT true,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CHECK (is_guest OR guest_level IS NULL),
    CHECK (NOT is_guest OR guest_level IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_futbol_players_user ON futbol.players (group_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_futbol_players_group ON futbol.players (group_id) WHERE active;

-- ── Skills (nunca se borran, se desactivan) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS futbol.skills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    uuid NOT NULL REFERENCES futbol.groups(id) ON DELETE CASCADE,
    key         text NOT NULL,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    weight      numeric(3, 2) NOT NULL CHECK (weight BETWEEN 0 AND 3),
    is_active   boolean NOT NULL DEFAULT true,
    sort_order  int NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, key)
);

CREATE TABLE IF NOT EXISTS futbol.skill_ratings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id         uuid NOT NULL REFERENCES futbol.skills(id),
    player_id        uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    rater_player_id  uuid NOT NULL REFERENCES futbol.players(id) ON DELETE CASCADE,
    value            smallint NOT NULL CHECK (value BETWEEN 1 AND 10),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (skill_id, player_id, rater_player_id)
);
CREATE INDEX IF NOT EXISTS idx_futbol_skill_ratings_player ON futbol.skill_ratings (player_id);

-- ── Vista player_skill_scores (ALGORITHMS §1.2) ─────────────────────────────
-- Espejo SQL de futbol.domain.skills.aggregate_skill_scores: la fuente de verdad
-- es el dominio Python; esta vista es para consultas de solo lectura del admin.
-- peers = raters no-admin y distintos del propio jugador (>= 3 → mediana);
-- si no, mediana de admins; si no, media de los valores resueltos del grupo (5.5 si no hay).
CREATE OR REPLACE VIEW futbol.player_skill_scores AS
WITH cells AS (
    SELECT sr.skill_id,
           sr.player_id,
           sr.value,
           (gm.role = 'admin') AS rater_is_admin
    FROM futbol.skill_ratings sr
    JOIN futbol.players rp ON rp.id = sr.rater_player_id
    LEFT JOIN futbol.group_members gm ON gm.user_id = rp.user_id AND gm.group_id = rp.group_id
    WHERE sr.rater_player_id <> sr.player_id
),
agg AS (
    SELECT skill_id, player_id,
           count(*) FILTER (WHERE NOT COALESCE(rater_is_admin, false)) AS n_peers,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY value)
               FILTER (WHERE NOT COALESCE(rater_is_admin, false)) AS peer_median,
           count(*) FILTER (WHERE COALESCE(rater_is_admin, false)) AS n_admin,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY value)
               FILTER (WHERE COALESCE(rater_is_admin, false)) AS admin_median
    FROM cells
    GROUP BY skill_id, player_id
),
resolved AS (
    SELECT p.id AS player_id, s.id AS skill_id, s.group_id,
           CASE WHEN a.n_peers >= 3 THEN a.peer_median
                WHEN a.n_admin > 0 THEN a.admin_median END AS value,
           CASE WHEN a.n_peers >= 3 THEN a.n_peers
                WHEN a.n_admin > 0 THEN a.n_admin ELSE 0 END AS n_raters,
           CASE WHEN a.n_peers >= 3 THEN 'peers'
                WHEN a.n_admin > 0 THEN 'admin' ELSE 'imputed' END AS source
    FROM futbol.players p
    JOIN futbol.skills s ON s.group_id = p.group_id AND s.is_active
    LEFT JOIN agg a ON a.skill_id = s.id AND a.player_id = p.id
    WHERE p.active AND NOT p.is_guest
)
SELECT r.player_id,
       r.skill_id,
       COALESCE(r.value,
                avg(r.value) OVER (PARTITION BY r.skill_id),
                5.5)::numeric(4, 2) AS value,
       r.n_raters::int AS n_raters,
       r.source
FROM resolved r;

-- ── Seed idempotente: grupo "Fútbol Vaquero" + skills por defecto ───────────
INSERT INTO futbol.groups (name)
SELECT 'Fútbol Vaquero'
WHERE NOT EXISTS (SELECT 1 FROM futbol.groups WHERE name = 'Fútbol Vaquero');

INSERT INTO futbol.skills (group_id, key, name, description, weight, sort_order)
SELECT g.id, d.key, d.name, d.description, d.weight, d.sort_order
FROM futbol.groups g
CROSS JOIN (VALUES
    ('overall',     'Nivel general',    'Tu impresión global de cómo juega.',            3.0, 1),
    ('technique',   'Técnica y control','Control, primer toque, manejo de la pelota.',   1.5, 2),
    ('passing',     'Pase y visión',    'Precisión de pase y lectura del juego.',        1.5, 3),
    ('defending',   'Marca y defensa',  'Marca, recuperación y vuelta al equipo.',       1.5, 4),
    ('dribbling',   'Regate',           'Desborde y gambeta en el uno contra uno.',      1.0, 5),
    ('finishing',   'Definición',       'Puntería y sangre fría frente al arco.',        1.0, 6),
    ('pace',        'Velocidad',        'Velocidad punta y arranque.',                   1.0, 7),
    ('stamina',     'Resistencia',      'Aguanta el ritmo todo el partido.',             1.0, 8),
    ('goalkeeping', 'Arquero',          'Cómo ataja. No entra al puntaje, reparte arqueros.', 0.0, 9)
) AS d(key, name, description, weight, sort_order)
WHERE g.name = 'Fútbol Vaquero'
ON CONFLICT (group_id, key) DO NOTHING;
