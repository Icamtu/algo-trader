# algo-trader/middleware/rate_limiter.py
"""
Zero-Dependency Sliding Window Rate Limiter for FastAPI.

Architecture:
  - Per-IP token bucket using in-memory dict with TTL cleanup.
  - Three tiers: AUTH (strict), TRADE (moderate), GENERAL (permissive).
  - Returns HTTP 429 with Retry-After header on limit breach.
  - Background task prunes stale entries every 60s.

Phase 1 Roadmap Item: C3 — API Rate Limiting & Throttling.
"""

import asyncio
import logging
import time
from collections import defaultdict
from typing import Dict, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# --- Rate Limit Configuration ---
# Format: (max_requests, window_seconds)
RATE_TIERS = {
    "auth":    (10,  60),   # 10 requests per minute for login/auth
    "trade":   (30,  60),   # 30 requests per minute for order execution
    "general": (120, 60),   # 120 requests per minute for everything else
}

# Route prefix → tier mapping
ROUTE_TIER_MAP = {
    "/auth":                "auth",
    "/api/v1/auth":         "auth",
    "/api/v1/login":        "auth",
    "/api/v1/execute":      "trade",
    "/api/v1/order":        "trade",
    "/api/v1/trade":        "trade",
    "/api/v1/deploy":       "trade",
    "/api/v1/action-center": "trade",
}

# Paths that should never be rate-limited (health checks, WS, internal)
EXEMPT_PATHS = {
    "/health",
    "/api/v1/health",
    "/ws",
    "/api/v1/system/heartbeat",
}


class SlidingWindowCounter:
    """Thread-safe sliding window rate counter for a single client."""

    __slots__ = ("_timestamps", "_max_requests", "_window_seconds")

    def __init__(self, max_requests: int, window_seconds: int):
        self._timestamps: list[float] = []
        self._max_requests = max_requests
        self._window_seconds = window_seconds

    def is_allowed(self) -> Tuple[bool, int, float]:
        """
        Check if a request is allowed.

        Returns:
            (allowed, remaining_requests, retry_after_seconds)
        """
        now = time.monotonic()
        cutoff = now - self._window_seconds

        # Prune expired timestamps (sliding window cleanup)
        self._timestamps = [ts for ts in self._timestamps if ts > cutoff]

        if len(self._timestamps) >= self._max_requests:
            # Calculate when the oldest request in window expires
            retry_after = self._timestamps[0] - cutoff
            return False, 0, max(0.1, retry_after)

        self._timestamps.append(now)
        remaining = self._max_requests - len(self._timestamps)
        return True, remaining, 0.0

    @property
    def last_active(self) -> float:
        """Monotonic timestamp of last activity."""
        return self._timestamps[-1] if self._timestamps else 0.0


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that enforces per-IP rate limits using a
    sliding window algorithm with tiered limits.
    """

    def __init__(self, app, cleanup_interval: int = 60, stale_ttl: int = 300):
        super().__init__(app)
        # Key: (client_ip, tier) → SlidingWindowCounter
        self._counters: Dict[str, SlidingWindowCounter] = {}
        self._cleanup_interval = cleanup_interval
        self._stale_ttl = stale_ttl
        self._cleanup_task: Optional[asyncio.Task] = None
        logger.info(
            f"Rate Limiter initialized: AUTH={RATE_TIERS['auth']}, "
            f"TRADE={RATE_TIERS['trade']}, GENERAL={RATE_TIERS['general']}"
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        # Start cleanup task on first request
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        path = request.url.path

        # Skip rate limiting for exempt paths
        if path in EXEMPT_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # Determine tier
        tier = self._resolve_tier(path)
        max_requests, window_seconds = RATE_TIERS[tier]

        # Get client IP (respect X-Forwarded-For for reverse proxy)
        client_ip = self._get_client_ip(request)
        counter_key = f"{client_ip}:{tier}"

        # Get or create counter
        if counter_key not in self._counters:
            self._counters[counter_key] = SlidingWindowCounter(max_requests, window_seconds)

        counter = self._counters[counter_key]
        allowed, remaining, retry_after = counter.is_allowed()

        if not allowed:
            logger.warning(
                f"RATE_LIMIT: {client_ip} hit {tier.upper()} limit "
                f"({max_requests}/{window_seconds}s) on {path}"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "status": "error",
                    "message": f"Rate limit exceeded. Max {max_requests} requests per {window_seconds}s for {tier} tier.",
                    "retry_after": round(retry_after, 1),
                },
                headers={
                    "Retry-After": str(int(retry_after) + 1),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                },
            )

        # Request allowed — add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

    def _resolve_tier(self, path: str) -> str:
        """Map a request path to its rate limit tier."""
        path_lower = path.lower()
        for prefix, tier in ROUTE_TIER_MAP.items():
            if path_lower.startswith(prefix):
                return tier
        return "general"

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting reverse proxy headers."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    async def _cleanup_loop(self):
        """Background task to prune stale counters and prevent memory leaks."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                now = time.monotonic()
                stale_keys = [
                    key for key, counter in self._counters.items()
                    if (now - counter.last_active) > self._stale_ttl
                ]
                for key in stale_keys:
                    del self._counters[key]

                if stale_keys:
                    logger.debug(f"Rate Limiter: Pruned {len(stale_keys)} stale counters")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Rate Limiter cleanup error: {e}")
