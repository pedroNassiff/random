-- Fútbol Vaquero — puestos en español para fútbol 5:
-- POR (portero), DEF (defensor), MED (medio), DEL (delantero).
-- Convierte los datos existentes (GK→POR, MID→MED, FWD→DEL). Idempotente.

ALTER TABLE futbol.players DROP CONSTRAINT IF EXISTS players_preferred_position_check;

UPDATE futbol.players SET preferred_position = CASE preferred_position
    WHEN 'GK' THEN 'POR'
    WHEN 'MID' THEN 'MED'
    WHEN 'FWD' THEN 'DEL'
    ELSE preferred_position
END
WHERE preferred_position IN ('GK', 'MID', 'FWD');

ALTER TABLE futbol.players ADD CONSTRAINT players_preferred_position_check
    CHECK (preferred_position IN ('POR', 'DEF', 'MED', 'DEL'));
