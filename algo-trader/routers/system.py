from fastapi import APIRouter, HTTPException, Depends, Request, Body, Query, Header
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
import os
import yaml
from datetime import datetime
import time
import httpx

from core.context import app_context, SYSTEM_START_TIME, _heartbeat_data, _memory_log_handler
from database.trade_logger import get_trade_logger
from execution.decision_agent import DecisionAgent
from execution.action_manager import get_action_manager
from utils.latency_tracker import latency_tracker
from services.alert_service import alert_service

router = APIRouter(prefix="/api/v1", tags=["System"])
logger = logging.getLogger(__name__)

_terminal_rate: dict = {}

# --- Models ---
class TerminalCommandRequest(BaseModel):
    command: str

class HeartbeatUpdate(BaseModel):
    status: Optional[str] = None
    checks: Optional[Dict[str, Any]] = None

class TestAlertRequest(BaseModel):
    message: str
    type: str = "TEST"

@router.get("/health")
async def get_system_health():
    """GET /api/v1/health - Unified health check."""
    health = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "engine": "AetherDesk Prime v2",
        "checks": {
            "algo_engine": {"status": "HEALTHY", "latency": 5},
            "drift": "synced"
        }
    }
    latest_health = app_context.get("latest_health", {})
    if latest_health:
        health["checks"].update(latest_health.get("checks", {}))
        health["status"] = latest_health.get("status", "healthy")
    return health

@router.get("/system/heartbeat")
async def get_system_heartbeat():
    """GET /api/v1/system/heartbeat - Returns current system health state."""
    return _heartbeat_data

@router.post("/system/heartbeat")
async def post_system_heartbeat(
    request: Request,
    update: HeartbeatUpdate,
    apikey: Optional[str] = Header(None),
    x_heartbeat_token: Optional[str] = Header(None)
):
    """POST /api/v1/system/heartbeat - Receives health updates."""
    expected_api_key = os.getenv("API_KEY", "AetherDesk_Unified_Key_2026")
    expected_jwt = os.getenv("JWT_SECRET")

    if apikey != expected_api_key and x_heartbeat_token != expected_jwt:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if update.status:
        _heartbeat_data["status"] = update.status
    if update.checks:
        _heartbeat_data["checks"].update(update.checks)

    _heartbeat_data["timestamp"] = datetime.now().isoformat()
    return {"status": "captured"}

@router.post("/terminal/command")
async def terminal_command(cmd_req: TerminalCommandRequest, request: Request):
    """Institutional Gateway for direct engine diagnostics."""
    # Auth: require trader or admin
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    import jwt as _jwt
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    try:
        payload = _jwt.decode(
            auth_header.removeprefix("Bearer ").strip(),
            JWT_SECRET, algorithms=["HS256"],
            options={"verify_aud": False}
        )
        role = payload.get("role", "viewer")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if role not in ("admin", "trader"):
        raise HTTPException(status_code=403, detail="INSUFFICIENT_PERMISSIONS")

    # Rate limit: 5s cooldown per user
    user_key = payload.get("email", auth_header[-12:])
    now = time.time()
    if now - _terminal_rate.get(user_key, 0) < 5.0:
        raise HTTPException(status_code=429, detail="Terminal rate limited: wait 5 seconds")
    _terminal_rate[user_key] = now

    try:
        raw_cmd = cmd_req.command.strip()
        if not raw_cmd:
            raise HTTPException(status_code=400, detail="EMPTY_COMMAND")

        parts = raw_cmd.split()
        cmd = parts[0].lower()

        strategy_runner = app_context.get("strategy_runner")
        order_manager = app_context.get("order_manager")

        if cmd == "/ping":
            return {"status": "EXEC_SUCCESS", "output": "PONG_KERNEL_ACTIVE"}
        elif cmd == "/status":
            matrix = strategy_runner.get_strategy_matrix()
            active = matrix.get("total_active", 0)
            uptime = int(time.time() - SYSTEM_START_TIME.timestamp())
            return {
                "status": "EXEC_SUCCESS",
                "output": f"KERNEL_UPTIME: {uptime}s | ACTIVE_STRATS: {active} | MODE: {order_manager.mode.upper()}"
            }
        elif cmd == "/sync":
            await order_manager.sync_with_broker()
            return {"status": "EXEC_SUCCESS", "output": "POS_RECONCILIATION_SYNCED_WITH_BROKER"}

        return {"status": "CMD_UNKNOWN", "output": f"COMMAND_NOT_RECOGNIZED: {cmd}"}
    except Exception as e:
        logger.error(f"Terminal Command Error: {e}")
        raise HTTPException(status_code=500, detail=f"KERNEL_EXCEPTION: {str(e)}")

@router.get("/ticker/config")
async def get_ticker_config():
    """GET /api/v1/ticker/config - Symbols for UI ticker strip."""
    try:
        from data.historify_db import get_watchlist
        watchlist = get_watchlist()
        tickers = [{"symbol": w["symbol"], "label": w.get("name", w["symbol"])} for w in watchlist] if watchlist else []
        if not tickers:
            tickers = [
                {"symbol": "NSE:NIFTY-INDEX", "label": "NIFTY 50"},
                {"symbol": "NSE:BANKNIFTY-INDEX", "label": "BANK NIFTY"}
            ]
        return {"ticker_symbols": tickers, "count": len(tickers)}
    except Exception as e:
        logger.error(f"Ticker config error: {e}")
        return {"ticker_symbols": [], "count": 0}

@router.get("/telemetry")
async def get_telemetry():
    """Returns deep telemetry for institutional monitoring."""
    try:
        db_logger = get_trade_logger()
        order_manager = app_context.get("order_manager")
        portfolio_manager = app_context.get("portfolio_manager")

        pnl_stats = await db_logger.get_pnl_summary()
        perf_stats = await db_logger.get_performance_metrics()

        telemetry = {
            "engine": "AetherDesk Prime v2",
            "uptime": str(datetime.now() - SYSTEM_START_TIME),
            "trading_mode": (order_manager.mode if order_manager else "N/A"),
            "pnl": {
                "total_pnl": pnl_stats.get("all_time", {}).get("net", 0.0),
                "daily_pnl": pnl_stats.get("daily", {}).get("net", 0.0),
                "win_rate": pnl_stats.get("win_rate", 0.0),
                "profit_factor": perf_stats.get("profit_factor", 0.0)
            },
            "performance_latency": {
                "tick_dispatch_ms": round(latency_tracker.get_avg_latency("TickDispatch"), 3),
                "db_ingest_ms": round(latency_tracker.get_avg_latency("DuckDBIngest"), 3)
            }
        }
        return telemetry
    except Exception as e:
        logger.error(f"Telemetry API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/test-alert")
async def test_alert(request: TestAlertRequest):
    """Dispatches a test alert via Telegram."""
    try:
        success = await alert_service.send_telegram(f"[{request.type}] {request.message}")
        return {"status": "success" if success else "failed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts")
async def get_alerts(limit: int = Query(50)):
    """Fetch recent alerts from the database."""
    try:
        db_logger = get_trade_logger()
        # Note: We need get_recent_alerts in trade_logger or equivalent
        conn = db_logger._get_connection()
        conn.row_factory = __import__('sqlite3').Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return {"status": "success", "data": [dict(row) for row in rows]}
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Header
from core.rbac import PERMISSIONS, Role

@router.get("/system/rbac")
async def get_rbac_matrix():
    """Returns the RBAC permission matrix for all roles."""
    matrix = []
    for role in Role:
        perms = PERMISSIONS.get(role, [])
        matrix.append({
            "role": role.value,
            "permissions": perms,
            "is_superuser": "*" in perms,
        })
    return {"status": "success", "roles": matrix}
