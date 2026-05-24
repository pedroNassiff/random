"""
audit/probes/tls.py

TLS / SSL certificate health check using SSL Labs API (free, rate-limited).
Falls back to direct TLS introspection when SSL Labs is rate-limited.
Layer 1 — passive.
"""
import time
import asyncio
import ssl
import socket
from datetime import datetime, timezone
from typing import Optional

import httpx

from ..domain.ports import ProbeBase
from ..domain.context import AuditContext
from ..domain.entities import Finding, ProbeOutput
from ..domain.enums import (
    Category, Layer, Severity, ProbeStatus, FixEffort, ImpactConfidence
)

_SSL_LABS_API = "https://api.ssllabs.com/api/v3/analyze"


async def _ssl_labs_check(host: str, client: httpx.AsyncClient) -> Optional[dict]:
    """
    Trigger SSL Labs scan. Returns grade/details or None if unavailable/rate-limited.
    Note: SSL Labs is free but rate-limited (1 new scan / 2h per host from same IP).
    We use fromCache=on + startNew=off to avoid hammering.
    """
    try:
        params = {
            "host": host,
            "all": "done",
            "fromCache": "on",
            "maxAge": "24",
        }
        r = await client.get(_SSL_LABS_API, params=params, timeout=20.0)
        if r.status_code == 429:
            return None
        data = r.json()
        if data.get("status") in ("READY", "ERROR"):
            return data
        # If IN_PROGRESS or DNS — return partial data
        return data
    except Exception:
        return None


def _direct_tls_info(host: str, port: int = 443) -> dict:
    """Direct TLS check without SSL Labs. Checks cert expiry + TLS version."""
    info: dict = {"error": None}
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                tls_version = ssock.version()
                cipher = ssock.cipher()

        # cert expiry
        not_after = cert.get("notAfter", "")
        if not_after:
            exp = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(
                tzinfo=timezone.utc
            )
            now = datetime.now(tz=timezone.utc)
            days_left = (exp - now).days
            info["cert_expiry_days"] = days_left
            info["cert_not_after"] = not_after
        else:
            info["cert_expiry_days"] = None

        info["tls_version"] = tls_version
        info["cipher"] = cipher[0] if cipher else None
        info["subject"] = dict(x[0] for x in cert.get("subject", []))
        info["issuer"] = dict(x[0] for x in cert.get("issuer", []))
        info["san"] = [
            v for _, v in cert.get("subjectAltName", [])
        ]
    except ssl.SSLError as e:
        info["error"] = f"SSL error: {e}"
    except Exception as e:
        info["error"] = str(e)

    return info


class TLSProbe(ProbeBase):
    key      = "tls"
    category = Category.SECURITY
    layer    = Layer.PASSIVE_LAYER_1

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []
        host = ctx.domain.lstrip("www.")
        # strip www for SSL Labs
        clean_host = ctx.domain

        raw: dict = {"host": clean_host}

        # ── 1. SSL Labs (async, with timeout) ─────────────────────────────────
        ssl_labs_data = None
        async with httpx.AsyncClient() as client:
            try:
                ssl_labs_data = await asyncio.wait_for(
                    _ssl_labs_check(clean_host, client),
                    timeout=25.0,
                )
            except asyncio.TimeoutError:
                pass

        # ── 2. Direct TLS fallback ─────────────────────────────────────────────
        direct = await asyncio.get_event_loop().run_in_executor(
            None, _direct_tls_info, clean_host, 443
        )
        raw["direct"] = direct
        raw["ssl_labs"] = ssl_labs_data

        # ── Parse SSL Labs grade ───────────────────────────────────────────────
        if ssl_labs_data and ssl_labs_data.get("status") == "READY":
            endpoints = ssl_labs_data.get("endpoints", [])
            if endpoints:
                grade = endpoints[0].get("grade", "")
                raw["grade"] = grade

                if grade in ("C", "D", "E", "F", "T", "M"):
                    findings.append(Finding(
                        probe_key=self.key,
                        category=Category.SECURITY,
                        severity=Severity.HIGH,
                        title=f"TLS grade {grade} (SSL Labs)",
                        description=(
                            f"SSL Labs puntúa la configuración TLS con {grade}. "
                            "Puede indicar protocolos débiles (TLS 1.0/1.1), ciphers inseguros, "
                            "o problemas de cadena de certificados."
                        ),
                        evidence={"grade": grade, "endpoints": endpoints[:2]},
                        fix_effort=FixEffort.SMALL,
                        impact_confidence=ImpactConfidence.HIGH,
                        refs=[{
                            "type": "doc",
                            "url": "https://www.ssllabs.com/ssltest/",
                            "title": "SSL Labs Test",
                        }],
                        remediation="Usar Mozilla SSL Config Generator (ssl-config.mozilla.org) para generar configuración TLS moderna. Deshabilitar TLS 1.0/1.1 y ciphers DES/RC4.",
                    ))

                # Check for deprecated protocols in endpoint details
                for ep in endpoints[:2]:
                    details = ep.get("details", {})
                    protocols = details.get("protocols", [])
                    deprecated = [
                        p["name"] + " " + p.get("version", "")
                        for p in protocols
                        if p.get("name") == "SSL" or
                        (p.get("name") == "TLS" and p.get("version", "") in ("1.0", "1.1"))
                    ]
                    if deprecated:
                        findings.append(Finding(
                            probe_key=self.key,
                            category=Category.SECURITY,
                            severity=Severity.HIGH,
                            title=f"Protocolos obsoletos habilitados: {', '.join(deprecated)}",
                            description=(
                                f"El servidor acepta {', '.join(deprecated)}, "
                                "protocolos con vulnerabilidades conocidas (POODLE, BEAST, etc.). "
                                "Solo TLS 1.2 y 1.3 deben estar habilitados."
                            ),
                            evidence={"deprecated_protocols": deprecated},
                            fix_effort=FixEffort.SMALL,
                            impact_confidence=ImpactConfidence.HIGH,
                            remediation="En Nginx: ssl_protocols TLSv1.2 TLSv1.3; — En Apache: SSLProtocol -all +TLSv1.2 +TLSv1.3",
                        ))

        # ── Parse direct TLS info ──────────────────────────────────────────────
        if direct.get("error"):
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.CRITICAL,
                title="Error de TLS / certificado inválido",
                description=(
                    f"No se pudo establecer conexión TLS segura: {direct['error']}. "
                    "El sitio puede no servir HTTPS o tener un certificado inválido."
                ),
                evidence={"error": direct["error"]},
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.HIGH,
                remediation="Verificar que HTTPS esté activo. Instalar certificado con Let's Encrypt: certbot --nginx -d dominio.com. Comprobar que el puerto 443 esté abierto.",
            ))
        else:
            days = direct.get("cert_expiry_days")
            if days is not None:
                if days <= 0:
                    findings.append(Finding(
                        probe_key=self.key,
                        category=Category.SECURITY,
                        severity=Severity.CRITICAL,
                        title="Certificado TLS expirado",
                        description=(
                            f"El certificado expiró hace {abs(days)} días. "
                            "Los navegadores muestran error de seguridad y bloquean el acceso."
                        ),
                        evidence={"cert_expiry_days": days, "cert_not_after": direct.get("cert_not_after")},
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.HIGH,
                        remediation="Renovar inmediatamente: certbot renew --force-renewal. Si usa panel de hosting, renovar desde la sección SSL. Activar autorenovado automático.",
                    ))
                elif days <= 14:
                    findings.append(Finding(
                        probe_key=self.key,
                        category=Category.SECURITY,
                        severity=Severity.HIGH,
                        title=f"Certificado TLS expira en {days} días",
                        description=(
                            f"El certificado expira en {days} días. "
                            "Renovar urgente — Let's Encrypt se renueva automático pero "
                            "puede fallar si hay un cambio de DNS reciente."
                        ),
                        evidence={"cert_expiry_days": days},
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.HIGH,
                        remediation="Renovar urgente: certbot renew. Verificar que el timer systemd/cron de renovación esté activo: systemctl status certbot.timer",
                    ))
                elif days <= 30:
                    findings.append(Finding(
                        probe_key=self.key,
                        category=Category.SECURITY,
                        severity=Severity.MEDIUM,
                        title=f"Certificado TLS expira en {days} días",
                        description=f"El certificado expira pronto ({days} días). Verificar que el autorenovado esté activo.",
                        evidence={"cert_expiry_days": days},
                        fix_effort=FixEffort.TRIVIAL,
                        impact_confidence=ImpactConfidence.MEDIUM,
                        remediation="Ejecutar certbot renew --dry-run para verificar que la renovación automática funcionará. Si falla, revisar DNS y puertos 80/443.",
                    ))

        duration = int((time.time() - t0) * 1000)
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.FAILED if direct.get("error") and not ssl_labs_data else ProbeStatus.SUCCESS,
            duration_ms=duration,
        )
