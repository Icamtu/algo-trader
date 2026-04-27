# algo-trader/utils/throttling.py
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

class AsyncTokenBucket:
    """
    Standard token bucket algorithm for rate limiting.
    Tokens are added at a fixed rate. Requests 'wait' until a token is available.
    """
    def __init__(self, capacity: float, refill_rate: float):
        self._rate = refill_rate
        self._capacity = capacity
        self._tokens = capacity
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def wait(self, tokens: int = 1):
        """
        Wait until 'tokens' are available in the bucket.
        """
        async with self._lock:
            while True:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return True

                # Calculate sleep time
                wait_time = (tokens - self._tokens) / self._rate
                await asyncio.sleep(wait_time)

    def _refill(self):
        now = time.monotonic()
        delta = now - self._last_refill
        new_tokens = delta * self._rate

        if new_tokens > 0:
            self._tokens = min(self._capacity, self._tokens + new_tokens)
            self._last_refill = now

    def __repr__(self):
        return f"AsyncTokenBucket(rate={self._rate}, capacity={self._capacity}, tokens={self._tokens:.2f})"
