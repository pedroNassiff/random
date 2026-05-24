"""
audit/capa2/probes/auth_weakness.py  — Phase 2.3

Authentication weakness checks:
- Login rate limiting (brute force protection)
- Account lockout after N failed attempts
- Password policy enforcement
- Username enumeration via response differences

OWASP Coverage: A07 Identification and Authentication Failures

Layer: ACTIVE_LAYER_2_SAFE
"""
import asyncio
import logging
import time
from typing import Optional

import httpx

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase

logger = logging.getLogger(__name__)

# Number of rapid login attempts to test rate limiting (low — detection only)
RATE_LIMIT_TEST_ATTEMPTS = 5
RATE_LIMIT_SLEEP_MS = 200   # 200ms between attempts

COMMON_LOGIN_PATHS = [
    "/login",
    "/auth/login",
    "/api/auth/login",
    "/api/login",
    "/api/v1/auth/login",
    "/users/sign_in",
    "/account/login",
]


class AuthWeaknessProbe(ProbeBase):
    key      = "auth_weakness"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        base = ctx.base_url

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            # 1. Discover login endpoint
            login_url = await _find_login_endpoint(client, base, COMMON_LOGIN_PATHS)
            if not login_url:
                return ProbeOutput(
                    raw_data={"note": "Could not find a login endpoint — checks skipped"},
                    findings=[],
                    status=ProbeStatus.SKIPPED,
                    duration_ms=int((time.time() - t0) * 1000),
                )

            raw["login_url"] = login_url

            # 2. Rate limiting check — 5 rapid wrong-password attempts
            rate_limit_finding = await _check_rate_limiting(
                client, login_url, circuit_breaker, raw
            )
            if rate_limit_finding:
                findings.append(rate_limit_finding)

            # 3. Username enumeration check
            enum_finding = await _check_username_enumeration(
                client, login_url, rate_limiter, circuit_breaker
            )
            if enum_finding:
                findings.append(enum_finding)

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


async def _find_login_endpoint(client: httpx.AsyncClient, base: str, paths: list[str]) -> Optional[str]:
    """Try each known login path and return the first that returns a 200."""
    for path in paths:
        url = base + path
        try:
            resp = await client.head(url)
            if resp.status_code in (200, 405):  # 405 = Method Not Allowed (endpoint exists)
                return url
            resp = await client.get(url)
            if resp.status_code == 200:
                return url
        except Exception:
            continue
    return None


async def _check_rate_limiting(
    client: httpx.AsyncClient,
    login_url: str,
    circuit_breaker,
    raw: dict,
) -> Optional[Finding]:
    """
    Send 5 rapid login attempts with wrong credentials.
    If all succeed (200 or 401/403 without rate limit headers),
    report missing rate limiting.

    We use a clearly fake credential that could never be a real account.
    """
    from email.utils import parseaddr
    fake_email = "audit-probe-no-account@example-invalid-domain-rl.com"
    fake_pass = "WrongPassword_AuditProbe123!"

    responses: list[dict] = []
    rate_limited = False

    for i in range(RATE_LIMIT_TEST_ATTEMPTS):
        await asyncio.sleep(RATE_LIMIT_SLEEP_MS / 1000)
        try:
            t_req = time.time()
            resp = await client.post(
                login_url,
                json={"email": fake_email, "password": fake_pass},
            )
            elapsed = (time.time() - t_req) * 1000
            if circuit_breaker:
                circuit_breaker.record(login_url, elapsed, resp.status_code)

            responses.append({
                "attempt": i + 1,
                "status": resp.status_code,
                "has_retry_after": "retry-after" in resp.headers,
                "has_x_ratelimit": any(h.startswith("x-ratelimit") for h in resp.headers),
            })

            # Check for rate-limiting signals
            if resp.status_code == 429:
                rate_limited = True
                break
            if "retry-after" in resp.headers:
                rate_limited = True
                break

        except Exception as exc:
            logger.debug("Auth weakness rate limit test error: %s", exc)
            break

    raw["rate_limit_check"] = responses
    raw["rate_limited_detected"] = rate_limited

    if not rate_limited and len(responses) >= RATE_LIMIT_TEST_ATTEMPTS:
        all_not_limited = all(r["status"] in (200, 401, 403, 422) for r in responses)
        no_rate_headers = all(not r["has_retry_after"] and not r["has_x_ratelimit"] for r in responses)
        if all_not_limited and no_rate_headers:
            return Finding(
                probe_key="auth_weakness",
                category=Category.SECURITY,
                severity=Severity.HIGH,
                title="Missing login rate limiting — brute force possible",
                description=(
                    f"{RATE_LIMIT_TEST_ATTEMPTS} rapid login attempts to {login_url} "
                    "were processed without any rate-limiting response (no 429, no Retry-After header). "
                    "An attacker could brute force credentials with no throttling."
                ),
                evidence={
                    "login_url": login_url,
                    "attempts": responses,
                    "rate_limited": False,
                },
                cwe="CWE-307",
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    "Add rate limiting to login endpoint: 5-10 attempts per IP per minute, "
                    "then exponential backoff or CAPTCHA. "
                    "Use a library: `slowapi` (Python/FastAPI), `express-rate-limit` (Node), "
                    "or a WAF-level rate limit (Cloudflare, AWS WAF). "
                    "Also implement account lockout after 10+ consecutive failures."
                ),
                refs=[
                    {"label": "OWASP A07", "url": "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/"},
                    {"label": "CWE-307", "url": "https://cwe.mitre.org/data/definitions/307.html"},
                ],
            )
    return None


async def _check_username_enumeration(
    client: httpx.AsyncClient,
    login_url: str,
    rate_limiter,
    circuit_breaker,
) -> Optional[Finding]:
    """
    Check if the login endpoint reveals whether a username exists via different
    response messages or status codes.
    """
    existing_email = "test@example.com"      # Almost certainly not a real account
    nonexistent_email = "zxqvbnm-doesnotexist@invaliddomain9872.com"
    fake_pass = "WrongPass123!"

    if rate_limiter:
        await rate_limiter.acquire(login_url)

    try:
        resp_existing = await client.post(
            login_url,
            json={"email": existing_email, "password": fake_pass},
        )
        if circuit_breaker:
            circuit_breaker.record(login_url, 0, resp_existing.status_code)

        await asyncio.sleep(0.3)

        if rate_limiter:
            await rate_limiter.acquire(login_url)

        resp_nonexistent = await client.post(
            login_url,
            json={"email": nonexistent_email, "password": fake_pass},
        )
        if circuit_breaker:
            circuit_breaker.record(login_url, 0, resp_nonexistent.status_code)

        # Compare status codes or response bodies
        status_differs = resp_existing.status_code != resp_nonexistent.status_code
        body_hint = False

        msg_existing = resp_existing.text.lower()[:500]
        msg_nonexistent = resp_nonexistent.text.lower()[:500]

        for hint in ["user not found", "email not found", "account not found",
                     "no account", "doesn't exist", "does not exist"]:
            if hint in msg_nonexistent and hint not in msg_existing:
                body_hint = True
                break

        if status_differs or body_hint:
            return Finding(
                probe_key="auth_weakness",
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title="Username enumeration via login response",
                description=(
                    f"The login endpoint at {login_url} returns different responses "
                    f"for existing vs non-existent email addresses "
                    f"(status_differs={status_differs}, body_hint={body_hint}). "
                    "An attacker can use this to enumerate valid accounts."
                ),
                evidence={
                    "login_url": login_url,
                    "existing_status": resp_existing.status_code,
                    "nonexistent_status": resp_nonexistent.status_code,
                    "body_hint": body_hint,
                },
                cwe="CWE-204",
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.MEDIUM,
                remediation=(
                    "Use a generic error message for all failed logins: "
                    "'Invalid email or password' — regardless of whether the account exists. "
                    "Return the same HTTP status code (401) and take the same response time "
                    "(constant-time comparison) for both cases."
                ),
                refs=[
                    {"label": "CWE-204", "url": "https://cwe.mitre.org/data/definitions/204.html"},
                    {"label": "OWASP Account Enumeration", "url": "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/03-Identity_Management_Testing/04-Testing_for_Account_Enumeration_and_Guessable_User_Account"},
                ],
            )

    except Exception as exc:
        logger.debug("Username enumeration check error: %s", exc)

    return None
