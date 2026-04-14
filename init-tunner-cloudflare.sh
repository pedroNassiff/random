#!/bin/bash
TUNNEL_URL_FILE="/tmp/cloudflare_tunnel_url"
rm -f "$TUNNEL_URL_FILE"

echo "🌐 Iniciando Cloudflare Tunnel → http://localhost:8000"
echo ""

cloudflared tunnel --url http://localhost:8000 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == *"trycloudflare.com"* ]]; then
    url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [[ -n "$url" ]]; then
      echo "$url" > "$TUNNEL_URL_FILE"
      echo ""
      echo "✅ URL DEL TÚNEL: $url"
      echo "   (guardada en $TUNNEL_URL_FILE — el backend la detecta automáticamente)"
      echo ""
    fi
  fi
done
