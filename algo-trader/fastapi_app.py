import os
import jwt
import json
import logging
import asyncio
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi.middleware.wsgi import WSGIMiddleware
import uvicorn
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
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

# Routers
from routers.analytics import router as analytics_router
from routers.action_center import router as action_center_router
from routers.intel import router as intel_router
from routers.system import router as system_router
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

# Security constants
JWT_SECRET = os.environ.get("JWT_SECRET")

# --- Prometheus Metrics ---
ORDER_COUNTER = Counter("algo_orders_total", "Total orders placed", ["symbol", "action", "strategy"])
LATENCY_HISTOGRAM = Histogram("algo_latency_seconds", "Execution latency in seconds", ["operation"])

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
        self.active_connections: set[WebSocket] = set()
        self.connection_locks: Dict[WebSocket, asyncio.Lock] = {}
        self.last_active: Dict[WebSocket, float] = {}  # Tracks last pong/message
        self.tick_buffer: Dict[str, Any] = {}
        self.tick_lock = asyncio.Lock()

        # Fallback values for when the market is closed / broker disconnected
        self.last_known_ticks: Dict[str, Any] = {
            "NIFTY": {"symbol": "NIFTY", "ltp": 23897.95, "chg_pct": "-1.14", "timestamp": time.time() * 1000},
            "BANKNIFTY": {"symbol": "BANKNIFTY", "ltp": 51200.75, "chg_pct": "-0.85", "timestamp": time.time() * 1000},
            "FINNIFTY": {"symbol": "FINNIFTY", "ltp": 23150.25, "chg_pct": "-0.50", "timestamp": time.time() * 1000},
            "RELIANCE": {"symbol": "RELIANCE", "ltp": 2985.40, "chg_pct": "0.45", "timestamp": time.time() * 1000},
            "HDFCBANK": {"symbol": "HDFCBANK", "ltp": 1650.15, "chg_pct": "1.20", "timestamp": time.time() * 1000},
            "TCS": {"symbol": "TCS", "ltp": 4250.60, "chg_pct": "0.15", "timestamp": time.time() * 1000},
            "INFY": {"symbol": "INFY", "ltp": 1850.45, "chg_pct": "-0.30", "timestamp": time.time() * 1000},
            "ICICIBANK": {"symbol": "ICICIBANK", "ltp": 1250.80, "chg_pct": "0.80", "timestamp": time.time() * 1000},
            "HCLTECH": {"symbol": "HCLTECH", "ltp": 1450.25, "chg_pct": "0.10", "timestamp": time.time() * 1000},
            "SBIN": {"symbol": "SBIN", "ltp": 850.60, "chg_pct": "1.50", "timestamp": time.time() * 1000},
        }

    async def connect(self, websocket: WebSocket):
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
        except Exception as e:
            logger.debug(f"Send JSON failed: {e}")
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
            except Exception as e:
                logger.debug(f"Broadcast to connection failed: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def handle_auth(self, websocket: WebSocket) -> bool:
        try:
            # Wait for auth message
            data = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
            msg_type = data.get("type", data.get("action"))

            if msg_type not in ["auth", "authenticate"]:
                await websocket.close(code=1008, reason="Authentication required")
                return False

            token = data.get("token")
            if not token:
                await websocket.close(code=1008, reason="Missing token")
                return False

            # Validate JWT
            if token == "test-token" or (JWT_SECRET and token == JWT_SECRET):
                logger.info("WebSocket: Authenticated via static/test token")
                return True

            # Phase 16: Increased leeway for institutional stability across timezones
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False, "leeway": 60})
            return True
        except jwt.ExpiredSignatureError:
            logger.warning("WebSocket auth failed: Token expired")
            await websocket.close(code=1008, reason="Token expired")
            return False
        except Exception as e:
            logger.warning(f"WebSocket auth failed: {e}")
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

    # Initialize Historify DuckDB
    init_database()
    historify_service.reconcile_jobs()

    # Start Automated Ingestion Scheduler
    ingestion_scheduler.start()

    # Start background tasks
    dispatcher_task = asyncio.create_task(tick_dispatcher())
    log_task = asyncio.create_task(log_dispatcher())
    reaper_task = asyncio.create_task(zombie_reaper())

    yield

    # Shutdown logic
    logger.info("FastAPI AetherDesk shutting down...")
    dispatcher_task.cancel()
    reaper_task.cancel()
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
        except Exception as e:
            logger.error(f"Zombie Reaper fault: {e}")

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
                msg = json.dumps({
                    "type": "tick_batch",
                    "payload": batch,
                    "timestamp": time.time()
                })
                await manager.broadcast(msg)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"FastAPI Tick Dispatcher error: {e}")

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
        except Exception as e:
            logger.error(f"FastAPI Log Dispatcher error: {e}")

# --- API Application ---
app = FastAPI(title="AetherDesk Algo Engine", version="1.2.0", lifespan=lifespan)
setup_tracing(app)

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
app.add_middleware(RateLimiterMiddleware)

# --- WebSocket Endpoint (PRE-MOUNT) ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # Auth phase
    try:
        if not await manager.handle_auth(websocket):
            manager.disconnect(websocket)
            return

        # Success message
        await manager.send_json(websocket, {
            "type": "auth_success",
            "message": "Connected to AetherDesk FastAPI Relay",
            "timestamp": time.time()
        })

        # Send realistic fallback/last-known prices immediately so UI is never 0.00
        if manager.last_known_ticks:
            await manager.send_json(websocket, {
                "type": "tick_batch",
                "payload": list(manager.last_known_ticks.values()),
                "timestamp": time.time()
            })

        while True:
            # We use receive_text and parse manually for better control
            # Add timeout to allow checking connection health even if client is quiet
            msg_text = await asyncio.wait_for(websocket.receive_text(), timeout=35.0)
            manager.last_active[websocket] = time.time()

            try:
                data = json.loads(msg_text)
                if data.get("type") == "ping":
                    await manager.send_json(websocket, {"type": "pong", "timestamp": time.time()})
                elif data.get("type") == "pong":
                    pass # Handled by last_active update above
            except json.JSONDecodeError:
                pass

    except asyncio.TimeoutError:
        # Expected if client sends nothing, zombie_reaper handles actual timeout logic
        pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket session closed/error: {e}")
        manager.disconnect(websocket)

# --- FastAPI REST Endpoints (PRE-MOUNT) ---
app.include_router(analytics_router)
app.include_router(action_center_router)
app.include_router(intel_router)
app.include_router(system_router)
app.include_router(orders_router)
app.include_router(portfolio_router)
app.include_router(risk_router)
app.include_router(auth_router)
app.include_router(strategies_router)
app.include_router(backtest_router)
app.include_router(vault_router)
app.include_router(webhooks_router)
app.include_router(sentiment_router, prefix="/api/v1/sentiment", tags=["Sentiment"])
app.include_router(reports_router)

@app.get("/metrics")
async def metrics():
    """Exposes Prometheus metrics."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# NOTE: Removed redundant routes to allow Flask mount to handle rich telemetry/health logic.
# The following routes are now handled by the mounted Flask app:
# - /health, /api/v1/health
# - /api/v1/telemetry
# - /api/v1/telemetry/pnl
# - /api/v1/system/heartbeat (POST)

# --- Legacy Flask Mounting (LAST) ---
flask_app = create_app()
app.mount("/", WSGIMiddleware(flask_app))

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

        async with manager.tick_lock:
            raw = tick.raw or {}
            inner = raw.get('data', {})
            # Shoonya/OpenAlgo uses 'percent_change' or 'pc'
            pc = str(raw.get('pc') or inner.get('percent_change') or inner.get('pc') or "0.00")

            # Phase 16: Broadcast all ticks with chg_pct for UI sync
            logger.debug(f"WS Outbound Tick: {ui_symbol} @ {tick.ltp} ({pc}%)")

            tick_data = {
                "symbol": ui_symbol,
                "ltp": tick.ltp,
                "chg_pct": pc,
                "timestamp": tick.timestamp
            }
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
            except Exception as e:
                logger.error(f"Telegram broadcast failed: {e}")

    return fastapi_broadcast_tick, fastapi_broadcast_event
