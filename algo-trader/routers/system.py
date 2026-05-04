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

router = APIRouter(tags=["System"])
router_no_prefix = APIRouter(tags=["System"])
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
@router.get("/system/health")
@router.get("/health/api/current")
async def get_system_health():
    """GET /api/v1/health & /api/v1/system/health - Unified health check."""
    health = {
        "status": _heartbeat_data.get("status", "healthy"),
        "timestamp": datetime.now().isoformat(),
        "engine": "AetherDesk Prime v2",
        "checks": {
            "algo_engine": {"status": "HEALTHY", "latency": 5},
            "drift": "synced"
        }
    }

    # Merge heartbeat data checks
    heartbeat_checks = _heartbeat_data.get("checks", {})
    if heartbeat_checks:
        health["checks"].update(heartbeat_checks)

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
    expected_api_key = os.getenv("API_KEY")
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
    except Exception:
        logger.error("Terminal Command Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
    except Exception:
        logger.error("Ticker config error", exc_info=True)
        return {"ticker_symbols": [], "count": 0}

@router.get("/telemetry")
async def get_telemetry():
    """Returns deep telemetry for institutional monitoring."""
    try:
        db_logger = get_trade_logger()
        order_manager = app_context.get("order_manager")

        # Get actual summaries
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
    except Exception:
        logger.error("Telemetry API Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/pnl")
@router.get("/telemetry/pnl")
async def get_telemetry_pnl():
    """Returns global PnL summary for the dashboard."""
    try:
        db_logger = get_trade_logger()
        stats = await db_logger.get_pnl_summary()
        return {"status": "success", "data": stats}
    except Exception:
        logger.error("Telemetry PnL Error", exc_info=True)
        return {"status": "success", "data": {"daily": {"net": 0.0}, "all_time": {"net": 0.0}}}

@router.get("/telemetry/performance")
async def get_telemetry_performance():
    """Returns global performance metrics (Win Rate, Profit Factor, etc.)."""
    try:
        db_logger = get_trade_logger()
        metrics = await db_logger.get_performance_metrics()
        return {"status": "success", "data": metrics}
    except Exception:
        logger.error("Telemetry Performance Error", exc_info=True)
        return {"status": "success", "data": {"win_rate": 0.0, "profit_factor": 0.0, "total_trades": 0}}

@router.post("/system/test-alert")
async def test_alert(request: TestAlertRequest):
    """Dispatches a test alert via Telegram."""
    try:
        success = await alert_service.send_telegram(f"[{request.type}] {request.message}")
        return {"status": "success" if success else "failed"}
    except Exception:
        logger.error("Alert test error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
        data = []
        for i, row in enumerate(rows):
            if i >= 100: break # Safety: secondary limit
            data.append(dict(row))
        return {"status": "success", "data": data}
    except Exception:
        logger.error("Error fetching alerts", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
@router.get("/system/logs")
async def get_system_logs(limit: int = Query(100)):
    """GET /api/v1/system/logs - Returns internal system logs."""
    logs = _memory_log_handler.get_logs()
    return {"status": "success", "logs": logs[-limit:] if limit > 0 else logs}

@router.get("/mode")
async def get_trading_mode():
    """GET /api/v1/mode - Current engine trading mode."""
    order_manager = app_context.get("order_manager")
    return {
        "status": "success",
        "mode": order_manager.mode if order_manager else "sandbox"
    }

@router.post("/mode")
async def set_trading_mode(data: Dict[str, str] = Body(...)):
    """POST /api/v1/mode - Update engine trading mode."""
    mode = data.get("mode")
    if mode not in ("live", "sandbox"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'live' or 'sandbox'.")

    order_manager = app_context.get("order_manager")
    if order_manager:
        order_manager.set_mode(mode)
        logger.info(f"Trading mode switched to {mode.upper()}")
        return {
            "status": "success",
            "mode": order_manager.mode,
            "message": f"System switched to {mode.upper()} mode"
        }
    return {"status": "error", "message": "Order manager not initialized"}

@router.get("/mode/status")
async def get_mode_status():
    """GET /api/v1/mode/status - Detailed mode status including database info."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        # Get all trades (using async version)
        all_trades_full = await db_logger.get_all_trades_async(limit=10000)
        sandbox_count = sum(1 for t in all_trades_full if t.mode == "sandbox")
        live_count = sum(1 for t in all_trades_full if t.mode == "live")

        current_mode = order_manager.mode
        pm = order_manager.sandbox_position_manager if current_mode == "sandbox" else order_manager.live_position_manager
        positions = pm.all_positions()
        open_pos_count = sum(1 for p in positions.values() if p.quantity != 0)

        return {
            "status": "success",
            "current_mode": current_mode.upper(),
            "database": {
                "sandbox_trades": sandbox_count,
                "live_trades": live_count,
                "total_trades": sandbox_count + live_count,
                "location": db_logger.db_file
            },
            "positions": {
                "open": open_pos_count,
                "total_tracked": len(positions)
            },
            "position_manager": {
                "active": current_mode,
                "sandbox_pm": order_manager.sandbox_position_manager is not None,
                "live_pm": order_manager.live_position_manager is not None
            }
        }
    except Exception:
        logger.error("Error getting mode status", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/settings")
async def get_settings():
    """GET /api/v1/settings - Fetch system-level configuration."""
    try:
        db_logger = get_trade_logger()
        settings = db_logger.get_system_settings()
        # Ensure we return at least the expected keys for the frontend
        return {
            "status": "success",
            "decision_mode": settings.get("decision_mode", "human"),
            "llm_model": settings.get("llm_model", "qwen3.5-claude:latest"),
            "provider": settings.get("provider", "ollama"),
            "agent_enabled": settings.get("agent_enabled", "true").lower() == "true",
            "agent_error_reason": settings.get("agent_error_reason", "")
        }
    except Exception:
        logger.error("Error fetching settings", exc_info=True)
        return {
            "status": "error",
            "message": "Internal error",
            "decision_mode": "human",
            "llm_model": "qwen3.5-claude:latest",
            "provider": "ollama",
            "agent_enabled": True,
            "agent_error_reason": ""
        }

@router.put("/settings")
async def update_settings(data: Dict[str, Any] = Body(...)):
    """PUT /api/v1/settings - Update system-level configuration."""
    try:
        db_logger = get_trade_logger()
        success = True
        for key, value in data.items():
            if not db_logger.update_system_setting(key, str(value)):
                success = False

        # After update, we might need to notify the decision agent
        # (This would be handled by the agent itself on next poll or via signal)

        return {"status": "success" if success else "partial_success"}
    except Exception:
        logger.error("Error updating settings", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/apikey")
@router_no_prefix.get("/apikey")
async def get_system_apikey():
    """GET /apikey - Returns the engine's unified API key."""
    return {"api_key": os.getenv("API_KEY")}

@router.get("/brokers")
async def get_brokers_registry():
    """GET /api/v1/brokers - Returns supported native broker adapters."""
    active_broker = os.getenv("AETHERBRIDGE_ACTIVE_BROKER", "shoonya").lower()

    brokers = [
        {
            "id": "shoonya",
            "name": "Shoonya (Finvasia)",
            "version": "Native_v1.0",
            "supported_exchanges": ["NSE", "BSE", "NFO", "MCX"],
            "type": "IN_STOCK",
            "description": "Zero-latency native adapter for Shoonya.",
            "active": active_broker == "shoonya"
        },
        {
            "id": "zerodha",
            "name": "Zerodha KiteConnect",
            "version": "Native_v5.1",
            "supported_exchanges": ["NSE", "BSE", "NFO", "MCX"],
            "type": "IN_STOCK",
            "description": "Direct connectivity via KiteConnect SDK.",
            "active": active_broker == "zerodha"
        },
        {
            "id": "paper",
            "name": "AetherBridge Paper",
            "version": "v1.0",
            "supported_exchanges": ["VIRTUAL"],
            "type": "SIMULATION",
            "description": "Risk-free virtual trading node.",
            "active": active_broker == "paper"
        }
    ]
    return {"brokers": brokers, "count": len(brokers)}
