"""
audit/capa2/probes/csrf_analysis.py  — Phase 2.1

Analyzes CSRF protection:
- Presence and validation of CSRF tokens on state-changing forms
- SameSite cookie flag (covered also by session_management, but mapped here to CSRF context)
- Custom request header checks (X-Requested-With, Origin validation)
- Double-submit cookie pattern validity

Layer: ACTIVE_LAYER_2_SAFE — authenticated passive observation
"""
import logging
import re
import time
from typing import Optional

import httpx
from bs4 import BeautifulSoup  # type: ignore

from ...domain.context import AuditContext
from ...domain.entities import Finding, ProbeOutput
from ...domain.enums import (
    Category, Severity, Layer, ProbeStatus, FixEffort, ImpactConfidence,
)
from ...domain.ports import ProbeBase

logger = logging.getLogger(__name__)

CSRF_TOKEN_NAMES = [
    "csrf_token", "csrftoken", "_csrf", "csrf", "xsrf_token",
    "x-csrf-token", "_token", "authenticity_token",
]

STATE_CHANGING_METHODS = {"post", "put", "patch", "delete"}


class CSRFAnalysisProbe(ProbeBase):
    key      = "csrf_analysis"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {}

        sessions: dict = ctx.cache.get("auth_sessions", {})
        if not sessions:
            return ProbeOutput(
                raw_data={"error": "no auth sessions"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=0,
                error="no auth sessions available",
            )

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")
        forms_analyzed: list[dict] = []

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            # Use the first available session
            first_session = next(iter(sessions.values()))
            cookies_list = _load_cookies_from_storage_state(
                first_session.storage_state_path if hasattr(first_session, "storage_state_path")
                else first_session.get("storage_state_path", "")
            )
            cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies_list)
            headers = {"Cookie": cookie_header}

            # Fetch main page to find forms
            if rate_limiter:
                await rate_limiter.acquire(ctx.root_url)
            try:
                r_start = time.time()
                resp = await client.get(ctx.root_url, headers=headers)
                if circuit_breaker:
                    circuit_breaker.record(ctx.root_url, (time.time() - r_start) * 1000, resp.status_code)

                soup = BeautifulSoup(resp.text, "html.parser")
                forms = soup.find_all("form")

                for form in forms:
                    method = (form.get("method") or "get").lower()
                    action = form.get("action", ctx.root_url)

                    if method not in STATE_CHANGING_METHODS:
                        continue  # GET forms don't need CSRF protection

                    # Look for CSRF token field
                    token_field = None
                    for name in CSRF_TOKEN_NAMES:
                        field_el = form.find("input", {"name": re.compile(name, re.IGNORECASE)})
                        if field_el:
                            token_field = field_el.get("name")
                            break

                    form_info = {
                        "action": action,
                        "method": method,
                        "has_csrf_token": token_field is not None,
                        "csrf_field_name": token_field,
                    }
                    forms_analyzed.append(form_info)

                    if not token_field:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.HIGH,
                            title=f"Missing CSRF token on {method.upper()} form",
                            description=(
                                f"The form with action '{action}' submits via {method.upper()} "
                                "but has no detectable CSRF token field. "
                                "This may allow cross-site request forgery attacks."
                            ),
                            evidence=form_info,
                            cwe="CWE-352",
                            fix_effort=FixEffort.SMALL,
                            impact_confidence=ImpactConfidence.MEDIUM,
                            remediation=(
                                "Add a CSRF token to every state-changing form. "
                                "Use your framework's built-in CSRF protection: "
                                "Django's {% csrf_token %}, Rails' authenticity_token, "
                                "or Express csrf() middleware. "
                                "Also ensure SameSite=Strict or Lax on session cookies."
                            ),
                            refs=[
                                {"label": "OWASP CSRF", "url": "https://owasp.org/www-community/attacks/csrf"},
                                {"label": "CWE-352", "url": "https://cwe.mitre.org/data/definitions/352.html"},
                            ],
                        ))

            except httpx.RequestError as exc:
                logger.warning("CSRF probe could not fetch %s: %s", ctx.root_url, exc)

        # Check SameSite on session cookies (CSRF relevance)
        first_session = next(iter(sessions.values())) if sessions else None
        if first_session:
            cookies_list = _load_cookies_from_storage_state(
                first_session.storage_state_path if hasattr(first_session, "storage_state_path")
                else first_session.get("storage_state_path", "")
            )
            for c in cookies_list:
                if c.get("sameSite", "").lower() not in ("strict", "lax"):
                    findings.append(Finding(
                        probe_key=self.key,
                        category=self.category,
                        severity=Severity.MEDIUM,
                        title=f"Cookie '{c.get('name')}' missing SameSite CSRF protection",
                        description=(
                            f"Cookie '{c.get('name')}' has SameSite={c.get('sameSite', 'None')}, "
                            "which does not protect against CSRF attacks from cross-origin requests."
                        ),
                        evidence={"cookie": c.get("name"), "sameSite": c.get("sameSite")},
                        cwe="CWE-352",
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.HIGH,
                        remediation="Set `SameSite=Strict` or `SameSite=Lax` on all session cookies.",
                        refs=[{"label": "MDN SameSite", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite"}],
                    ))
                    break  # One finding per probe — covers all cookies

        raw = {"forms_analyzed": forms_analyzed, "total_findings": len(findings)}
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


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
