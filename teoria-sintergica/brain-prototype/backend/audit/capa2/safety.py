"""
audit/capa2/safety.py

CircuitBreaker for Capa 2 probes.

Monitors:
  - Response time vs per-endpoint baseline
  - Error rate in a sliding window of last 100 requests
  - Any 5xx on any endpoint
  - AUDIT_KILL_SWITCH environment variable

Usage:
    breaker = CircuitBreaker(environment="production")
    breaker.capture_baseline("https://example.com/api/users", 120.0)

    # Inside a probe, after each request:
    breaker.record(url, response_time_ms, status_code)
    # Raises CircuitBreakerTripped if any condition is met.
"""
import os
import time
import logging
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

KILL_SWITCH_ENV = "AUDIT_KILL_SWITCH"


class CircuitBreakerTripped(Exception):
    """Raised when the circuit breaker opens. All active probes must catch this."""


@dataclass
class CircuitBreaker:
    """
    Stateful circuit breaker shared across ALL probes in a single Capa 2 run.

    Must be instantiated once per run and passed via AuditContext.cache.
    Once opened, it stays open until explicitly reset (tests only).
    """
    environment: str = "production"
    _baselines: dict[str, float] = field(default_factory=dict)
    _request_log: deque = field(default_factory=lambda: deque(maxlen=100))
    _is_open: bool = field(default=False)

    def _cfg(self) -> dict:
        from .config import RATE_LIMITS
        return RATE_LIMITS.get(self.environment, RATE_LIMITS["production"])

    def capture_baseline(self, endpoint: str, response_time_ms: float) -> None:
        """Record a baseline response time before active testing begins."""
        self._baselines[endpoint] = response_time_ms
        logger.debug("Baseline captured: %s → %.0fms", endpoint, response_time_ms)

    def record(self, endpoint: str, response_time_ms: float, status_code: int) -> None:
        """
        Record a completed request. Raises CircuitBreakerTripped if any
        safety threshold is exceeded.
        """
        if self._is_open:
            raise CircuitBreakerTripped("Circuit breaker already open — run aborted")

        self._check_kill_switch()

        # 5xx — immediate trip
        if status_code >= 500:
            self._trip(f"5xx response ({status_code}) on {endpoint}")

        # Response time vs baseline
        if endpoint in self._baselines:
            cfg = self._cfg()
            multiplier = cfg["circuit_breaker_response_time_multiplier"]
            threshold_ms = self._baselines[endpoint] * multiplier
            if response_time_ms > threshold_ms and response_time_ms > 2000:
                # Only warn, don't trip — slow responses need sustained pattern
                logger.warning(
                    "Slow response on %s: %.0fms vs baseline %.0fms (×%.1f threshold)",
                    endpoint, response_time_ms, self._baselines[endpoint], multiplier,
                )

        # Sliding window error rate
        self._request_log.append((time.monotonic(), status_code >= 400))
        if len(self._request_log) >= 20:
            error_count = sum(1 for _, is_err in self._request_log if is_err)
            error_rate_pct = error_count / len(self._request_log) * 100
            threshold_pct = self._cfg()["circuit_breaker_error_rate_pct"]
            if error_rate_pct > threshold_pct:
                self._trip(
                    f"Error rate {error_rate_pct:.1f}% exceeded "
                    f"threshold {threshold_pct}%"
                )

    def manual_trip(self, reason: str = "Emergency stop") -> None:
        """Immediately open the circuit breaker (emergency stop endpoint)."""
        self._trip(reason)

    def _trip(self, reason: str) -> None:
        self._is_open = True
        logger.critical("Circuit breaker OPENED: %s", reason)
        raise CircuitBreakerTripped(reason)

    def _check_kill_switch(self) -> None:
        if os.getenv(KILL_SWITCH_ENV, "").lower() in ("1", "true", "yes"):
            self._trip("AUDIT_KILL_SWITCH environment variable set")

    @property
    def is_open(self) -> bool:
        if not self._is_open:
            try:
                self._check_kill_switch()
            except CircuitBreakerTripped:
                pass
        return self._is_open

    def reset(self) -> None:
        """Reset state. For testing only — not callable from production probes."""
        self._is_open = False
        self._request_log.clear()
        self._baselines.clear()
