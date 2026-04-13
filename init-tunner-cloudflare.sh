#!/bin/bash
echo "🌐 Iniciando Cloudflare Tunnel → http://localhost:8000"
echo "   (La URL del túnel aparece abajo — copiala al PitchModal)"
echo ""
cloudflared tunnel --url http://localhost:8000 2>&1 | tee /tmp/cloudflared.log | grep --line-buffered -E "trycloudflare\.com|ERR|error" | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == *"trycloudflare.com"* ]]; then
    url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [[ -n "$url" ]]; then
      echo ""
      echo "✅ URL DEL TÚNEL: $url"
      echo "   Pegá esta URL en el campo del PitchModal"
      echo ""
    fi
  fi
done
