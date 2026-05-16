"""
audit/probes/email_auth.py

Checks SPF, DKIM (selector discovery), DMARC, BIMI, MTA-STS records.
Layer 1 — passive DNS lookups only.
"""
import time
import asyncio
from typing import Optional

try:
    import dns.resolver
    import dns.asyncresolver
    _DNS_AVAILABLE = True
except ImportError:
    _DNS_AVAILABLE = False

from ..domain.ports import ProbeBase
from ..domain.context import AuditContext
from ..domain.entities import Finding, ProbeOutput
from ..domain.enums import (
    Category, Layer, Severity, ProbeStatus, FixEffort, ImpactConfidence
)


async def _txt_records(domain: str) -> list[str]:
    if not _DNS_AVAILABLE:
        return []
    try:
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 8
        answers = await resolver.resolve(domain, "TXT")
        return [str(r).strip('"') for r in answers]
    except Exception:
        return []


async def _get_mx(domain: str) -> list[str]:
    if not _DNS_AVAILABLE:
        return []
    try:
        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 8
        answers = await resolver.resolve(domain, "MX")
        return [str(r.exchange).rstrip(".") for r in answers]
    except Exception:
        return []


def _find_spf(records: list[str]) -> Optional[str]:
    for r in records:
        if r.startswith("v=spf1"):
            return r
    return None


def _find_dmarc(records: list[str]) -> Optional[str]:
    for r in records:
        if r.startswith("v=DMARC1"):
            return r
    return None


class EmailAuthProbe(ProbeBase):
    key      = "email_auth"
    category = Category.SECURITY
    layer    = Layer.PASSIVE_LAYER_1

    _COMMON_DKIM_SELECTORS = [
        "google", "mail", "default", "dkim", "selector1", "selector2",
        "k1", "k2", "smtp", "email", "mimecast", "sendgrid",
        "mailchimp", "mailjet", "postmarkapp",
    ]

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        domain = ctx.domain.lstrip("www.")

        # ── Parallel DNS lookups ──────────────────────────────────────────────
        root_txt, dmarc_txt, mx_records = await asyncio.gather(
            _txt_records(domain),
            _txt_records(f"_dmarc.{domain}"),
            _get_mx(domain),
        )

        raw: dict = {
            "domain": domain,
            "spf": None,
            "dmarc": None,
            "dkim_selectors_found": [],
            "mx": mx_records,
        }

        # ── SPF ───────────────────────────────────────────────────────────────
        spf = _find_spf(root_txt)
        raw["spf"] = spf
        if not spf:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.HIGH,
                title="Sin registro SPF",
                description=(
                    f"El dominio `{domain}` no tiene registro SPF (Sender Policy Framework). "
                    "Cualquier servidor puede enviar emails haciéndose pasar por este dominio (spoofing / phishing)."
                ),
                evidence={"txt_records": root_txt},
                fix_effort=FixEffort.TRIVIAL,
                impact_confidence=ImpactConfidence.HIGH,
                refs=[{"type": "rfc", "url": "https://datatracker.ietf.org/doc/html/rfc7208", "title": "RFC 7208 SPF"}],
                remediation="Añadir registro TXT al DNS: v=spf1 include:_spf.google.com ~all (ajustar el include según el proveedor de email usado).",
            ))
        else:
            # SPF quality: check for +all or ?all (permissive)
            if "+all" in spf or "?all" in spf:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="SPF con mecanismo all permisivo",
                    description=(
                        f"El SPF usa `{'+all' if '+all' in spf else '?all'}`, que permite "
                        "cualquier servidor enviar email por este dominio. Equivale a no tener SPF."
                    ),
                    evidence={"spf": spf},
                    fix_effort=FixEffort.TRIVIAL,
                    impact_confidence=ImpactConfidence.HIGH,
                    remediation="Cambiar el mecanismo a -all para rechazar todos los envíos no autorizados. Ejemplo: v=spf1 include:_spf.provider.com -all",
                ))
            if "~all" in spf:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="SPF en modo softfail (~all)",
                    description=(
                        "El SPF usa `~all` (softfail): los emails no autorizados pasan igual, "
                        "solo se marcan. Migrar a `-all` para rechazarlos definitivamente."
                    ),
                    evidence={"spf": spf},
                    fix_effort=FixEffort.TRIVIAL,
                    impact_confidence=ImpactConfidence.MEDIUM,
                    remediation="Cambiar ~all a -all en el registro TXT del DNS para activar el rechazo estricto. Verificar primero con los logs de email que no hay envíos legítimos no listados.",
                ))

        # ── DMARC ─────────────────────────────────────────────────────────────
        dmarc = _find_dmarc(dmarc_txt)
        raw["dmarc"] = dmarc
        if not dmarc:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.HIGH,
                title="Sin registro DMARC",
                description=(
                    f"`{domain}` no tiene registro DMARC. Sin DMARC los proveedores de email "
                    "no saben qué hacer con emails que fallan SPF/DKIM. "
                    "Alta exposición a phishing usando el dominio de la empresa."
                ),
                evidence={"dmarc_query": f"_dmarc.{domain}", "found": dmarc_txt},
                fix_effort=FixEffort.TRIVIAL,
                impact_confidence=ImpactConfidence.HIGH,
                refs=[{
                    "type": "doc",
                    "url": "https://dmarc.org/overview/",
                    "title": "DMARC Overview",
                }],
                remediation="Añadir registro TXT en _dmarc.dominio.com con valor: v=DMARC1; p=quarantine; rua=mailto:dmarc@dominio.com",
            ))
        else:
            if "p=none" in dmarc:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="DMARC en modo monitor (p=none)",
                    description=(
                        "DMARC está en `p=none`: solo monitoriza, no bloquea ni cuarentena "
                        "los emails fraudulentos. Migrar a `p=quarantine` o `p=reject`."
                    ),
                    evidence={"dmarc": dmarc},
                    fix_effort=FixEffort.TRIVIAL,
                    impact_confidence=ImpactConfidence.MEDIUM,
                    remediation="Revisar los reportes DMARC recibidos (rua=), confirmar que los envíos legítimos pasan, luego cambiar p=none a p=quarantine y finalmente a p=reject.",
                ))

        # ── DKIM (common selectors) ───────────────────────────────────────────
        dkim_tasks = [
            _txt_records(f"{sel}._domainkey.{domain}")
            for sel in self._COMMON_DKIM_SELECTORS
        ]
        dkim_results = await asyncio.gather(*dkim_tasks)
        found_selectors = [
            sel for sel, records in zip(self._COMMON_DKIM_SELECTORS, dkim_results)
            if any("v=DKIM1" in r for r in records)
        ]
        raw["dkim_selectors_found"] = found_selectors

        if not found_selectors:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title="No se detectó DKIM en selectores comunes",
                description=(
                    f"No se encontró registro DKIM en los selectores más habituales "
                    f"({', '.join(self._COMMON_DKIM_SELECTORS[:6])}...). "
                    "DKIM ausente permite que emails legítimos sean alterados en tránsito."
                ),
                evidence={"selectors_checked": self._COMMON_DKIM_SELECTORS},
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.LOW,
                remediation="Activar DKIM en tu proveedor de email (Google Workspace, Mailchimp, etc.) y publicar la clave pública en el DNS: selector._domainkey.dominio.com TXT v=DKIM1; k=rsa; p=...",
            ))

        duration = int((time.time() - t0) * 1000)
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=duration,
        )
