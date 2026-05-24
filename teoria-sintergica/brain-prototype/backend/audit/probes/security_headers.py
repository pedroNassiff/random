"""
audit/probes/security_headers.py

Checks HTTP response headers for key security directives.
Layer 1 — passive, single request.
"""
import time
import httpx

from ..domain.ports import ProbeBase
from ..domain.context import AuditContext
from ..domain.entities import Finding, ProbeOutput
from ..domain.enums import (
    Category, Layer, Severity, ProbeStatus, FixEffort, ImpactConfidence
)

_REQUIRED_HEADERS = {
    "strict-transport-security": {
        "severity": Severity.HIGH,
        "title": "Sin HSTS (Strict-Transport-Security)",
        "description": (
            "Sin HSTS el navegador permite conexiones HTTP no cifradas al mismo dominio. "
            "Un atacante en la red puede interceptar la redirección de HTTP a HTTPS (SSL stripping)."
        ),
        "fix": "Añadir Strict-Transport-Security: max-age=31536000; includeSubDomains",
        "fix_effort": FixEffort.TRIVIAL,
        "refs": [
            {"type": "owasp", "url": "https://owasp.org/www-project-secure-headers/#strict-transport-security",
             "title": "OWASP HSTS"},
        ],
    },
    "content-security-policy": {
        "severity": Severity.HIGH,
        "title": "Sin CSP (Content-Security-Policy)",
        "description": (
            "Sin CSP el navegador ejecutará cualquier script, estilo o recurso externo sin restricción. "
            "Amplia superficie de ataque para XSS."
        ),
        "fix": "Definir CSP estricta. Empezar con Content-Security-Policy: default-src 'self'",
        "fix_effort": FixEffort.MEDIUM,
        "refs": [
            {"type": "mdn", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
             "title": "MDN Content-Security-Policy"},
        ],
    },
    "x-content-type-options": {
        "severity": Severity.LOW,
        "title": "Sin X-Content-Type-Options",
        "description": (
            "Sin este header el navegador puede inferir el tipo MIME de una respuesta, "
            "posibilitando ataques de MIME-sniffing."
        ),
        "fix": "Añadir X-Content-Type-Options: nosniff",
        "fix_effort": FixEffort.TRIVIAL,
    },
    "referrer-policy": {
        "severity": Severity.LOW,
        "title": "Sin Referrer-Policy",
        "description": (
            "Sin este header el navegador envía la URL completa como Referer a sitios externos, "
            "filtrando paths internos y parámetros sensibles."
        ),
        "fix": "Añadir Referrer-Policy: strict-origin-when-cross-origin",
        "fix_effort": FixEffort.TRIVIAL,
    },
    "permissions-policy": {
        "severity": Severity.MEDIUM,
        "title": "Sin Permissions-Policy",
        "description": (
            "Sin Permissions-Policy cualquier script de terceros (ads, analytics) puede "
            "acceder a cámara, micrófono, geolocalización sin restricciones explícitas."
        ),
        "fix": "Añadir Permissions-Policy: camera=(), microphone=(), geolocation=()",
        "fix_effort": FixEffort.TRIVIAL,
    },
    "x-frame-options": {
        "severity": Severity.MEDIUM,
        "title": "Sin X-Frame-Options",
        "description": (
            "El sitio puede ser embebido en un iframe por cualquier dominio, "
            "permitiendo ataques de clickjacking."
        ),
        "fix": "Añadir X-Frame-Options: SAMEORIGIN (o usar CSP frame-ancestors)",
        "fix_effort": FixEffort.TRIVIAL,
    },
}

_CSP_UNSAFE = ["unsafe-inline", "unsafe-eval", "unsafe-hashes"]
_SERVER_LEAK_HEADERS = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"]


class SecurityHeadersProbe(ProbeBase):
    key      = "security_headers"
    category = Category.SECURITY
    layer    = Layer.PASSIVE_LAYER_1

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
                r = await client.get(
                    ctx.root_url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; RandomLabAudit/1.0)"},
                )
            headers = {k.lower(): v for k, v in r.headers.items()}
        except Exception as exc:
            return ProbeOutput(
                raw_data={}, findings=[],
                status=ProbeStatus.FAILED,
                duration_ms=int((time.time() - t0) * 1000),
                error=str(exc),
            )

        # ── 1. Required headers ───────────────────────────────────────────────
        for header_name, spec in _REQUIRED_HEADERS.items():
            if header_name not in headers:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=spec["severity"],
                    title=spec["title"],
                    description=spec["description"],
                    evidence={"observed_headers": sorted(headers.keys())},
                    fix_effort=spec.get("fix_effort", FixEffort.TRIVIAL),
                    impact_confidence=ImpactConfidence.LOW,
                    refs=spec.get("refs", []),
                    remediation=spec.get("fix"),
                ))

        # ── 2. CSP quality check (if present) ────────────────────────────────
        csp = headers.get("content-security-policy", "")
        if csp:
            unsafe_found = [u for u in _CSP_UNSAFE if u in csp]
            if unsafe_found:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title=f"CSP debilitada con {', '.join(unsafe_found)}",
                    description=(
                        f"La CSP contiene {', '.join(unsafe_found)}, lo que anula gran parte "
                        "de su protección contra XSS. Los frameworks modernos no necesitan estas directivas."
                    ),
                    evidence={"csp": csp},
                    fix_effort=FixEffort.MEDIUM,
                    impact_confidence=ImpactConfidence.MEDIUM,
                    refs=[{
                        "type": "doc",
                        "url": "https://csp.withgoogle.com/docs/strict-csp.html",
                        "title": "Google Strict CSP Guide",
                    }],
                    remediation="Eliminar unsafe-inline y unsafe-eval. Usar nonces (nonce-{base64}) o hashes en cada directiva. Guía: csp.withgoogle.com/docs/strict-csp.html",
                ))

        # ── 3. Information disclosure via server headers ───────────────────────
        for hdr in _SERVER_LEAK_HEADERS:
            val = headers.get(hdr, "")
            if val:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title=f"Info disclosure via header {hdr}",
                    description=(
                        f"El header `{hdr}: {val}` expone la tecnología y posible versión del servidor. "
                        "Facilita fingerprinting para atacantes."
                    ),
                    evidence={"header": hdr, "value": val},
                    fix_effort=FixEffort.TRIVIAL,
                    impact_confidence=ImpactConfidence.LOW,
                    remediation=f"Eliminar o vaciar el header '{hdr}' en la configuración del servidor. En Nginx: add_header {hdr} ''; En Apache: Header unset {hdr}",
                ))

        # ── 4. HSTS quality check ─────────────────────────────────────────────
        hsts = headers.get("strict-transport-security", "")
        if hsts:
            if "max-age" in hsts:
                try:
                    max_age = int(
                        next(p for p in hsts.split(";") if "max-age" in p)
                        .split("=")[1].strip()
                    )
                    if max_age < 15552000:  # < 180 days
                        findings.append(Finding(
                            probe_key=self.key,
                            category=Category.SECURITY,
                            severity=Severity.LOW,
                            title="HSTS max-age demasiado corto",
                            description=(
                                f"HSTS max-age={max_age}s (~{max_age//86400} días). "
                                "Se recomienda mínimo 180 días (15552000s), idealmente 1 año."
                            ),
                            evidence={"hsts": hsts, "max_age_days": max_age // 86400},
                            fix_effort=FixEffort.TRIVIAL,
                            impact_confidence=ImpactConfidence.LOW,
                            remediation="Incrementar max-age a 31536000 (1 año). Ejemplo: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
                        ))
                except (StopIteration, ValueError, IndexError):
                    pass

        duration = int((time.time() - t0) * 1000)
        return ProbeOutput(
            raw_data={"headers": dict(headers), "status_code": r.status_code},
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=duration,
        )
