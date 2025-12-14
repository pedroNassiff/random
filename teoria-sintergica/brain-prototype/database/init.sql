-- ============================================
-- Teoria Sintérgica - Brain Prototype Database
-- PostgreSQL Initialization Script
-- ============================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Full-text search

-- ============================================
-- TABLA: users
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Configuración flexible en JSON
  settings JSONB DEFAULT '{
    "preferred_meditation": "vipassana",
    "default_target": 0.7,
    "sound_enabled": true,
    "labels_visible": true
  }'::jsonb,
  
  -- Metadata
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- TABLA: practice_sessions
-- ============================================
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
  ) STORED,
  
  -- Configuración de sesión
  target_coherence FLOAT CHECK (target_coherence BETWEEN 0 AND 1),
  meditation_type VARCHAR(50), -- 'vipassana', 'samadhi', 'none'
  
  -- Métricas agregadas (calculadas al final de sesión)
  avg_coherence FLOAT,
  peak_coherence FLOAT,
  min_coherence FLOAT,
  
  avg_alpha FLOAT,
  avg_theta FLOAT,
  avg_beta FLOAT,
  avg_gamma FLOAT,
  avg_delta FLOAT,
  
  avg_plv FLOAT,
  avg_entropy FLOAT,
  
  -- Estado sintérgico
  syntergic_state_duration INTEGER DEFAULT 0, -- segundos en coherence > 0.8 + alpha > 0.6
  syntergic_state_percentage FLOAT, -- % del tiempo en estado sintérgico
  
  -- Logros desbloqueados en esta sesión
  achievements_unlocked TEXT[], -- ['first_contact', 'flow_state']
  
  -- Notas del usuario
  notes TEXT,
  mood_before VARCHAR(50), -- 'calm', 'anxious', 'tired', 'energetic'
  mood_after VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: achievements
-- ============================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(50) NOT NULL, -- 'first_contact', 'steady_mind', etc.
  
  unlocked_at TIMESTAMP DEFAULT NOW(),
  session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
  
  -- Metadata del momento del desbloqueo
  unlock_coherence FLOAT, -- coherencia al momento del logro
  unlock_alpha FLOAT,
  
  UNIQUE(user_id, achievement_key)
);

-- ============================================
-- TABLA: user_stats (cache agregado)
-- ============================================
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Totales
  total_sessions INTEGER DEFAULT 0,
  total_practice_time INTEGER DEFAULT 0, -- segundos totales
  
  -- Records personales
  best_coherence FLOAT DEFAULT 0,
  best_alpha FLOAT DEFAULT 0,
  best_theta FLOAT DEFAULT 0,
  longest_session INTEGER DEFAULT 0, -- segundos
  longest_syntergic_state INTEGER DEFAULT 0, -- segundos consecutivos
  
  -- Logros
  achievements_count INTEGER DEFAULT 0,
  
  -- Última actividad
  last_session_at TIMESTAMP,
  current_streak INTEGER DEFAULT 0, -- días consecutivos practicando
  longest_streak INTEGER DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: session_events (opcional - para timeline)
-- ============================================
CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES practice_sessions(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL, -- 'achievement_unlocked', 'peak_reached', 'state_changed'
  event_data JSONB, -- metadata flexible
  
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Sessions
CREATE INDEX idx_sessions_user_started ON practice_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_meditation_type ON practice_sessions(meditation_type);
CREATE INDEX idx_sessions_duration ON practice_sessions(duration_seconds DESC);

-- Achievements
CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_achievements_key ON achievements(achievement_key);
CREATE INDEX idx_achievements_unlocked ON achievements(unlocked_at DESC);

-- Events
CREATE INDEX idx_events_session ON session_events(session_id, timestamp);
CREATE INDEX idx_events_type ON session_events(event_type);

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función para actualizar user_stats después de cada sesión
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo ejecutar cuando la sesión termina (ended_at se actualiza)
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    INSERT INTO user_stats (user_id, total_sessions, total_practice_time, best_coherence, best_alpha, last_session_at)
    VALUES (
      NEW.user_id,
      1,
      NEW.duration_seconds,
      NEW.peak_coherence,
      NEW.avg_alpha,
      NEW.ended_at
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_sessions = user_stats.total_sessions + 1,
      total_practice_time = user_stats.total_practice_time + NEW.duration_seconds,
      best_coherence = GREATEST(user_stats.best_coherence, NEW.peak_coherence),
      best_alpha = GREATEST(user_stats.best_alpha, NEW.avg_alpha),
      longest_session = GREATEST(user_stats.longest_session, NEW.duration_seconds),
      longest_syntergic_state = GREATEST(user_stats.longest_syntergic_state, NEW.syntergic_state_duration),
      last_session_at = NEW.ended_at,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stats
CREATE TRIGGER trigger_update_user_stats
AFTER UPDATE ON practice_sessions
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();

-- Función para contar achievements
CREATE OR REPLACE FUNCTION update_achievement_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_stats
  SET achievements_count = (
    SELECT COUNT(*) FROM achievements WHERE user_id = NEW.user_id
  ),
  updated_at = NOW()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para contar achievements
CREATE TRIGGER trigger_update_achievement_count
AFTER INSERT ON achievements
FOR EACH ROW
EXECUTE FUNCTION update_achievement_count();

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Usuario de prueba
INSERT INTO users (id, email, name, settings) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@sintergica.com',
  'Test User',
  '{
    "preferred_meditation": "vipassana",
    "default_target": 0.75,
    "sound_enabled": true,
    "labels_visible": true
  }'::jsonb
);

-- Inicializar stats
INSERT INTO user_stats (user_id) VALUES (
  '00000000-0000-0000-0000-000000000001'
);

-- ============================================
-- GRANTS (Seguridad)
-- ============================================

-- Asegurar que el usuario tiene permisos
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO brain_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO brain_user;

-- ============================================
-- COMENTARIOS (Documentación)
-- ============================================

COMMENT ON TABLE users IS 'Usuarios del sistema de neurofeedback';
COMMENT ON TABLE practice_sessions IS 'Sesiones de práctica con métricas agregadas';
COMMENT ON TABLE achievements IS 'Logros desbloqueados por usuarios';
COMMENT ON TABLE user_stats IS 'Cache de estadísticas agregadas por usuario';
COMMENT ON TABLE session_events IS 'Timeline de eventos dentro de sesiones';

COMMENT ON COLUMN practice_sessions.syntergic_state_duration IS 'Segundos con coherence > 0.8 AND alpha > 0.6 (Grinberg)';
COMMENT ON COLUMN user_stats.current_streak IS 'Días consecutivos con al menos una sesión';
