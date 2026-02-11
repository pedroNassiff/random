-- Analytics Database Schema for Random Portfolio
-- Siguiendo mejores prácticas de GDPR y data analytics

-- ============================================
-- TABLA: users (Anonimizada)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_id VARCHAR(255) UNIQUE NOT NULL, -- Hash anónimo del navegador
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 1,
    total_pageviews INTEGER DEFAULT 0,
    total_time_spent INTEGER DEFAULT 0, -- En segundos
    country VARCHAR(2), -- ISO 3166-1 alpha-2 (e.g., "US", "AR")
    city VARCHAR(100),
    timezone VARCHAR(50),
    language VARCHAR(10), -- e.g., "es", "en", "fr"
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_anonymous_id ON users(anonymous_id);
CREATE INDEX idx_users_last_seen ON users(last_seen DESC);


-- ============================================
-- TABLA: sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Session info
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- En segundos (calculado al finalizar)
    
    -- Device & Browser
    device_type VARCHAR(20), -- "desktop", "mobile", "tablet"
    browser VARCHAR(50), -- "Chrome", "Safari", "Firefox"
    browser_version VARCHAR(20),
    os VARCHAR(50), -- "macOS", "Windows", "iOS", "Android"
    os_version VARCHAR(20),
    screen_width INTEGER,
    screen_height INTEGER,
    
    -- Navigation
    entry_page VARCHAR(500), -- Primera página visitada
    exit_page VARCHAR(500), -- Última página visitada
    pageviews INTEGER DEFAULT 0,
    
    -- Engagement
    total_clicks INTEGER DEFAULT 0,
    total_scroll_depth INTEGER DEFAULT 0, -- Promedio de scroll (0-100%)
    bounce BOOLEAN DEFAULT FALSE, -- True si solo vio 1 página
    
    -- Referrer
    referrer_source VARCHAR(100), -- "google", "direct", "github", "linkedin"
    referrer_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    
    -- Location (anonimizada)
    country VARCHAR(2),
    city VARCHAR(100),
    ip_hash VARCHAR(64), -- Hash SHA256 de la IP (no guardamos IP real)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_country ON sessions(country);
CREATE INDEX idx_sessions_referrer_source ON sessions(referrer_source);


-- ============================================
-- TABLA: pageviews
-- ============================================
CREATE TABLE IF NOT EXISTS pageviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Page info
    page_path VARCHAR(500) NOT NULL, -- "/", "/work", "/work/hermes"
    page_title VARCHAR(200),
    page_section VARCHAR(100), -- "home", "work", "services", "lab", "about"
    
    -- Timing
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_on_page INTEGER, -- En segundos
    
    -- Engagement
    scroll_depth INTEGER, -- 0-100%
    clicks INTEGER DEFAULT 0,
    
    -- Performance
    load_time INTEGER, -- En milisegundos
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pageviews_session_id ON pageviews(session_id);
CREATE INDEX idx_pageviews_user_id ON pageviews(user_id);
CREATE INDEX idx_pageviews_page_path ON pageviews(page_path);
CREATE INDEX idx_pageviews_viewed_at ON pageviews(viewed_at DESC);


-- ============================================
-- TABLA: events (Click tracking & interactions)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Event info
    event_type VARCHAR(50) NOT NULL, -- "click", "scroll", "hover", "view", "form_submit"
    event_name VARCHAR(100) NOT NULL, -- "project_card_click", "nav_click", "cta_click"
    event_category VARCHAR(50), -- "navigation", "engagement", "conversion"
    
    -- Target info
    target_element VARCHAR(100), -- "button", "link", "card", "image"
    target_id VARCHAR(100), -- ID del elemento
    target_text TEXT, -- Texto del elemento clickeado
    target_url VARCHAR(500), -- URL si es un link
    
    -- Context
    page_path VARCHAR(500),
    page_section VARCHAR(100),
    
    -- Data adicional (JSON para flexibilidad)
    event_data JSONB,
    
    -- Timing
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_event_name ON events(event_name);
CREATE INDEX idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX idx_events_event_data ON events USING GIN(event_data);


-- ============================================
-- TABLA: engagement_zones (Zonas de interés)
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Zone info
    page_path VARCHAR(500),
    zone_id VARCHAR(100), -- "hero", "projects", "services", "lab", "about"
    zone_name VARCHAR(100),
    
    -- Engagement metrics
    time_spent INTEGER, -- En segundos (>5 segundos es significativo)
    scroll_reached BOOLEAN DEFAULT FALSE,
    clicked BOOLEAN DEFAULT FALSE,
    
    -- Timing
    entered_at TIMESTAMP WITH TIME ZONE,
    exited_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_engagement_zones_session_id ON engagement_zones(session_id);
CREATE INDEX idx_engagement_zones_zone_id ON engagement_zones(zone_id);
CREATE INDEX idx_engagement_zones_time_spent ON engagement_zones(time_spent DESC);


-- ============================================
-- TABLA: conversions (Objetivos cumplidos)
-- ============================================
CREATE TABLE IF NOT EXISTS conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Conversion info
    conversion_type VARCHAR(50) NOT NULL, -- "project_view", "contact_click", "lab_visit", "full_scroll"
    conversion_value VARCHAR(100),
    
    -- Context
    page_path VARCHAR(500),
    
    -- Timing
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversions_session_id ON conversions(session_id);
CREATE INDEX idx_conversions_conversion_type ON conversions(conversion_type);
CREATE INDEX idx_conversions_converted_at ON conversions(converted_at DESC);


-- ============================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- VISTA: Analytics Dashboard (datos agregados)
-- ============================================
CREATE OR REPLACE VIEW analytics_summary AS
SELECT 
    DATE(s.started_at) as date,
    COUNT(DISTINCT s.user_id) as unique_visitors,
    COUNT(DISTINCT s.id) as total_sessions,
    SUM(s.pageviews) as total_pageviews,
    ROUND(AVG(s.duration), 2) as avg_session_duration,
    ROUND(AVG(s.total_scroll_depth), 2) as avg_scroll_depth,
    COUNT(CASE WHEN s.bounce THEN 1 END) * 100.0 / COUNT(*) as bounce_rate,
    s.country,
    s.referrer_source
FROM sessions s
GROUP BY DATE(s.started_at), s.country, s.referrer_source
ORDER BY date DESC;


-- ============================================
-- VISTA: Páginas más vistas
-- ============================================
CREATE OR REPLACE VIEW top_pages AS
SELECT 
    page_path,
    page_title,
    COUNT(*) as views,
    ROUND(AVG(time_on_page), 2) as avg_time_on_page,
    ROUND(AVG(scroll_depth), 2) as avg_scroll_depth,
    SUM(clicks) as total_clicks
FROM pageviews
WHERE viewed_at > NOW() - INTERVAL '30 days'
GROUP BY page_path, page_title
ORDER BY views DESC
LIMIT 50;


-- ============================================
-- VISTA: Eventos más frecuentes
-- ============================================
CREATE OR REPLACE VIEW top_events AS
SELECT 
    event_name,
    event_type,
    event_category,
    COUNT(*) as event_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    page_path
FROM events
WHERE occurred_at > NOW() - INTERVAL '30 days'
GROUP BY event_name, event_type, event_category, page_path
ORDER BY event_count DESC
LIMIT 50;


-- ============================================
-- VISTA: Zonas de mayor engagement
-- ============================================
CREATE OR REPLACE VIEW top_engagement_zones AS
SELECT 
    zone_id,
    zone_name,
    COUNT(*) as total_visits,
    ROUND(AVG(time_spent), 2) as avg_time_spent,
    COUNT(CASE WHEN time_spent > 5 THEN 1 END) as engaged_visits,
    COUNT(CASE WHEN clicked THEN 1 END) as clicks
FROM engagement_zones
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY zone_id, zone_name
ORDER BY avg_time_spent DESC;
