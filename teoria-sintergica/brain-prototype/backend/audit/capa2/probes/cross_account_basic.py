"""
audit/capa2/probes/cross_account_basic.py  — Phase 2.1

Basic cross-account access check (IDOR precursor):
- If multiple auth sessions are configured (e.g. customer_a, customer_b),
  verify that resources owned by customer_a are NOT accessible by customer_b.
- Phase 2.1 version: passive observation, 1 resource check max.
- Full IDOR enumeration is done in Phase 2.3 (idor_horizontal.py).

Layer: ACTIVE_LAYER_2_SAFE — authenticated passive observation
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

logger = logging.getLogger(__name__)


class CrossAccountBasicProbe(ProbeBase):
    key      = "cross_account_basic"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []

        sessions: dict = ctx.cache.get("auth_sessions", {})
        if len(sessions) < 2:
            return ProbeOutput(
                raw_data={"note": "Need at least 2 auth sessions for cross-account check"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=0,
                error="cross_account_basic requires at least 2 auth sessions (e.g. customer_a, customer_b)",
            )

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        session_items = list(sessions.items())
        label_a, session_a = session_items[0]
        label_b, session_b = session_items[1]

        cookies_a = _get_cookie_header(session_a)
        cookies_b = _get_cookie_header(session_b)

        resource_endpoints = ctx.config.get("capa2", {}).get("resource_endpoints", [])

        # If no endpoints configured, try to auto-discover common user data endpoints
        if not resource_endpoints:
            base = ctx.base_url
            resource_endpoints = [
                f"{base}/api/me",
                f"{base}/api/user",
                f"{base}/api/profile",
                f"{base}/api/account",
            ]

        raw: dict = {"sessions": [label_a, label_b], "checks": []}
        found_any_resource = False

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for endpoint in resource_endpoints:
                if rate_limiter:
                    await rate_limiter.acquire(endpoint)

                # Fetch resource as session_a
                try:
                    t_req = time.time()
                    resp_a = await client.get(endpoint, headers={"Cookie": cookies_a})
                    if circuit_breaker:
                        circuit_breaker.record(endpoint, (time.time() - t_req) * 1000, resp_a.status_code)

                    if resp_a.status_code != 200:
                        continue  # Endpoint doesn't exist or not accessible with this session

                    found_any_resource = True

                    # Extract user ID from response to confirm it belongs to session_a
                    user_id_a = _extract_user_id(resp_a.text)

                    # Now try to access the same endpoint with session_b
                    if rate_limiter:
                        await rate_limiter.acquire(endpoint)
                    t_req = time.time()
                    resp_b = await client.get(endpoint, headers={"Cookie": cookies_b})
                    if circuit_breaker:
                        circuit_breaker.record(endpoint, (time.time() - t_req) * 1000, resp_b.status_code)

                    user_id_b = _extract_user_id(resp_b.text)

                    check = {
                        "endpoint": endpoint,
                        "session_a": label_a,
                        "session_b": label_b,
                        "user_id_a": user_id_a,
                        "user_id_b": user_id_b,
                        "status_a": resp_a.status_code,
                        "status_b": resp_b.status_code,
                    }
                    raw["checks"].append(check)

                    # If session_b can see session_a's data (same response content)
                    if (resp_b.status_code == 200 and user_id_a and user_id_b
                            and user_id_a == user_id_b):
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.CRITICAL,
                            title="Cross-account data leak at shared /me endpoint",
                            description=(
                                f"Both '{label_a}' and '{label_b}' sessions return the same "
                                f"user data (id: {user_id_a}) at {endpoint}. "
                                "This indicates sessions may be sharing a user context."
                            ),
                            evidence=check,
                            cwe="CWE-639",
                            fix_effort=FixEffort.MEDIUM,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation=(
                                "Ensure /me and /profile endpoints return data scoped to the "
                                "authenticated user's session only. "
                                "Verify session isolation in your auth middleware."
                            ),
                            refs=[
                                {"label": "OWASP A01 Broken Access Control", "url": "https://owasp.org/Top10/A01_2021-Broken_Access_Control/"},
                                {"label": "CWE-639", "url": "https://cwe.mitre.org/data/definitions/639.html"},
                            ],
                        ))
                    break  # Phase 2.1: one resource check is sufficient

                except httpx.RequestError as exc:
                    logger.debug("Cross-account check error on %s: %s", endpoint, exc)
                    continue

        if not found_any_resource:
            return ProbeOutput(
                raw_data={"note": "Could not find accessible user resource endpoints"},
                findings=[],
                status=ProbeStatus.PARTIAL,
                duration_ms=int((time.time() - t0) * 1000),
            )

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _get_cookie_header(session) -> str:
    cookies = _load_cookies_from_storage_state(
        session.storage_state_path if hasattr(session, "storage_state_path")
        else session.get("storage_state_path", "")
    )
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


def _load_cookies_from_storage_state(storage_path: str) -> list[dict]:
    if not storage_path:
        return []
    import json, os
    if not os.path.exists(storage_path):
        return []
    try:
        with open(storage_path) as f:
            return json.load(f).get("cookies", [])
    except Exception:
        return []


def _extract_user_id(response_text: str) -> Optional[str]:
    """Heuristically extract a user/account ID from JSON response."""
    import json
    try:
        data = json.loads(response_text)
        for key in ("id", "user_id", "userId", "account_id", "accountId", "sub"):
            val = data.get(key) if isinstance(data, dict) else None
            if val is not None:
                return str(val)
        # Nested: data.user.id or data.data.id
        for nested_key in ("user", "data", "account"):
            nested = data.get(nested_key, {}) if isinstance(data, dict) else {}
            if isinstance(nested, dict):
                for key in ("id", "user_id", "userId"):
                    val = nested.get(key)
                    if val is not None:
                        return str(val)
    except (json.JSONDecodeError, TypeError):
        pass
    return None
