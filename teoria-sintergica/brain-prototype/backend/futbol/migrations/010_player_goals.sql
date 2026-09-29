-- Fútbol Vaquero — goles por jugador (opcional) al cargar el resultado. Idempotente.
-- NULL = no se sabe. Se usa para el término "Goleadores" del balanceador y, más adelante, estadísticas.

ALTER TABLE futbol.match_teams ADD COLUMN IF NOT EXISTS goals smallint CHECK (goals BETWEEN 0 AND 99);
