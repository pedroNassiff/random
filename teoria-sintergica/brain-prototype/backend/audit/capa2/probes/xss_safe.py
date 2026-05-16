"""
audit/capa2/probes/xss_safe.py  — Phase 2.3

Safe XSS detection. Detection-only — no cookie exfiltration.

Approach:
- Inject marker payloads into form fields and URL parameters
- Detect reflection in HTML response (not execution — that needs staging)
- Check Content-Security-Policy header effectiveness
- NO actual script execution, NO cookie stealing

OWASP Coverage: A03 Injection

Layer: ACTIVE_LAYER_2_SAFE
"""
import html
import logging
import re
import time

import httpx
from bs4 import BeautifulSoup  # type: ignore

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase
from ..config import XSS_PAYLOADS

logger = logging.getLogger(__name__)

AUDIT_MARKER = "xss-audit-marker-rl"  # Unique marker that makes findings unambiguous
MAX_ENDPOINTS_TO_TEST = 8
MAX_PARAMS = 5


class XSSSafeProbe(ProbeBase):
    key      = "xss_safe"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"endpoints_tested": [], "reflections_found": 0, "injections_sent": 0}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        sessions: dict = ctx.cache.get("auth_sessions", {})
        cookie_header = _get_cookie_header(sessions)
        auth_headers = {"Cookie": cookie_header} if cookie_header else {}

        endpoints_with_params = _get_endpoints_with_params(ctx)
        if not endpoints_with_params:
            return ProbeOutput(
                raw_data={"note": "No endpoints found — inject endpoint_discovery first"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=int((time.time() - t0) * 1000),
            )

        # Also test search forms discovered in the main page
        main_page_forms = await _discover_forms(ctx.root_url, auth_headers)

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            # Test URL parameters
            for endpoint_info in endpoints_with_params[:MAX_ENDPOINTS_TO_TEST]:
                url = endpoint_info["url"]
                params = endpoint_info.get("params", [])[:MAX_PARAMS]

                for param in params:
                    for payload in XSS_PAYLOADS:
                        if rate_limiter:
                            await rate_limiter.acquire(url)

                        try:
                            t_req = time.time()
                            resp = await client.get(url, params={param: payload}, headers=auth_headers)
                            elapsed = (time.time() - t_req) * 1000
                            if circuit_breaker:
                                circuit_breaker.record(url, elapsed, resp.status_code)

                            raw["injections_sent"] += 1

                            # Check CSP header
                            csp = resp.headers.get("content-security-policy", "")
                            reflected, context = _check_reflection(resp.text, payload)

                            if reflected:
                                raw["reflections_found"] += 1
                                severity = Severity.HIGH if not csp else Severity.MEDIUM
                                findings.append(Finding(
                                    probe_key=self.key,
                                    category=self.category,
                                    severity=severity,
                                    title=f"XSS reflection detected on '{param}' parameter",
                                    description=(
                                        f"Payload reflected unescaped in response at {url}?{param}=... "
                                        f"Reflection context: {context}. "
                                        + ("CSP header present (may mitigate execution). " if csp else "No CSP header — execution likely. ")
                                        + "Full execution verification requires Phase 2.4 on staging."
                                    ),
                                    evidence={
                                        "url": url,
                                        "param": param,
                                        "payload_type": "reflection_marker",
                                        "context": context,
                                        "csp_present": bool(csp),
                                        "csp_value": csp[:200] if csp else None,
                                        "phase_2_4_required": True,
                                    },
                                    cwe="CWE-79",
                                    cvss_score=6.1 if csp else 8.8,
                                    fix_effort=FixEffort.SMALL,
                                    impact_confidence=ImpactConfidence.HIGH,
                                    remediation=(
                                        "HTML-escape all user-controlled output: "
                                        "use your templating engine's auto-escaping (Jinja2, Django templates, etc.). "
                                        "Also add a strict Content-Security-Policy header. "
                                        "For JS context: use `textContent` instead of `innerHTML`."
                                    ),
                                    refs=[
                                        {"label": "OWASP XSS", "url": "https://owasp.org/www-community/attacks/xss/"},
                                        {"label": "CWE-79", "url": "https://cwe.mitre.org/data/definitions/79.html"},
                                    ],
                                ))
                                break  # One finding per param

                        except httpx.RequestError as exc:
                            logger.debug("XSS probe error on %s param %s: %s", url, param, exc)

            # Check CSP header globally
            csp_finding = await _check_global_csp(client, ctx, auth_headers, circuit_breaker, rate_limiter)
            if csp_finding:
                findings.append(csp_finding)

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _check_reflection(response_text: str, payload: str) -> tuple[bool, str]:
    """
    Check if the payload is reflected in the response.
    Returns (is_reflected, context_description).
    Context: 'html_unescaped', 'html_escaped', 'js_context', 'attr_context'
    """
    # Unescaped reflection — dangerous
    if payload in response_text:
        # Determine context
        soup = BeautifulSoup(response_text, "html.parser")
        scripts = soup.find_all("script")
        for s in scripts:
            if payload in (s.string or ""):
                return True, "js_context"

        # Look for payload inside attribute value
        raw_attr_pattern = re.compile(re.escape(payload))
        for tag in soup.find_all(True):
            for attr_val in tag.attrs.values():
                if isinstance(attr_val, str) and payload in attr_val:
                    return True, "html_attribute_context"
                if isinstance(attr_val, list):
                    for av in attr_val:
                        if isinstance(av, str) and payload in av:
                            return True, "html_attribute_context"

        return True, "html_body_context"

    # Partially escaped — may still be exploitable
    partially_escaped = html.escape(payload, quote=False)
    if partially_escaped != payload and partially_escaped in response_text:
        return False, "html_escaped_safe"

    return False, "not_reflected"


async def _check_global_csp(client, ctx, headers, circuit_breaker, rate_limiter) -> Finding | None:
    """Check if the site has a Content-Security-Policy and if it's strict."""
    try:
        if rate_limiter:
            await rate_limiter.acquire(ctx.root_url)
        t_req = time.time()
        resp = await client.get(ctx.root_url, headers=headers)
        elapsed = (time.time() - t_req) * 1000
        if circuit_breaker:
            circuit_breaker.record(ctx.root_url, elapsed, resp.status_code)

        csp = resp.headers.get("content-security-policy", "")
        if not csp:
            return Finding(
                probe_key="xss_safe",
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title="Missing Content-Security-Policy header",
                description=(
                    "No Content-Security-Policy header found on the main page. "
                    "CSP is a defense-in-depth layer that limits XSS impact even if XSS exists."
                ),
                evidence={"url": ctx.root_url, "csp": None},
                cwe="CWE-693",
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    "Add a Content-Security-Policy header. Start with: "
                    "`Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'`. "
                    "Use report-only mode first to test: `Content-Security-Policy-Report-Only: ...`"
                ),
                refs=[
                    {"label": "MDN CSP", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"},
                    {"label": "CSP Quick Reference", "url": "https://content-security-policy.com"},
                ],
            )

        # Check for unsafe-inline or unsafe-eval
        weak_directives = []
        if "'unsafe-inline'" in csp:
            weak_directives.append("'unsafe-inline'")
        if "'unsafe-eval'" in csp:
            weak_directives.append("'unsafe-eval'")
        if "data:" in csp:
            weak_directives.append("data: URI")

        if weak_directives:
            return Finding(
                probe_key="xss_safe",
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title="Weak Content-Security-Policy directives",
                description=(
                    f"CSP contains weak directives: {', '.join(weak_directives)}. "
                    "These weaken the XSS protection that CSP provides."
                ),
                evidence={"csp": csp[:500], "weak_directives": weak_directives},
                cwe="CWE-693",
                fix_effort=FixEffort.MEDIUM,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    "Remove 'unsafe-inline' and 'unsafe-eval'. "
                    "Use nonces or hashes for legitimate inline scripts: `script-src 'nonce-{random}'`. "
                    "Migrate inline event handlers to external scripts."
                ),
                refs=[{"label": "CSP Evaluator", "url": "https://csp-evaluator.withgoogle.com/"}],
            )
    except Exception:
        pass
    return None


async def _discover_forms(page_url: str, headers: dict) -> list[dict]:
    """Discover form action URLs and input names from a page."""
    forms = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(page_url, headers=headers)
            soup = BeautifulSoup(resp.text, "html.parser")
            for form in soup.find_all("form"):
                action = form.get("action", page_url)
                inputs = [i.get("name") for i in form.find_all("input") if i.get("name") and i.get("type") not in ("hidden", "submit")]
                if inputs:
                    forms.append({"url": action, "params": inputs})
    except Exception:
        pass
    return forms


def _get_endpoints_with_params(ctx: AuditContext) -> list[dict]:
    discovered = ctx.cache.get("endpoint_discovery_results", {})
    api_endpoints = discovered.get("api_endpoints_discovered", [])

    config_endpoints = ctx.config.get("capa2", {}).get("parameterized_endpoints", [])
    result = []
    for ep in config_endpoints:
        if isinstance(ep, dict):
            result.append(ep)
        else:
            result.append({"url": ep, "params": ["q", "search", "id", "name", "input"]})

    for url in api_endpoints:
        result.append({"url": url, "params": ["q", "search", "input"]})

    if not result:
        base = ctx.base_url
        result = [
            {"url": base + "/search", "params": ["q", "query"]},
            {"url": base + "/api/search", "params": ["q", "query", "filter"]},
        ]
    return result


def _get_cookie_header(sessions: dict) -> str:
    if not sessions:
        return ""
    first = next(iter(sessions.values()))
    cookies = _load_cookies(
        first.storage_state_path if hasattr(first, "storage_state_path")
        else first.get("storage_state_path", "")
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
