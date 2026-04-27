import asyncio
import logging
import signal
from datetime import datetime, time
from typing import Optional, Any

from core.config import settings
from core.strategy_runner import StrategyRunner
from data.market_data import MarketDataStream


logger = logging.getLogger(__name__)


from services.historify_service import historify_service


class AlgoScheduler:
    """
    Coordinates the app lifecycle.

    It starts market data, starts all discovered strategies, keeps the process
    alive with a lightweight heartbeat, and shuts everything down gracefully.
    """

    def __init__(
        self,
        market_stream: MarketDataStream,
        strategy_runner: StrategyRunner,
        order_manager: Optional[Any] = None
    ):
        self.market_stream = market_stream
        self.strategy_runner = strategy_runner
        self.order_manager = order_manager
        self._stop_event = asyncio.Event()
        self._heartbeat_interval = settings.get("system", {}).get("heartbeat_interval_seconds", 30)
        self._reconciliation_interval = settings.get("system", {}).get("reconciliation_interval_seconds", 30)
        self._session_check_interval = settings.get("system", {}).get("session_check_interval_seconds", 300)
        self._historify_interval = settings.get("system", {}).get("historify_interval_seconds", 1800)
        self._last_sync_date = None

    def install_signal_handlers(self):
        """Stop cleanly on Ctrl+C or container shutdown signals."""
        loop = asyncio.get_running_loop()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.request_stop)
            except NotImplementedError:
                logger.debug("Signal handlers are not available on this platform.")

    def request_stop(self):
        """Request a graceful stop from anywhere in the app."""
        if not self._stop_event.is_set():
            logger.info("Shutdown requested. Stopping algo-trader...")
            self._stop_event.set()

    async def run(self):
        """Start the runtime and keep it alive until a stop is requested."""
        self.install_signal_handlers()
        logger.info("Starting market data stream...")
        self.market_stream.start()

        logger.info("Starting strategy runner...")
        await self.strategy_runner.start()

        try:
            last_reconciliation = 0
            last_session_check = -self._session_check_interval
            last_historify = 0
            while not self._stop_event.is_set():
                now = asyncio.get_running_loop().time()

                # 1. Heartbeat
                logger.debug("Algo-trader heartbeat: app is running.")

                # 2. Broker Reconciliation
                if self.order_manager and (now - last_reconciliation > self._reconciliation_interval):
                    logger.info("Triggering scheduled broker reconciliation...")
                    asyncio.create_task(self.order_manager.sync_with_broker())
                    last_reconciliation = now

                # 3. Session Health & Auto-Reauth (Phase 40 Audit)
                if self.order_manager and (now - last_session_check > self._session_check_interval):
                    from services.session_service import get_session_service
                    ss = get_session_service(self.order_manager)

                    logger.info("Performing periodic broker session health check...")
                    is_healthy = await ss.check_health()

                    if not is_healthy:
                        logger.warning("📍 Broker session unhealthy. Attempting automated re-authentication...")
                        asyncio.create_task(ss.run_reauth_flow())
                    else:
                        logger.info("✅ Broker session is healthy.")

                    last_session_check = now

                # 4. Historify Background Ingestion
                if (now - last_historify > self._historify_interval):
                    logger.info("📅 Triggering scheduled Historify background ingestion...")
                    # Run in thread via service because it spawns its own threads per symbol
                    try:
                        historify_service.trigger_scheduled_ingestion(["1m", "5m"])
                    except Exception as e:
                        logger.error(f"Failed to trigger Historify ingestion: {e}")
                    last_historify = now

                # 5. Risk Circuit Breaker Check
                if self.order_manager and self.order_manager.risk_manager:
                    if self.order_manager.risk_manager.is_circuit_broken():
                        logger.critical("🚨 CIRCUIT BREAKER TRIGGERED! Drawing down positions...")
                        # Implement flatten_all here or in risk_manager
                        await self.order_manager.cancel_all_orders()
                        # self.request_stop() # Optional: stop the engine

                # 6. Automated Symbol Sync (Master Contract)
                if self._should_sync_symbols():
                    logger.info("📅 Triggering automated Master Contract sync...")
                    from utils.sync_symbols import run_sync
                    asyncio.create_task(asyncio.to_thread(run_sync))
                    self._last_sync_date = datetime.now().date()

                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=self._heartbeat_interval)
                except asyncio.TimeoutError:
                    continue
        finally:
            await self.shutdown()

    def _should_sync_symbols(self) -> bool:
        """Check if we should trigger a master contract sync (Daily at 08:05 and 11:30 PM)."""
        now = datetime.now()
        current_date = now.date()
        current_time = now.time()

        # Morning sync (08:05 AM)
        morning_sync = time(8, 5)
        # Night sync (11:30 PM)
        night_sync = time(23, 30)

        # If we haven't synced today and it's past morning sync time
        if self._last_sync_date != current_date:
            if current_time >= morning_sync:
                return True

        # We don't strictly enforce night sync if morning sync was done,
        # but it's good to have it as a backup or for next-day data.
        # For simplicity, we stick to "once per day after 08:05 AM".

        return False

    async def shutdown(self):
        """Stop strategies and market data in the right order."""
        logger.info("Shutting down strategy runner...")
        await self.strategy_runner.stop()

        logger.info("Shutting down market data stream...")
        await self.market_stream.stop()

        logger.info("Algo-trader shutdown complete.")
