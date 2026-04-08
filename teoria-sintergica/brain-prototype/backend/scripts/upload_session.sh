#!/bin/bash
#
# upload_session.sh
# Sube una sesión grabada en local a las BBDDs de producción.
#
# Workflow completo automatizado:
#   1. Abre túneles SSH hacia prod
#   2. Ejecuta sync_to_prod.py
#   3. Cierra los túneles
#
# Uso:
#   ./scripts/upload_session.sh           → sube la última sesión grabada
#   ./scripts/upload_session.sh --id 11   → sesión específica
#   ./scripts/upload_session.sh --all     → todas las sesiones locales
#   ./scripts/upload_session.sh --list    → lista sesiones locales (sin subir)
#   ./scripts/upload_session.sh --id 11 --force       → sobreescribir si ya existe
#   ./scripts/upload_session.sh --id 25 --validate    → sync + trigger validation
#   ./scripts/upload_session.sh --id 11 --no-samples  → skip raw EEG (más rápido)
#
# Requiere: .env.prod-db con credenciales de producción
#   cp .env.prod-db.example .env.prod-db  (la primera vez)
#

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
TUNNEL_SCRIPT="$BACKEND_DIR/tunnel-prod-db.sh"
SYNC_SCRIPT="$SCRIPT_DIR/sync_to_prod.py"

# Verificar que existe .env.prod-db
if [ ! -f "$BACKEND_DIR/.env.prod-db" ]; then
  echo "❌ Falta .env.prod-db"
  echo "   cp $BACKEND_DIR/.env.prod-db.example $BACKEND_DIR/.env.prod-db"
  echo "   (luego rellena con las credenciales de producción)"
  exit 1
fi

# Verificar que existe tunnel-prod-db.sh
if [ ! -f "$TUNNEL_SCRIPT" ]; then
  echo "❌ Falta $TUNNEL_SCRIPT"
  exit 1
fi

# Parsear args para pasarlos a sync_to_prod.py
SYNC_ARGS="${*:---last}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  📤 UPLOAD LOCAL SESSION → PRODUCCIÓN"
echo "═══════════════════════════════════════════════════"
echo ""

# Si es solo --list no necesitamos túneles
if [[ "$*" == *"--list"* ]]; then
  source "$BACKEND_DIR/venv/bin/activate" 2>/dev/null || true
  python "$SYNC_SCRIPT" --list
  exit 0
fi

# Abrir túneles SSH en background
echo "🔌 Abriendo túneles SSH hacia producción…"
bash "$TUNNEL_SCRIPT" --bg

# Asegurar que los túneles se cierran al salir (éxito o error)
cleanup() {
  echo ""
  echo "🔌 Cerrando túneles SSH…"
  bash "$TUNNEL_SCRIPT" --kill
}
trap cleanup EXIT

# Esperar un momento a que los túneles estén listos
sleep 1.5

# Activar venv
source "$BACKEND_DIR/venv/bin/activate" 2>/dev/null || true

# Ejecutar sync
echo ""
python "$SYNC_SCRIPT" $SYNC_ARGS

echo ""
echo "═══════════════════════════════════════════════════"
