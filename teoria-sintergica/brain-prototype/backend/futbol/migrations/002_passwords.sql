-- Fútbol Vaquero — login con contraseña.
-- El magic link queda para el primer acceso (crear contraseña) y para "olvidé mi contraseña".
-- Idempotente.

ALTER TABLE futbol.app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE futbol.app_users ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;
