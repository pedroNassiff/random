"""
audit/application/orchestrator.py

AuditOrchestrator — use case that:
1. Selects probes based on SKU
2. Runs them concurrently (with per-probe timeout)
3. Aggregates findings
4. Scores results
5. Returns structured AuditRun output

No I/O itself — receives repository as dependency (injected).
"""
import asyncio
import time
import logging
from datetime import datetime, timezone
from typing import Callable, Awaitable

from ..domain.context import AuditContext
from ..domain.entities import AuditRun, ProbeResult, Finding, AuditReport
from ..domain.enums import AuditStatus, ProbeStatus, SKU
from ..domain.ports import ProbeBase
from .scoring import score_findings, compute_overall_scores, build_executive_md

# Lazy import probes to avoid circular deps
from ..probes.security_headers import SecurityHeadersProbe
from ..probes.tls import TLSProbe
from ..probes.email_auth import EmailAuthProbe
from ..probes.ct_logs import CTLogsProbe
from ..probes.pagespeed import PageSpeedProbe

logger = logging.getLogger(__name__)

# ── Probe registry ─────────────────────────────────────────────────────────────
_ALL_PROBES: list[ProbeBase] = [
    SecurityHeadersProbe(),
    TLSProbe(),
    EmailAuthProbe(),
    CTLogsProbe(),
    PageSpeedProbe(),
]

_SKU_PROBES: dict[SKU, list[str]] = {
    SKU.HEALTH_CHECK:  ["security_headers", "email_auth", "pagespeed"],
    SKU.AUDIT_EXPRESS: ["security_headers", "tls", "email_auth", "ct_logs", "pagespeed"],
    SKU.PENTEST:       [],   # Layer 2, not orchestrated here
    SKU.CONTINUOUS:    ["security_headers", "tls", "email_auth", "pagespeed"],
}

_PROBE_MAP: dict[str, ProbeBase] = {p.key: p for p in _ALL_PROBES}

_PER_PROBE_TIMEOUT = 90   # seconds
_MAX_CONCURRENT   = 4


def _select_probes(sku: SKU, config: dict) -> list[ProbeBase]:
    keys = config.get("probes") or _SKU_PROBES.get(sku, list(_PROBE_MAP.keys()))
    return [_PROBE_MAP[k] for k in keys if k in _PROBE_MAP]


async def _run_probe_safe(probe: ProbeBase, ctx: AuditContext) -> ProbeResult:
    """Run a single probe with timeout + error isolation."""
    t0 = time.time()
    try:
        output = await asyncio.wait_for(probe.run(ctx), timeout=_PER_PROBE_TIMEOUT)
        # Stamp findings with run_id
        for f in output.findings:
            f.run_id = ctx.run_id
        return ProbeResult(
            run_id=ctx.run_id,
            probe_key=probe.key,
            status=output.status,
            duration_ms=output.duration_ms or int((time.time() - t0) * 1000),
            raw_data=output.raw_data,
            error=output.error,
        ), output.findings
    except asyncio.TimeoutError:
        logger.warning("Probe %s timed out after %ss", probe.key, _PER_PROBE_TIMEOUT)
        return ProbeResult(
            run_id=ctx.run_id,
            probe_key=probe.key,
            status=ProbeStatus.FAILED,
            duration_ms=int((time.time() - t0) * 1000),
            error=f"Timeout after {_PER_PROBE_TIMEOUT}s",
        ), []
    except Exception as exc:
        logger.exception("Probe %s raised an exception", probe.key)
        return ProbeResult(
            run_id=ctx.run_id,
            probe_key=probe.key,
            status=ProbeStatus.FAILED,
            duration_ms=int((time.time() - t0) * 1000),
            error=str(exc),
        ), []


# ── SaveCallback type ─────────────────────────────────────────────────────────
SaveCallback = Callable[[AuditRun, list[ProbeResult], list[Finding], AuditReport], Awaitable[None]]


async def run_audit(
    run: AuditRun,
    on_save: SaveCallback,
    contact_name: str = "",
) -> AuditRun:
    """
    Full audit pipeline entry point.

    `on_save` is called at the end with all entities to persist.
    This keeps the orchestrator decoupled from the DB.
    """
    run.status    = AuditStatus.RUNNING
    run.started_at = datetime.now(timezone.utc).isoformat()

    ctx = AuditContext(
        run_id=run.id,
        root_url=run.root_url,
        sku=run.sku.value,
        config=run.config,
    )

    probes = _select_probes(run.sku, run.config)
    logger.info("Audit %s: running %d probes for %s", run.id, len(probes), run.root_url)

    # ── Concurrent probe execution ─────────────────────────────────────────────
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT)

    async def _bounded(probe: ProbeBase):
        async with semaphore:
            return await _run_probe_safe(probe, ctx)

    tasks = [_bounded(p) for p in probes]
    results = await asyncio.gather(*tasks)

    probe_results: list[ProbeResult] = []
    all_findings:  list[Finding]     = []

    for probe_result, findings in results:
        probe_results.append(probe_result)
        all_findings.extend(findings)

    # ── Score + sort ───────────────────────────────────────────────────────────
    industry = run.config.get("industry", "default")
    scored_findings = score_findings(all_findings, industry)
    scores = compute_overall_scores(scored_findings)
    exec_md = build_executive_md(run.id, run.root_url, scored_findings, scores, contact_name)

    report = AuditReport(
        run_id=run.id,
        overall_score=scores["overall"],
        score_breakdown=scores["breakdown"],
        executive_md=exec_md,
    )

    run.status     = AuditStatus.COMPLETED
    run.finished_at = datetime.now(timezone.utc).isoformat()

    await on_save(run, probe_results, scored_findings, report)

    logger.info(
        "Audit %s completed: %d findings, score=%d",
        run.id, len(scored_findings), scores["overall"],
    )
    return run
