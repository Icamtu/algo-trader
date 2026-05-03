import asyncio
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DLQEntry:
    def __init__(self, order_params: Dict[str, Any], error: str):
        self.order_params = order_params
        self.error = error
        self.attempts = 0
        self.last_attempt_at = 0
        self.created_at = time.time()
        self.next_retry_at = self.created_at + 30 # Initial 30s delay

class DeadLetterQueueService:
    """
    Manages failed orders with an institutional retry policy.
    Ensures that orders interrupted by transient network errors are recovered.
    """

    def __init__(self, max_retries: int = 3, expiration_seconds: int = 3600):
        self.queue: List[DLQEntry] = []
        self.max_retries = max_retries
        self.expiration_seconds = expiration_seconds
        self.is_running = False

    def enqueue(self, order_params: Dict[str, Any], error: str):
        """Adds a failed order to the DLQ."""
        logger.warning("DLQ: Enqueueing failed order for %s", order_params.get('symbol'))
        self.queue.append(DLQEntry(order_params, error))

    async def start_processor(self, order_manager: Any, interval: int = 10):
        """
        Background loop to process the retry queue.
        """
        if self.is_running: return
        self.is_running = True
        logger.info("DLQ Processor Started.")

        while self.is_running:
            try:
                now = time.time()
                to_retry = [e for e in self.queue if now >= e.next_retry_at]

                for entry in to_retry:
                    # Remove if expired
                    if now - entry.created_at > self.expiration_seconds:
                        logger.error("DLQ: Order for %s expired after %ss", entry.order_params.get('symbol'), self.expiration_seconds)
                        self.queue.remove(entry)
                        continue

                    # Remove if max retries exceeded
                    if entry.attempts >= self.max_retries:
                        logger.error("DLQ: Max retries (%s) reached for %s", self.max_retries, entry.order_params.get('symbol'))
                        self.queue.remove(entry)
                        continue

                    # Attempt retry
                    entry.attempts += 1
                    entry.last_attempt_at = now
                    logger.info("DLQ: Retrying order for %s (Attempt %s)", entry.order_params.get('symbol'), entry.attempts)

                    try:
                        # Call place_order again
                        result = await order_manager.place_order(**entry.order_params, retry_from_dlq=True)
                        if result.get("status") == "success":
                            logger.info("DLQ: Retry successful for %s", entry.order_params.get('symbol'))
                            self.queue.remove(entry)
                        else:
                            # Update next retry with exponential backoff (30s, 60s, 120s...)
                            delay = 30 * (2 ** (entry.attempts - 1))
                            entry.next_retry_at = now + delay
                            logger.warning("DLQ: Retry failed for %s, next retry in %ss", entry.order_params.get('symbol'), delay)
                    except Exception:
                        logger.error("DLQ: Error during retry execution", exc_info=True)

                await asyncio.sleep(interval)
            except Exception:
                logger.error("DLQ loop error", exc_info=True)
                await asyncio.sleep(interval)

# Singleton
dlq_service = DeadLetterQueueService()
