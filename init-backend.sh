#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV="$SCRIPT_DIR/teoria-sintergica/brain-prototype/backend/venv/bin/activate"
source "$VENV"

# ── Kill any process already on port 8000 ────────────────────────────────────
EXISTING=$(lsof -ti tcp:8000 2>/dev/null || true)
if [[ -n "$EXISTING" ]]; then
  echo "⚠ Puerto 8000 ocupado (PID $EXISTING) — matando proceso..."
  kill -9 $EXISTING 2>/dev/null
  sleep 1
fi

# ── Kill any process already on port 8001 (sanji-rx) ─────────────────────────
EXISTING_SANJI=$(lsof -ti tcp:8001 2>/dev/null || true)
if [[ -n "$EXISTING_SANJI" ]]; then
  echo "⚠ Puerto 8001 ocupado (PID $EXISTING_SANJI) — matando proceso..."
  kill -9 $EXISTING_SANJI 2>/dev/null
  sleep 1
fi

# ── Start SANJI-RX backend on port 8001 (background) ─────────────────────────
echo "🐱 Iniciando SANJI-RX backend en puerto 8001..."
cd "$SCRIPT_DIR/sanji-rx/backend"
uvicorn main:app --reload --port 8001 --log-level warning > /tmp/sanji-rx.log 2>&1 &
SANJI_PID=$!
echo "   PID: $SANJI_PID — log: /tmp/sanji-rx.log"

# Wait briefly and verify it started
sleep 2
if kill -0 $SANJI_PID 2>/dev/null; then
  echo "✅ SANJI-RX listo en http://localhost:8001"
else
  echo "❌ SANJI-RX falló al arrancar — revisá /tmp/sanji-rx.log"
fi

# ── Back to brain-prototype backend ──────────────────────────────────────────
cd "$SCRIPT_DIR/teoria-sintergica/brain-prototype/backend"

# ── Auto-start Cloudflare tunnel in background ─────────────────────────────
rm -f /tmp/cloudflare_tunnel_url
if command -v cloudflared &>/dev/null; then
  echo "🌐 Iniciando Cloudflare tunnel en background..."
  cloudflared tunnel --url http://localhost:8000 > /tmp/cloudflared.log 2>&1 &
  TUNNEL_PID=$!
  echo "   PID: $TUNNEL_PID — log: /tmp/cloudflared.log"
  # Wait up to 15s for tunnel URL to appear
  for i in $(seq 1 15); do
    sleep 1
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1)
    if [[ -n "$url" ]]; then
      echo "$url" > /tmp/cloudflare_tunnel_url
      echo "✅ Túnel activo: $url"
      break
    fi
  done
else
  echo "⚠ cloudflared no encontrado — tracking pixel usará localhost"
fi

uvicorn main:app --reload --port 8000