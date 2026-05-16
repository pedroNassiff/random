"""
audit/capa2/probes/ssrf_safe.py  — Phase 2.3

Safe SSRF detection. Detection-only — no cloud metadata access.

Approach:
- Find endpoints that accept URL parameters
- Send requests to 127.0.0.1, localhost, 0.0.0.0, [::1]
- Measure response time and content differences vs benign URL
- NO requests to cloud metadata endpoints (169.254.169.254, etc.)

OWASP Coverage: A10 SSRF

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
from ..config import SSRF_TARGETS

logger = logging.getLogger(__name__)

# Common parameter names that accept URLs
URL_PARAM_NAMES = [
    "url", "uri", "endpoint", "dest", "destination", "target",
    "redirect", "redirectTo", "redirect_url", "continue",
    "return", "returnUrl", "return_url", "next", "callback",
    "feed", "webhook", "hook", "proxy", "resource", "image",
    "avatar", "logo", "src",
]

# Benign external URL to use as baseline
BENIGN_URL = "https://example.com"


class SSRFSafeProbe(ProbeBase):
    key      = "ssrf_safe"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"checks": [], "injections_sent": 0}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        sessions: dict = ctx.cache.get("auth_sessions", {})
        cookie_header = _get_cookie_header(sessions)
        auth_headers = {"Cookie": cookie_header} if cookie_header else {}

        # Get URL-accepting endpoints from config or discover heuristically
        url_endpoints = ctx.config.get("capa2", {}).get("url_accepting_endpoints", [])
        if not url_endpoints:
            # Discover from common patterns
            base = ctx.base_url
            url_endpoints = [
                {"url": base + "/api/fetch", "param": "url"},
                {"url": base + "/api/proxy", "param": "target"},
                {"url": base + "/api/screenshot", "param": "url"},
                {"url": base + "/api/import", "param": "url"},
                {"url": base + "/webhook", "param": "url"},
            ]

        discovered = ctx.cache.get("endpoint_discovery_results", {})
        api_endpoints = discovered.get("api_endpoints_discovered", [])
        for ep_url in api_endpoints:
            for param_name in URL_PARAM_NAMES:
                if param_name in ep_url.lower():
                    url_endpoints.append({"url": ep_url, "param": param_name})

        async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
            for endpoint_info in url_endpoints:
                endpoint = endpoint_info if isinstance(endpoint_info, str) else endpoint_info.get("url", "")
                param = endpoint_info.get("param", "url") if isinstance(endpoint_info, dict) else "url"
                if not endpoint:
                    continue

                # Get baseline with benign URL
                baseline = await _get_baseline(client, endpoint, param, BENIGN_URL, auth_headers, rate_limiter, circuit_breaker)
                if baseline is None:
                    continue

                for ssrf_target in SSRF_TARGETS:
                    if rate_limiter:
                        await rate_limiter.acquire(endpoint)

                    try:
                        t_req = time.time()
                        resp = await client.get(endpoint, params={param: ssrf_target}, headers=auth_headers)
                        elapsed = (time.time() - t_req) * 1000
                        if circuit_breaker:
                            circuit_breaker.record(endpoint, elapsed, resp.status_code)

                        raw["injections_sent"] += 1
                        check = {
                            "endpoint": endpoint,
                            "param": param,
                            "target": ssrf_target,
                            "status": resp.status_code,
                            "elapsed_ms": round(elapsed, 1),
                            "baseline_status": baseline["status"],
                            "baseline_elapsed_ms": baseline["elapsed_ms"],
                        }
                        raw["checks"].append(check)

                        result = _detect_ssrf(baseline, resp, ssrf_target, elapsed)
                        if result:
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.CRITICAL,
                                title=f"Potential SSRF on parameter '{param}'",
                                description=(
                                    f"Parameter '{param}' at {endpoint} showed SSRF indicators "
                                    f"with target '{ssrf_target}': {result['indicator']}. "
                                    "SSRF can allow access to internal services and cloud metadata. "
                                    "Confirmation on staging required for Phase 2.4."
                                ),
                                evidence={
                                    **check,
                                    "indicator": result["indicator"],
                                    "detection_method": result["method"],
                                    "cloud_metadata_NOT_tested": True,
                                    "phase_2_4_required": True,
                                },
                                cwe="CWE-918",
                                cvss_score=9.8,
                                fix_effort=FixEffort.MEDIUM,
                                impact_confidence=ImpactConfidence.MEDIUM,
                                remediation=(
                                    "Validate and allowlist URLs before making server-side requests. "
                                    "Reject requests to private IP ranges (10.0.0.0/8, 172.16.0.0/12, "
                                    "192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8, [::1]). "
                                    "Use a network-level allowlist with an egress proxy. "
                                    "Never pass user-supplied URLs directly to http.get() or requests.get()."
                                ),
                                refs=[
                                    {"label": "OWASP SSRF", "url": "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/"},
                                    {"label": "CWE-918", "url": "https://cwe.mitre.org/data/definitions/918.html"},
                                ],
                            ))
                            break  # One finding per endpoint is sufficient

                    except httpx.RequestError as exc:
                        logger.debug("SSRF probe error on %s: %s", endpoint, exc)
                        continue

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


async def _get_baseline(client, endpoint, param, benign_value, headers, rate_limiter, circuit_breaker) -> Optional[dict]:
    if rate_limiter:
        await rate_limiter.acquire(endpoint)
    try:
        t_req = time.time()
        resp = await client.get(endpoint, params={param: benign_value}, headers=headers)
        elapsed = (time.time() - t_req) * 1000
        if circuit_breaker:
            circuit_breaker.record(endpoint, elapsed, resp.status_code)
        if resp.status_code >= 500:
            return None
        return {
            "status": resp.status_code,
            "elapsed_ms": round(elapsed, 1),
            "content_length": len(resp.content),
        }
    except Exception:
        return None


def _detect_ssrf(baseline: dict, resp: httpx.Response, ssrf_target: str, elapsed: float) -> Optional[dict]:
    """Compare injected response to baseline to detect SSRF indicators."""
    # Status code change (e.g. 200 → 200 with internal content, or error revealing internal stack)
    if resp.status_code >= 500 and baseline["status"] < 500:
        return {"indicator": "server_error_on_internal_target", "method": "status_code"}

    # Response time anomaly — internal connections may be faster (direct) or slower (connection refused)
    elapsed_diff = elapsed - baseline["elapsed_ms"]
    if elapsed_diff < -500:  # 500ms faster than baseline → possible internal route resolved
        return {"indicator": "faster_response_on_internal_target", "method": "timing"}

    # Internal error messages in response body
    error_patterns = [
        "connection refused",
        "econnrefused",
        "no route to host",
        "127.0.0.1",
        "localhost",
        "internal server",
        "<!doctype html>",    # may indicate content fetched from internal page
    ]
    body_lower = resp.text[:1000].lower()
    for pattern in error_patterns:
        if pattern in body_lower and pattern not in baseline.get("baseline_body", "").lower():
            return {"indicator": f"internal_reference_in_response: '{pattern}'", "method": "body_analysis"}

    return None


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
