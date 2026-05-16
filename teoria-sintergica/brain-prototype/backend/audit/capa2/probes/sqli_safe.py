"""
audit/capa2/probes/sqli_safe.py  — Phase 2.3

Safe SQLi detection. Detection-only — no data extraction.

Approach:
- Inject 5 payloads into GET/POST parameters
- Detect anomalous behavior: error messages, timing differences, response size changes
- NO UNION SELECT, NO --dbs, NO --dump
- If confirmed: report for fix + flag for Phase 2.4 staging confirmation

OWASP Coverage: A03 Injection

Layer: ACTIVE_LAYER_2_SAFE
"""
import logging
import re
import time
from typing import Optional

import httpx

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase
from ..config import SQLI_PAYLOADS

logger = logging.getLogger(__name__)

# SQL error message patterns across common databases
SQLI_ERROR_PATTERNS = [
    r"you have an error in your sql syntax",
    r"warning: mysql",
    r"unrecognized token",
    r"sqlite[._]exception",
    r"org\.postgresql\.util",
    r"psql error",
    r"microsoft ole db provider for sql server",
    r"odbc sql server driver",
    r"ora-\d{5}",              # Oracle
    r"db2 sql error",
    r"syntax error.*near",
    r"invalid sql statement",
    r"unclosed quotation mark",
    r"quoted string not properly terminated",
]
_COMPILED_ERROR_PATTERNS = [re.compile(p, re.IGNORECASE) for p in SQLI_ERROR_PATTERNS]

# Max parameters to test per endpoint (detection-not-exploitation cap)
MAX_PARAMS = 5
MAX_ENDPOINTS_TO_TEST = 10


class SQLiSafeProbe(ProbeBase):
    key      = "sqli_safe"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"endpoints_tested": [], "injections_sent": 0}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        # Get endpoints from Phase 2.2 discovery (cache) or config
        endpoints_with_params = _get_endpoints_with_params(ctx)
        if not endpoints_with_params:
            return ProbeOutput(
                raw_data={"note": "No parameterized endpoints found. Run endpoint_discovery first."},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=int((time.time() - t0) * 1000),
            )

        sessions: dict = ctx.cache.get("auth_sessions", {})
        cookie_header = _get_cookie_header_from_sessions(sessions)
        auth_headers = {"Cookie": cookie_header} if cookie_header else {}

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for endpoint_info in endpoints_with_params[:MAX_ENDPOINTS_TO_TEST]:
                endpoint = endpoint_info["url"]
                params = endpoint_info.get("params", [])[:MAX_PARAMS]

                endpoint_result: dict = {"url": endpoint, "params_tested": [], "findings": []}

                for param in params:
                    baseline_response = await _get_baseline(client, endpoint, param, auth_headers, rate_limiter, circuit_breaker)
                    if baseline_response is None:
                        continue

                    for payload in SQLI_PAYLOADS:
                        if rate_limiter:
                            await rate_limiter.acquire(endpoint)

                        try:
                            t_req = time.time()
                            resp = await _inject_payload(client, endpoint, param, payload, auth_headers)
                            elapsed = (time.time() - t_req) * 1000

                            if circuit_breaker:
                                circuit_breaker.record(endpoint, elapsed, resp.status_code)

                            raw["injections_sent"] += 1
                            result = _analyze_response(
                                baseline=baseline_response,
                                injected=resp,
                                payload=payload,
                                param=param,
                                endpoint=endpoint,
                            )

                            if result:
                                endpoint_result["findings"].append(result)
                                findings.append(Finding(
                                    probe_key=self.key,
                                    category=self.category,
                                    severity=Severity.CRITICAL,
                                    title=f"Potential SQLi on parameter '{param}'",
                                    description=(
                                        f"Parameter '{param}' at {endpoint} showed anomalous behavior "
                                        f"with payload `{_redact_payload(payload)}`. "
                                        f"Indicator: {result['indicator']}. "
                                        "Requires confirmation in Phase 2.4 (staging)."
                                    ),
                                    evidence={
                                        **result,
                                        "payload_type": "detection_only",
                                        "phase_2_4_required": True,
                                    },
                                    cwe="CWE-89",
                                    cvss_score=9.8,
                                    fix_effort=FixEffort.MEDIUM,
                                    impact_confidence=ImpactConfidence.MEDIUM,
                                    remediation=(
                                        "Use parameterized queries / prepared statements. "
                                        "NEVER concatenate user input into SQL strings. "
                                        "Python/SQLAlchemy: `session.execute(text('SELECT * FROM t WHERE id=:id'), {'id': user_id})`. "
                                        "Django ORM: use `.filter(id=user_id)` — never `.raw(f'...{user_id}')`. "
                                        "Also add WAF rule for common SQLi patterns."
                                    ),
                                    refs=[
                                        {"label": "OWASP SQLi", "url": "https://owasp.org/www-community/attacks/SQL_Injection"},
                                        {"label": "CWE-89", "url": "https://cwe.mitre.org/data/definitions/89.html"},
                                    ],
                                ))
                                break  # One confirmed finding per param is enough

                        except httpx.RequestError as exc:
                            logger.debug("SQLi probe error on %s param %s: %s", endpoint, param, exc)
                            continue

                endpoint_result["params_tested"].append(param)
                raw["endpoints_tested"].append(endpoint_result)

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


async def _get_baseline(client, endpoint, param, headers, rate_limiter, circuit_breaker) -> Optional[httpx.Response]:
    """Fetch the endpoint with an innocuous value to establish baseline."""
    if rate_limiter:
        await rate_limiter.acquire(endpoint)
    try:
        resp = await client.get(endpoint, params={param: "1"}, headers=headers)
        if circuit_breaker:
            circuit_breaker.record(endpoint, 0, resp.status_code)
        return resp
    except Exception:
        return None


async def _inject_payload(client, endpoint, param, payload, headers) -> httpx.Response:
    """Send a GET request with the injection payload."""
    return await client.get(endpoint, params={param: payload}, headers=headers)


def _analyze_response(baseline: httpx.Response, injected: httpx.Response,
                       payload: str, param: str, endpoint: str) -> Optional[dict]:
    """Detect SQLi indicators by comparing injected response to baseline."""
    # Error-based detection
    for pattern in _COMPILED_ERROR_PATTERNS:
        if pattern.search(injected.text):
            return {
                "indicator": "sql_error_message",
                "param": param,
                "payload": _redact_payload(payload),
                "error_snippet": injected.text[:300],
                "detection_method": "error_based",
            }

    # Boolean-based: significant response size difference
    baseline_len = len(baseline.content)
    injected_len = len(injected.content)
    if baseline_len > 0:
        diff_ratio = abs(injected_len - baseline_len) / baseline_len
        if diff_ratio > 0.5 and abs(injected_len - baseline_len) > 100:
            return {
                "indicator": "response_size_anomaly",
                "param": param,
                "payload": _redact_payload(payload),
                "baseline_size": baseline_len,
                "injected_size": injected_len,
                "diff_ratio": round(diff_ratio, 2),
                "detection_method": "boolean_based",
            }

    # Status code change
    if injected.status_code >= 500 and baseline.status_code < 500:
        return {
            "indicator": "server_error_on_injection",
            "param": param,
            "payload": _redact_payload(payload),
            "baseline_status": baseline.status_code,
            "injected_status": injected.status_code,
            "detection_method": "error_based",
        }

    return None


def _get_endpoints_with_params(ctx: AuditContext) -> list[dict]:
    """Get parameterized endpoints from cache (Phase 2.2 discovery) or config."""
    # From Phase 2.2 endpoint_discovery cache
    discovered = ctx.cache.get("endpoint_discovery_results", {})
    api_endpoints = discovered.get("api_endpoints_discovered", [])

    # From explicit config
    config_endpoints = ctx.config.get("capa2", {}).get("parameterized_endpoints", [])

    result = []
    for url in config_endpoints:
        if isinstance(url, dict):
            result.append(url)
        else:
            # Guess common parameter names
            result.append({"url": url, "params": ["id", "q", "search", "filter", "page"]})

    for url in api_endpoints:
        result.append({"url": url, "params": ["id", "q", "search", "filter"]})

    # Common patterns on the base URL
    if not result:
        base = ctx.base_url
        result = [
            {"url": base + "/api/search", "params": ["q", "query", "search"]},
            {"url": base + "/api/users", "params": ["id", "email", "filter"]},
            {"url": base + "/search", "params": ["q", "query"]},
        ]

    return result


def _get_cookie_header_from_sessions(sessions: dict) -> str:
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


def _redact_payload(payload: str) -> str:
    """Safe representation of payload for logging — no full injection strings in evidence."""
    if len(payload) > 20:
        return payload[:10] + "..."
    return payload
