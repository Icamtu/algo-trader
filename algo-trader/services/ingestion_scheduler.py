import asyncio
import logging
import threading
import time
from services.historify_service import historify_service

logger = logging.getLogger(__name__)

class IngestionScheduler:
    """
    Automated background task to keep historical market data in sync.
    Periodically checks the watchlist and retrieves missing data.
    """

    def __init__(self, interval_seconds: int = 1800): # Default 30 minutes
        self.interval_seconds = interval_seconds
        self.is_running = False
        self._thread = None

    def start(self):
        if self.is_running:
            return

        self.is_running = True
        logger.info(f"Historify Ingestion Scheduler: Starting (interval={self.interval_seconds}s)...")

        # We use a thread for the sleep loop to avoid blocking the main async loop
        # or requiring a running event loop at initialization
        self._thread = threading.Thread(target=self._run_forever, daemon=True)
        self._thread.start()

    def stop(self):
        self.is_running = False
        logger.info("Historify Ingestion Scheduler: Stopping...")

    def _run_forever(self):
        # Initial delay to let the system stabilize/OpenAlgo connect
        time.sleep(30)

        while self.is_running:
            try:
                # Trigger bulk update
                # This will spawn internal worker threads in HistorifyService
                historify_service.trigger_scheduled_ingestion(intervals=["1m", "5m"])

                # Perform periodic maintenance on SQLite
                from database.trade_logger import get_trade_logger
                logger.info("Performing periodic DB maintenance (log rotation)...")
                get_trade_logger().rotate_logs(max_days=30)

                # Perform DuckDB Historify Retention
                from data.historify_db import enforce_retention_policy
                enforce_retention_policy(max_days=30)

            except Exception as e:
                logger.error(f"Historify Scheduler Loop Error: {e}")

            # Wait for next interval
            # Check is_running periodically to allow faster shutdown
            for _ in range(self.interval_seconds // 10):
                if not self.is_running:
                    break
                time.sleep(10)

# Singleton
ingestion_scheduler = IngestionScheduler()
