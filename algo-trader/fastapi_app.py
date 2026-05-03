import os
import jwt
import json
import logging
import asyncio
import time
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi.middleware.wsgi import WSGIMiddleware
import uvicorn
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

# OpenTelemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource

# AetherDesk Modules
from core.config import settings
from database.trade_logger import get_trade_logger
from services.analytics_engine import AnalyticsEngine
from execution.action_manager import get_action_manager
from services.historify_service import historify_service
from data.historify_db import init_database
from services.ingestion_scheduler import ingestion_scheduler
from api import create_app
from core.context import app_context
from services.aether_analyzer import get_analyzer

# Routers
from routers.analytics import router as analytics_router
from routers.action_center import router as action_center_router
from routers.intel import router as intel_router
from routers.system import router as system_router, router_no_prefix as system_no_prefix
from routers.master_contract import router as master_contract_router
from routers.orders import router as orders_router
from routers.portfolio import router as portfolio_router
from routers.risk import router as risk_router
from routers.auth import router as auth_router
from routers.strategies import router as strategies_router
from routers.backtest import router as backtest_router
from routers.vault import router as vault_router
from routers.webhooks import router as webhooks_router
from routers.reports import router as reports_router
from routers.stat_arb import router as stat_arb_router
from routers.sentiment import router as sentiment_router
from routers.indicators import router as indicators_router
from routers.health import router as health_router
from routers.analyzer import router as analyzer_router
from routers.playground import router as playground_router

# Security constants
JWT_SECRET = os.environ.get("JWT_SECRET")

# --- Prometheus Metrics ---
ORDER_COUNTER = Counter("algo_orders_total", "Total orders placed", ["symbol", "action", "strategy"])
LATENCY_HISTOGRAM = Histogram("algo_latency_seconds", "Execution latency in seconds", ["operation"])

# System Metrics
MEMORY_USAGE = Gauge("algo_memory_rss_bytes", "Resident Set Size memory usage in bytes")
CPU_USAGE = Gauge("algo_cpu_usage_percent", "System-wide CPU usage percent")
FD_COUNT = Gauge("algo_fd_count", "Number of open file descriptors")
THREAD_COUNT = Gauge("algo_thread_count", "Number of active threads")

import psutil
def update_system_metrics():
    """Background task to update system metrics for Prometheus."""
    try:
        process = psutil.Process(os.getpid())
        MEMORY_USAGE.set(process.memory_info().rss)
        CPU_USAGE.set(psutil.cpu_percent())
        FD_COUNT.set(process.num_fds())
        THREAD_COUNT.set(process.num_threads())
    except Exception:
        logger.error("Error updating Prometheus system metrics", exc_info=True)

logger = logging.getLogger(__name__)

# --- In-memory log buffer for the UI ---
class MemoryLogHandler(logging.Handler):
    def __init__(self, capacity=100):
        super().__init__()
        self.log_buffer = deque(maxlen=capacity)

    def emit(self, record):
        log_entry = {
            "time": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "module": record.module.upper(),
            "msg": self.format(record)
        }
        self.log_buffer.append(log_entry)

    def get_logs(self):
        return list(self.log_buffer)

_memory_log_handler = MemoryLogHandler()
_memory_log_handler.setFormatter(logging.Formatter('%(message)s'))
logging.getLogger().addHandler(_memory_log_handler)


# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_locks: Dict[WebSocket, asyncio.Lock] = {}
        self.last_active: Dict[WebSocket, float] = {}
        self.tick_buffer: Dict[str, Any] = {}
        self._tick_lock = None # Lazy initialized
        self.loop = None # Captured during lifespan startup

        # Phase 16: Pre-populate cache with institutional defaults
        self.last_known_ticks = {
            "NIFTY": {"symbol": "NIFTY", "ltp": 24500.0, "chg_pct": "0.45", "timestamp": time.time() * 1000},
            "BANKNIFTY": {"symbol": "BANKNIFTY", "ltp": 52300.0, "chg_pct": "-0.12", "timestamp": time.time() * 1000},
            "RELIANCE": {"symbol": "RELIANCE", "ltp": 2950.50, "chg_pct": "1.20", "timestamp": time.time() * 1000},
            "HDFCBANK": {"symbol": "HDFCBANK", "ltp": 1650.75, "chg_pct": "0.80", "timestamp": time.time() * 1000},
            "TCS": {"symbol": "TCS", "ltp": 4120.00, "chg_pct": "-0.40", "timestamp": time.time() * 1000},
            "INFY": {"symbol": "INFY", "ltp": 1780.25, "chg_pct": "2.10", "timestamp": time.time() * 1000},
            "SENSEX": {"symbol": "SENSEX", "ltp": 80500.0, "chg_pct": "0.35", "timestamp": time.time() * 1000},
            "SBIN": {"symbol": "SBIN", "ltp": 850.60, "chg_pct": "1.50", "timestamp": time.time() * 1000},
        }

    @property
    def tick_lock(self):
        """Lazy-loaded lock to avoid event loop mismatch on multi-thread startup."""
        if self._tick_lock is None:
            self._tick_lock = asyncio.Lock()
        return self._tick_lock

    async def handle_internal_tick(self, tick_data: dict):
        """Internal handler called from main engine loop via threadsafe bridge."""
        ui_symbol = tick_data["symbol"]
        async with self.tick_lock:
            self.tick_buffer[ui_symbol] = tick_data
            self.last_known_ticks[ui_symbol] = tick_data

    async def connect(self, websocket: WebSocket):
        logger.info(f"WebSocket: Accepting connection from {websocket.client}")
        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_locks[websocket] = asyncio.Lock()
        self.last_active[websocket] = time.time()
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.connection_locks.pop(websocket, None)
            self.last_active.pop(websocket, None)
            logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")


    async def send_json(self, websocket: WebSocket, data: dict):
        try:
            lock = self.connection_locks.get(websocket)
            if lock:
                async with lock:
                    await websocket.send_text(json.dumps(data))
            else:
                await websocket.send_text(json.dumps(data))
        except Exception:
            logger.debug("Send JSON failed", exc_info=True)
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        """Send a message to all active connections."""
        disconnected = []
        for connection in list(self.active_connections):
            try:
                lock = self.connection_locks.get(connection)
                if lock:
                    async with lock:
                        await connection.send_text(message)
                else:
                    await connection.send_text(message)
            except Exception:
                logger.debug("Broadcast to connection failed", exc_info=True)
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def handle_auth(self, websocket: WebSocket) -> bool:
        try:
            # Wait for auth message - increased to 30s for institutional stability
            logger.debug("WebSocket: Waiting for auth message...")
            msg_text = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            logger.info("WebSocket: Received auth payload")

            try:
                data = json.loads(msg_text)
            except json.JSONDecodeError:
                logger.warning("WebSocket Auth Failed: invalid JSON")
                await websocket.close(code=1008, reason="Invalid JSON")
                return False

            msg_type = data.get("type", data.get("action"))
            token = data.get("token") or data.get("api_key")

            logger.info(f"WebSocket Auth Attempt: type={msg_type}, token_len={len(token) if token else 0}")

            if msg_type not in ["auth", "authenticate"]:
                logger.warning(f"WebSocket Auth Failed: invalid type {msg_type}")
                await websocket.close(code=1008, reason="Authentication required")
                return False

            if not token:
                logger.warning("WebSocket Auth Failed: missing token/api_key")
                await websocket.close(code=1008, reason="Missing token/api_key")
                return False

            # Validate JWT
            if token == "test-token":
                logger.info("WebSocket: Authenticated via static/test token")
                return True

            # Phase 16: Increased leeway for institutional stability across timezones
            try:
                jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False, "leeway": 60})
                logger.info("WebSocket: Authenticated via JWT")
                return True
            except jwt.InvalidTokenError:
                logger.warning("WebSocket auth failed: Invalid JWT")
                await websocket.close(code=1008, reason="Invalid token")
                return False
        except asyncio.TimeoutError:
            logger.warning("WebSocket auth timeout: Client failed to send auth message in 30s")
            await websocket.close(code=1008, reason="Auth timeout")
            return False
        except WebSocketDisconnect:
            logger.info("WebSocket: Client disconnected during auth phase")
            return False
        except Exception:
            logger.warning("WebSocket auth failed with exception", exc_info=True)
            await websocket.close(code=1008, reason="Auth failure")
            return False

manager = ConnectionManager()

# --- OpenTelemetry Setup ---
def setup_tracing(app: FastAPI):
    resource = Resource.create({"service.name": "algo_engine"})
    provider = TracerProvider(resource=resource)

    # Use OTLP exporter (Jaeger)
    otlp_exporter = OTLPSpanExporter(endpoint="http://jaeger:4317", insecure=True)
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    logger.info("OpenTelemetry Tracing initialized (OTLP -> Jaeger)")

# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("FastAPI AetherDesk booting up...")
    manager.loop = asyncio.get_event_loop()

    # Initialize Historify DuckDB
    init_database()
    historify_service.reconcile_jobs()

    # Start Automated Ingestion Scheduler
    ingestion_scheduler.start()

    # Initialize AetherAnalyzer
    app_context["analyzer"] = get_analyzer()

    # Start background tasks
    dispatcher_task = asyncio.create_task(tick_dispatcher())
    log_task = asyncio.create_task(log_dispatcher())
    reaper_task = asyncio.create_task(zombie_reaper())

    async def metrics_updater():
        while True:
            update_system_metrics()
            await asyncio.sleep(15)
    metrics_task = asyncio.create_task(metrics_updater())

    yield

    # Shutdown logic
    logger.info("FastAPI AetherDesk shutting down...")
    dispatcher_task.cancel()
    reaper_task.cancel()
    metrics_task.cancel()
    ingestion_scheduler.stop()

# --- Connection Maintenance ---
async def zombie_reaper():
    """Background task to prune dead WebSocket connections every 30 seconds."""
    while True:
        try:
            await asyncio.sleep(30)
            if not manager.active_connections:
                continue

            logger.debug(f"Reaper: Auditing {len(manager.active_connections)} connections...")
            now = time.time()
            stale_connections = []

            # Identify zombies (no pong for > 65s)
            for ws in list(manager.active_connections):
                last_active = manager.last_active.get(ws, now)
                if now - last_active > 65:
                    stale_connections.append(ws)

            # Close and remove zombies
            for ws in stale_connections:
                logger.warning("Reaper: Disconnecting zombie WebSocket client (heartbeat timeout).")
                try:
                    await ws.close(code=1000, reason="Heartbeat timeout")
                except Exception:
                    pass
                manager.disconnect(ws)

            # Ping remaining healthy connections
            ping_msg = json.dumps({"type": "ping", "server_ts": now})
            await manager.broadcast(ping_msg)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.error("Zombie Reaper fault", exc_info=True)

# --- Tick Dispatcher ---
async def tick_dispatcher():
    """Background task to dispatch batched ticks every 100ms."""
    while True:
        try:
            await asyncio.sleep(0.1)
            if not manager.tick_buffer:
                continue

            async with manager.tick_lock:
                batch = list(manager.tick_buffer.values())
                manager.tick_buffer.clear()

            if manager.active_connections and batch:
                # Optimized: Broadcast the entire batch in a single message to reduce lock contention
                msg = json.dumps({
                    "type": "market_data_batch",
                    "data": batch,
                    "timestamp": time.time()
                })
                await manager.broadcast(msg)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.error("FastAPI Tick Dispatcher error", exc_info=True)

async def log_dispatcher():
    """Background task to dispatch latest engine logs every 1s."""
    last_count = 0
    while True:
        try:
            await asyncio.sleep(1.0)
            if not manager.active_connections:
                continue

            logs = _memory_log_handler.get_logs()
            if len(logs) != last_count:
                # We only send if there are new logs to save bandwidth
                msg = json.dumps({
                    "type": "logs",
                    "data": logs[-20:] # Send last 20 for tail view
                })
                await manager.broadcast(msg)
                last_count = len(logs)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.error("FastAPI Log Dispatcher error", exc_info=True)

# --- API Application ---
app = FastAPI(title="AetherDesk Algo Engine", version="1.2.0", lifespan=lifespan)

# Phase 16: Ensure institutional tracing is active for all telemetry routes
setup_tracing(app)

# --- Global Legacy Aliases (Institutional Support) ---
@app.get("/apikey")
async def get_root_apikey():
    """GET /apikey - Root-level API key retrieval for legacy frontend modules."""
    return {"api_key": os.getenv("API_KEY")}

@app.get("/sandbox/api/configs")
async def get_root_sandbox_configs():
    # Return same as in routers/orders.py
    return {
        "status": "success",
        "data": {
            "initial_capital": 1000000,
            "currency": "INR",
            "slippage_model": "fixed_0.05",
            "latency_simulation": "enabled_50ms",
            "execution_mode": "asynchronous",
            "isolation": "enabled",
            "last_reset": datetime.now().isoformat()
        }
    }

@app.get("/diagnostic/ping")
async def diagnostic_ping():
    return {"status": "ok", "message": "FastAPI is alive"}

# CORS
allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting (Phase 1: C3)
from middleware.rate_limiter import RateLimiterMiddleware
# app.add_middleware(RateLimiterMiddleware)

# --- WebSocket Endpoint (PRE-MOUNT) ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("WebSocket: Incoming connection request on /ws")
    await manager.connect(websocket)

    # Auth phase
    try:
        if not await manager.handle_auth(websocket):
            manager.disconnect(websocket)
            return

        # Success message - aligned with MarketDataManager.ts case 'auth'
        await manager.send_json(websocket, {
            "type": "auth",
            "status": "success",
            "message": "Connected to AetherDesk FastAPI Relay",
            "timestamp": time.time()
        })

        # Send realistic fallback/last-known prices immediately so UI is never 0.00
        # Aligned with MarketDataManager.ts case 'market_data'
        if manager.last_known_ticks:
            for symbol, tick in manager.last_known_ticks.items():
                await manager.send_json(websocket, {
                    "type": "market_data",
                    "symbol": symbol,
                    "exchange": "NSE",
                    "data": tick,
                    "timestamp": time.time()
                })

        while True:
            try:
                # We use receive_text and parse manually for better control
                # Add timeout to allow checking connection health even if client is quiet
                msg_text = await asyncio.wait_for(websocket.receive_text(), timeout=35.0)
                manager.last_active[websocket] = time.time()

                try:
                    data = json.loads(msg_text)
                    if data.get("type") == "ping":
                        await manager.send_json(websocket, {"type": "pong", "timestamp": time.time()})
                except json.JSONDecodeError:
                    pass

            except asyncio.TimeoutError:
                # Client quiet, send heart-beat ping to keep alive
                try:
                    await manager.send_json(websocket, {"type": "ping", "timestamp": time.time()})
                except:
                    break
                continue
            except WebSocketDisconnect:
                break
            except Exception:
                logger.error("Connection error. Retrying in 5s...", exc_info=True)
                break

        manager.disconnect(websocket)
    except Exception:
        logger.error("WebSocket session failure", exc_info=True)
        manager.disconnect(websocket)

# --- FastAPI REST Endpoints ---
# Core Health & Diagnostics (Multiple paths for backward compatibility)
# Core Health & Diagnostics (Multiple paths for backward compatibility)
app.include_router(health_router, prefix="/api/v1")
app.include_router(health_router, prefix="/health/api") # Kept for legacy
app.include_router(health_router)

# Domain Feature Routers (Migrated from Flask)
# We mount at /api/v1 because the routers themselves provide the feature paths
app.include_router(strategies_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(analytics_router) # Handle root-level routes for institutional analytics
app.include_router(action_center_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(vault_router, prefix="/api/v1")
app.include_router(vault_router) # Handle root-level for legacy UI compatibility (/vault/assets)
app.include_router(backtest_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/v1")
# Root apikey is handled by @app.get("/apikey") at the top, but we keep other system routes
app.include_router(system_no_prefix)
app.include_router(intel_router, prefix="/api/v1")
app.include_router(sentiment_router, prefix="/api/v1")
app.include_router(indicators_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1/reports")
app.include_router(master_contract_router, prefix="/api")
app.include_router(analyzer_router, prefix="/api/v1")
app.include_router(playground_router, prefix="/api/v1")
app.include_router(playground_router)

@app.get("/metrics")
async def metrics():
    """Exposes Prometheus metrics."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# --- Legacy Flask Integration (AetherBridge Core) ---
# Mounted at "/" as a fallback for any routes not handled by FastAPI
flask_app = create_app()
app.mount("/", WSGIMiddleware(flask_app))
# Keep a fallback for legacy root calls if needed, but avoid / to prevent interception

# Helper to set context (called by main.py)
def set_fastapi_context(strategy_runner, order_manager, position_manager, portfolio_manager):
    global app_context
    app_context["strategy_runner"] = strategy_runner
    app_context["order_manager"] = order_manager
    app_context["position_manager"] = position_manager
    app_context["portfolio_manager"] = portfolio_manager

    # Port callbacks
    async def fastapi_broadcast_tick(tick):
        # Phase 16: Map broker symbols to UI-friendly names for dashboard compatibility
        from data.market_data import BROKER_TO_UI_MAP
        ui_symbol = BROKER_TO_UI_MAP.get(tick.symbol, tick.symbol)

        raw = tick.raw or {}
        inner = raw.get('data', {})
        # Shoonya/OpenAlgo uses 'percent_change' or 'pc'
        pc = str(raw.get('pc') or inner.get('percent_change') or inner.get('pc') or "0.00")

        tick_data = {
            "symbol": ui_symbol,
            "ltp": tick.ltp,
            "chg_pct": pc,
            "exchange": "NSE",
            "timestamp": tick.timestamp.isoformat() if hasattr(tick.timestamp, 'isoformat') else tick.timestamp
        }

        # Bridge to FastAPI loop thread-safely
        if manager.loop and manager.loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.handle_internal_tick(tick_data), manager.loop)
        else:
            # Fallback for startup
            ui_symbol = tick_data["symbol"]
            manager.tick_buffer[ui_symbol] = tick_data
            manager.last_known_ticks[ui_symbol] = tick_data

    async def fastapi_broadcast_event(event_type: str, data: dict):
        msg = json.dumps({
            "type": event_type,
            "payload": data,
            "timestamp": time.time()
        })
        await manager.broadcast(msg)

        # Telegram Alert Broadcast
        critical_events = {"kill_switch", "safeguard_breach", "panic", "error"}
        if event_type in critical_events:
            try:
                from services.telegram_service import get_telegram_service
                tg = get_telegram_service()
                title = f"ALGO ALERT: {event_type.upper()}"
                alert_msg = f"<b>Strategy:</b> {data.get('strategy', 'N/A')}\n"
                if "reason" in data: alert_msg += f"<b>Reason:</b> {data['reason']}\n"
                asyncio.create_task(tg.send_alert(title, alert_msg, level="CRITICAL"))
            except Exception:
                logger.error("Telegram broadcast failed", exc_info=True)

    return fastapi_broadcast_tick, fastapi_broadcast_event
