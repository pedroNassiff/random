-- Fútbol Vaquero — apertura de inscripción configurable por grupo.
-- Default jueves 00:00 (= comportamiento anterior: día siguiente al partido del miércoles).
-- Días: 0 = domingo … 6 = sábado. Idempotente.

ALTER TABLE futbol.groups ADD COLUMN IF NOT EXISTS signup_open_weekday int NOT NULL DEFAULT 4;
ALTER TABLE futbol.groups ADD COLUMN IF NOT EXISTS signup_open_time time NOT NULL DEFAULT '00:00';
