"""
audit/capa2/probes/cors_policy.py  — Phase 2.2

Analyzes Cross-Origin Resource Sharing (CORS) policy:
- Wildcard Access-Control-Allow-Origin with credentials
- Arbitrary origin reflection
- Pre-flight (OPTIONS) bypass possibilities
- Null origin acceptance

Layer: ACTIVE_LAYER_2_SAFE
"""
import logging
import time

import httpx

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase

logger = logging.getLogger(__name__)

TEST_ORIGINS = [
    "https://evil.example.com",
    "null",
    "https://attacker.com",
]

TEST_ENDPOINTS_SUFFIXES = [
    "/api",
    "/api/v1",
    "/api/me",
    "/api/user",
    "/graphql",
]


class CORSPolicyProbe(ProbeBase):
    key      = "cors_policy"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"endpoints_checked": [], "issues": []}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        endpoints = [ctx.base_url + suffix for suffix in TEST_ENDPOINTS_SUFFIXES]
        # Also include configured resource_endpoints from Capa 2 config
        extra = ctx.config.get("capa2", {}).get("resource_endpoints", [])
        endpoints = list(dict.fromkeys(endpoints + extra))  # deduplicate, preserve order

        async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
            for endpoint in endpoints:
                for test_origin in TEST_ORIGINS:
                    if rate_limiter:
                        await rate_limiter.acquire(endpoint)

                    try:
                        t_req = time.time()
                        # OPTIONS pre-flight
                        headers = {
                            "Origin": test_origin,
                            "Access-Control-Request-Method": "GET",
                            "Access-Control-Request-Headers": "Content-Type",
                        }
                        resp = await client.options(endpoint, headers=headers)
                        elapsed = (time.time() - t_req) * 1000

                        if circuit_breaker:
                            circuit_breaker.record(endpoint, elapsed, resp.status_code)

                        acao = resp.headers.get("access-control-allow-origin", "")
                        acac = resp.headers.get("access-control-allow-credentials", "").lower()
                        acam = resp.headers.get("access-control-allow-methods", "")

                        check = {
                            "endpoint": endpoint,
                            "test_origin": test_origin,
                            "acao": acao,
                            "acac": acac,
                            "acam": acam,
                            "status": resp.status_code,
                        }
                        raw["endpoints_checked"].append(check)

                        # Critical: wildcard with credentials
                        if acao == "*" and acac == "true":
                            issue = {**check, "type": "wildcard_with_credentials"}
                            raw["issues"].append(issue)
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.CRITICAL,
                                title="CORS: wildcard origin + credentials allowed",
                                description=(
                                    f"Endpoint {endpoint} returns "
                                    "`Access-Control-Allow-Origin: *` AND "
                                    "`Access-Control-Allow-Credentials: true`. "
                                    "This combination allows any website to make authenticated "
                                    "cross-origin requests on behalf of the user."
                                ),
                                evidence=issue,
                                cwe="CWE-942",
                                fix_effort=FixEffort.TRIVIAL,
                                impact_confidence=ImpactConfidence.HIGH,
                                remediation=(
                                    "Never use `*` with credentials. "
                                    "Maintain an explicit whitelist of trusted origins. "
                                    "Return `Access-Control-Allow-Origin: https://yourdomain.com` "
                                    "only after validating the `Origin` request header."
                                ),
                                refs=[
                                    {"label": "OWASP CORS", "url": "https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny"},
                                    {"label": "CWE-942", "url": "https://cwe.mitre.org/data/definitions/942.html"},
                                ],
                            ))

                        # High: arbitrary origin reflection
                        elif acao == test_origin and test_origin not in ("null",):
                            issue = {**check, "type": "arbitrary_origin_reflected"}
                            raw["issues"].append(issue)
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.HIGH,
                                title="CORS: arbitrary origin reflected",
                                description=(
                                    f"Endpoint {endpoint} reflects the attacker Origin "
                                    f"'{test_origin}' in Access-Control-Allow-Origin. "
                                    "Any cross-origin site can make authenticated requests."
                                ),
                                evidence=issue,
                                cwe="CWE-942",
                                fix_effort=FixEffort.SMALL,
                                impact_confidence=ImpactConfidence.HIGH,
                                remediation=(
                                    "Validate Origin against a static allowlist before reflecting it. "
                                    "Do not use regex-based validation that can be bypassed "
                                    "(e.g. `evil.yoursite.com.attacker.com`)."
                                ),
                                refs=[{"label": "PortSwigger CORS", "url": "https://portswigger.net/web-security/cors"}],
                            ))

                        # Medium: null origin accepted
                        elif test_origin == "null" and acao == "null":
                            issue = {**check, "type": "null_origin_accepted"}
                            raw["issues"].append(issue)
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.MEDIUM,
                                title="CORS: null origin accepted",
                                description=(
                                    f"Endpoint {endpoint} accepts `Origin: null`. "
                                    "Sandboxed iframes and redirects from local files send null origin, "
                                    "which can be abused for CSRF-like attacks."
                                ),
                                evidence=issue,
                                cwe="CWE-942",
                                fix_effort=FixEffort.TRIVIAL,
                                impact_confidence=ImpactConfidence.MEDIUM,
                                remediation="Remove 'null' from allowed origins. Only whitelist specific https:// origins.",
                                refs=[{"label": "PortSwigger null origin", "url": "https://portswigger.net/web-security/cors/lab-null-origin-whitelisted-with-strict-transport-security"}],
                            ))

                    except httpx.RequestError as exc:
                        logger.debug("CORS probe error on %s: %s", endpoint, exc)
                        continue

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )
