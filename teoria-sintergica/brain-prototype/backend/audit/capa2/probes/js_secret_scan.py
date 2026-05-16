"""
audit/capa2/probes/js_secret_scan.py  — Phase 2.2

Scans JavaScript files for accidentally exposed secrets:
- API keys, tokens, passwords
- Private keys
- Bearer tokens
- AWS/GCP/Azure credentials

Detection only — no secret is extracted or reported in full.
Evidence includes the file path, line number, pattern type, and a
REDACTED snippet (first 6 chars + *** so a human can verify without
the assistant logging the full secret).

Layer: ACTIVE_LAYER_2_SAFE
"""
import asyncio
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
from ..config import JS_SECRET_PATTERNS

logger = logging.getLogger(__name__)

_COMPILED_PATTERNS = [(p, re.compile(p)) for p in JS_SECRET_PATTERNS]

MAX_JS_FILES = 20           # Don't scan every single JS file
MAX_JS_SIZE_KB = 2048       # Skip huge bundles that would take too long


class JsSecretScanProbe(ProbeBase):
    key      = "js_secret_scan"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {}

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            # 1. Discover JS files from the main page
            if rate_limiter:
                await rate_limiter.acquire(ctx.root_url)
            try:
                t_req = time.time()
                resp = await client.get(ctx.root_url)
                if circuit_breaker:
                    circuit_breaker.record(ctx.root_url, (time.time() - t_req) * 1000, resp.status_code)
            except httpx.RequestError as exc:
                return ProbeOutput(
                    raw_data={"error": str(exc)},
                    findings=[],
                    status=ProbeStatus.FAILED,
                    duration_ms=int((time.time() - t0) * 1000),
                    error=str(exc),
                )

            js_urls = _extract_js_urls(resp.text, ctx.base_url)[:MAX_JS_FILES]
            raw["js_files_found"] = len(js_urls)
            raw["js_files_scanned"] = 0
            raw["hits"] = []

            # 2. Scan each JS file
            for js_url in js_urls:
                if rate_limiter:
                    await rate_limiter.acquire(js_url)
                try:
                    t_req = time.time()
                    js_resp = await client.get(js_url)
                    elapsed = (time.time() - t_req) * 1000
                    if circuit_breaker:
                        circuit_breaker.record(js_url, elapsed, js_resp.status_code)

                    if js_resp.status_code != 200:
                        continue
                    if len(js_resp.content) > MAX_JS_SIZE_KB * 1024:
                        logger.debug("Skipping large JS file: %s", js_url)
                        continue

                    raw["js_files_scanned"] += 1
                    hits = _scan_for_secrets(js_resp.text, js_url)
                    raw["hits"].extend(hits)

                    for hit in hits:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.CRITICAL,
                            title=f"Potential secret in JS: {hit['pattern_type']}",
                            description=(
                                f"Pattern '{hit['pattern_type']}' matched in {js_url}. "
                                "Secrets embedded in client-side JS are visible to all visitors."
                            ),
                            evidence={
                                "file": js_url,
                                "pattern_type": hit["pattern_type"],
                                "redacted_value": hit["redacted"],
                                "line_hint": hit.get("line_hint"),
                            },
                            cwe="CWE-312",
                            fix_effort=FixEffort.MEDIUM,
                            impact_confidence=ImpactConfidence.MEDIUM,
                            remediation=(
                                f"Remove the {hit['pattern_type']} from client-side code. "
                                "Move all secrets to server-side environment variables. "
                                "If exposed: rotate the credential immediately. "
                                "Use build-time config injection that strips secrets from bundles."
                            ),
                            refs=[
                                {"label": "OWASP A02 Cryptographic Failures", "url": "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/"},
                                {"label": "CWE-312", "url": "https://cwe.mitre.org/data/definitions/312.html"},
                            ],
                        ))

                except httpx.RequestError as exc:
                    logger.debug("Failed to fetch JS %s: %s", js_url, exc)
                    continue

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _extract_js_urls(html: str, base_url: str) -> list[str]:
    """Find all <script src="..."> URLs in the page."""
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for tag in soup.find_all("script", src=True):
        src = tag.get("src", "")
        if not src:
            continue
        full = urljoin(base_url, src)
        parsed = urlparse(full)
        # Only scan same-origin JS (third-party CDN files are out of scope)
        base_parsed = urlparse(base_url)
        if parsed.netloc == base_parsed.netloc:
            urls.append(full)
    return urls


def _scan_for_secrets(content: str, file_url: str) -> list[dict]:
    """Scan JS content for secret patterns. Returns redacted hits."""
    hits = []
    lines = content.splitlines()
    seen_patterns: set[str] = set()

    for line_num, line in enumerate(lines, 1):
        for pattern_str, pattern in _COMPILED_PATTERNS:
            match = pattern.search(line)
            if match:
                full_match = match.group(0)
                # Deduplicate: same pattern type per file
                dedup_key = f"{file_url}:{pattern_str}"
                if dedup_key in seen_patterns:
                    continue
                seen_patterns.add(dedup_key)

                # Redact: show first 8 chars only
                redacted = full_match[:8] + "***" if len(full_match) > 8 else "***"
                # Pattern type label
                pattern_type = _label_pattern(pattern_str)
                hits.append({
                    "pattern_type": pattern_type,
                    "redacted": redacted,
                    "line_hint": line_num,
                    "file": file_url,
                })
                logger.info("Secret pattern hit in %s line %d: %s", file_url, line_num, pattern_type)
    return hits


def _label_pattern(pattern_str: str) -> str:
    labels = {
        "api[_-]?key": "API Key",
        "secret|token": "Secret/Token",
        "password": "Password",
        "aws|gcp|azure": "Cloud Credential",
        "PRIVATE KEY": "Private Key",
        "bearer": "Bearer Token",
        "Authorization": "Authorization Header",
    }
    for key, label in labels.items():
        if re.search(key, pattern_str, re.IGNORECASE):
            return label
    return "Unknown Secret Pattern"
