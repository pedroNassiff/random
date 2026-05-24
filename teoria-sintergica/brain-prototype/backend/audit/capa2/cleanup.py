"""
audit/capa2/cleanup.py

Tracks every resource created during Capa 2 testing for post-phase cleanup.

All probes that create data (test comments, wishlists, accounts, uploads)
MUST register their creations here. The cleanup script runs after each phase.

This ensures no test artifacts remain in production/staging after the audit.

Usage:
    tracker = CleanupTracker(run_id="...", log_path="/audit/logs/cleanup.jsonl")

    # In a probe, after creating a resource:
    tracker.register(
        probe_key="idor_horizontal",
        resource_type="comment",
        resource_id="12345",
        endpoint="https://example.com/api/comments",
        cleanup_endpoint="DELETE https://example.com/api/comments/12345",
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    # After the phase, run cleanup:
    results = await tracker.cleanup_all(http_client)
"""
import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class CreatedResource:
    probe_key:        str
    resource_type:    str    # 'comment', 'account', 'upload', 'wishlist', etc.
    resource_id:      str
    endpoint:         str    # where it was created
    cleanup_method:   str    # HTTP method: 'DELETE' | 'PUT' | 'PATCH'
    cleanup_url:      str    # URL to call to delete the resource
    created_at:       str    = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    cleaned_up:       bool   = False
    cleanup_error:    Optional[str] = None


@dataclass
class CleanupTracker:
    """
    Centralized registry of all resources created during Capa 2 testing.

    Shared across all probes via AuditContext.cache["cleanup_tracker"].
    """
    run_id:   str
    log_path: str
    _items:   list[CreatedResource] = field(default_factory=list)

    def register(
        self,
        probe_key: str,
        resource_type: str,
        resource_id: str,
        endpoint: str,
        cleanup_method: str,
        cleanup_url: str,
    ) -> None:
        """Register a created resource for cleanup."""
        item = CreatedResource(
            probe_key=probe_key,
            resource_type=resource_type,
            resource_id=resource_id,
            endpoint=endpoint,
            cleanup_method=cleanup_method.upper(),
            cleanup_url=cleanup_url,
        )
        self._items.append(item)
        self._append_to_log(item)
        logger.info(
            "Cleanup registered: %s %s (probe: %s)",
            resource_type, resource_id, probe_key,
        )

    async def cleanup_all(self, http_client) -> dict:
        """
        Attempt to delete all registered resources.
        Returns a summary dict with counts.
        """
        if not self._items:
            logger.info("Cleanup: no items to clean up for run %s", self.run_id)
            return {"total": 0, "cleaned": 0, "failed": 0, "items": []}

        cleaned = 0
        failed = 0

        for item in self._items:
            if item.cleaned_up:
                continue
            try:
                method = item.cleanup_method.lower()
                resp = await getattr(http_client, method)(item.cleanup_url)
                if resp.status_code < 400:
                    item.cleaned_up = True
                    cleaned += 1
                    logger.info("Cleaned up: %s %s", item.resource_type, item.resource_id)
                else:
                    item.cleanup_error = f"HTTP {resp.status_code}"
                    failed += 1
                    logger.warning(
                        "Cleanup failed: %s %s → %s",
                        item.resource_type, item.resource_id, item.cleanup_error,
                    )
            except Exception as exc:
                item.cleanup_error = str(exc)
                failed += 1
                logger.error(
                    "Cleanup exception for %s %s: %s",
                    item.resource_type, item.resource_id, exc,
                )

        self._rewrite_log()
        return {
            "total": len(self._items),
            "cleaned": cleaned,
            "failed": failed,
            "items": [asdict(i) for i in self._items],
        }

    def summary(self) -> dict:
        """Return cleanup status summary without performing cleanup."""
        return {
            "total": len(self._items),
            "cleaned": sum(1 for i in self._items if i.cleaned_up),
            "pending": sum(1 for i in self._items if not i.cleaned_up),
            "items": [asdict(i) for i in self._items],
        }

    def _append_to_log(self, item: CreatedResource) -> None:
        """Append a single item to the JSONL log file."""
        if not self.log_path:
            return
        try:
            os.makedirs(os.path.dirname(self.log_path) or ".", exist_ok=True)
            with open(self.log_path, "a") as f:
                f.write(json.dumps({"run_id": self.run_id, **asdict(item)}) + "\n")
        except Exception as exc:
            logger.warning("Could not write cleanup log: %s", exc)

    def _rewrite_log(self) -> None:
        """Rewrite the entire log with updated cleanup states."""
        if not self.log_path:
            return
        try:
            with open(self.log_path, "w") as f:
                for item in self._items:
                    f.write(json.dumps({"run_id": self.run_id, **asdict(item)}) + "\n")
        except Exception as exc:
            logger.warning("Could not rewrite cleanup log: %s", exc)
