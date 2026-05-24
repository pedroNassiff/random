"""
audit/probes/ct_logs.py

Certificate Transparency logs — discover exposed subdomains via crt.sh.
Layer 1 — passive, public API.
"""
import time
import httpx
from urllib.parse import urlparse

from ..domain.ports import ProbeBase
from ..domain.context import AuditContext
from ..domain.entities import Finding, ProbeOutput
from ..domain.enums import (
    Category, Layer, Severity, ProbeStatus, FixEffort, ImpactConfidence
)

_CRTSH_API = "https://crt.sh/?q={domain}&output=json"

# Subdomains that typically indicate forgotten infrastructure
_RISKY_PREFIXES = [
    "dev", "staging", "stage", "test", "qa", "uat", "demo",
    "beta", "alpha", "preview", "old", "legacy", "v1", "v2",
    "admin", "backend", "api-dev", "api-staging", "internal",
    "jenkins", "gitlab", "jira", "confluence", "grafana",
    "vpn", "ssh", "mail-dev", "smtp-dev",
]


def _extract_domain_from_url(url: str) -> str:
    parsed = urlparse(url if url.startswith("http") else "https://" + url)
    host = parsed.netloc or parsed.path
    # strip port
    return host.split(":")[0].lstrip("www.")


class CTLogsProbe(ProbeBase):
    key      = "ct_logs"
    category = Category.SECURITY
    layer    = Layer.PASSIVE_LAYER_1

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        domain = _extract_domain_from_url(ctx.root_url)

        raw: dict = {"domain": domain}

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"https://crt.sh/?q=%.{domain}&output=json",
                    headers={"Accept": "application/json"},
                )
                if r.status_code != 200:
                    raise ValueError(f"crt.sh returned {r.status_code}")
                entries = r.json()
        except Exception as exc:
            return ProbeOutput(
                raw_data={"error": str(exc)},
                findings=[],
                status=ProbeStatus.PARTIAL,
                duration_ms=int((time.time() - t0) * 1000),
                error=str(exc),
            )

        # Deduplicate subdomains
        seen: set[str] = set()
        subdomains: list[str] = []
        for entry in entries:
            names = entry.get("name_value", "")
            for name in names.splitlines():
                name = name.strip().lstrip("*. ")
                if name and name != domain and name not in seen:
                    seen.add(name)
                    subdomains.append(name)

        raw["total_subdomains"] = len(subdomains)
        raw["subdomains_sample"] = sorted(subdomains)[:50]

        # Find risky/forgotten subdomains
        risky = [
            s for s in subdomains
            if any(s.startswith(p + ".") or s.split(".")[0] == p for p in _RISKY_PREFIXES)
        ]
        raw["risky_subdomains"] = risky

        if risky:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title=f"{len(risky)} subdominios de staging/dev expuestos en CT logs",
                description=(
                    f"Los siguientes subdominios están registrados en Certificate Transparency y "
                    "típicamente corresponden a entornos no endurecidos: "
                    f"{', '.join(risky[:8])}{'...' if len(risky) > 8 else ''}. "
                    "Son vectores de ataque frecuentes (credenciales por defecto, acceso sin auth, versiones desactualizadas)."
                ),
                evidence={"risky_subdomains": risky, "total_subdomains": len(subdomains)},
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.MEDIUM,
                refs=[{
                    "type": "doc",
                    "url": "https://crt.sh",
                    "title": "crt.sh Certificate Search",
                }],
                remediation="Revisar cada subdominio listado: desactivar los no usados, proteger los necesarios con autenticación HTTP Basic o listas de IPs. Auditar versiones de software en cada entorno.",
            ))

        if len(subdomains) > 30:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.INFO,
                title=f"Gran superficie de ataque: {len(subdomains)} subdominios en CT logs",
                description=(
                    f"Se detectaron {len(subdomains)} subdominios únicos registrados históricamente. "
                    "Cada subdominio activo es una potencial superficie de ataque adicional."
                ),
                evidence={"total": len(subdomains), "sample": sorted(subdomains)[:20]},
                fix_effort=FixEffort.LARGE,
                impact_confidence=ImpactConfidence.LOW,
                remediation="Auditar todos los subdominios activos con nmap o similar. Eliminar registros DNS de subdominios no usados. Implementar monitoreo de subdomain takeover (p.ej. subjack).",
            ))

        duration = int((time.time() - t0) * 1000)
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=duration,
        )
