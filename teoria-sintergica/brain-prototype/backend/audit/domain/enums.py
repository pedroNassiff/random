"""
audit/domain/enums.py

Value objects as enums — shared vocabulary across the bounded context.
"""
from enum import Enum


class Severity(str, Enum):
    INFO     = "info"
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


class Category(str, Enum):
    SECURITY          = "security"
    PERFORMANCE       = "performance"
    SEO               = "seo"
    ACCESSIBILITY     = "accessibility"
    PRIVACY           = "privacy"
    COST_OPTIMIZATION = "cost_optimization"
    LEGAL             = "legal"


class Layer(str, Enum):
    PASSIVE_LAYER_1       = "1_passive"        # no auth, public data only
    ACTIVE_LAYER_2_SAFE   = "2_active_safe"    # detection-only, prod-safe
    ACTIVE_LAYER_2        = "2_active"         # deep active, staging only


class AuditStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    CANCELLED = "cancelled"


class ProbeStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED  = "failed"
    SKIPPED = "skipped"


class SKU(str, Enum):
    HEALTH_CHECK   = "health_check"    # free / lead-magnet subset
    AUDIT_EXPRESS  = "audit_express"   # full Layer 1
    PENTEST        = "pentest"         # Layer 2 (contract required)
    CONTINUOUS     = "continuous"      # recurring scan


class FixEffort(str, Enum):
    TRIVIAL = "trivial"   # < 1h, config change
    SMALL   = "small"     # < 1 day
    MEDIUM  = "medium"    # 1-3 days
    LARGE   = "large"     # > 3 days


class ImpactConfidence(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"
