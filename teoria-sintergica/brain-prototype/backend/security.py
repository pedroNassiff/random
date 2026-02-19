"""
security.py — Rate limiting + bot/abuse protection middleware for FastAPI.
Adds zero connectivity risk: only blocks/throttles abuse patterns.
"""

import time
import re
from collections import defaultdict, deque
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ─────────────────────────────────────────────────────────────────────────────
# In-memory token-bucket rate limiter
# Simple, zero-dependency — for a single-process uvicorn server.
# If you scale to multiple workers, swap this for Redis + slowapi.
# ─────────────────────────────────────────────────────────────────────────────

class _TokenBucket:
    """Thread-unsafe but fine for async uvicorn single process."""
    __slots__ = ("tokens", "last_refill", "rate", "capacity")

    def __init__(self, rate: float, capacity: int):
        self.rate = rate          # tokens per second
        self.capacity = capacity  # burst ceiling
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def consume(self, n: float = 1.0) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now
        if self.tokens >= n:
            self.tokens -= n
            return True
        return False


class _BucketStore:
    """Per-IP bucket store with automatic eviction of idle entries."""
    def __init__(self, rate: float, capacity: int, evict_after: float = 300.0):
        self._buckets: dict[str, _TokenBucket] = {}
        self._last_seen: dict[str, float] = {}
        self._evict_after = evict_after
        self._rate = rate
        self._capacity = capacity

    def get(self, key: str) -> _TokenBucket:
        now = time.monotonic()
        # Lazy eviction: clean up keys not seen for evict_after seconds
        if len(self._buckets) > 5000:
            dead = [k for k, t in self._last_seen.items() if now - t > self._evict_after]
            for k in dead:
                self._buckets.pop(k, None)
                self._last_seen.pop(k, None)
        if key not in self._buckets:
            self._buckets[key] = _TokenBucket(self._rate, self._capacity)
        self._last_seen[key] = now
        return self._buckets[key]


# ─────────────────────────────────────────────────────────────────────────────
# Rate limit tiers:
#   PUBLIC  — general API: 60 req/min, burst 20
#   WRITE   — POST/PUT endpoints: 20 req/min, burst 10
#   HEAVY   — analytics batch / automation: 10 req/min, burst 5
# ─────────────────────────────────────────────────────────────────────────────

_public_store = _BucketStore(rate=60 / 60, capacity=20)    # 1 req/s avg, burst 20
_write_store  = _BucketStore(rate=20 / 60, capacity=10)    # 1 req/3s avg, burst 10
_heavy_store  = _BucketStore(rate=10 / 60, capacity=5)     # 1 req/6s avg, burst 5

HEAVY_PATHS = {"/analytics/events", "/analytics/batch", "/automation"}

# ─────────────────────────────────────────────────────────────────────────────
# Known bad User-Agent patterns (scanner tools, exploit kits)
# ─────────────────────────────────────────────────────────────────────────────

_BAD_UA_RE = re.compile(
    r"(sqlmap|nikto|masscan|nmap|zgrab|python-requests/2\.2[0-9]"
    r"|go-http-client/1\.1|curl/7\.[0-4]"           # generic scanners
    r"|dirbuster|gobuster|wfuzz|dirb|ffuf"           # directory fuzzers
    r"|nuclei|acunetix|nessus|openvas"               # vuln scanners
    r"|bot|crawl|spider|scrape|slurp|wget)"          # generic bots
    r"",
    re.IGNORECASE,
)

# Paths that are only hit by scanners — never by legitimate users
_SCANNER_PATHS = re.compile(
    r"^/(wp-admin|wp-login|wp-content|phpmyadmin|\.env"
    r"|\.git|\.htaccess|\.DS_Store|admin|config"
    r"|cgi-bin|shell|eval|xmlrpc|actuator"
    r"|etc/passwd|proc/self|vendor/phpunit)",
    re.IGNORECASE,
)


def _get_ip(request: Request) -> str:
    """Extract real client IP, honouring X-Real-IP set by nginx."""
    forwarded = request.headers.get("X-Real-IP")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Middleware
# ─────────────────────────────────────────────────────────────────────────────

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Layered security checks (cheapest first):
    1. Block obvious scanner paths instantly (no bucket consumed)
    2. Block known-bad User-Agents with 403
    3. Rate-limit by tier based on method + path
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        ua   = request.headers.get("user-agent", "")
        ip   = _get_ip(request)
        method = request.method.upper()

        # ── 1. Hard-block scanner paths ──────────────────────────────────────
        if _SCANNER_PATHS.search(path):
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )

        # ── 2. Bad User-Agent block ───────────────────────────────────────────
        if ua and _BAD_UA_RE.search(ua):
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden"},
                headers={"Retry-After": "3600"},
            )

        # ── 3. Tiered rate limiting ───────────────────────────────────────────
        # Select store
        if any(path.startswith(p) for p in HEAVY_PATHS):
            store = _heavy_store
            window_label = "heavy"
        elif method in ("POST", "PUT", "PATCH", "DELETE"):
            store = _write_store
            window_label = "write"
        else:
            store = _public_store
            window_label = "public"

        bucket = store.get(ip)
        if not bucket.consume():
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests",
                    "tier": window_label,
                    "hint": "Back off and retry after a few seconds",
                },
                headers={
                    "Retry-After": "10",
                    "X-RateLimit-Limit": str(bucket.capacity),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # ── 4. Security response headers ─────────────────────────────────────
        response = await call_next(request)
        response.headers.update({
            "X-Content-Type-Options":  "nosniff",
            "X-Frame-Options":         "DENY",
            "Referrer-Policy":         "strict-origin-when-cross-origin",
            "X-XSS-Protection":        "1; mode=block",
            "Permissions-Policy":      "geolocation=(), microphone=(), camera=()",
            # Don't expose server internals
            "Server":                  "random-lab",
        })
        return response
