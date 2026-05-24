"""
audit/capa2/config.py

Rate limits and operational constants for Capa 2 probes.
Hardcoded by design — not overridable via probe arguments (policy decision).
"""

# ── Rate limits per environment ───────────────────────────────────────────────

RATE_LIMITS: dict[str, dict] = {
    "production": {
        "max_rps_per_endpoint": 2,
        "max_concurrent_probes": 1,
        "pause_between_probes_s": 5,
        "circuit_breaker_response_time_multiplier": 2.0,
        "circuit_breaker_error_rate_pct": 5,
    },
    "staging": {
        "max_rps_per_endpoint": 10,
        "max_concurrent_probes": 3,
        "pause_between_probes_s": 1,
        "circuit_breaker_response_time_multiplier": 5.0,
        "circuit_breaker_error_rate_pct": 20,
    },
}

# ── Preflight checklist ───────────────────────────────────────────────────────

PREFLIGHT_CHECKS: list[str] = [
    "consent_documents_signed_and_filed",
    "scope_doc_present_and_signed",
    "emergency_contacts_configured",
    "kill_switch_endpoint_responsive",
    "rate_limiter_configured_for_environment",
    "auth_sessions_valid",
    "ip_whitelisted_in_waf",
    "logging_to_persistent_storage_verified",
    "backup_confirmed_recent_by_client",
    "baseline_metrics_captured",
]

# ── SQLi detection payloads — detection only, no extraction ──────────────────

SQLI_PAYLOADS: list[str] = [
    "'",
    "1' OR '1'='1",
    "1 AND 1=1--",
    "'; --",
    "\" OR \"\"=\"",
]

# ── XSS detection payloads — console marker only ─────────────────────────────

XSS_PAYLOADS: list[str] = [
    "<script>console.log('audit-marker')</script>",
    '"><img src=x onerror=console.log(1)>',
    "'><svg onload=console.log(1)>",
]

# ── SSRF detection targets — local only, NO cloud metadata ───────────────────

SSRF_TARGETS: list[str] = [
    "http://127.0.0.1",
    "http://localhost",
    "http://0.0.0.0",
    "http://[::1]",
]

# ── Command injection timing payloads ─────────────────────────────────────────

CMD_INJECTION_PAYLOADS: list[str] = [
    "; sleep 3",
    "| sleep 3",
    "& sleep 3",
    "`sleep 3`",
    "$(sleep 3)",
]
CMD_INJECTION_TIMING_THRESHOLD_S: float = 2.5  # seconds

# ── JS secret patterns (regex) ────────────────────────────────────────────────

JS_SECRET_PATTERNS: list[str] = [
    r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}",
    r"(?i)(secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}",
    r"(?i)password\s*[:=]\s*['\"][^'\"]{8,}",
    r"(?i)(aws|gcp|azure)[_-]?(access[_-]?key|secret)\s*[:=]",
    r"-----BEGIN (RSA |EC )?PRIVATE KEY-----",
    r"(?i)bearer\s+[A-Za-z0-9\-._~+/=]{20,}",
]

# ── IDOR max resources to verify (detection-not-exploitation limits) ──────────

IDOR_MAX_RESOURCES_PROD    = 2
IDOR_MAX_RESOURCES_STAGING = 10
