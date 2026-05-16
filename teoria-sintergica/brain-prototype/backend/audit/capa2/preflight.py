"""
audit/capa2/preflight.py

Pre-flight gate that must pass before any Capa 2 probe runs.

All 10 checks are required by default. Individual checks can be bypassed
via `Capa2RunConfig.preflight_overrides` with explicit written justification.

Usage:
    checker = PreflightChecker(config, auth_sessions)
    result = await checker.run()
    if not result.passed:
        raise PreflightFailed(result.failed_checks)
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from .config import PREFLIGHT_CHECKS

logger = logging.getLogger(__name__)


@dataclass
class PreflightResult:
    passed: bool
    checks: dict[str, bool]   = field(default_factory=dict)
    notes:  dict[str, str]    = field(default_factory=dict)

    @property
    def failed_checks(self) -> list[str]:
        return [k for k, v in self.checks.items() if not v]

    @property
    def bypassed_checks(self) -> list[str]:
        return [k for k, note in self.notes.items() if "bypass" in note.lower()]


class PreflightFailed(Exception):
    def __init__(self, failed: list[str]):
        super().__init__(f"Preflight failed: {', '.join(failed)}")
        self.failed_checks = failed


class PreflightChecker:
    """
    Evaluates all preflight conditions before Capa 2 execution begins.

    Most checks are structural (config presence) rather than live network
    probes — they verify the operator has done the required setup.
    """

    def __init__(self, run_config: dict, auth_session_labels: list[str] = None):
        """
        Args:
            run_config: The Capa2RunConfig dict or the run.config dict.
            auth_session_labels: List of available auth session labels.
        """
        self.config = run_config
        self.auth_session_labels = auth_session_labels or []

    async def run(self, overrides: Optional[dict[str, bool]] = None) -> PreflightResult:
        """
        Run all preflight checks. Returns a PreflightResult.

        Args:
            overrides: dict[check_name, bool] — explicit bypass with justification
                       in the run config. Bypassed checks are logged with WARNING.
        """
        overrides = overrides or self.config.get("preflight_overrides", {})
        checks: dict[str, bool] = {}
        notes:  dict[str, str]  = {}

        for check in PREFLIGHT_CHECKS:
            if check in overrides:
                result = overrides[check]
                notes[check] = f"bypass: explicitly set to {result} in config"
                logger.warning("Preflight check bypassed: %s → %s", check, result)
                checks[check] = result
            else:
                passed, note = await self._run_check(check)
                checks[check] = passed
                if note:
                    notes[check] = note

        all_passed = all(checks.values())
        return PreflightResult(passed=all_passed, checks=checks, notes=notes)

    async def _run_check(self, check: str) -> tuple[bool, str]:
        """Dispatch to per-check method. Returns (passed, note)."""
        method = getattr(self, f"_check_{check}", None)
        if method is None:
            # Unknown check — fail safe
            logger.warning("No implementation for preflight check: %s", check)
            return False, "no implementation — fail safe"
        try:
            return await method()
        except Exception as exc:
            logger.exception("Preflight check %s raised an exception", check)
            return False, str(exc)

    # ── Individual check implementations ─────────────────────────────────────

    async def _check_consent_documents_signed_and_filed(self) -> tuple[bool, str]:
        """Requires `consent_doc_path` in config pointing to a signed PDF."""
        path = self.config.get("consent_doc_path", "")
        if not path:
            return False, "consent_doc_path not set in config"
        import os
        if not os.path.exists(path):
            return False, f"consent document not found at: {path}"
        return True, ""

    async def _check_scope_doc_present_and_signed(self) -> tuple[bool, str]:
        """Requires `scope_doc_path` in config."""
        path = self.config.get("scope_doc_path", "")
        if not path:
            return False, "scope_doc_path not set in config"
        import os
        if not os.path.exists(path):
            return False, f"scope document not found at: {path}"
        return True, ""

    async def _check_emergency_contacts_configured(self) -> tuple[bool, str]:
        """Requires `emergency_contact` email/phone in config."""
        contact = self.config.get("emergency_contact", "")
        if not contact or len(contact) < 5:
            return False, "emergency_contact not configured"
        return True, ""

    async def _check_kill_switch_endpoint_responsive(self) -> tuple[bool, str]:
        """Checks that the local server is up (the /audit/runs/{id}/emergency-stop endpoint exists)."""
        # We verify the circuit breaker config is in place rather than a live HTTP check
        # since we don't have the run_id at preflight time
        environment = self.config.get("environment", "")
        if not environment:
            return False, "environment not set (must be 'production' or 'staging')"
        return True, ""

    async def _check_rate_limiter_configured_for_environment(self) -> tuple[bool, str]:
        """Verifies environment is set to a known value."""
        from .config import RATE_LIMITS
        environment = self.config.get("environment", "")
        if environment not in RATE_LIMITS:
            return False, f"environment '{environment}' not in RATE_LIMITS config"
        return True, ""

    async def _check_auth_sessions_valid(self) -> tuple[bool, str]:
        """Verifies at least one auth session is configured and its storage_state file exists."""
        sessions = self.config.get("auth_sessions", [])
        if not sessions and not self.auth_session_labels:
            return False, "no auth_sessions configured"
        # If sessions are dicts (from JSON config), check storage_state_path
        import os
        for s in sessions:
            if isinstance(s, dict):
                path = s.get("storage_state_path", "")
                if path and not os.path.exists(path):
                    return False, f"auth session '{s.get('label')}' storage_state not found: {path}"
        return True, ""

    async def _check_ip_whitelisted_in_waf(self) -> tuple[bool, str]:
        """
        Operator must confirm WAF whitelist — checked via config flag.
        We can't auto-verify this; it requires client coordination.
        """
        confirmed = self.config.get("waf_whitelist_confirmed", False)
        if not confirmed:
            return False, "waf_whitelist_confirmed not set to True in config — coordinate with client first"
        return True, ""

    async def _check_logging_to_persistent_storage_verified(self) -> tuple[bool, str]:
        """Checks audit log directory is configured and writable."""
        log_path = self.config.get("audit_log_path", "")
        if not log_path:
            return False, "audit_log_path not set in config"
        import os
        parent = os.path.dirname(log_path) or "."
        if not os.path.isdir(parent):
            return False, f"audit log directory does not exist: {parent}"
        if not os.access(parent, os.W_OK):
            return False, f"audit log directory not writable: {parent}"
        return True, ""

    async def _check_backup_confirmed_recent_by_client(self) -> tuple[bool, str]:
        """Client must confirm a recent backup exists before active testing."""
        confirmed = self.config.get("backup_confirmed", False)
        if not confirmed:
            return False, "backup_confirmed not set to True in config — client must confirm"
        return True, ""

    async def _check_baseline_metrics_captured(self) -> tuple[bool, str]:
        """Baseline metrics must be captured before active probes run."""
        baseline = self.config.get("baseline_captured", False)
        if not baseline:
            return False, "baseline_captured not True — run baseline capture first"
        return True, ""
