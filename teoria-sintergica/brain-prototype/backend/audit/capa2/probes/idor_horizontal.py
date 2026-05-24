"""
audit/capa2/probes/idor_horizontal.py  — Phase 2.3

IDOR (Insecure Direct Object Reference) horizontal access check.

Approach:
- With session_a, fetch a resource (e.g. GET /api/orders/123)
- Try to access the same resource with session_b
- If session_b can access session_a's resource → IDOR confirmed

Production limit: max 2 resources
Staging limit: max 10 resources (from config.py)

OWASP Coverage: A01 Broken Access Control

Layer: ACTIVE_LAYER_2_SAFE
"""
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
from ..config import IDOR_MAX_RESOURCES_PROD, IDOR_MAX_RESOURCES_STAGING

logger = logging.getLogger(__name__)

# Common ID parameter names and resource endpoint patterns to probe
RESOURCE_PATH_PATTERNS = [
    "/api/users/{id}",
    "/api/orders/{id}",
    "/api/invoices/{id}",
    "/api/documents/{id}",
    "/api/files/{id}",
    "/api/accounts/{id}",
    "/api/profiles/{id}",
    "/api/me/orders",    # Scoped endpoints (should be auth-scoped)
]


class IDORHorizontalProbe(ProbeBase):
    key      = "idor_horizontal"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"checks": [], "total_resources_tested": 0}

        sessions: dict = ctx.cache.get("auth_sessions", {})
        if len(sessions) < 2:
            return ProbeOutput(
                raw_data={"note": "Need 2+ sessions for horizontal IDOR check"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=int((time.time() - t0) * 1000),
                error="idor_horizontal requires at least 2 auth sessions",
            )

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")
        environment = ctx.config.get("capa2", {}).get("environment", "production")
        max_resources = IDOR_MAX_RESOURCES_STAGING if environment == "staging" else IDOR_MAX_RESOURCES_PROD

        session_items = list(sessions.items())
        label_a, session_a = session_items[0]
        label_b, session_b = session_items[1]

        cookies_a = _get_cookie_header(session_a)
        cookies_b = _get_cookie_header(session_b)

        # Get resource endpoints from config or use defaults
        resource_endpoints = ctx.config.get("capa2", {}).get("resource_endpoints", [])
        if not resource_endpoints:
            resource_endpoints = [ctx.base_url + p.replace("{id}", "1") for p in RESOURCE_PATH_PATTERNS]

        resources_tested = 0

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for endpoint in resource_endpoints:
                if resources_tested >= max_resources:
                    break

                if rate_limiter:
                    await rate_limiter.acquire(endpoint)

                # Step 1: Access as session_a (owner)
                try:
                    t_req = time.time()
                    resp_a = await client.get(endpoint, headers={"Cookie": cookies_a})
                    elapsed = (time.time() - t_req) * 1000
                    if circuit_breaker:
                        circuit_breaker.record(endpoint, elapsed, resp_a.status_code)

                    if resp_a.status_code != 200:
                        continue

                    # Step 2: Attempt same resource as session_b
                    if rate_limiter:
                        await rate_limiter.acquire(endpoint)
                    t_req = time.time()
                    resp_b = await client.get(endpoint, headers={"Cookie": cookies_b})
                    elapsed = (time.time() - t_req) * 1000
                    if circuit_breaker:
                        circuit_breaker.record(endpoint, elapsed, resp_b.status_code)

                    resources_tested += 1
                    check = {
                        "endpoint": endpoint,
                        "session_a": label_a,
                        "session_b": label_b,
                        "status_a": resp_a.status_code,
                        "status_b": resp_b.status_code,
                        "environment": environment,
                        "marker": "detection_only — no mass enumeration",
                    }
                    raw["checks"].append(check)

                    if resp_b.status_code == 200:
                        # Verify the content is actually session_a's resource (not a shared resource)
                        content_match = _check_content_overlap(resp_a.text, resp_b.text)
                        if content_match:
                            check["content_overlap"] = True
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.CRITICAL,
                                title=f"IDOR: '{label_b}' accessed '{label_a}' resource",
                                description=(
                                    f"Session '{label_b}' was able to access the resource at "
                                    f"{endpoint} that belongs to session '{label_a}'. "
                                    "The response content overlaps, confirming cross-account data access. "
                                    f"Environment: {environment}. "
                                    "Testing limited to {max_resources} resources (detection-only)."
                                ),
                                evidence={
                                    **check,
                                    "detection_only": True,
                                    "phase_2_4_required": environment == "production",
                                },
                                cwe="CWE-639",
                                cvss_score=8.1,
                                fix_effort=FixEffort.MEDIUM,
                                impact_confidence=ImpactConfidence.HIGH,
                                remediation=(
                                    "Implement object-level authorization on every endpoint. "
                                    "Before returning a resource, verify that the authenticated user "
                                    "owns or has explicit permission to access it. "
                                    "Do NOT rely only on the resource ID being 'hard to guess'. "
                                    "Example: `if resource.owner_id != current_user.id: raise 403`."
                                ),
                                refs=[
                                    {"label": "OWASP A01 Broken Access Control", "url": "https://owasp.org/Top10/A01_2021-Broken_Access_Control/"},
                                    {"label": "OWASP IDOR", "url": "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References"},
                                    {"label": "CWE-639", "url": "https://cwe.mitre.org/data/definitions/639.html"},
                                ],
                            ))
                        else:
                            # 200 but different content — may be that session_b has own version
                            check["content_overlap"] = False
                    elif resp_b.status_code in (401, 403):
                        # This is the correct behavior — access denied
                        check["properly_denied"] = True

                except httpx.RequestError as exc:
                    logger.debug("IDOR probe error on %s: %s", endpoint, exc)
                    continue

        raw["total_resources_tested"] = resources_tested
        raw["max_allowed"] = max_resources

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _check_content_overlap(text_a: str, text_b: str) -> bool:
    """
    Heuristically check if two responses contain overlapping content
    (suggesting same resource was returned).
    """
    if not text_a or not text_b:
        return False
    # Compare first 100 chars of body (skip dynamic timestamps)
    common_len = min(len(text_a), len(text_b), 100)
    if text_a[:common_len] == text_b[:common_len]:
        return True

    # Try to extract IDs from JSON and compare
    import json
    try:
        data_a = json.loads(text_a)
        data_b = json.loads(text_b)
        for key in ("id", "user_id", "userId", "account_id"):
            id_a = data_a.get(key) if isinstance(data_a, dict) else None
            id_b = data_b.get(key) if isinstance(data_b, dict) else None
            if id_a and id_b and id_a == id_b:
                return True
    except (json.JSONDecodeError, TypeError):
        pass
    return False


def _get_cookie_header(session) -> str:
    cookies = _load_cookies(
        session.storage_state_path if hasattr(session, "storage_state_path")
        else session.get("storage_state_path", "")
    )
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


def _load_cookies(path: str) -> list[dict]:
    if not path:
        return []
    import json, os
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            return json.load(f).get("cookies", [])
    except Exception:
        return []
