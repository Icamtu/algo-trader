import time
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    In-memory Token Bucket Rate Limiter (Phase 3).
    Prevents broker API bans by enforcing request-per-second limits.
    """
    def __init__(self, requests_per_second: float = 10.0):
        self.capacity = requests_per_second
        self.tokens = requests_per_second
        self.updated_at = time.monotonic()
        self.lock = asyncio.Lock()

    async def wait(self):
        """Asynchronously waits for a token to become available."""
        async with self.lock:
            while self.tokens < 1:
                now = time.monotonic()
                fill_amount = (now - self.updated_at) * self.capacity
                self.tokens = min(self.capacity, self.tokens + fill_amount)
                self.updated_at = now

                if self.tokens < 1:
                    sleep_time = (1 - self.tokens) / self.capacity
                    await asyncio.sleep(sleep_time)

            self.tokens -= 1
            return True

# Registry for broker-specific limiters
_limiters: Dict[str, RateLimiter] = {}

def get_limiter(broker_id: str, rps: float = 10.0) -> RateLimiter:
    if broker_id not in _limiters:
        _limiters[broker_id] = RateLimiter(rps)
    return _limiters[broker_id]
