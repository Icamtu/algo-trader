import time
import logging
import asyncio
from typing import Optional, Any, Dict, List
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class LatencyTracker:
    """
    Utility to track and log execution latencies for institutional performance audits.
    """

    def __init__(self):
        self._stats: Dict[str, List[float]] = {}
        self._max_history = 100

    def get_avg_latency(self, label: str) -> float:
        """Returns the rolling average latency for a label."""
        latencies = self._stats.get(label, [])
        if not latencies:
            return 0.0
        return sum(latencies) / len(latencies)

    def _record(self, label: str, ms: float):
        if label not in self._stats:
            self._stats[label] = []
        self._stats[label].append(ms)
        if len(self._stats[label]) > self._max_history:
            self._stats[label].pop(0)

    @contextmanager
    def measure(self, label: str, threshold_ms: float = 1.0, metadata: Optional[Dict[str, Any]] = None):
        """
        Context manager to measure execution time.
        Logs a warning if execution exceeds threshold_ms.
        """
        start_time = time.perf_counter()
        try:
            yield
        finally:
            end_time = time.perf_counter()
            latency_ms = (end_time - start_time) * 1000
            self._record(label, latency_ms)

            meta_str = f" | {metadata}" if metadata else ""
            if latency_ms >= threshold_ms:
                logger.debug(f"[LATENCY] {label}: {latency_ms:.3f}ms{meta_str}")

    async def measure_async(self, label: str, threshold_ms: float = 1.0, metadata: Optional[Dict[str, Any]] = None):
        """
        Context manager for async operations.
        Usage: async with LatencyTracker.measure_async("OrderPlace"): ...
        """
        class AsyncMeasure:
            def __init__(self, parent, label, threshold, meta):
                self.parent = parent
                self.label = label
                self.threshold = threshold
                self.meta = meta
                self.start = 0

            async def __aenter__(self):
                self.start = time.perf_counter()
                return self

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                latency_ms = (time.perf_counter() - self.start) * 1000
                self.parent._record(self.label, latency_ms)

                meta_str = f" | {self.meta}" if self.meta else ""
                if latency_ms >= self.threshold:
                    logger.debug(f"[LATENCY_ASYNC] {self.label}: {latency_ms:.3f}ms{meta_str}")

        return AsyncMeasure(self, label, threshold_ms, metadata)

latency_tracker = LatencyTracker()
