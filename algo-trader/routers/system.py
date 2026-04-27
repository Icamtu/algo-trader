from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any
import logging
import os
import yaml
from datetime import datetime
import time

from core.context import app_context
from database.trade_logger import get_trade_logger
from execution.decision_agent import DecisionAgent

router = APIRouter(prefix="/api/v1/system", tags=["System"])
logger = logging.getLogger(__name__)

@router.post("/analyzertoggle")
async def api_analyzer_toggle(request: Request):
    """POST /api/v1/analyzertoggle - Enable/Disable AI Analyzer."""
    try:
        data = await request.json()
        state = data.get("state", False)

        db_logger = get_trade_logger()
        db_logger.update_system_setting("agent_enabled", str(state).lower())

        # Reset failures on enable
        if state:
            DecisionAgent.CONSECUTIVE_FAILURES = 0

        return {
            "status": "success",
            "message": f"Analyzer {'enabled' if state else 'disabled'}",
            "state": state
        }
    except Exception as e:
        logger.error(f"Error toggling analyzer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config/ticker")
async def get_ticker_config():
    """GET /api/v1/config/ticker - Return managed ticker configuration."""
    try:
        config_path = os.path.join(os.getcwd(), "config", "ticker.yaml")
        if not os.path.exists(config_path):
             return {"ticker_symbols": []}
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        return config
    except Exception as e:
        logger.error(f"Error reading ticker config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/terminal/command")
async def terminal_command(request: Request):
    """POST /api/v1/terminal/command - Process generic UI terminal commands."""
    try:
        data = await request.json()
        command_raw = data.get("command", "").strip()

        # Parse the command
        parts = command_raw.split()
        if not parts:
            return {"status": "success", "message": ""}

        cmd = parts[0].lower()
        args = parts[1:]

        db_logger = get_trade_logger()

        # Command Routing
        if cmd in ["/help", "help"]:
            msg = (
                "AetherDesk Prime Terminal v1.2.0\n"
                "Available commands:\n"
                "  /status   - Display engine health and active components\n"
                "  /risk     - View active global risk limits\n"
                "  /sync     - Validate broker connection\n"
                "  /ping     - Measure Engine API latency\n"
                "  /clear    - Clear terminal output"
            )
            return {"status": "success", "message": msg}

        elif cmd in ["/ping", "ping"]:
            return {"status": "success", "message": f"PONG - Engine Active. Local time: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}"}

        elif cmd in ["/status", "status"]:
            runner = app_context.get("strategy_runner")
            mode = "ONLINE" if runner else "OFFLINE"
            strat_count = len(runner.strategies) if runner else 0

            msg = (
                f"Engine Status: {mode}\n"
                f"Active Strategies: {strat_count}\n"
                f"Surgical AI Analyzer: {'Enabled' if getattr(app_context.get('analyzer'), 'enabled', False) else 'Disabled'}\n"
            )
            return {"status": "success", "message": msg}

        elif cmd in ["/risk", "risk"]:
            settings = db_logger.get_risk_settings()
            if not settings:
                return {"status": "success", "message": "No risk settings defined in database."}

            lines = ["Active Risk Guardrails:"]
            for k, v in settings.items():
                lines.append(f"  - {k.replace('_', ' ').title()}: {v}")
            return {"status": "success", "message": "\n".join(lines)}

        elif cmd in ["/sync", "sync"]:
            from services.session_service import get_session_service
            is_valid = await get_session_service().validate_session()
            status_text = "VALID" if is_valid else "INVALID (Requires Re-auth)"
            return {"status": "success", "message": f"Shoonya Broker Session: {status_text}"}

        else:
            return {"status": "success", "message": f"Command not recognized: '{cmd}'. Type /help for available commands."}

    except Exception as e:
        logger.error(f"Terminal execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def api_health():
    """Unified system health check with positional drift telemetry."""
    health = {
        "status": "healthy",
        "service": "AetherDesk Algo Engine",
        "version": "1.2.0 (FastAPI)",
        "timestamp": datetime.now().isoformat(),
        "checks": {
            "algo_engine": {"status": "HEALTHY", "latency": 0},
            "drift": "synced"
        }
    }

    # Check for positional drift
    try:
        from core.context import app_context
        order_manager = app_context.get("order_manager")
        if order_manager:
            # Check if we can get positions
            broker_pos = await order_manager.get_open_positions_dict()
            engine_pos = order_manager.position_manager.get_all_quantities()

            # Check for mismatch both ways
            all_symbols = set(broker_pos.keys()) | set(engine_pos.keys())
            drift = False
            for symbol in all_symbols:
                if broker_pos.get(symbol, 0) != engine_pos.get(symbol, 0):
                    drift = True
                    break

            health["checks"]["drift"] = "drift_detected" if drift else "synced"
            if drift:
                health["status"] = "degraded"
    except Exception as e:
        logger.error(f"Health check drift analysis failure: {e}")
        health["checks"]["drift"] = "error"
        health["checks"]["drift_error"] = str(e)

    return health

@router.get("/session/validate")
async def validate_session():
    """Verify Shoonya session health & token validity."""
    try:
        from services.session_service import get_session_service
        is_valid = await get_session_service().validate_session()
        return {
            "status": "success" if is_valid else "error",
            "is_valid": is_valid,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Session validation route error: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/dashboard/session")
async def get_session_dashboard():
    """Returns detailed session status for the UI dashboard."""
    try:
        from services.session_service import get_session_service
        ss = get_session_service()
        state = await ss.get_session_state()
        return {
            "status": "success",
            "data": {
                **state,
                "shoonya_user": os.getenv("SHOONYA_USER_ID", "N/A"),
                "auto_reauth_enabled": True
            }
        }
    except Exception as e:
        logger.error(f"Dashboard session route error: {e}")
        return {"status": "error", "message": str(e)}
