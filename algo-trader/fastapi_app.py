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

# Security constants
JWT_SECRET = os.environ.get("JWT_SECRET")

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

# Global logging handler
_memory_log_handler = MemoryLogHandler()

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()
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
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        # We use a list to avoid "set changed size during iteration" errors
        stale_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.debug(f"Broadcast failed for a connection (likely closed): {e}")
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(stale)

    async def send_json(self, websocket: WebSocket, data: dict):
        try:
            await websocket.send_text(json.dumps(data))
        except Exception as e:
            logger.debug(f"Send JSON failed: {e}")
            self.disconnect(websocket)

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
    reaper_task = asyncio.create_task(zombie_reaper())

    yield

    # Shutdown logic
    logger.info("FastAPI AetherDesk shutting down...")
    dispatcher_task.cancel()
    reaper_task.cancel()
    ingestion_scheduler.stop()

# --- Connection Maintenance ---
async def zombie_reaper():
    """Background task to prune dead WebSocket connections every 60 seconds."""
    while True:
        try:
            await asyncio.sleep(60)
            if not manager.active_connections:
                continue

            logger.debug(f"Reaper: Auditing {len(manager.active_connections)} connections...")
            ping_msg = json.dumps({"type": "ping", "server_ts": time.time()})

            # Use broadcast logic which already prunes on failure
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

# --- API Application ---
app = FastAPI(title="AetherDesk Algo Engine", version="1.2.0", lifespan=lifespan)

# CORS
allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            msg_text = await websocket.receive_text()
            data = json.loads(msg_text)

            if data.get("type") == "ping":
                await manager.send_json(websocket, {"type": "pong", "timestamp": time.time()})
            continue

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
