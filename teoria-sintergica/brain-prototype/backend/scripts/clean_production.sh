#!/bin/bash
#
# Script para limpiar grabaciones vacías en PRODUCCIÓN
# 
# IMPORTANTE: Asegúrate de configurar las credenciales correctas en .env.production
#

set -e

cd "$(dirname "$0")/.."

echo "⚠️  LIMPIEZA DE PRODUCCIÓN ⚠️"
echo ""
echo "Este script eliminará grabaciones sin datos de la base de datos de PRODUCCIÓN"
echo "en api.random-lab.es"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production no encontrado"
    echo ""
    echo "Crea el archivo .env.production con las credenciales de producción:"
    echo ""
    cat .env.example | grep -v "^#" | grep -v "^$"
    exit 1
fi

# Load production env vars
export $(grep -v '^#' .env.production | xargs)

echo "📊 Conectando a:"
echo "  PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "  InfluxDB: $INFLUX_URL"
echo ""

# Activate venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run cleanup script in dry-run mode first
echo "🔍 Ejecutando dry-run (no eliminará nada)..."
echo ""
python scripts/clean_empty_recordings.py

echo ""
echo "=================================================="
echo "Para eliminar realmente las grabaciones, ejecuta:"
echo ""
echo "  ./scripts/clean_production.sh --confirm"
echo "=================================================="

# If --confirm flag is present, run actual cleanup
if [ "$1" = "--confirm" ]; then
    echo ""
    echo "⚠️  CONFIRMACIÓN REQUERIDA ⚠️"
    echo ""
    echo "eliminar" | python scripts/clean_empty_recordings.py --confirm
fi
