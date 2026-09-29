-- Fútbol Vaquero — una skill sin datos vale 5 ("no sabemos cómo juega"), no la media del grupo.
-- Espejo de futbol.domain.config.UNKNOWN_DEFAULT. Idempotente.

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
       COALESCE(r.value, 5.0)::numeric(4, 2) AS value,
       r.n_raters::int AS n_raters,
       r.source
FROM resolved r;
