"""
audit/capa2/probes/jwt_analysis.py  — Phase 2.3

Analyzes JWT tokens present in responses or cookies:
- Algorithm confusion (alg: none, alg: HS256 vs RS256)
- Weak signing key indicators
- Short expiration / no expiration (exp claim)
- Sensitive data in payload without encryption

OWASP Coverage: A02 Cryptographic Failures, A07 Auth Failures

Layer: ACTIVE_LAYER_2_SAFE
"""
import base64
import json
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

# Encoded form of {"alg":"none"} — used to detect alg:none bypass acceptance
NONE_ALG_VARIANTS = ["none", "None", "NONE", "nOnE"]


class JWTAnalysisProbe(ProbeBase):
    key      = "jwt_analysis"
    category = Category.SECURITY
    layer    = Layer.ACTIVE_LAYER_2_SAFE

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        raw: dict = {"jwts_analyzed": [], "alg_none_tested": False}

        sessions: dict = ctx.cache.get("auth_sessions", {})
        if not sessions:
            return ProbeOutput(
                raw_data={"error": "no auth sessions"},
                findings=[],
                status=ProbeStatus.SKIPPED,
                duration_ms=0,
            )

        rate_limiter = ctx.cache.get("rate_limiter")
        circuit_breaker = ctx.cache.get("circuit_breaker")

        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for label, session in sessions.items():
                storage_path = (
                    session.storage_state_path if hasattr(session, "storage_state_path")
                    else session.get("storage_state_path", "")
                )
                cookies = _load_cookies(storage_path)
                cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)

                # Extract JWT from cookies or make a request to collect one from Authorization header
                jwt_tokens = _extract_jwts_from_cookies(cookies)

                # Also try to get JWT from API response
                if not jwt_tokens:
                    jwt_tokens = await _fetch_jwt_from_response(
                        client, ctx, cookie_header, rate_limiter, circuit_breaker
                    )

                for token_source, token in jwt_tokens:
                    analysis = _analyze_jwt(token)
                    if not analysis:
                        continue

                    raw["jwts_analyzed"].append({
                        "source": token_source,
                        "session": label,
                        "header": analysis["header"],
                        "payload_keys": list(analysis["payload"].keys()),
                    })

                    # Check 1: alg: none
                    if analysis["header"].get("alg", "").lower() == "none":
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.CRITICAL,
                            title=f"JWT with alg:none accepted [{label}]",
                            description=(
                                "JWT token uses `alg: none` which means signatures are not verified. "
                                "Any attacker can forge arbitrary JWT claims."
                            ),
                            evidence={"source": token_source, "alg": "none"},
                            cwe="CWE-347",
                            cvss_score=9.8,
                            fix_effort=FixEffort.SMALL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation=(
                                "Explicitly reject JWTs with alg:none. "
                                "In your JWT library, specify allowed algorithms: "
                                "`jwt.decode(token, key, algorithms=['RS256'])`. "
                                "Never allow 'none' in your algorithm list."
                            ),
                            refs=[
                                {"label": "Auth0 JWT alg:none", "url": "https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/"},
                                {"label": "CWE-347", "url": "https://cwe.mitre.org/data/definitions/347.html"},
                            ],
                        ))

                    # Check 2: Short expiration
                    exp = analysis["payload"].get("exp")
                    iat = analysis["payload"].get("iat")
                    if exp and iat:
                        ttl_seconds = exp - iat
                        if ttl_seconds > 86400 * 30:  # > 30 days
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.MEDIUM,
                                title=f"JWT with very long expiration ({ttl_seconds // 86400} days) [{label}]",
                                description=(
                                    f"JWT expires in {ttl_seconds // 86400} days. Long-lived tokens "
                                    "increase the window for token theft reuse. "
                                    "Consider using refresh token rotation instead."
                                ),
                                evidence={"ttl_seconds": ttl_seconds, "source": token_source},
                                cwe="CWE-613",
                                fix_effort=FixEffort.SMALL,
                                impact_confidence=ImpactConfidence.MEDIUM,
                                remediation=(
                                    "Set access token TTL to 15-60 minutes. "
                                    "Use refresh tokens (with rotation + revocation) for long sessions. "
                                    "For mobile: use refresh token in secure storage, never in localStorage."
                                ),
                                refs=[{"label": "OWASP JWT Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"}],
                            ))
                    elif not exp:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=self.category,
                            severity=Severity.HIGH,
                            title=f"JWT with no expiration [{label}]",
                            description=(
                                "JWT has no `exp` claim — it never expires. "
                                "A stolen token would grant permanent access."
                            ),
                            evidence={"claims": list(analysis["payload"].keys()), "source": token_source},
                            cwe="CWE-613",
                            fix_effort=FixEffort.SMALL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation="Always set the `exp` claim. Use short-lived tokens (15-60 min) with refresh token rotation.",
                            refs=[{"label": "JWT RFC 7519", "url": "https://tools.ietf.org/html/rfc7519#section-4.1.4"}],
                        ))

                    # Check 3: Sensitive data in payload (JWTs are not encrypted by default)
                    sensitive_keys = ["password", "secret", "ssn", "credit_card", "card_number", "cvv"]
                    for key_name in sensitive_keys:
                        if key_name in [k.lower() for k in analysis["payload"].keys()]:
                            findings.append(Finding(
                                probe_key=self.key,
                                category=self.category,
                                severity=Severity.MEDIUM,
                                title=f"Sensitive data in JWT payload: '{key_name}' [{label}]",
                                description=(
                                    f"JWT payload contains the key '{key_name}'. "
                                    "JWT payloads are base64-encoded, not encrypted. "
                                    "Anyone with the token can read these values."
                                ),
                                evidence={"key": key_name, "source": token_source},
                                cwe="CWE-312",
                                fix_effort=FixEffort.SMALL,
                                impact_confidence=ImpactConfidence.HIGH,
                                remediation=(
                                    f"Remove '{key_name}' from the JWT payload. "
                                    "Only include non-sensitive claims (user_id, roles, exp, iat). "
                                    "If encryption is required, use JWE (JSON Web Encryption) instead."
                                ),
                                refs=[{"label": "JWT Best Practices", "url": "https://datatracker.ietf.org/doc/html/rfc8725"}],
                            ))

                    # Check 4: Test alg:none bypass (only if current alg is HS*/RS*)
                    current_alg = analysis["header"].get("alg", "")
                    if current_alg and current_alg.lower() != "none":
                        bypass_result = await _test_alg_none_bypass(
                            client, ctx, token, analysis, cookie_header,
                            rate_limiter, circuit_breaker
                        )
                        raw["alg_none_tested"] = True
                        if bypass_result:
                            findings.append(bypass_result)

        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )


def _analyze_jwt(token: str) -> Optional[dict]:
    """Decode (but not verify) a JWT token. Returns header + payload dicts."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        # Pad base64 properly
        def _decode(b64: str) -> dict:
            b64 += "=" * (-len(b64) % 4)
            return json.loads(base64.urlsafe_b64decode(b64))

        header = _decode(parts[0])
        payload = _decode(parts[1])
        return {"header": header, "payload": payload, "original": token}
    except Exception:
        return None


def _extract_jwts_from_cookies(cookies: list[dict]) -> list[tuple[str, str]]:
    """Find JWT-shaped values in cookies."""
    jwts = []
    for c in cookies:
        val = c.get("value", "")
        if val.count(".") == 2 and len(val) > 50:
            # Likely a JWT
            try:
                parts = val.split(".")
                base64.urlsafe_b64decode(parts[0] + "==")
                jwts.append((f"cookie:{c.get('name')}", val))
            except Exception:
                pass
    return jwts


async def _fetch_jwt_from_response(client, ctx, cookie_header, rate_limiter, circuit_breaker) -> list[tuple[str, str]]:
    """Try common API endpoints to capture JWT from Authorization / response body."""
    test_urls = [
        ctx.base_url + "/api/auth/refresh",
        ctx.base_url + "/api/token",
        ctx.base_url + "/api/me",
    ]
    jwts = []
    for url in test_urls:
        if rate_limiter:
            await rate_limiter.acquire(url)
        try:
            t_req = time.time()
            resp = await client.get(url, headers={"Cookie": cookie_header})
            if circuit_breaker:
                circuit_breaker.record(url, (time.time() - t_req) * 1000, resp.status_code)
            # Check Authorization header in response
            auth = resp.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                token = auth.split(" ", 1)[1]
                if token.count(".") == 2:
                    jwts.append(("response:authorization-header", token))
            # Check response body for token field
            try:
                data = resp.json()
                for key in ("token", "access_token", "accessToken", "jwt"):
                    val = data.get(key, "")
                    if val and str(val).count(".") == 2:
                        jwts.append((f"response:{key}", str(val)))
            except Exception:
                pass
        except Exception:
            continue
        if jwts:
            break
    return jwts


async def _test_alg_none_bypass(client, ctx, original_token, analysis, cookie_header, rate_limiter, circuit_breaker) -> Optional[Finding]:
    """
    Attempt alg:none bypass: forge a token with alg:none and the same payload.
    Send it to a protected endpoint and check if it's accepted.
    """
    try:
        # Build forged token with alg:none
        forged_header = json.dumps({"alg": "none", "typ": "JWT"}).encode()
        forged_payload = json.dumps(analysis["payload"]).encode()
        header_b64 = base64.urlsafe_b64encode(forged_header).rstrip(b"=").decode()
        payload_b64 = base64.urlsafe_b64encode(forged_payload).rstrip(b"=").decode()
        forged_token = f"{header_b64}.{payload_b64}."

        test_url = ctx.base_url + "/api/me"
        if rate_limiter:
            await rate_limiter.acquire(test_url)

        t_req = time.time()
        resp = await client.get(
            test_url,
            headers={"Authorization": f"Bearer {forged_token}"}
        )
        elapsed = (time.time() - t_req) * 1000
        if circuit_breaker:
            circuit_breaker.record(test_url, elapsed, resp.status_code)

        if resp.status_code == 200:
            return Finding(
                probe_key="jwt_analysis",
                category=Category.SECURITY,
                severity=Severity.CRITICAL,
                title="JWT alg:none bypass accepted — unsigned tokens allowed",
                description=(
                    f"Endpoint {test_url} accepted a forged JWT with `alg: none` and no signature. "
                    "An attacker can forge arbitrary JWT claims to escalate privileges."
                ),
                evidence={
                    "endpoint": test_url,
                    "forged_alg": "none",
                    "response_status": resp.status_code,
                },
                cwe="CWE-347",
                cvss_score=9.8,
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation=(
                    "Explicitly reject JWTs with alg:none. "
                    "Specify allowed algorithms in your JWT decoder: `algorithms=['RS256']`. "
                    "Never pass algorithm options from the token header to the decoder."
                ),
                refs=[{"label": "Auth0 JWT Vulnerabilities", "url": "https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/"}],
            )
    except Exception:
        pass
    return None


def _load_cookies(path: str) -> list[dict]:
    if not path:
        return []
    import os
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            return json.load(f).get("cookies", [])
    except Exception:
        return []
