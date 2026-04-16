import os
import jwt
import asyncio
import json
import logging
import threading
import websockets
import time
from functools import partial

import core.logger  # noqa: F401 - initializes global logging on import
from api import create_app, set_api_context
from core.config import settings
from core.scheduler import AlgoScheduler
from core.strategy_runner import StrategyRunner
from data.market_data import MarketDataStream
from execution.openalgo_client import OpenAlgoClient
from execution.order_manager import OrderManager
from portfolio.portfolio_manager import PortfolioManager
from execution.position_manager import PositionManager


logger = logging.getLogger(__name__)
PORT_WS_RELAY = 5002

# Global set of connected frontend WebSocket clients
connected_clients = set()

# Tick batching buffer
tick_buffer = {}
tick_buffer_lock = asyncio.Lock()

# Security constants
JWT_SECRET = os.environ.get("JWT_SECRET")

async def ws_handler(websocket):
    """Handles frontend WebSocket connections with mandatory JWT authentication."""
    # We don't add to connected_clients immediately.
    # The client has a 5-second window to authenticate.
    logger.info("New WebSocket connection attempt. Awaiting authentication...")

    try:
        # Wait for the first message which MUST be an auth packet
        try:
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)

            msg_type = data.get("type", data.get("action"))
            if msg_type not in ["auth", "authenticate"]:
                logger.warning(f"WebSocket auth failed: First message was not 'auth' type (received: {msg_type})")
                await websocket.close(1008, "Authentication required")
                return

            token = data.get("token")
            if not token:
                logger.warning("WebSocket auth failed: Missing token in auth packet.")
                await websocket.close(1008, "Missing token")
                return

            try:
                # Validate JWT
                payload = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_aud": False}
                )
                logger.info(f"WebSocket authenticated successfully for user: {payload.get('email', 'unknown')}")
            except jwt.InvalidTokenError as e:
                logger.warning(f"WebSocket auth failed: {e}")
                await websocket.close(1008, "Invalid token")
                return

        except asyncio.TimeoutError:
            logger.warning("WebSocket auth failed: Timeout waiting for auth packet.")
            await websocket.close(1008, "Authentication timeout")
            return
        except Exception as e:
            logger.error(f"WebSocket handshake error: {e}")
            await websocket.close(1011, "Internal server error")
            return

        # Success - add to pool
        connected_clients.add(websocket)

        # Connection established, send welcome message
        await websocket.send(json.dumps({
            "type": "auth_success",
            "message": "Connected to AetherDesk Relay",
            "timestamp": time.time()
        }))

        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": time.time(),
                        "client_ts": data.get("timestamp")
                    }))
            except json.JSONDecodeError:
                pass
    except Exception as e:
        logger.debug(f"WebSocket client session error: {str(e)}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Frontend UI disconnected. Total clients: {len(connected_clients)}")

async def tick_dispatcher():
    """Background task to dispatch batched ticks every 100ms."""
    logger.info("Tick batch dispatcher started (100ms window).")
    while True:
        try:
            await asyncio.sleep(0.1)  # 100ms buffering window
            if not tick_buffer:
                continue

            async with tick_buffer_lock:
                batch = list(tick_buffer.values())
                tick_buffer.clear()

            if connected_clients and batch:
                message = json.dumps({
                    "type": "tick_batch",
                    "payload": batch,
                    "timestamp": time.time()
                })
                # Efficient parallel broadcast
                await asyncio.gather(
                    *[client.send(message) for client in connected_clients],
                    return_exceptions=True
                )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Tick dispatcher error: {e}")

async def broadcast_event(event_type: str, data: dict):
    """Callback to broadcast any trading event to all connected UI clients and Telegram."""
    # 1. UI WebSocket Broadcast
    if connected_clients:
        message = json.dumps({
            "type": event_type,
            "payload": data,
            "timestamp": time.time()
        })
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )

    # 2. Telegram Alert Broadcast (Critical only)
    critical_events = {"kill_switch", "safeguard_breach", "panic", "error"}
    if event_type in critical_events:
        try:
            from services.telegram_service import get_telegram_service
            tg = get_telegram_service()

            title = f"ALGO ALERT: {event_type.upper()}"
            msg = f"<b>Strategy:</b> {data.get('strategy', 'N/A')}\n"
            if "reason" in data:
                msg += f"<b>Reason:</b> {data['reason']}\n"
            if "symbol" in data:
                msg += f"<b>Symbol:</b> {data['symbol']}\n"

            # Additional metadata formatting
            payload_summary = ", ".join([f"{k}: {v}" for k, v in data.items() if k not in ["strategy", "reason", "symbol"]])
            if payload_summary:
                msg += f"\n<b>Details:</b> <code>{payload_summary}</code>"

            asyncio.create_task(tg.send_alert(title, msg, level="CRITICAL"))
        except Exception as e:
            logger.error(f"Telegram broadcast failed: {e}")

async def broadcast_tick(tick):
    """Adds a tick to the batch buffer instead of immediate broadcast."""
    async with tick_buffer_lock:
        tick_buffer[tick.symbol] = {
            "symbol": tick.symbol,
            "ltp": tick.ltp,
            "timestamp": tick.timestamp
        }

# Network binding configuration
ALGO_HOST = os.getenv("ALGO_HOST", "0.0.0.0")  # nosec B104

def run_flask_server(app, host=ALGO_HOST, port=5001):
    """Run Flask app in a background thread."""
    logger.info(f"Starting Flask API server on {host}:{port}")
    # Enable threading to prevent backtest execution from blocking other API requests
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)


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
                health_update["broker"] = {"status": "OFFLINE", "details": ss_status["last_error"] or "Auth Required"}

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
                except Exception as e:
                    return name, {"status": "OFFLINE", "details": str(e)}

            checks = [
                check_api("openalgo", "http://openalgo-web:5000/"),
                check_api("ollama_local", "http://local_ollama:11434/api/tags"),
                check_api("openclaw_agent", "http://openclaw:18789/"),
            ]
            results = await asyncio.gather(*checks)
            for name, res in results:
                health_update[name] = res

            # Push update to API Gateway (Local REST call)
            async with httpx.AsyncClient() as client:
                await client.post(
                    heartbeat_url,
                    json=health_update,
                    headers={"X-Heartbeat-Token": token}
                )

        except Exception as e:
            # Don't swarm logs if API is booting up
            logger.debug(f"Heartbeat monitor loop suppressed error: {e}")

        await asyncio.sleep(60)

async def async_main():
    """Bootstrap the trading app and keep it running."""
    trading_mode = settings.get("trading", {}).get("mode", "paper").lower()
    logger.info("Algo-trader booting in %s mode.", trading_mode.upper())

    if trading_mode in {"paper", "fronttest"}:
        logger.info(
            "Paper/fronttest mode delegates execution to OpenAlgo Sandbox/Analyzer. "
            "No separate local paper broker is used."
        )

    # Initialize managers
    client = OpenAlgoClient(
        base_url=settings.get("openalgo", {}).get("base_url"),
        api_key=settings.get("openalgo", {}).get("api_key"),
    )
    from risk.risk_manager import RiskManager
    risk_manager = RiskManager()
    position_manager = PositionManager()
    from execution.action_manager import get_action_manager
    action_manager = get_action_manager(telemetry_callback=broadcast_event)

    order_manager = OrderManager(
        client,
        mode=trading_mode,
        risk_manager=risk_manager,
        position_manager=position_manager,
        telemetry_callback=broadcast_event,
        action_manager=action_manager
    )
    action_manager.set_order_manager(order_manager)
    portfolio_manager = PortfolioManager(
        account_capital=settings.get("portfolio", {}).get("account_capital", 100000.0),
        max_capital_per_trade_pct=settings.get("portfolio", {}).get("max_capital_per_trade_pct", 10.0),
    )
    market_stream = MarketDataStream()
    strategy_runner = StrategyRunner(
        market_stream=market_stream,
        order_manager=order_manager,
        portfolio_manager=portfolio_manager,
        config=settings,
        telemetry_callback=broadcast_event
    )

    # Initialize DuckDB Ingestor for real-time history
    from data.market_data import DuckDBIngestor
    duckdb_ingestor = DuckDBIngestor()

    # Register the WebSocket broadcast callback to relay ticks to frontend
    # Note: GlobalHeader ticker symbols are hardcoded for now, but we subscribe them here
    ui_symbols = ["NIFTY", "BANKNIFTY", "RELIANCE", "HDFCBANK", "INFY", "TCS"]
    market_stream.subscribe(ui_symbols, broadcast_tick)

    # Also persist these UI symbols to DuckDB Historify in real-time
    market_stream.subscribe(ui_symbols, duckdb_ingestor.handle_tick)

    # Initialize Flask API context
    set_api_context(strategy_runner, order_manager, position_manager, portfolio_manager)

    # Create Flask app and start it in a background thread
    server_port = int(os.getenv("PORT", 18788))
    app = create_app()
    flask_thread = threading.Thread(
        target=partial(run_flask_server, app, ALGO_HOST, server_port),
        daemon=True,
    )
    flask_thread.start()
    logger.info("Flask API server thread started.")

    # Start the WebSocket Relay server for the Frontend UI
    ws_server = await websockets.serve(
        ws_handler,
        ALGO_HOST,
        PORT_WS_RELAY,
        ping_interval=15,
        ping_timeout=10,
        close_timeout=5
    )
    logger.info(f"WebSocket relay server started on port {PORT_WS_RELAY}")

    # Start the ticker dispatcher
    dispatcher_task = asyncio.create_task(tick_dispatcher())

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
        dispatcher_task.cancel()
        await asyncio.gather(dispatcher_task, return_exceptions=True)


def main():
    """Synchronous entrypoint for `python main.py`."""
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        logger.info("Algo-trader stopped by user.")


if __name__ == "__main__":
    main()
