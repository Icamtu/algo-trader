import os
import asyncio
import logging
import threading
import time
from functools import partial
import uvicorn

import core.logger  # noqa: F401 - initializes global logging on import
from core.config import settings
from core.scheduler import AlgoScheduler
from core.strategy_runner import StrategyRunner
from data.market_data import MarketDataStream
from execution.order_manager import OrderManager
from portfolio.portfolio_manager import PortfolioManager
from execution.position_manager import PositionManager
from fastapi_app import app, set_fastapi_context

logger = logging.getLogger(__name__)

# Security constants
JWT_SECRET = os.environ.get("JWT_SECRET")

# Network binding configuration
ALGO_HOST = os.getenv("ALGO_HOST", "0.0.0.0")  # nosec B104

async def system_health_monitor(order_manager):
    """Refined background heartbeat checking for all unified system metrics."""
    import httpx
    import time
    logger.info("System Health Heartbeat Monitor active.")

    # Internal auth for heartbeat push
    port = int(os.getenv("PORT", 18788))
    # We use localhost here as it's an internal call within the same container
    heartbeat_url = f"http://localhost:{port}/api/v1/system/heartbeat"
    token = os.getenv("JWT_SECRET")

    while True:
        try:
            health_update = {}

            # 1. Check Broker
            from services.session_service import get_session_service
            ss = get_session_service(order_manager)
            await ss.check_health()
            ss_status = ss.get_status()
            if ss_status["is_healthy"]:
                health_update["broker"] = {"status": "HEALTHY", "details": "Active Session"}
            else:
                health_update["broker"] = {"status": "OFFLINE", "details": "Authentication required"}

            # 2. Check APIs (Async)
            async def check_api(name, url, timeout=2.0):
                start_time = time.time()
                try:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        resp = await client.get(url)
                        latency = int((time.time() - start_time) * 1000)
                        if resp.status_code < 400:
                            return name, {"status": "HEALTHY", "latency": latency}
                        return name, {"status": "ERROR", "details": f"HTTP {resp.status_code}"}
                except Exception:
                    return name, {"status": "OFFLINE", "details": "Connection error"}

            checks = [
                check_api("ollama_local", "http://local_ollama:11434/api/tags"),
                check_api("openclaw_agent", "http://openclaw:18789/"),
            ]

            # Phase 16: Ensure health monitor stays focused on active AetherBridge infra
            results = await asyncio.gather(*checks, return_exceptions=True)
            for i, res in enumerate(results):
                if isinstance(res, Exception):
                    name = ["ollama_local", "openclaw_agent"][i]
                    health_update[name] = {"status": "OFFLINE", "details": "Service unreachable"}
                else:
                    name, status_dict = res
                    health_update[name] = status_dict

            # 3. Check Database (Historify_DB)
            try:
                from services.historify_service import historify_service
                db_stats = historify_service.get_stats()

                health_update["database"] = {
                    "status": db_stats.get("status", "HEALTHY"),
                    "latency": db_stats.get("latency", 0),
                    "integrity": db_stats.get("integrity", "STABLE"),
                    "details": f"{db_stats.get('market_records', 0)} Records | {db_stats.get('disk_usage_mb', 0)} MB"
                }
            except Exception:
                health_update["database"] = {
                    "status": "OFFLINE",
                    "details": "Database error",
                    "integrity": "DISCONNECTED"
                }

            logger.info(f"Pushing health update: {list(health_update.keys())}")
            # Phase 16: Also store in context for FastAPI routers to access directly
            from core.context import app_context
            app_context["latest_health"] = health_update

            # Broadcast risk status periodically for the UI (Phase 16 Sync)
            if order_manager and order_manager.risk_manager:
                from fastapi_app import manager as ws_manager
                import json
                risk_data = order_manager.risk_manager.get_status()
                # Use a background task to avoid blocking the health monitor
                asyncio.create_task(ws_manager.broadcast(json.dumps({
                    "type": "risk_update",
                    "payload": risk_data,
                    "timestamp": time.time()
                })))

            # Push update to API Gateway (Local REST call for legacy Flask compatibility)
            async with httpx.AsyncClient() as client:
                await client.post(
                    heartbeat_url,
                    json=health_update,
                    headers={"X-Heartbeat-Token": token}
                )

        except Exception as e:
            # Don't swarm logs if API is booting up
            logger.debug(f"Heartbeat monitor loop suppressed error: {e}")

        await asyncio.sleep(10)

def run_fastapi_server(host, port):
    """Run FastAPI server using uvicorn."""
    logger.info(f"Starting FastAPI server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")

async def async_main():
    """Bootstrap the trading app and keep it running."""
    trading_mode = settings.get("trading", {}).get("mode", "paper").lower()
    logger.info("Algo-trader booting in %s mode (FastAPI Unified).", trading_mode.upper())

    # Initialize managers
    from risk.risk_manager import RiskManager
    risk_manager = RiskManager()
    position_manager = PositionManager()

    # These will be set after context is initialized
    broadcast_tick_cb = None
    broadcast_event_cb = None

    # Temporary broadcast event to allow ActionManager initialization
    # It will be replaced once FastAPI context is set
    async def temp_broadcast_event(event_type, data):
        if broadcast_event_cb:
            await broadcast_event_cb(event_type, data)

    from execution.action_manager import get_action_manager
    action_manager = get_action_manager(telemetry_callback=temp_broadcast_event)

    from services.historify_service import historify_service
    historify_service.set_broadcast_callback(temp_broadcast_event)

    # Populate DuckDB watchlist for Historify with known-good cash symbols
    import data.historify_db as hdb
    hdb.init_database()
    removed_watchlist_entries = hdb.sanitize_watchlist()
    if removed_watchlist_entries:
        logger.info("Historify: Pruned unsupported watchlist entries before startup sync.")

    current_watchlist = hdb.get_watchlist()
    if not current_watchlist:
        logger.info("Historify: Populating initial watchlist with known-good defaults...")
        hdb.seed_default_watchlist()
        current_watchlist = hdb.get_watchlist()

    # Phase 16: Include managed UI ticker symbols in the active stream
    from routers.system import get_ticker_config
    ticker_config = await get_ticker_config()
    ui_config_symbols = [t["symbol"] for t in ticker_config.get("ticker_symbols", [])]

    ui_symbols = list(set([item["symbol"] for item in current_watchlist] + ui_config_symbols))

    # Trigger initial ingestion for watchlist on startup
    logger.info(f"Historify: Triggering initial sync for {len(ui_symbols)} symbols...")
    historify_service.trigger_scheduled_ingestion(["1m", "5m"])

    order_manager = OrderManager(
        mode=trading_mode,
        risk_manager=risk_manager,
        position_manager=position_manager,
        telemetry_callback=temp_broadcast_event,
        action_manager=action_manager
    )
    action_manager.set_order_manager(order_manager)

    # AetherBridge: Native Broker Lifecycle
    if order_manager.native_broker:
        logger.info("AetherBridge: Initiating native broker login...")
        login_task = asyncio.create_task(order_manager.native_broker.login())
        # We don't block startup for login, but we track it.
        def on_login_done(t):
            if t.result():
                logger.info("AetherBridge: Native Broker login SUCCESS.")
            else:
                logger.error("AetherBridge: Native Broker login FAILED.")
        login_task.add_done_callback(on_login_done)

    portfolio_manager = PortfolioManager(
        account_capital=settings.get("portfolio", {}).get("account_capital", 100000.0),
        max_capital_per_trade_pct=settings.get("portfolio", {}).get("max_capital_per_trade_pct", 10.0),
    )

    market_stream = MarketDataStream()
    if trading_mode == "paper":
        market_stream.set_native_broker(order_manager.paper_broker)
    elif order_manager.native_broker:
        market_stream.set_native_broker(order_manager.native_broker)

    strategy_runner = StrategyRunner(
        market_stream=market_stream,
        order_manager=order_manager,
        portfolio_manager=portfolio_manager,
        config=settings,
        telemetry_callback=temp_broadcast_event
    )

    # Initialize context and get official callbacks
    from api import set_api_context as legacy_set_api_context
    legacy_set_api_context(
        strategy_runner, order_manager, position_manager, portfolio_manager
    )

    broadcast_tick_cb, broadcast_event_cb = set_fastapi_context(
        strategy_runner, order_manager, position_manager, portfolio_manager
    )

    # Initialize DuckDB Ingestor for real-time history
    from data.market_data import DuckDBIngestor
    duckdb_ingestor = DuckDBIngestor()
    # We define a wrapper because market_stream.subscribe expects a non-async callback usually,
    # but our new callbacks are async. We'll wrap them if needed.
    async def tick_wrapper(tick):
        await broadcast_tick_cb(tick)
        await duckdb_ingestor.handle_tick(tick)

    market_stream.subscribe(ui_symbols, tick_wrapper)

    # Start FastAPI server in a background thread
    server_port = int(os.getenv("PORT", 18788))
    fastapi_thread = threading.Thread(
        target=run_fastapi_server,
        args=(ALGO_HOST, server_port),
        daemon=True
    )
    fastapi_thread.start()
    logger.info("FastAPI Unified Server thread started.")

    # Start the unified heartbeat task
    heartbeat_task = asyncio.create_task(system_health_monitor(order_manager))

    # Start the scheduler (async main loop)
    scheduler = AlgoScheduler(
        market_stream=market_stream,
        strategy_runner=strategy_runner,
        order_manager=order_manager
    )

    try:
        await scheduler.run()
    finally:
        logger.info("Algo-trader shutting down.")


def main():
    """Synchronous entrypoint for `python main.py`."""
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        logger.info("Algo-trader stopped by user.")


if __name__ == "__main__":
    main()
