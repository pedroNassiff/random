#!/bin/bash
cd teoria-sintergica/brain-prototype/backend
source venv/bin/activate

# ── Kill any process already on port 8000 ────────────────────────────────────
EXISTING=$(lsof -ti tcp:8000 2>/dev/null)
if [[ -n "$EXISTING" ]]; then
  echo "⚠ Puerto 8000 ocupado (PID $EXISTING) — matando proceso..."
  kill -9 $EXISTING 2>/dev/null
  sleep 1
fi

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
