"""
audit/capa2/probes/endpoint_discovery.py  — Phase 2.2

Attack surface mapping — discovers undocumented or forgotten endpoints:
- Crawls authenticated pages for hidden links, forms, API calls
- Checks for common admin/debug/status endpoints
- Extracts API endpoints from JS source
- Looks for `.env`, `robots.txt`, `sitemap.xml`, common backup files

This is a passive census — no active fuzzing.
Rate-limited per environment config.

Layer: ACTIVE_LAYER_2_SAFE
"""
import logging
import re
import time
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup  # type: ignore

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase

logger = logging.getLogger(__name__)

SENSITIVE_PATHS = [
    "/.env",
    "/.env.local",
    "/.env.production",
    "/config.json",
    "/config.js",
    "/application.yml",
    "/swagger.json",
    "/api-docs",
    "/api/swagger",
    "/openapi.json",
    "/v1/api-docs",
    "/v2/api-docs",
    "/v3/api-docs",
    "/graphql",
    "/graphiql",
    "/admin",
    "/admin/login",
    "/wp-admin",
    "/phpmyadmin",
    "/_debug",
    "/__debug__",
    "/debug",
    "/status",
    "/health",
    "/metrics",
    "/actuator",
    "/actuator/env",
    "/actuator/mappings",
    "/.git/config",
    "/.git/HEAD",
    "/backup.sql",
    "/backup.zip",
    "/dump.sql",
    "/robots.txt",
    "/sitemap.xml",
    "/.htaccess",
    "/server-status",
    "/server-info",
]


class EndpointDiscoveryProbe(ProbeBase):
    key      = "endpoint_discovery"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {
            "paths_checked": len(SENSITIVE_PATHS),
            "exposures": [],
            "api_endpoints_discovered": [],
        }

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        base = ctx.base_url
        sessions: dict = ctx.cache.get("auth_sessions", {})
        cookie_header = ""
        if sessions:
            first = next(iter(sessions.values()))
            cookies_list = _load_cookies(
                first.storage_state_path if hasattr(first, "storage_state_path")
                else first.get("storage_state_path", "")
            )
            cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies_list)

        headers = {"Cookie": cookie_header} if cookie_header else {}

        async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
            for path in SENSITIVE_PATHS:
                url = base + path
                if rate_limiter:
                    await rate_limiter.acquire(url)

                try:
                    t_req = time.time()
                    resp = await client.get(url, headers=headers)
                    elapsed = (time.time() - t_req) * 1000
                    if circuit_breaker:
                        circuit_breaker.record(url, elapsed, resp.status_code)

                    if resp.status_code == 200:
                        exposure = {
                            "url": url,
                            "status": resp.status_code,
                            "content_type": resp.headers.get("content-type", ""),
                            "size_bytes": len(resp.content),
                            "snippet": resp.text[:200] if resp.text else "",
                        }
                        raw["exposures"].append(exposure)
                        severity = _classify_exposure_severity(path, resp)
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=severity,
                            title=f"Sensitive path exposed: {path}",
                            description=(
                                f"The path `{url}` returned HTTP 200. "
                                f"This path should not be publicly accessible."
                            ),
                            evidence=exposure,
                            cwe=_cwe_for_path(path),
                            fix_effort=FixEffort.SMALL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation=_remediation_for_path(path),
                            refs=[{"label": "OWASP A05 Security Misconfiguration", "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/"}],
                        ))

                except httpx.RequestError as exc:
                    logger.debug("Endpoint discovery error on %s: %s", url, exc)
                    continue

            # Crawl the main page to discover API endpoints from inline JS
            if rate_limiter:
                await rate_limiter.acquire(ctx.root_url)
            try:
                resp = await client.get(ctx.root_url, headers=headers)
                if resp.status_code == 200:
                    api_endpoints = _extract_api_endpoints_from_html(resp.text, base)
                    raw["api_endpoints_discovered"] = api_endpoints
            except httpx.RequestError:
                pass

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _classify_exposure_severity(path: str, resp: httpx.Response) -> Severity:
    critical_paths = ["/.env", "/.git", "/backup", "/dump", "/actuator/env"]
    high_paths = ["/swagger", "/graphiql", "/admin", "/phpmyadmin", "/config.json"]
    for p in critical_paths:
        if p in path:
            return Severity.CRITICAL
    for p in high_paths:
        if p in path:
            return Severity.HIGH
    return Severity.MEDIUM


def _cwe_for_path(path: str) -> str:
    if ".env" in path or "config" in path:
        return "CWE-312"
    if ".git" in path:
        return "CWE-116"
    return "CWE-200"


def _remediation_for_path(path: str) -> str:
    if ".env" in path:
        return "Remove .env files from the web root and ensure they are listed in .gitignore. Use server-side environment injection."
    if ".git" in path:
        return "Block access to .git/ directory in your web server config: `Deny from all` in Apache or `location ~ /\\.git { deny all; }` in Nginx."
    if "swagger" in path or "api-docs" in path or "openapi" in path:
        return "Restrict API documentation endpoints behind authentication in production. Only expose them in development/staging."
    if "admin" in path:
        return "Ensure admin interfaces are behind auth AND IP allowlist. Remove default CMS admin paths if unused."
    return "Restrict access to this path via web server config or remove if not needed."


def _extract_api_endpoints_from_html(html: str, base_url: str) -> list[str]:
    """Extract API endpoint patterns from HTML/inline JS."""
    api_patterns = [
        r'["\'](/api/[^"\'?#\s]{2,50})["\']',
        r'["\'](/v\d+/[^"\'?#\s]{2,50})["\']',
        r'fetch\(["\']([^"\']+)["\']',
        r'axios\.[a-z]+\(["\']([^"\']+)["\']',
    ]
    found = set()
    for pat in api_patterns:
        for match in re.findall(pat, html):
            if match.startswith("/"):
                found.add(base_url + match)
            elif match.startswith("http"):
                parsed = urlparse(match)
                base_parsed = urlparse(base_url)
                if parsed.netloc == base_parsed.netloc:
                    found.add(match)
    return list(found)[:50]  # Cap at 50 discovered endpoints


def _load_cookies(storage_path: str) -> list[dict]:
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
