-- ============================================
-- RANDOM AUTOMATION SCHEMA
-- Extension de la DB existente de analytics
-- ============================================

-- Este script NO toca las tablas de analytics existentes
-- Solo agrega nuevas tablas para el sistema de automatización

BEGIN;

-- ============================================
-- LEADS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_leads (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    
    -- Datos de contacto
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    contact_email VARCHAR(255),
    contact_linkedin VARCHAR(500),
    
    -- Datos de la empresa
    industry VARCHAR(100),
    company_size VARCHAR(50), -- "1-10", "11-50", "51-200", etc.
    location VARCHAR(255),
    tech_stack JSONB, -- {"frontend": ["React", "Vue"], "backend": ["Node", "Python"]}
    
    -- Scoring y cualificación
    ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
    ai_reasoning TEXT, -- Por qué Claude le dio ese score
    fit_category VARCHAR(50), -- "high", "medium", "low"
    tags TEXT[], -- ["b2b-saas", "healthcare", "AI-ready"]
    
    -- Estado del lead
    status VARCHAR(50) DEFAULT 'pending_review', 
    -- 'pending_review', 'approved', 'rejected', 'contacted', 'converted'
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Outreach
    outreach_status VARCHAR(50), -- 'not_contacted', 'email_sent', 'linkedin_message_sent', 'replied', 'meeting_scheduled'
    first_contact_date TIMESTAMP,
    last_contact_date TIMESTAMP,
    contact_attempts INTEGER DEFAULT 0,
    
    -- Metadata
    source VARCHAR(100), -- "linkedin_scraper", "manual", "referral"
    scraped_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_leads_status ON automation_leads(status);
CREATE INDEX idx_leads_score ON automation_leads(ai_score DESC);
CREATE INDEX idx_leads_outreach ON automation_leads(outreach_status);
CREATE INDEX idx_leads_company ON automation_leads(company_name);
CREATE INDEX idx_leads_created ON automation_leads(created_at DESC);

COMMENT ON TABLE automation_leads IS 'Leads scraped y cualificados por IA';
COMMENT ON COLUMN automation_leads.ai_score IS 'Score 0-100 asignado por Claude basado en fit con Random';
COMMENT ON COLUMN automation_leads.tech_stack IS 'JSON con tecnologías que usa la empresa';

-- ============================================
-- CONTENT LIBRARY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_content (
    id SERIAL PRIMARY KEY,
    
    -- Contenido
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- "linkedin_post", "twitter_thread", "email", "blog_post"
    format VARCHAR(50), -- "text", "carousel", "video_script"
    
    -- Tono y estilo
    tone VARCHAR(50), -- "philosophical", "technical", "inspirational"
    target_audience VARCHAR(100), -- "CTOs", "founders", "developers"
    
    -- IA metadata
    generated_by VARCHAR(50) DEFAULT 'claude', -- "claude", "human", "hybrid"
    prompt_used TEXT, -- El prompt que se usó para generar
    variants JSONB, -- Array de variantes A/B
    
    -- Estado
    status VARCHAR(50) DEFAULT 'draft',
    -- 'draft', 'pending_approval', 'approved', 'published', 'rejected'
    
    -- Aprobación
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Publicación
    published_to JSONB, -- {"linkedin": "2024-02-12", "twitter": null}
    scheduled_for TIMESTAMP,
    published_at TIMESTAMP,
    
    -- Performance (se conecta con analytics)
    views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    conversions INTEGER DEFAULT 0,
    
    -- Assets relacionados
    images_urls TEXT[],
    video_url VARCHAR(500),
    
    -- Metadata
    tags TEXT[],
    related_project VARCHAR(100), -- Si el contenido habla de un proyecto específico
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_status ON automation_content(status);
CREATE INDEX idx_content_type ON automation_content(content_type);
CREATE INDEX idx_content_scheduled ON automation_content(scheduled_for);
CREATE INDEX idx_content_published ON automation_content(published_at DESC);
CREATE INDEX idx_content_created ON automation_content(created_at DESC);

COMMENT ON TABLE automation_content IS 'Librería de contenido generado por IA y humanos';
COMMENT ON COLUMN automation_content.variants IS 'JSON con variantes A/B del contenido';
COMMENT ON COLUMN automation_content.engagement_rate IS 'Porcentaje de engagement (calculado desde analytics)';

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_campaigns (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL, -- "outreach", "newsletter", "social_campaign"
    
    -- Configuración
    target_audience JSONB, -- Filtros de leads o segmentos
    content_ids INTEGER[], -- Referencias a automation_content
    
    -- Timing
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    scheduled_sends JSONB, -- Array de fechas programadas
    
    -- Estado
    status VARCHAR(50) DEFAULT 'draft',
    -- 'draft', 'active', 'paused', 'completed', 'cancelled'
    
    -- Performance
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    
    -- Rates (calculados)
    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    reply_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON automation_campaigns(status);
CREATE INDEX idx_campaigns_type ON automation_campaigns(campaign_type);
CREATE INDEX idx_campaigns_created ON automation_campaigns(created_at DESC);

COMMENT ON TABLE automation_campaigns IS 'Campañas de comunicación (email, social, outreach)';
COMMENT ON COLUMN automation_campaigns.target_audience IS 'JSON con filtros de segmentación';

-- ============================================
-- AUTOMATION LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_logs (
    id SERIAL PRIMARY KEY,
    
    -- Qué agente hizo qué
    agent_name VARCHAR(100) NOT NULL, -- "content_generator", "lead_scraper", "email_sender"
    action_type VARCHAR(100) NOT NULL, -- "generate_content", "scrape_leads", "send_email"
    
    -- Input/Output
    input_data JSONB, -- Lo que recibió el agente
    output_data JSONB, -- Lo que produjo
    
    -- Estado
    status VARCHAR(50) NOT NULL, -- "success", "failed", "pending_approval"
    error_message TEXT,
    
    -- Permisos y acceso (importante para seguridad)
    data_accessed JSONB, -- {"tables": ["leads"], "apis": ["claude", "linkedin"]}
    permissions_used TEXT[],
    
    -- Aprobación (si requirió)
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    
    -- Performance
    execution_time_ms INTEGER,
    tokens_used INTEGER, -- Si usó Claude API
    cost_usd DECIMAL(10,4), -- Costo de la operación
    
    -- Metadata
    workflow_id VARCHAR(100), -- ID del workflow de n8n
    execution_id VARCHAR(100), -- ID de ejecución de n8n
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_agent ON automation_logs(agent_name);
CREATE INDEX idx_logs_status ON automation_logs(status);
CREATE INDEX idx_logs_approval ON automation_logs(requires_approval, approved_at);
CREATE INDEX idx_logs_date ON automation_logs(created_at DESC);
CREATE INDEX idx_logs_workflow ON automation_logs(workflow_id);

COMMENT ON TABLE automation_logs IS 'Log completo de todas las acciones de automatización para auditoría';
COMMENT ON COLUMN automation_logs.data_accessed IS 'JSON con detalle de qué datos accedió el agente';
COMMENT ON COLUMN automation_logs.cost_usd IS 'Costo de la operación (APIs, etc)';

-- ============================================
-- AGENT PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_agent_permissions (
    id SERIAL PRIMARY KEY,
    
    -- Agente
    agent_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Permisos de lectura
    can_read_tables TEXT[], -- ["leads", "content"]
    can_read_apis TEXT[], -- ["claude", "linkedin_public"]
    
    -- Permisos de escritura
    can_write_tables TEXT[], -- ["content", "logs"]
    can_write_apis TEXT[], -- ["resend", "linkedin"]
    
    -- Restricciones
    cannot_access TEXT[], -- ["users.email", "financial_data"]
    requires_approval_for TEXT[], -- ["publish_content", "send_email"]
    
    -- Rate limits
    max_requests_per_hour INTEGER,
    max_requests_per_day INTEGER,
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE automation_agent_permissions IS 'Permisos granulares de cada agente para control de acceso';
COMMENT ON COLUMN automation_agent_permissions.requires_approval_for IS 'Acciones que requieren aprobación humana';

-- Insertar permisos por defecto
INSERT INTO automation_agent_permissions 
    (agent_name, description, can_read_tables, can_write_tables, can_read_apis, requires_approval_for, max_requests_per_hour, max_requests_per_day) 
VALUES
    ('content_generator', 'Genera contenido con IA', 
     ARRAY['automation_content']::TEXT[], 
     ARRAY['automation_content', 'automation_logs']::TEXT[],
     ARRAY['claude']::TEXT[],
     ARRAY['publish_content']::TEXT[], 
     100, 1000),
     
    ('lead_scraper', 'Scraper de LinkedIn', 
     ARRAY[]::TEXT[], 
     ARRAY['automation_leads', 'automation_logs']::TEXT[],
     ARRAY['apify', 'linkedin_public']::TEXT[],
     ARRAY['approve_leads']::TEXT[], 
     50, 200),
     
    ('email_sender', 'Envía emails de campañas', 
     ARRAY['automation_leads', 'automation_content']::TEXT[], 
     ARRAY['automation_campaigns', 'automation_logs']::TEXT[],
     ARRAY['resend']::TEXT[],
     ARRAY['send_email']::TEXT[], 
     200, 2000),
     
    ('social_publisher', 'Publica en redes sociales', 
     ARRAY['automation_content']::TEXT[], 
     ARRAY['automation_content', 'automation_logs']::TEXT[],
     ARRAY['linkedin', 'twitter']::TEXT[],
     ARRAY['publish_content']::TEXT[], 
     50, 200)
ON CONFLICT (agent_name) DO NOTHING;

-- ============================================
-- VIEWS & ANALYTICS
-- ============================================

-- Vista: Dashboard summary
CREATE MATERIALIZED VIEW IF NOT EXISTS automation_dashboard_summary AS
SELECT 
    -- Leads
    (SELECT COUNT(*) FROM automation_leads WHERE status = 'pending_review') as leads_pending,
    (SELECT COUNT(*) FROM automation_leads WHERE status = 'approved') as leads_approved,
    (SELECT COALESCE(AVG(ai_score), 0) FROM automation_leads WHERE status = 'approved') as avg_lead_score,
    
    -- Content
    (SELECT COUNT(*) FROM automation_content WHERE status = 'pending_approval') as content_pending,
    (SELECT COUNT(*) FROM automation_content WHERE status = 'published') as content_published,
    (SELECT COALESCE(AVG(engagement_rate), 0) FROM automation_content WHERE published_at > NOW() - INTERVAL '30 days') as avg_engagement,
    
    -- Campaigns
    (SELECT COUNT(*) FROM automation_campaigns WHERE status = 'active') as campaigns_active,
    (SELECT COALESCE(SUM(total_sent), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as emails_sent_30d,
    (SELECT COALESCE(AVG(open_rate), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as avg_open_rate,
    
    -- Logs y auditoría
    (SELECT COUNT(*) FROM automation_logs WHERE requires_approval = TRUE AND approved_at IS NULL) as actions_pending_approval,
    (SELECT COUNT(*) FROM automation_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'failed') as errors_24h,
    
    -- Timestamp
    NOW() as last_updated;

COMMENT ON MATERIALIZED VIEW automation_dashboard_summary IS 'Resumen de métricas para el dashboard de automatización';

-- Función para refresh automático del dashboard
CREATE OR REPLACE FUNCTION refresh_automation_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW automation_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_automation_dashboard IS 'Actualiza la vista materializada del dashboard';

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas relevantes
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON automation_leads
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at 
    BEFORE UPDATE ON automation_content
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON automation_campaigns
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON automation_agent_permissions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Crear un lead de ejemplo para testing
INSERT INTO automation_leads 
    (company_name, website, linkedin_url, industry, company_size, location, ai_score, ai_reasoning, fit_category, tags, source)
VALUES
    ('Example SaaS Inc', 'https://example.com', 'https://linkedin.com/company/example', 
     'Software', '51-200', 'Barcelona, Spain', 
     85, 'Empresa de SaaS B2B en crecimiento, buen fit para digitalización', 'high',
     ARRAY['b2b-saas', 'barcelona', 'tech']::TEXT[], 'manual')
ON CONFLICT DO NOTHING;

-- Crear contenido de ejemplo
INSERT INTO automation_content
    (title, body, content_type, tone, target_audience, generated_by, status, tags)
VALUES
    ('¿Y si el mejor plan es no tenerlo?', 
     'En Random, perturbamos primero, observamos después, y construimos con lo que emerge. No vendemos soluciones — cocreamos descubrimientos.',
     'linkedin_post', 'philosophical', 'CTOs', 'claude', 'draft',
     ARRAY['filosofia', 'innovacion']::TEXT[])
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Ejecutar después del setup para verificar

-- SELECT 'Leads table:' as check_name, COUNT(*) as records FROM automation_leads;
-- SELECT 'Content table:' as check_name, COUNT(*) as records FROM automation_content;
-- SELECT 'Campaigns table:' as check_name, COUNT(*) as records FROM automation_campaigns;
-- SELECT 'Logs table:' as check_name, COUNT(*) as records FROM automation_logs;
-- SELECT 'Permissions table:' as check_name, COUNT(*) as records FROM automation_agent_permissions;
-- SELECT * FROM automation_dashboard_summary;

-- ============================================
-- MAINTENANCE
-- ============================================

-- Script para ejecutar semanalmente (crear cronjob)
-- Limpia logs antiguos y refresca dashboard

-- DELETE FROM automation_logs WHERE created_at < NOW() - INTERVAL '90 days';
-- SELECT refresh_automation_dashboard();
-- VACUUM ANALYZE automation_logs;