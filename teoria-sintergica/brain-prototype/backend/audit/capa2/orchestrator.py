"""
audit/capa2/orchestrator.py

Capa 2 (active/authenticated) audit orchestrator.

Execution flow:
  1. Preflight checks — all must pass
  2. Baseline capture — record response times before active probes
  3. Phase 2.1 — authenticated passive recon (session_management, csrf_analysis, cross_account_basic)
  4. Phase 2.2 — attack surface mapping (endpoint_discovery, js_secret_scan, cors_policy)
  5. Phase 2.3 — active non-destructive (sqli_safe, xss_safe, idor_horizontal, ssrf_safe,
                                          jwt_analysis, auth_weakness, misconfig_check)

Each phase gate can be stopped by:
  - Circuit breaker trip
  - Manual emergency stop (manual_trip on the shared circuit breaker)
  - AUDIT_KILL_SWITCH env var

Rate limiting is enforced between every request via RateLimiter.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Callable, Awaitable, Optional

from ..domain.context import AuditContext
from ..domain.entities import AuditRun, AuditReport, Finding, ProbeResult
from ..domain.enums import AuditStatus, ProbeStatus, SKU
from ..domain.ports import ProbeBase

from .safety import CircuitBreaker, CircuitBreakerTripped
from .preflight import PreflightChecker, PreflightFailed
from .rate_limiter import RateLimiter
from .cleanup import CleanupTracker
from .probes.session_management import SessionManagementProbe
from .probes.csrf_analysis import CSRFAnalysisProbe
from .probes.cross_account_basic import CrossAccountBasicProbe
from .probes.endpoint_discovery import EndpointDiscoveryProbe
from .probes.js_secret_scan import JsSecretScanProbe
from .probes.cors_policy import CORSPolicyProbe
from .probes.sqli_safe import SQLiSafeProbe
from .probes.xss_safe import XSSSafeProbe
from .probes.idor_horizontal import IDORHorizontalProbe
from .probes.ssrf_safe import SSRFSafeProbe
from .probes.jwt_analysis import JWTAnalysisProbe
from .probes.auth_weakness import AuthWeaknessProbe
from .probes.misconfig_check import MisconfigCheckProbe

logger = logging.getLogger(__name__)

# ── Phase registry ─────────────────────────────────────────────────────────────

PHASE_21_PROBES: list[ProbeBase] = [
    SessionManagementProbe(),
    CSRFAnalysisProbe(),
    CrossAccountBasicProbe(),
]

PHASE_22_PROBES: list[ProbeBase] = [
    EndpointDiscoveryProbe(),
    JsSecretScanProbe(),
    CORSPolicyProbe(),
]

PHASE_23_PROBES: list[ProbeBase] = [
    SQLiSafeProbe(),
    XSSSafeProbe(),
    IDORHorizontalProbe(),
    SSRFSafeProbe(),
    JWTAnalysisProbe(),
    AuthWeaknessProbe(),
    MisconfigCheckProbe(),
]

PHASES: dict[str, list[ProbeBase]] = {
    "2.1": PHASE_21_PROBES,
    "2.2": PHASE_22_PROBES,
    "2.3": PHASE_23_PROBES,
}

_PER_PROBE_TIMEOUT = 180  # seconds per probe

# ── Types ──────────────────────────────────────────────────────────────────────

SaveCallback = Callable[[AuditRun, list[ProbeResult], list[Finding], AuditReport], Awaitable[None]]


# ── Main entry point ──────────────────────────────────────────────────────────

async def run_capa2_audit(
    run: AuditRun,
    on_save: Optional[SaveCallback] = None,
) -> tuple[list[ProbeResult], list[Finding]]:
    """
    Execute a full Capa 2 audit for the given AuditRun.

    The run.config must include Capa 2 configuration:
        {
            "capa2": {
                "environment": "production" | "staging",
                "phases_enabled": ["2.1", "2.2", "2.3"],
                "preflight_overrides": {},  # optional bypass
                "auth_sessions": [{"label": "...", "storage_state_path": "...", ...}],
                "resource_endpoints": [],  # optional — endpoints to probe for IDOR
                "parameterized_endpoints": [],  # optional — endpoints for SQLi/XSS
                "consent_doc_path": "/path/to/signed_consent.pdf",
                "scope_doc_path": "/path/to/signed_scope.pdf",
                "emergency_contact": "client@example.com",
                "waf_whitelist_confirmed": true,
                "backup_confirmed": true,
                "baseline_captured": true,  # set after baseline step completes
                "audit_log_path": "/secure/audit/logs/run_id.jsonl",
            }
        }

    Returns:
        (probe_results, findings) — for the caller to persist.
    """
    run.status = AuditStatus.RUNNING
    run.started_at = datetime.now(timezone.utc).isoformat()

    capa2_config = run.config.get("capa2", {})
    environment = capa2_config.get("environment", "production")
    phases_enabled = capa2_config.get("phases_enabled", ["2.1", "2.2", "2.3"])

    log_path = capa2_config.get("audit_log_path", f"/tmp/audit_capa2_{run.id}.jsonl")

    # Initialize shared components
    circuit_breaker = CircuitBreaker(environment=environment)
    rate_limiter = RateLimiter(environment=environment)
    cleanup_tracker = CleanupTracker(run_id=run.id, log_path=log_path)

    # Load auth sessions
    auth_sessions = _load_auth_sessions(capa2_config)

    # Build AuditContext with Capa 2 extensions in cache
    ctx = AuditContext(
        run_id=run.id,
        root_url=run.root_url,
        sku=run.sku.value,
        config=run.config,
        cache={
            "circuit_breaker": circuit_breaker,
            "rate_limiter": rate_limiter,
            "cleanup_tracker": cleanup_tracker,
            "auth_sessions": auth_sessions,
            "environment": environment,
        },
    )

    # ── Step 1: Preflight ──────────────────────────────────────────────────────
    logger.info("Capa 2 run %s — starting preflight checks", run.id)
    checker = PreflightChecker(
        run_config=capa2_config,
        auth_session_labels=list(auth_sessions.keys()),
    )
    preflight_result = await checker.run(capa2_config.get("preflight_overrides", {}))

    ctx.cache["preflight_result"] = preflight_result.checks

    if not preflight_result.passed:
        failed = preflight_result.failed_checks
        logger.error("Capa 2 preflight FAILED: %s", failed)
        run.status = AuditStatus.FAILED
        run.error = f"Preflight failed: {', '.join(failed)}"
        return [], []

    logger.info("Preflight passed for run %s", run.id)

    # ── Step 2: Capture baseline ───────────────────────────────────────────────
    await _capture_baseline(ctx, circuit_breaker, rate_limiter)
    capa2_config["baseline_captured"] = True  # Mark in config for subsequent runs

    # ── Step 3: Execute phases ─────────────────────────────────────────────────
    all_probe_results: list[ProbeResult] = []
    all_findings: list[Finding] = []

    for phase_key in ["2.1", "2.2", "2.3"]:
        if phase_key not in phases_enabled:
            logger.info("Phase %s skipped (not in phases_enabled)", phase_key)
            continue

        probes = PHASES[phase_key]
        logger.info("Starting Phase %s (%d probes) for run %s", phase_key, len(probes), run.id)

        phase_results, phase_findings = await _run_phase(
            ctx, probes, phase_key, circuit_breaker, rate_limiter
        )
        all_probe_results.extend(phase_results)
        all_findings.extend(phase_findings)

        # Cache Phase 2.2 endpoint discovery results for Phase 2.3 probes
        if phase_key == "2.2":
            for r in phase_results:
                if r.probe_key == "endpoint_discovery" and r.raw_data:
                    ctx.cache["endpoint_discovery_results"] = r.raw_data

        # Check if circuit breaker tripped during the phase
        if circuit_breaker.is_open:
            logger.critical("Circuit breaker open after Phase %s — stopping audit", phase_key)
            run.status = AuditStatus.CANCELLED
            run.error = "Circuit breaker tripped — audit stopped for safety"
            break

        await rate_limiter.pause_between_probes()

    # ── Step 4: Cleanup ───────────────────────────────────────────────────────
    logger.info("Cleanup tracker summary: %s", cleanup_tracker.summary())
    ctx.cache["cleanup_summary"] = cleanup_tracker.summary()

    # Mark completion
    if run.status == AuditStatus.RUNNING:
        run.status = AuditStatus.COMPLETED

    run.finished_at = datetime.now(timezone.utc).isoformat()
    logger.info(
        "Capa 2 run %s completed: %d probe results, %d findings",
        run.id, len(all_probe_results), len(all_findings),
    )

    return all_probe_results, all_findings


async def _run_phase(
    ctx: AuditContext,
    probes: list[ProbeBase],
    phase_key: str,
    circuit_breaker: CircuitBreaker,
    rate_limiter: RateLimiter,
) -> tuple[list[ProbeResult], list[Finding]]:
    """Run all probes in a phase sequentially (Capa 2 safety requirement)."""
    results: list[ProbeResult] = []
    findings: list[Finding] = []

    for probe in probes:
        if circuit_breaker.is_open:
            logger.warning("Circuit breaker open — skipping probe %s", probe.key)
            break

        t0 = time.time()
        try:
            output = await asyncio.wait_for(probe.run(ctx), timeout=_PER_PROBE_TIMEOUT)
            for f in output.findings:
                f.run_id = ctx.run_id
            findings.extend(output.findings)

            result = ProbeResult(
                run_id=ctx.run_id,
                probe_key=probe.key,
                status=output.status,
                duration_ms=output.duration_ms or int((time.time() - t0) * 1000),
                raw_data=output.raw_data,
                error=output.error,
            )
            logger.info(
                "Phase %s — probe %s: %s (%d findings, %dms)",
                phase_key, probe.key, output.status, len(output.findings), result.duration_ms,
            )

        except CircuitBreakerTripped as exc:
            logger.critical("Circuit breaker tripped during probe %s: %s", probe.key, exc)
            result = ProbeResult(
                run_id=ctx.run_id,
                probe_key=probe.key,
                status=ProbeStatus.FAILED,
                duration_ms=int((time.time() - t0) * 1000),
                error=f"CircuitBreakerTripped: {exc}",
            )

        except asyncio.TimeoutError:
            logger.warning("Probe %s timed out after %ss", probe.key, _PER_PROBE_TIMEOUT)
            result = ProbeResult(
                run_id=ctx.run_id,
                probe_key=probe.key,
                status=ProbeStatus.FAILED,
                duration_ms=int((time.time() - t0) * 1000),
                error=f"Timeout after {_PER_PROBE_TIMEOUT}s",
            )

        except Exception as exc:
            logger.exception("Probe %s raised unexpected exception", probe.key)
            result = ProbeResult(
                run_id=ctx.run_id,
                probe_key=probe.key,
                status=ProbeStatus.FAILED,
                duration_ms=int((time.time() - t0) * 1000),
                error=str(exc),
            )

        results.append(result)
        await rate_limiter.pause_between_probes()

    return results, findings


async def _capture_baseline(ctx: AuditContext, circuit_breaker: CircuitBreaker, rate_limiter: RateLimiter) -> None:
    """Measure baseline response times for the main page before active probes start."""
    import httpx
    endpoints = [ctx.root_url, ctx.base_url + "/api", ctx.base_url + "/health"]

    async with httpx.AsyncClient(timeout=10) as client:
        for endpoint in endpoints:
            await rate_limiter.acquire(endpoint)
            try:
                t0 = time.time()
                resp = await client.get(endpoint)
                elapsed_ms = (time.time() - t0) * 1000
                circuit_breaker.capture_baseline(endpoint, elapsed_ms)
                logger.debug("Baseline: %s → %.0fms (status %d)", endpoint, elapsed_ms, resp.status_code)
            except Exception:
                pass


def _load_auth_sessions(capa2_config: dict) -> dict:
    """Load auth sessions from config dict into a label → session dict."""
    from .auth_sessions import AuthSession
    sessions_config = capa2_config.get("auth_sessions", [])
    sessions: dict = {}
    for s in sessions_config:
        if isinstance(s, dict):
            try:
                session = AuthSession.from_dict(s) if hasattr(AuthSession, "from_dict") else AuthSession(**s)
            except Exception as exc:
                logger.warning("Could not load auth session %s: %s", s.get("label"), exc)
                continue
            sessions[session.label] = session
        elif hasattr(s, "label"):
            sessions[s.label] = s
    return sessions
