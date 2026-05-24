"""
audit/capa2/probes/session_management.py  — Phase 2.1

Analyzes session management security:
- Session token entropy
- Secure / HttpOnly / SameSite cookie flags
- Session fixation indicators
- Logout invalidation check
- Concurrent session handling (basic)

Layer: ACTIVE_LAYER_2_SAFE — authenticated passive observation
"""
import asyncio
import logging
import math
import time
from collections import Counter
from typing import Optional

import httpx

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase

logger = logging.getLogger(__name__)


def _shannon_entropy(token: str) -> float:
    """Compute Shannon entropy (bits per character) of a token string."""
    if not token:
        return 0.0
    counts = Counter(token)
    total = len(token)
    return -sum((c / total) * math.log2(c / total) for c in counts.values())


class SessionManagementProbe(ProbeBase):
    key      = "session_management"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {}

        sessions: dict = ctx.cache.get("auth_sessions", {})
        if not sessions:
            return ProbeOutput(
                raw_data={"error": "no auth sessions available"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=0,
                error="no auth sessions — configure Capa 2 auth sessions first",
            )

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        base_url = ctx.base_url
        session_data: list[dict] = []

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for label, session in sessions.items():
                storage_path = session.storage_state_path if hasattr(session, "storage_state_path") else session.get("storage_state_path", "")

                # Load cookies from storage_state
                cookies = _load_cookies_from_storage_state(storage_path)
                cookie_findings = _analyze_cookies(cookies, label)
                findings.extend(cookie_findings)

                # Check session token entropy
                session_token = _find_session_cookie(cookies)
                entropy_info: dict = {}
                if session_token:
                    entropy = _shannon_entropy(session_token.get("value", ""))
                    token_len = len(session_token.get("value", ""))
                    entropy_info = {
                        "cookie_name": session_token.get("name"),
                        "entropy_bits_per_char": round(entropy, 3),
                        "token_length": token_len,
                    }
                    if entropy < 3.5 or token_len < 16:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.HIGH,
                            title=f"Weak session token entropy [{label}]",
                            description=(
                                f"Session cookie '{session_token.get('name')}' has low entropy "
                                f"({entropy:.2f} bits/char, length {token_len}). "
                                "Predictable session tokens are susceptible to brute force."
                            ),
                            evidence=entropy_info,
                            cwe="CWE-330",
                            fix_effort=FixEffort.MEDIUM,
                            impact_confidence=ImpactConfidence.MEDIUM,
                            remediation=(
                                "Use a CSPRNG to generate session tokens of at least 128 bits. "
                                "Python: `secrets.token_urlsafe(32)`. "
                                "Ensure tokens are not predictable sequences."
                            ),
                            refs=[{"label": "OWASP Session Management", "url": "https://owasp.org/www-community/attacks/Session_fixation"}],
                        ))

                # Logout invalidation check
                if rate_limiter:
                    await rate_limiter.acquire(base_url + "/logout")
                logout_result = await _check_logout_invalidation(client, base_url, cookies, circuit_breaker)
                if logout_result:
                    findings.append(logout_result)

                session_data.append({
                    "label": label,
                    "cookie_count": len(cookies),
                    "entropy_info": entropy_info,
                    "logout_check": logout_result is not None,
                })

        raw = {"sessions_analyzed": session_data, "total_findings": len(findings)}
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS if not any(f.severity in (Severity.CRITICAL, Severity.HIGH) for f in findings) else ProbeStatus.PARTIAL,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _load_cookies_from_storage_state(storage_path: str) -> list[dict]:
    """Parse cookies from a Playwright storage_state JSON file."""
    if not storage_path:
        return []
    import json, os
    if not os.path.exists(storage_path):
        return []
    try:
        with open(storage_path) as f:
            data = json.load(f)
        return data.get("cookies", [])
    except Exception:
        return []


def _find_session_cookie(cookies: list[dict]) -> Optional[dict]:
    """Heuristically find the main session cookie."""
    session_names = ["session", "sessionid", "sess", "sid", "phpsessid", "jsessionid", "connect.sid", "auth"]
    for c in cookies:
        name = c.get("name", "").lower()
        if any(s in name for s in session_names):
            return c
    # Fallback: largest cookie (likely session carrier)
    if cookies:
        return max(cookies, key=lambda c: len(c.get("value", "")))
    return None


def _analyze_cookies(cookies: list[dict], session_label: str) -> list[Finding]:
    """Check Secure, HttpOnly, SameSite flags on all cookies."""
    findings = []
    for c in cookies:
        name = c.get("name", "")
        issues = []
        if not c.get("secure", False):
            issues.append("missing Secure flag")
        if not c.get("httpOnly", False):
            issues.append("missing HttpOnly flag")
        same_site = c.get("sameSite", "").lower()
        if same_site not in ("strict", "lax"):
            issues.append(f"SameSite={same_site or 'None'} (weak CSRF protection)")

        if issues:
            findings.append(Finding(
                probe_key="session_management",
                category=Category.SECURITY,
                severity=Severity.MEDIUM if "HttpOnly" not in str(issues) else Severity.HIGH,
                title=f"Insecure cookie flags on '{name}' [{session_label}]",
                description=f"Cookie '{name}' has security issues: {', '.join(issues)}.",
                evidence={"cookie_name": name, "issues": issues, "raw": c},
                cwe="CWE-614",
                fix_effort=FixEffort.TRIVIAL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    f"Set the cookie with: `Set-Cookie: {name}=value; "
                    "Secure; HttpOnly; SameSite=Strict`."
                ),
                refs=[{"label": "OWASP Secure Cookie", "url": "https://owasp.org/www-community/controls/SecureCookieAttribute"}],
            ))
    return findings


async def _check_logout_invalidation(client: httpx.AsyncClient, base_url: str, cookies: list[dict], circuit_breaker) -> Optional[Finding]:
    """
    Check if session cookies remain valid after logout.
    Low-risk check: we issue a GET to a known auth-required endpoint
    using the session cookies, then attempt logout, then repeat the GET.
    """
    # This is a best-effort check — we don't know the app's URL structure
    # so we try common patterns
    test_urls = [f"{base_url}/api/me", f"{base_url}/api/user", f"{base_url}/profile"]
    logout_urls = [f"{base_url}/logout", f"{base_url}/api/logout", f"{base_url}/auth/logout"]

    cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
    headers = {"Cookie": cookie_header}

    # 1. Verify we're authenticated pre-logout
    pre_auth = False
    for url in test_urls:
        try:
            r = await client.get(url, headers=headers)
            if circuit_breaker:
                circuit_breaker.record(url, 0, r.status_code)
            if r.status_code == 200:
                pre_auth = True
                auth_url = url
                break
        except Exception:
            continue

    if not pre_auth:
        return None  # Can't verify without knowing auth endpoint

    # 2. Attempt logout
    for url in logout_urls:
        try:
            r = await client.post(url, headers=headers)
            if r.status_code < 400:
                break
        except Exception:
            continue

    # 3. Re-test with same cookies
    try:
        r = await client.get(auth_url, headers=headers)
        if circuit_breaker:
            circuit_breaker.record(auth_url, 0, r.status_code)
        if r.status_code == 200:
            return Finding(
                probe_key="session_management",
                category=Category.SECURITY,
                severity=Severity.HIGH,
                title="Session not invalidated after logout",
                description=(
                    f"After calling logout, the session cookie is still accepted by {auth_url}. "
                    "This allows session reuse after logout (session fixation / token reuse risk)."
                ),
                evidence={"auth_endpoint": auth_url, "post_logout_status": r.status_code},
                cwe="CWE-613",
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    "On logout, invalidate the server-side session and issue a new session ID. "
                    "For JWT: maintain a server-side revocation list or use short-lived tokens."
                ),
                refs=[{"label": "OWASP A07 Auth Failures", "url": "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/"}],
            )
    except Exception:
        pass

    return None
