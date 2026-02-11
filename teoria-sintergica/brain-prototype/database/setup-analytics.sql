-- ============================================
-- Setup Analytics Database
-- ============================================

-- Create analytics database
CREATE DATABASE random_analytics;

-- Create analytics user
CREATE USER analytics_user WITH PASSWORD 'random_sanyi_mapuche';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE random_analytics TO analytics_user;

-- Connect to analytics database and grant schema privileges
\c random_analytics

GRANT ALL ON SCHEMA public TO analytics_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO analytics_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO analytics_user;
