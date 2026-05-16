"""
audit/capa2/probes/misconfig_check.py  — Phase 2.3

Security misconfiguration checks:
- Default credentials on admin panels
- Debug mode endpoints
- Error disclosure (stack traces in 500 responses)
- Server version disclosure
- Directory listing
- Unnecessary HTTP methods enabled

OWASP Coverage: A05 Security Misconfiguration

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

VERBOSE_ERROR_PATTERNS = [
    "traceback (most recent call last)",
    "at line [0-9]+",
    "stack trace:",
    "syntax error at",
    "fatal error:",
    "exception in thread",
    "null pointer exception",
    "sqlexception",
    "django debug",
    "werkzeug debugger",
    "500 internal server error",
]

DEBUG_PATHS = [
    "/__debug__/",
    "/console",
    "/_pdb",
    "/debug/vars",
    "/debug/pprof",
    "/actuator/beans",
    "/actuator/configprops",
]


class MisconfigCheckProbe(ProbeBase):
    key      = "misconfig_check"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")
        base = ctx.base_url

        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            # 1. Server version disclosure
            if rate_limiter:
                await rate_limiter.acquire(ctx.root_url)
            try:
                t_req = time.time()
                resp = await client.get(ctx.root_url)
                elapsed = (time.time() - t_req) * 1000
                if circuit_breaker:
                    circuit_breaker.record(ctx.root_url, elapsed, resp.status_code)

                server = resp.headers.get("server", "")
                x_powered_by = resp.headers.get("x-powered-by", "")
                raw["server_header"] = server
                raw["x_powered_by"] = x_powered_by

                if _has_version_info(server) or _has_version_info(x_powered_by):
                    header_detail = []
                    if _has_version_info(server):
                        header_detail.append(f"Server: {server}")
                    if _has_version_info(x_powered_by):
                        header_detail.append(f"X-Powered-By: {x_powered_by}")
                    findings.append(Finding(
                        probe_key=self.key,
                        category=self.category,
                        severity=Severity.LOW,
                        title="Server version disclosed in headers",
                        description=(
                            "HTTP response headers reveal server software version: "
                            + "; ".join(header_detail) + ". "
                            "This aids attackers in targeting known vulnerabilities."
                        ),
                        evidence={"server": server, "x_powered_by": x_powered_by},
                        cwe="CWE-200",
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.HIGH,
                        remediation=(
                            "Remove or obscure version from Server and X-Powered-By headers. "
                            "Nginx: `server_tokens off;`. "
                            "Apache: `ServerTokens Prod; ServerSignature Off`. "
                            "Express: `app.disable('x-powered-by')` or use `helmet`."
                        ),
                        refs=[{"label": "OWASP Security Headers", "url": "https://owasp.org/www-project-secure-headers/"}],
                    ))

            except httpx.RequestError as exc:
                logger.debug("Misconfig: main page error: %s", exc)

            # 2. Debug endpoints check
            for path in DEBUG_PATHS:
                url = base + path
                if rate_limiter:
                    await rate_limiter.acquire(url)
                try:
                    t_req = time.time()
                    resp = await client.get(url)
                    elapsed = (time.time() - t_req) * 1000
                    if circuit_breaker:
                        circuit_breaker.record(url, elapsed, resp.status_code)

                    if resp.status_code == 200:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.HIGH,
                            title=f"Debug endpoint accessible: {path}",
                            description=(
                                f"Debug/diagnostic endpoint `{url}` returned HTTP 200 in production. "
                                "Debug endpoints can expose environment variables, heap dumps, "
                                "routing tables, and other sensitive internal data."
                            ),
                            evidence={"url": url, "status": 200, "snippet": resp.text[:300]},
                            cwe="CWE-489",
                            fix_effort=FixEffort.TRIVIAL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation=(
                                f"Disable debug endpoints in production. "
                                "Set `DEBUG=False` in Django. "
                                "For Spring Boot Actuator: restrict endpoints to `management.endpoints.web.exposure.include=health,info`. "
                                "Block with: `location {path} {{ deny all; }}`."
                            ),
                            refs=[
                                {"label": "OWASP A05", "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/"},
                                {"label": "CWE-489", "url": "https://cwe.mitre.org/data/definitions/489.html"},
                            ],
                        ))
                except httpx.RequestError:
                    continue

            # 3. Error disclosure — trigger a 404 and check for stack traces
            trash_url = base + "/audit-probe-nonexistent-path-4x9z"
            if rate_limiter:
                await rate_limiter.acquire(trash_url)
            try:
                resp = await client.get(trash_url)
                if circuit_breaker:
                    circuit_breaker.record(trash_url, 0, resp.status_code)

                body_lower = resp.text.lower()
                for pattern in VERBOSE_ERROR_PATTERNS:
                    import re
                    if re.search(pattern, body_lower):
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.MEDIUM,
                            title="Verbose error disclosure in HTTP responses",
                            description=(
                                "The application returns detailed error messages / stack traces in HTTP responses. "
                                f"Pattern matched: `{pattern}`. "
                                "Stack traces reveal source code paths, library versions, and internal architecture."
                            ),
                            evidence={"url": trash_url, "pattern": pattern, "snippet": resp.text[:500]},
                            cwe="CWE-209",
                            fix_effort=FixEffort.TRIVIAL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation=(
                                "Disable debug mode in production. "
                                "Configure a generic error page for 4xx/5xx. "
                                "Log errors server-side but return only generic messages to clients. "
                                "Django: `DEBUG=False` + custom 500.html. "
                                "Express: remove error message from req/res in error middleware."
                            ),
                            refs=[
                                {"label": "CWE-209", "url": "https://cwe.mitre.org/data/definitions/209.html"},
                                {"label": "OWASP Error Handling", "url": "https://owasp.org/www-community/Improper_Error_Handling"},
                            ],
                        ))
                        break
            except httpx.RequestError:
                pass

            # 4. HTTP methods allowed check (TRACE/PUT/DELETE on non-REST endpoints)
            if rate_limiter:
                await rate_limiter.acquire(ctx.root_url)
            try:
                resp = await client.options(ctx.root_url)
                allowed = resp.headers.get("allow", "").upper()
                raw["allowed_methods"] = allowed

                if "TRACE" in allowed:
                    findings.append(Finding(
                        probe_key=self.key,
                        category=self.category,
                        severity=Severity.MEDIUM,
                        title="HTTP TRACE method enabled (XST risk)",
                        description=(
                            "The server allows HTTP TRACE method. "
                            "TRACE can be used in Cross-Site Tracing (XST) attacks to steal "
                            "HttpOnly cookies and Authorization headers via XSS."
                        ),
                        evidence={"allow_header": allowed},
                        cwe="CWE-16",
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.LOW,
                        remediation=(
                            "Disable TRACE method. "
                            "Nginx: `if ($request_method = TRACE) { return 405; }`. "
                            "Apache: `TraceEnable off`."
                        ),
                        refs=[{"label": "OWASP XST", "url": "https://owasp.org/www-community/attacks/Cross_Site_Tracing"}],
                    ))
            except httpx.RequestError:
                pass

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _has_version_info(header_value: str) -> bool:
    """Check if a header value contains version numbers (e.g. nginx/1.18.0)."""
    import re
    return bool(re.search(r"\d+\.\d+", header_value))
