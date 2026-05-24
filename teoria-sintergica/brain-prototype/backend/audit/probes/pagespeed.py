"""
audit/probes/pagespeed.py

Google PageSpeed Insights API — Core Web Vitals + performance score.
Layer 1 — passive, uses public API.
"""
import time
import os
from typing import Optional

import httpx

from ..domain.ports import ProbeBase
from ..domain.context import AuditContext
from ..domain.entities import Finding, ProbeOutput
from ..domain.enums import (
    Category, Layer, Severity, ProbeStatus, FixEffort, ImpactConfidence
)

_PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

# CWV thresholds (Good / Needs Improvement / Poor)
_LCP_POOR   = 4000   # ms
_LCP_NI     = 2500

_INP_POOR   = 500    # ms
_INP_NI     = 200

_CLS_POOR   = 0.25
_CLS_NI     = 0.1

_FID_POOR   = 300    # ms (legacy, replaced by INP)
_FID_NI     = 100

_SCORE_POOR = 49
_SCORE_NI   = 89


def _score_color(s: float) -> str:
    if s >= 0.9: return "good"
    if s >= 0.5: return "needs_improvement"
    return "poor"


class PageSpeedProbe(ProbeBase):
    key      = "pagespeed"
    category = Category.PERFORMANCE
    layer    = Layer.PASSIVE_LAYER_1

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings: list[Finding] = []

        api_key = os.getenv("GOOGLE_PAGESPEED_KEY", "")
        params = {
            "url": ctx.root_url,
            "strategy": "mobile",
            "category": ["performance", "accessibility", "seo", "best-practices"],
        }
        if api_key:
            params["key"] = api_key

        raw: dict = {"url": ctx.root_url}

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.get(_PSI_API, params=params)
                if r.status_code != 200:
                    raise ValueError(f"PSI API returned {r.status_code}: {r.text[:200]}")
                data = r.json()
        except Exception as exc:
            return ProbeOutput(
                raw_data={"error": str(exc)},
                findings=[],
                status=ProbeStatus.FAILED,
                duration_ms=int((time.time() - t0) * 1000),
                error=str(exc),
            )

        lhr = data.get("lighthouseResult", {})
        categories = lhr.get("categories", {})
        audits = lhr.get("audits", {})

        # ── Category scores ────────────────────────────────────────────────────
        scores: dict[str, Optional[float]] = {}
        for cat in ["performance", "accessibility", "seo", "best-practices"]:
            val = categories.get(cat, {}).get("score")
            scores[cat] = round(val * 100) if val is not None else None

        raw["scores"] = scores

        # ── Performance score ──────────────────────────────────────────────────
        perf_score = scores.get("performance")
        if perf_score is not None and perf_score <= _SCORE_POOR:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.PERFORMANCE,
                severity=Severity.HIGH,
                title=f"Performance score crítico: {perf_score}/100 (mobile)",
                description=(
                    f"Lighthouse clasifica el rendimiento mobile como POOR ({perf_score}). "
                    "Un score < 50 está directamente correlacionado con altas tasas de abandono "
                    "y penalización en ranking de Google."
                ),
                evidence={"performance_score": perf_score},
                fix_effort=FixEffort.MEDIUM,
                impact_confidence=ImpactConfidence.HIGH,
                remediation="Optimizar imágenes (convertir a WebP/AVIF), deshabilitar JavaScript bloqueante (defer/async), activar CDN y caché HTTP agresivo.",
            ))
        elif perf_score is not None and perf_score <= _SCORE_NI:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.PERFORMANCE,
                severity=Severity.MEDIUM,
                title=f"Performance score mejorable: {perf_score}/100 (mobile)",
                description=(
                    f"Lighthouse detecta margen de mejora importante en rendimiento mobile ({perf_score}/100). "
                    "Google usa Core Web Vitals como factor de ranking."
                ),
                evidence={"performance_score": perf_score},
                fix_effort=FixEffort.MEDIUM,
                impact_confidence=ImpactConfidence.MEDIUM,
                remediation="Ejecutar Lighthouse localmente para ver las oportunidades específicas (imágenes sin comprimir, CSS no usado, fonts bloqueantes).",
            ))

        # ── Core Web Vitals ────────────────────────────────────────────────────
        def _metric(key: str) -> Optional[float]:
            a = audits.get(key, {})
            return a.get("numericValue")

        lcp_ms   = _metric("largest-contentful-paint")
        cls_val  = _metric("cumulative-layout-shift")
        inp_ms   = _metric("interaction-to-next-paint") or _metric("total-blocking-time")
        fcp_ms   = _metric("first-contentful-paint")
        tbt_ms   = _metric("total-blocking-time")
        ttfb_ms  = _metric("server-response-time")

        raw["vitals"] = {
            "lcp_ms": lcp_ms, "cls": cls_val,
            "inp_ms": inp_ms, "fcp_ms": fcp_ms,
            "tbt_ms": tbt_ms, "ttfb_ms": ttfb_ms,
        }

        if lcp_ms is not None:
            if lcp_ms >= _LCP_POOR:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.PERFORMANCE,
                    severity=Severity.HIGH,
                    title=f"LCP crítico: {lcp_ms/1000:.1f}s (objetivo <2.5s)",
                    description=(
                        f"Largest Contentful Paint de {lcp_ms/1000:.1f}s está en zona POOR (>4s). "
                        "Impacta directamente la percepción de carga y el ranking de búsqueda."
                    ),
                    evidence={"lcp_ms": lcp_ms, "threshold_poor_ms": _LCP_POOR},
                    fix_effort=FixEffort.MEDIUM,
                    impact_confidence=ImpactConfidence.HIGH,
                    remediation="Precargar imagen hero con <link rel=preload>. Usar CDN para assets estáticos. Eliminar JavaScript bloqueante. Comprimir y convertir imágenes a WebP.",
                ))
            elif lcp_ms >= _LCP_NI:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.PERFORMANCE,
                    severity=Severity.MEDIUM,
                    title=f"LCP mejorable: {lcp_ms/1000:.1f}s (objetivo <2.5s)",
                    description=f"LCP de {lcp_ms/1000:.1f}s está en zona 'Needs Improvement'. Optimizar imagen hero o fuentes.",
                    evidence={"lcp_ms": lcp_ms},
                    fix_effort=FixEffort.SMALL,
                    impact_confidence=ImpactConfidence.MEDIUM,
                    remediation="Añadir fetchpriority=high a la imagen hero. Revisar fuentes web con font-display:swap. Comprobar si hay redirecciones encadenadas.",
                ))

        if cls_val is not None:
            if cls_val >= _CLS_POOR:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.PERFORMANCE,
                    severity=Severity.HIGH,
                    title=f"CLS crítico: {cls_val:.3f} (objetivo <0.1)",
                    description=(
                        f"Cumulative Layout Shift de {cls_val:.3f} es POOR (>0.25). "
                        "Los elementos se mueven durante la carga, deteriorando UX y causando clics accidentales. "
                        "Causa más común: imágenes sin dimensiones o ads."
                    ),
                    evidence={"cls": cls_val},
                    fix_effort=FixEffort.SMALL,
                    impact_confidence=ImpactConfidence.MEDIUM,
                    remediation="Añadir width y height explícitos a todas las imágenes. Reservar espacio con aspect-ratio para embeds dinámicos. Evitar insertar contenido encima de contenido existente.",
                ))
            elif cls_val >= _CLS_NI:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.PERFORMANCE,
                    severity=Severity.LOW,
                    title=f"CLS mejorable: {cls_val:.3f} (objetivo <0.1)",
                    description=f"Layout shifts detectados (CLS={cls_val:.3f}). Añadir width/height a imágenes.",
                    evidence={"cls": cls_val},
                    fix_effort=FixEffort.SMALL,
                    impact_confidence=ImpactConfidence.LOW,
                    remediation="Añadir atributos width/height a las etiquetas <img>. Revisar fuentes web (usar font-display: swap).",
                ))

        # ── TTFB ──────────────────────────────────────────────────────────────
        if ttfb_ms is not None and ttfb_ms > 800:
            sev = Severity.HIGH if ttfb_ms > 1800 else Severity.MEDIUM
            findings.append(Finding(
                probe_key=self.key,
                category=Category.PERFORMANCE,
                severity=sev,
                title=f"TTFB alto: {ttfb_ms:.0f}ms (objetivo <800ms)",
                description=(
                    f"El servidor tarda {ttfb_ms:.0f}ms en responder (Time to First Byte). "
                    "Puede indicar ausencia de CDN, queries lentas en BD, o servidor pequeño."
                ),
                evidence={"ttfb_ms": ttfb_ms},
                fix_effort=FixEffort.MEDIUM,
                impact_confidence=ImpactConfidence.HIGH,
                remediation="Implementar Cloudflare CDN (gratuito) para servir desde el edge. Añadir caché de páginas. Optimizar las queries de base de datos más lentas.",
            ))

        # ── Accessibility / SEO quick pass ────────────────────────────────────
        a11y = scores.get("accessibility")
        if a11y is not None and a11y < 80:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.ACCESSIBILITY,
                severity=Severity.MEDIUM if a11y >= 60 else Severity.HIGH,
                title=f"Accesibilidad deficiente: {a11y}/100",
                description=(
                    f"Lighthouse detecta score de accesibilidad de {a11y}/100. "
                    "Desde junio 2025 (European Accessibility Act) los sitios B2C en Europa "
                    "deben cumplir WCAG 2.1 AA bajo pena de multa."
                ),
                evidence={"accessibility_score": a11y},
                fix_effort=FixEffort.MEDIUM,
                impact_confidence=ImpactConfidence.MEDIUM,
                remediation="Auditar con axe DevTools o Lighthouse: añadir alt text a imágenes, labels a formularios, mejorar contraste de color (mínimo 4.5:1 para texto). Usar herramienta WAVE para detección rápida.",
            ))

        seo_score = scores.get("seo")
        if seo_score is not None and seo_score < 80:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SEO,
                severity=Severity.MEDIUM,
                title=f"SEO técnico bajo: {seo_score}/100",
                description=f"Lighthouse detecta {seo_score}/100 en SEO técnico. Puede afectar indexación orgánica.",
                evidence={"seo_score": seo_score},
                fix_effort=FixEffort.SMALL,
                impact_confidence=ImpactConfidence.MEDIUM,
                remediation="Verificar meta title y description únicos por página, estructura de headings (un solo H1), robots.txt correcto, sitemap.xml enviado a Google Search Console.",
            ))

        duration = int((time.time() - t0) * 1000)
        return ProbeOutput(
            raw_data=raw,
            findings=findings,
            status=ProbeStatus.SUCCESS,
            duration_ms=duration,
        )
