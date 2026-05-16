"""
audit/capa2/rate_limiter.py

Token-bucket rate limiter for Capa 2 probes.

All active probes MUST acquire a token before sending any HTTP request.
Rate limits are configured per environment via capa2/config.py.

Usage:
    limiter = RateLimiter(environment="production")
    async with limiter.acquire(endpoint_url):
        response = await client.get(endpoint_url)
"""
import asyncio
import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RateLimiter:
    """
    Per-endpoint token bucket rate limiter.

    Rate is driven by environment config (max_rps_per_endpoint).
    Between any two requests to the same endpoint, at least
    (1 / max_rps) seconds must elapse.
    """
    environment: str = "production"
    _last_request: dict[str, float] = field(default_factory=dict)
    _global_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def _min_interval(self) -> float:
        from .config import RATE_LIMITS
        cfg = RATE_LIMITS.get(self.environment, RATE_LIMITS["production"])
        return 1.0 / cfg["max_rps_per_endpoint"]

    async def acquire(self, endpoint: str) -> None:
        """
        Wait until the rate limit allows another request to `endpoint`.
        Call this before every outbound HTTP request in a Capa 2 probe.
        """
        async with self._global_lock:
            interval = self._min_interval()
            last = self._last_request.get(endpoint, 0.0)
            now = time.monotonic()
            wait = interval - (now - last)
            if wait > 0:
                logger.debug("Rate limit: sleeping %.2fs before %s", wait, endpoint)
                await asyncio.sleep(wait)
            self._last_request[endpoint] = time.monotonic()

    async def pause_between_probes(self) -> None:
        """
        Pause between probe executions (configured per environment).
        Called by the Capa 2 orchestrator between sequential probes.
        """
        from .config import RATE_LIMITS
        cfg = RATE_LIMITS.get(self.environment, RATE_LIMITS["production"])
        pause = cfg["pause_between_probes_s"]
        logger.debug("Inter-probe pause: %.1fs", pause)
        await asyncio.sleep(pause)
