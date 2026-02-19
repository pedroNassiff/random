#!/bin/bash
# deploy-security.sh
# Applies all security layers to the Digital Ocean server.
# Run from the root of the repo.
#
# Usage:  bash .github/deploy-security.sh
# Requires: ssh access to root@142.93.47.46

set -e

SERVER="root@142.93.47.46"
NGINX_CONF="/etc/nginx/sites-available/brain-backend"
BACKEND_DIR="/home/brain/random/teoria-sintergica/brain-prototype/backend"

echo "==> [1/4] Patching nginx.conf http block (zones + bot map)..."
ssh "$SERVER" bash << 'REMOTE'
# Idempotent: only insert if not already present
if ! grep -q "zone=api_general" /etc/nginx/nginx.conf; then
cat >> /etc/nginx/nginx.conf << 'EOF'

# ── random-lab security zones (auto-added by deploy-security.sh) ──
limit_req_zone  $binary_remote_addr  zone=api_general:10m  rate=60r/m;
limit_req_zone  $binary_remote_addr  zone=api_write:10m    rate=20r/m;
limit_req_zone  $binary_remote_addr  zone=api_heavy:10m    rate=10r/m;
limit_conn_zone $binary_remote_addr  zone=conn_limit:10m;

map $http_user_agent $bad_bot {
    default          0;
    ~*sqlmap         1;
    ~*nikto          1;
    ~*masscan        1;
    ~*nmap           1;
    ~*dirbuster      1;
    ~*gobuster       1;
    ~*wfuzz          1;
    ~*ffuf           1;
    ~*nuclei         1;
    ~*acunetix       1;
    ~*nessus         1;
    ~*openvas        1;
    ~*python-requests/2\.2[0-9] 1;
    ~*go-http-client/1\.1       1;
    ""               1;
}
EOF
echo "  zones + map added"
else
  echo "  zones already present — skipping"
fi
REMOTE

echo "==> [2/4] Uploading hardened nginx site config..."
scp .github/nginx-secure.conf "$SERVER:$NGINX_CONF"

echo "==> [3/4] Uploading security.py to backend..."
scp teoria-sintergica/brain-prototype/backend/security.py \
    "$SERVER:$BACKEND_DIR/security.py"

echo "==> [4/4] Testing nginx config and reloading..."
ssh "$SERVER" "nginx -t && systemctl reload nginx && echo '  nginx reloaded OK'"

echo ""
echo "Done. Security layers active:"
echo "  - Nginx: rate-limit zones + bad-bot map + scanner path blocks"
echo "  - FastAPI: SecurityMiddleware (token-bucket) + TrustedHostMiddleware"
echo "  - Vercel: CSP + security headers"
echo ""
echo "Monitor with:"
echo "  ssh $SERVER 'tail -f /var/log/nginx/brain-backend-error.log'"
echo "  ssh $SERVER 'grep 429 /var/log/nginx/brain-backend-access.log | wc -l'"
