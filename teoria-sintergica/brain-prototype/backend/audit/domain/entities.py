"""
audit/domain/entities.py

Core domain entities — pure dataclasses, no I/O, no ORM.
These are the domain objects that flow between layers.
"""
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime
import uuid


# ── Capa 2 entities ────────────────────────────────────────────────────────────

@dataclass
class AuthSession:
    """A captured Playwright session for authenticated probes."""
    label:                str          # 'customer_a', 'customer_b', 'admin'
    storage_state_path:   str          # path to Playwright storage_state JSON
    captured_at:          datetime
    expires_at:           datetime
    test_user_email:      str
    refresh_strategy:     str = "cookies_only"  # 'cookies_only' | 'full_login_replay'


@dataclass
class Capa2RunConfig:
    """Configuration for a Capa 2 (active/authenticated) audit run."""
    environment:         str                  # 'production' | 'staging'
    mode:                str                  # 'full' | 'detection_only'
    auth_sessions:       list["AuthSession"]  = field(default_factory=list)
    staging_available:   bool                 = False
    emergency_contact:   str                  = ""
    rate_limit_rps:      float                = 2.0
    phases_enabled:      list[str]            = field(default_factory=lambda: ["2.1", "2.2", "2.3"])
    preflight_overrides: dict[str, bool]      = field(default_factory=dict)

from .enums import (
    Severity, Category, AuditStatus, ProbeStatus,
    SKU, FixEffort, ImpactConfidence,
)


def _new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Finding:
    """A single actionable issue discovered by a probe."""
    probe_key:           str
    category:            Category
    severity:            Severity
    title:               str
    description:         str
    # ── optional fields ──────────────────────────────────────────────────────
    evidence:            dict[str, Any]     = field(default_factory=dict)
    impact_eur_monthly:  Optional[float]    = None
    impact_confidence:   ImpactConfidence   = ImpactConfidence.LOW
    fix_effort:          Optional[FixEffort] = None
    cwe:                 Optional[str]      = None
    cvss_score:          Optional[float]    = None
    refs:                list[dict]         = field(default_factory=list)
    priority_score:      float              = 0.0
    remediation:         Optional[str]      = None
    # set by orchestrator after scoring
    id:                  str                = field(default_factory=_new_id)
    run_id:              Optional[str]      = None


@dataclass
class ProbeOutput:
    """What a probe returns after running."""
    raw_data:    dict[str, Any]
    findings:    list[Finding]
    status:      ProbeStatus
    duration_ms: int              = 0
    error:       Optional[str]   = None


@dataclass
class ProbeResult:
    """Persisted execution record of one probe."""
    run_id:      str
    probe_key:   str
    status:      ProbeStatus
    duration_ms: int              = 0
    raw_data:    dict[str, Any]   = field(default_factory=dict)
    error:       Optional[str]    = None
    id:          str              = field(default_factory=_new_id)
    created_at:  str              = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class AuditRun:
    """Aggregate root — one full execution of the audit pipeline."""
    id:          str
    contact_id:  Optional[int]
    root_url:    str
    sku:         SKU
    status:      AuditStatus     = AuditStatus.PENDING
    trigger:     str             = "manual"
    config:      dict[str, Any]  = field(default_factory=dict)
    started_at:  Optional[str]   = None
    finished_at: Optional[str]   = None
    error:       Optional[str]   = None
    created_at:  str             = field(default_factory=lambda: datetime.utcnow().isoformat())

    @staticmethod
    def create(root_url: str, contact_id: Optional[int] = None,
               sku: SKU = SKU.HEALTH_CHECK, config: dict | None = None,
               trigger: str = "manual") -> "AuditRun":
        return AuditRun(
            id=_new_id(),
            contact_id=contact_id,
            root_url=root_url,
            sku=sku,
            config=config or {},
            trigger=trigger,
        )


@dataclass
class AuditReport:
    """Generated report summary linked to a run."""
    run_id:         str
    overall_score:  int
    score_breakdown: dict[str, int]
    executive_md:   str             = ""
    pdf_gcs_path:   Optional[str]   = None
    id:             str             = field(default_factory=_new_id)
    generated_at:   str             = field(default_factory=lambda: datetime.utcnow().isoformat())
    version:        int             = 1
