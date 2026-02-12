-- ============================================
-- RANDOM AUTOMATION SCHEMA (Simplified - No Triggers)
-- ============================================

-- Nota: Este script omite triggers que pueden causar conflictos de permisos

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS automation_leads (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    contact_email VARCHAR(255),
    contact_linkedin VARCHAR(500),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    location VARCHAR(255),
    tech_stack JSONB,
    ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
    ai_reasoning TEXT,
    fit_category VARCHAR(50),
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'pending_review',
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    outreach_status VARCHAR(50),
    first_contact_date TIMESTAMP,
    last_contact_date TIMESTAMP,
    contact_attempts INTEGER DEFAULT 0,
    source VARCHAR(100),
    scraped_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON automation_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON automation_leads(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outreach ON automation_leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_company ON automation_leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_created ON automation_leads(created_at DESC);

-- CONTENT LIBRARY TABLE
CREATE TABLE IF NOT EXISTS automation_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    format VARCHAR(50),
    tone VARCHAR(50),
    target_audience VARCHAR(100),
    generated_by VARCHAR(50) DEFAULT 'claude',
    prompt_used TEXT,
    variants JSONB,
    status VARCHAR(50) DEFAULT 'draft',
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    published_to JSONB,
    scheduled_for TIMESTAMP,
    published_at TIMESTAMP,
    views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    conversions INTEGER DEFAULT 0,
    images_urls TEXT[],
    video_url VARCHAR(500),
    tags TEXT[],
    related_project VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_status ON automation_content(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON automation_content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_scheduled ON automation_content(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_published ON automation_content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_created ON automation_content(created_at DESC);

-- CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS automation_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL,
    target_audience JSONB,
    content_ids INTEGER[],
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    scheduled_sends JSONB,
    status VARCHAR(50) DEFAULT 'draft',
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    reply_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON automation_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON automation_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON automation_campaigns(created_at DESC);

-- AUTOMATION LOGS TABLE
CREATE TABLE IF NOT EXISTS automation_logs (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    data_accessed JSONB,
    permissions_used TEXT[],
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,4),
    workflow_id VARCHAR(100),
    execution_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_agent ON automation_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_approval ON automation_logs(requires_approval, approved_at);
CREATE INDEX IF NOT EXISTS idx_logs_date ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_workflow ON automation_logs(workflow_id);

-- AGENT PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS automation_agent_permissions (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    can_read_tables TEXT[],
    can_read_apis TEXT[],
    can_write_tables TEXT[],
    can_write_apis TEXT[],
    cannot_access TEXT[],
    requires_approval_for TEXT[],
    max_requests_per_hour INTEGER,
    max_requests_per_day INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default permissions
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

-- Dashboard summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS automation_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM automation_leads WHERE status = 'pending_review') as leads_pending,
    (SELECT COUNT(*) FROM automation_leads WHERE status = 'approved') as leads_approved,
    (SELECT COALESCE(AVG(ai_score), 0) FROM automation_leads WHERE status = 'approved') as avg_lead_score,
    (SELECT COUNT(*) FROM automation_content WHERE status = 'pending_approval') as content_pending,
    (SELECT COUNT(*) FROM automation_content WHERE status = 'published') as content_published,
    (SELECT COALESCE(AVG(engagement_rate), 0) FROM automation_content WHERE published_at > NOW() - INTERVAL '30 days') as avg_engagement,
    (SELECT COUNT(*) FROM automation_campaigns WHERE status = 'active') as campaigns_active,
    (SELECT COALESCE(SUM(total_sent), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as emails_sent_30d,
    (SELECT COALESCE(AVG(open_rate), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as avg_open_rate,
    (SELECT COUNT(*) FROM automation_logs WHERE requires_approval = TRUE AND approved_at IS NULL) as actions_pending_approval,
    (SELECT COUNT(*) FROM automation_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'failed') as errors_24h,
    NOW() as last_updated;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_automation_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW automation_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Initial test data
INSERT INTO automation_leads 
    (company_name, website, linkedin_url, industry, company_size, location, ai_score, ai_reasoning, fit_category, tags, source)
VALUES
    ('Example SaaS Inc', 'https://example.com', 'https://linkedin.com/company/example', 
     'Software', '51-200', 'Barcelona, Spain', 
     85, 'Empresa de SaaS B2B en crecimiento, buen fit para digitalización', 'high',
     ARRAY['b2b-saas', 'barcelona', 'tech']::TEXT[], 'manual')
ON CONFLICT DO NOTHING;

INSERT INTO automation_content
    (title, body, content_type, tone, target_audience, generated_by, status, tags)
VALUES
    ('¿Y si el mejor plan es no tenerlo?', 
     'En Random, perturbamos primero, observamos después, y construimos con lo que emerge. No vendemos soluciones — cocreamos descubrimientos.',
     'linkedin_post', 'philosophical', 'CTOs', 'claude', 'draft',
     ARRAY['filosofia', 'innovacion']::TEXT[])
ON CONFLICT DO NOTHING;

-- Initial dashboard refresh
SELECT refresh_automation_dashboard();
