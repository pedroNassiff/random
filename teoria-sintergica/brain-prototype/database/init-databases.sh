#!/bin/bash
set -e

echo "🚀 Creando base de datos brain_prototype..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Base de datos principal (brain_prototype)
    CREATE DATABASE brain_prototype;
    GRANT ALL PRIVILEGES ON DATABASE brain_prototype TO brain_user;
EOSQL

echo "✅ brain_prototype creada"

echo "🚀 Creando base de datos random_analytics..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Base de datos de analytics
    CREATE DATABASE random_analytics;
    
    -- Crear usuario específico para analytics
    CREATE USER analytics_user WITH PASSWORD 'random_sanyi_mapuche';
    GRANT ALL PRIVILEGES ON DATABASE random_analytics TO analytics_user;
EOSQL

echo "✅ random_analytics creada"

echo "🎉 Ambas bases de datos listas!"
