-- Migración para agregar campos de metadata de usuario
-- Fecha: 2026-02-15
-- Descripción: Agregar campos para almacenar información de usuario extraída del storage del navegador

-- 1. Agregar columnas a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS user_identifier VARCHAR(255);

-- 2. Crear índice para email (útil para buscar usuarios por email)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- 3. Crear índice para user_identifier (útil para buscar por ID externo)
CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(user_identifier) WHERE user_identifier IS NOT NULL;

-- 4. Crear tabla para historial de metadata (guardar todos los datos extraídos)
CREATE TABLE IF NOT EXISTS user_metadata_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(50) REFERENCES sessions(session_id) ON DELETE SET NULL,
    metadata JSONB NOT NULL,
    extracted_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Crear índice en user_id para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_metadata_history_user ON user_metadata_history(user_id);

-- 6. Crear índice en session_id
CREATE INDEX IF NOT EXISTS idx_metadata_history_session ON user_metadata_history(session_id);

-- 7. Crear índice GIN en el campo JSONB para búsquedas rápidas en la metadata
CREATE INDEX IF NOT EXISTS idx_metadata_history_data ON user_metadata_history USING GIN (metadata);

-- 8. Agregar comentarios para documentación
COMMENT ON COLUMN users.email IS 'Email del usuario extraído del storage';
COMMENT ON COLUMN users.name IS 'Nombre del usuario extraído del storage';
COMMENT ON COLUMN users.phone IS 'Teléfono del usuario extraído del storage';
COMMENT ON COLUMN users.user_identifier IS 'ID de usuario externo (de otro sistema) extraído del storage';
COMMENT ON TABLE user_metadata_history IS 'Historial completo de metadata extraída del storage del navegador por sesión';
