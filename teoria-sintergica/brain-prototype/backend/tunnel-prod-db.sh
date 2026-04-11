#!/bin/bash
#
# tunnel-prod-db.sh
#
# Abre túneles SSH hacia las BBDDs de producción.
# Se usa SOLO para subir sesiones grabadas en local → producción.
# El backend y Muse siempre corren contra BBDDs locales.
#
# Workflow de subida:
#   1. ./tunnel-prod-db.sh --bg          # abre túneles
#   2. python scripts/sync_to_prod.py    # sube sesiones
#   3. ./tunnel-prod-db.sh --kill        # cierra túneles
#
# O en una sola línea:
#   ./scripts/upload_session.sh [session_id]
#
# Mapeo de puertos:
#   localhost:5433  ←→  prod:5432  (PostgreSQL)
#   localhost:8087  ←→  prod:8086  (InfluxDB)
#

PROD_HOST="${PROD_SSH_HOST:-api.random-lab.es}"
PROD_USER="${PROD_SSH_USER:-root}"

PG_LOCAL_PORT=5433
PG_REMOTE_PORT=5432
INFLUX_LOCAL_PORT=8087
INFLUX_REMOTE_PORT=8086

PID_FILE="/tmp/brain-prod-tunnels.pid"

# ── helpers ───────────────────────────────────────────────────────────────────
kill_tunnels() {
  if [ -f "$PID_FILE" ]; then
    echo "⏹  Cerrando túneles (PID $(cat $PID_FILE))…"
    kill "$(cat $PID_FILE)" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "✓ Túneles cerrados"
  else
    echo "ℹ️  No hay túneles activos (sin PID file)"
  fi
}

start_tunnels() {
  echo "🔌 Abriendo túneles SSH hacia $PROD_USER@$PROD_HOST …"
  echo "   localhost:$PG_LOCAL_PORT  →  prod:$PG_REMOTE_PORT  (PostgreSQL)"
  echo "   localhost:$INFLUX_LOCAL_PORT →  prod:$INFLUX_REMOTE_PORT (InfluxDB)"
  echo ""

  ssh -N \
    -L "${PG_LOCAL_PORT}:localhost:${PG_REMOTE_PORT}" \
    -L "${INFLUX_LOCAL_PORT}:localhost:${INFLUX_REMOTE_PORT}" \
    "${PROD_USER}@${PROD_HOST}"
}

start_tunnels_bg() {
  echo "🔌 Abriendo túneles SSH en background hacia $PROD_USER@$PROD_HOST …"

  ssh -f -N \
    -L "${PG_LOCAL_PORT}:localhost:${PG_REMOTE_PORT}" \
    -L "${INFLUX_LOCAL_PORT}:localhost:${INFLUX_REMOTE_PORT}" \
    "${PROD_USER}@${PROD_HOST}"

  # Guardar PID del proceso ssh que acabamos de lanzar
  SSH_PID=$(pgrep -n -f "ssh -f -N -L ${PG_LOCAL_PORT}" || true)
  echo "$SSH_PID" > "$PID_FILE"

  echo "✓ Túneles activos (PID $SSH_PID)"
  echo "   PostgreSQL  → conecta en localhost:$PG_LOCAL_PORT"
  echo "   InfluxDB    → conecta en localhost:$INFLUX_LOCAL_PORT"
  echo ""
  echo "Para cerrar:  ./tunnel-prod-db.sh --kill"
}

# ── main ──────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --kill)
    kill_tunnels
    ;;
  --bg)
    start_tunnels_bg
    ;;
  *)
    start_tunnels   # bloquea hasta Ctrl+C
    ;;
esac
