"""
audit/router.py

FastAPI router for Audit Express.
Mounts at /audit — registered in main.py.

Endpoints:
  POST   /audit/runs              — create + kick off audit (async background)
  GET    /audit/runs              — list runs (optionally by contact)
  GET    /audit/runs/{id}         — run detail + summary
  GET    /audit/runs/{id}/findings — paginated findings
  GET    /audit/runs/{id}/report   — executive summary + scores
  POST   /audit/runs/{id}/cancel   — mark cancelled (if pending/running)
  PATCH  /audit/contacts/{id}/audit-type — set/clear audit_type on a contact
"""
import asyncio
import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, validator

from .domain.entities import AuditRun, AuditReport
from .domain.enums import SKU, AuditStatus
from .application.orchestrator import run_audit
from .infrastructure.repository import (
    init_audit_db,
    save_run, save_probe_results, save_findings, save_report,
    get_run, get_run_with_summary, list_runs, get_findings, get_report,
)

logger = logging.getLogger(__name__)

# Ensure tables exist on import
init_audit_db()

router = APIRouter(prefix="/audit", tags=["audit"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class LaunchAuditRequest(BaseModel):
    root_url:   str
    contact_id: Optional[int]    = None
    sku:        str               = SKU.HEALTH_CHECK.value
    config:     dict              = {}
    trigger:    str               = "manual"

    @validator("root_url")
    def _normalize_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("http"):
            v = "https://" + v
        parsed = urlparse(v)
        if not parsed.netloc:
            raise ValueError("URL inválida")
        return v

    @validator("sku")
    def _valid_sku(cls, v: str) -> str:
        allowed = {s.value for s in SKU}
        if v not in allowed:
            raise ValueError(f"SKU debe ser uno de: {allowed}")
        return v


class SetAuditTypeRequest(BaseModel):
    audit_type: Optional[str] = None  # 'tech_health_audit' | None to clear


# ── Background task callback ───────────────────────────────────────────────────

async def _save_all(run, probe_results, findings, report):
    """Adapter: persists all entities after audit completes."""
    await asyncio.get_event_loop().run_in_executor(None, save_run, run)
    await asyncio.get_event_loop().run_in_executor(None, save_probe_results, probe_results)
    await asyncio.get_event_loop().run_in_executor(None, save_findings, findings)
    await asyncio.get_event_loop().run_in_executor(None, save_report, report)


async def _run_audit_background(run: AuditRun, contact_name: str = "") -> None:
    try:
        await run_audit(run, on_save=_save_all, contact_name=contact_name)
    except Exception:
        logger.exception("Background audit %s failed", run.id)
        run.status = AuditStatus.FAILED
        await asyncio.get_event_loop().run_in_executor(None, save_run, run)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/runs", status_code=202)
async def launch_audit(
    body: LaunchAuditRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create and immediately start an audit in the background.
    Returns the run_id — poll GET /audit/runs/{id} for status.
    """
    try:
        sku = SKU(body.sku)
    except ValueError:
        raise HTTPException(400, f"SKU inválido: {body.sku}")

    run = AuditRun.create(
        root_url=body.root_url,
        contact_id=body.contact_id,
        sku=sku,
        config=body.config,
        trigger=body.trigger,
    )

    # Persist immediately with PENDING status so we can poll
    await asyncio.get_event_loop().run_in_executor(None, save_run, run)

    # Kick off in background (non-blocking response)
    background_tasks.add_task(_run_audit_background, run)

    return {
        "run_id":   run.id,
        "status":   run.status.value,
        "root_url": run.root_url,
        "sku":      run.sku.value,
        "message":  "Audit iniciado. Sondea GET /audit/runs/{run_id} para ver el estado.",
    }


@router.get("/runs")
async def list_audit_runs(contact_id: Optional[int] = None, limit: int = 50):
    """List audit runs, optionally filtered by contact."""
    runs = await asyncio.get_event_loop().run_in_executor(
        None, list_runs, contact_id, min(limit, 200)
    )
    return {"runs": runs, "total": len(runs)}


@router.get("/runs/{run_id}")
async def get_audit_run(run_id: str):
    """Run detail with finding count + severity breakdown + report summary."""
    data = await asyncio.get_event_loop().run_in_executor(
        None, get_run_with_summary, run_id
    )
    if not data:
        raise HTTPException(404, "Audit run not found")
    return data


@router.get("/runs/{run_id}/findings")
async def get_audit_findings(
    run_id: str,
    severity: Optional[str] = None,
    category: Optional[str] = None,
):
    """All findings for a run, sorted by priority score (highest first)."""
    run = await asyncio.get_event_loop().run_in_executor(None, get_run, run_id)
    if not run:
        raise HTTPException(404, "Audit run not found")

    findings = await asyncio.get_event_loop().run_in_executor(None, get_findings, run_id)

    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    if category:
        findings = [f for f in findings if f["category"] == category]

    return {"run_id": run_id, "findings": findings, "total": len(findings)}


@router.get("/runs/{run_id}/report")
async def get_audit_report(run_id: str):
    """Report summary with scores and executive markdown."""
    run = await asyncio.get_event_loop().run_in_executor(None, get_run, run_id)
    if not run:
        raise HTTPException(404, "Audit run not found")

    report = await asyncio.get_event_loop().run_in_executor(None, get_report, run_id)
    if not report:
        raise HTTPException(404, "Report not generated yet")
    return report


@router.post("/runs/{run_id}/cancel")
async def cancel_audit_run(run_id: str):
    """Mark a pending or running audit as cancelled."""
    run_data = await asyncio.get_event_loop().run_in_executor(None, get_run, run_id)
    if not run_data:
        raise HTTPException(404, "Audit run not found")
    if run_data["status"] not in ("pending", "running"):
        raise HTTPException(400, f"Cannot cancel an audit in status '{run_data['status']}'")

    # We mark it cancelled — note: if it's already running the background task
    # won't stop, but when it tries to save it'll overwrite with completed/failed.
    # For v1 this is acceptable. RQ would handle proper cancellation.
    import sqlite3, json
    from pathlib import Path
    db_path = Path(__file__).parent.parent / "database" / "prospecting.db"
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "UPDATE audit_runs SET status = 'cancelled' WHERE id = ?", (run_id,)
        )
    return {"run_id": run_id, "status": "cancelled"}


@router.patch("/contacts/{contact_id}/audit-type")
async def set_contact_audit_type(contact_id: int, body: SetAuditTypeRequest):
    """
    Tag a prospect for tech health audit (or clear the tag).
    Integrates with Planning Prospection CRM.
    """
    import sqlite3
    from pathlib import Path
    db_path = Path(__file__).parent.parent / "database" / "prospecting.db"
    try:
        with sqlite3.connect(str(db_path)) as conn:
            row = conn.execute(
                "SELECT id FROM contacts WHERE id = ?", (contact_id,)
            ).fetchone()
            if not row:
                raise HTTPException(404, "Contact not found")
            conn.execute(
                "UPDATE contacts SET audit_type = ? WHERE id = ?",
                (body.audit_type, contact_id),
            )
        return {"contact_id": contact_id, "audit_type": body.audit_type}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/probes")
async def list_probes():
    """Return the registered probe catalog (Capa 1 + Capa 2)."""
    from .application.orchestrator import _ALL_PROBES, _SKU_PROBES
    from .capa2.orchestrator import PHASE_21_PROBES, PHASE_22_PROBES, PHASE_23_PROBES
    capa2_probes = PHASE_21_PROBES + PHASE_22_PROBES + PHASE_23_PROBES
    return {
        "probes": [
            {"key": p.key, "category": p.category.value, "layer": p.layer.value}
            for p in _ALL_PROBES
        ],
        "capa2_probes": [
            {"key": p.key, "category": p.category.value, "layer": p.layer.value}
            for p in capa2_probes
        ],
        "sku_mapping": {k.value: v for k, v in _SKU_PROBES.items()},
    }


# ── Capa 2 endpoints ───────────────────────────────────────────────────────────

class LaunchCapa2Request(BaseModel):
    root_url:   str
    contact_id: Optional[int]  = None
    config:     dict           = {}   # must include "capa2" sub-dict
    trigger:    str            = "manual"

    @validator("root_url")
    def _normalize(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("http"):
            v = "https://" + v
        parsed = urlparse(v)
        if not parsed.netloc:
            raise ValueError("URL inválida")
        return v

    @validator("config")
    def _require_capa2_config(cls, v: dict) -> dict:
        if "capa2" not in v:
            raise ValueError("config must include a 'capa2' sub-dict with environment, auth_sessions, etc.")
        capa2 = v["capa2"]
        required = ["environment", "consent_doc_path", "scope_doc_path", "emergency_contact"]
        missing = [k for k in required if not capa2.get(k)]
        if missing:
            raise ValueError(f"capa2 config missing required fields: {missing}")
        if capa2.get("environment") not in ("production", "staging"):
            raise ValueError("capa2.environment must be 'production' or 'staging'")
        return v


@router.post("/runs/capa2", status_code=202)
async def launch_capa2_audit(
    body: LaunchCapa2Request,
    background_tasks: BackgroundTasks,
):
    """
    Launch a Capa 2 (active/authenticated) audit.

    Requires signed consent — enforced via preflight checks in the orchestrator.
    Returns the run_id — poll GET /audit/runs/{id} for status.
    """
    run = AuditRun.create(
        root_url=body.root_url,
        contact_id=body.contact_id,
        sku=SKU.PENTEST,
        config=body.config,
        trigger=body.trigger,
    )

    await asyncio.get_event_loop().run_in_executor(None, save_run, run)
    background_tasks.add_task(_run_capa2_background, run)

    return {
        "run_id":   run.id,
        "status":   run.status.value,
        "root_url": run.root_url,
        "sku":      run.sku.value,
        "layer":    "capa2",
        "message":  "Capa 2 audit iniciado. Requiere preflight válido. Sondea GET /audit/runs/{id}.",
    }


async def _run_capa2_background(run: AuditRun) -> None:
    from .capa2.orchestrator import run_capa2_audit
    try:
        probe_results, findings = await run_capa2_audit(run, on_save=_save_all)
        if probe_results or findings:
            await asyncio.get_event_loop().run_in_executor(None, save_probe_results, probe_results)
            await asyncio.get_event_loop().run_in_executor(None, save_findings, findings)
        await asyncio.get_event_loop().run_in_executor(None, save_run, run)
    except Exception:
        logger.exception("Background Capa 2 audit %s failed", run.id)
        run.status = AuditStatus.FAILED
        await asyncio.get_event_loop().run_in_executor(None, save_run, run)


@router.post("/runs/{run_id}/emergency-stop")
async def emergency_stop_run(run_id: str):
    """
    Immediately trip the circuit breaker for a running Capa 2 audit.

    This marks the run as cancelled in the DB. The background task checks
    circuit_breaker.is_open before each probe and will stop on next check.

    Also sets AUDIT_KILL_SWITCH=true in the process environment as a hard stop.
    """
    import os

    run_data = await asyncio.get_event_loop().run_in_executor(None, get_run, run_id)
    if not run_data:
        raise HTTPException(404, "Audit run not found")

    if run_data["status"] not in ("pending", "running"):
        raise HTTPException(400, f"Run is already in status '{run_data['status']}' — cannot emergency stop")

    # Set kill switch env var — will be picked up by circuit breaker on next check
    os.environ["AUDIT_KILL_SWITCH"] = "true"

    # Mark as cancelled in DB immediately
    import sqlite3
    from pathlib import Path
    db_path = Path(__file__).parent.parent / "database" / "prospecting.db"
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "UPDATE audit_runs SET status = 'cancelled', error = 'Emergency stop activated' WHERE id = ?",
            (run_id,),
        )

    logger.critical("EMERGENCY STOP activated for run %s", run_id)
    return {
        "run_id": run_id,
        "status": "cancelled",
        "message": "Emergency stop activated. All active probes will halt on next circuit breaker check.",
    }


@router.delete("/runs/{run_id}/emergency-stop")
async def clear_kill_switch(run_id: str):
    """
    Clear the AUDIT_KILL_SWITCH env var after confirming all probes stopped.
    Must be called manually after reviewing the situation.
    """
    import os
    os.environ.pop("AUDIT_KILL_SWITCH", None)
    return {"message": "AUDIT_KILL_SWITCH cleared. New audit runs can be started."}


@router.get("/runs/{run_id}/capa2/preflight")
async def get_preflight_status(run_id: str):
    """
    Return the preflight check status for a Capa 2 run.
    Useful for the frontend gating UI — shows which checks passed/failed.
    """
    run_data = await asyncio.get_event_loop().run_in_executor(None, get_run, run_id)
    if not run_data:
        raise HTTPException(404, "Audit run not found")

    # Run preflight in dry-run mode over the stored config
    import json
    capa2_config = {}
    try:
        config_raw = run_data.get("config", "{}")
        full_config = json.loads(config_raw) if isinstance(config_raw, str) else config_raw
        capa2_config = full_config.get("capa2", {})
    except Exception:
        pass

    if not capa2_config:
        return {"run_id": run_id, "preflight": {}, "passed": False, "note": "No capa2 config found"}

    from .capa2.preflight import PreflightChecker
    checker = PreflightChecker(run_config=capa2_config)
    result = await checker.run()
    return {
        "run_id": run_id,
        "passed": result.passed,
        "checks": result.checks,
        "failed_checks": result.failed_checks,
        "notes": result.notes,
    }
