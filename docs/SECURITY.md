# Security Hardening — random-lab.es

## Architecture

```
Browser / Bot
    │
    ▼
[Vercel CDN] ──── random-lab.es frontend
    │  CSP + security headers (layer 3)
    │
    ▼
[Nginx] ──────── api.random-lab.es → 127.0.0.1:8000
    │  Rate-limit zones + bad-bot map (layer 1)
    │
    ▼
[FastAPI] ──── SecurityMiddleware + TrustedHostMiddleware
               Token-bucket per IP (layer 2)
```

---

## Layer 1 — Nginx (Digital Ocean VPS)

File: `.github/nginx-secure.conf`  
Target: `/etc/nginx/sites-available/brain-backend`

### What it blocks

| Threat | Mechanism |
|--------|-----------|
| Volumetric floods | `limit_req_zone` — 60 r/min general, 20 write, 10 heavy |
| Connection floods | `limit_conn` — max 20 simultaneous per IP |
| Known scanner UAs | `map $http_user_agent $bad_bot` → 403 |
| Scanner paths | `location ~*` → 404 before Python sees it |
| Non-standard methods | `if ($request_method)` → 405 |
| Slow-body attacks | `client_body_timeout 12s` |

### Rate-limit zones (add to `/etc/nginx/nginx.conf` http block)

```nginx
limit_req_zone  $binary_remote_addr  zone=api_general:10m  rate=60r/m;
limit_req_zone  $binary_remote_addr  zone=api_write:10m    rate=20r/m;
limit_req_zone  $binary_remote_addr  zone=api_heavy:10m    rate=10r/m;
limit_conn_zone $binary_remote_addr  zone=conn_limit:10m;
```

### Bad-bot map (add to `/etc/nginx/nginx.conf` http block)

```nginx
map $http_user_agent $bad_bot {
    default          0;
    ~*sqlmap         1;
    ~*nikto          1;
    ~*masscan        1;
    ~*nmap           1;
    ~*(dirbuster|gobuster|wfuzz|ffuf) 1;
    ~*(nuclei|acunetix|nessus|openvas) 1;
    ~*python-requests/2\.2[0-9] 1;
    ~*go-http-client/1\.1       1;
    ""               1;   # empty UA
}
```

### WebSocket exception

`/ws` location has **no rate limit** and 600s timeouts — required for EEG streaming.

---

## Layer 2 — FastAPI middleware

File: `teoria-sintergica/brain-prototype/backend/security.py`

- **Token-bucket** per IP (in-memory, zero deps):
  - General: 60 req/min, burst 20
  - Write (POST/PUT/PATCH/DELETE): 20 req/min, burst 10
  - Heavy (`/analytics/*`, `/automation`): 10 req/min, burst 5
- **Bad UA regex**: blocks same list as Nginx (defence in depth)
- **Scanner path regex**: returns 404
- **`TrustedHostMiddleware`**: rejects requests with unexpected `Host` headers
- Security response headers on every response

---

## Layer 3 — Vercel (frontend)

File: `vercel.json`

Headers applied to all routes:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | `default-src 'self'; connect-src … api.random-lab.es raw.githack.com` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

---

## Deploy

```bash
# Make script executable (first time only)
chmod +x .github/deploy-security.sh

# Run — requires SSH access to root@142.93.47.46
bash .github/deploy-security.sh
```

The script:
1. Patches `/etc/nginx/nginx.conf` with rate-limit zones + bad-bot map (idempotent)
2. Uploads `.github/nginx-secure.conf` → `/etc/nginx/sites-available/brain-backend`
3. Uploads `security.py` to backend
4. Runs `nginx -t && systemctl reload nginx`

---

## Monitoring

```bash
# Watch live blocked requests
ssh root@142.93.47.46 'tail -f /var/log/nginx/brain-backend-error.log'

# Count 429s today
ssh root@142.93.47.46 'grep 429 /var/log/nginx/brain-backend-access.log | wc -l'

# Count 403s (bad bot blocks)
ssh root@142.93.47.46 'grep " 403 " /var/log/nginx/brain-backend-access.log | wc -l'

# Top IPs hitting the API
ssh root@142.93.47.46 'awk "{print \$1}" /var/log/nginx/brain-backend-access.log | sort | uniq -c | sort -rn | head -20'
```

---

## What was intentionally NOT changed

- `/ws` WebSocket timeouts (600s) — needed for EEG data streaming
- CORS origins — same allowlist, no connectivity impact
- All existing API routes — zero functional changes
- `client_max_body_size` left at 10M (EEG files stream via WebSocket, not upload)


# Logs del proceso FastAPI (si corre con systemd)
ssh root@142.93.47.46 'journalctl -u brain-backend -f'

# O si corre con PM2
ssh root@142.93.47.46 'pm2 logs brain-backend'

# Errores Nginx del backend
ssh root@142.93.47.46 'tail -f /var/log/nginx/brain-backend-error.log'

# Accesos recientes al endpoint status
ssh root@142.93.47.46 'grep "/session/status" /var/log/nginx/brain-backend-access.log | tail -30'