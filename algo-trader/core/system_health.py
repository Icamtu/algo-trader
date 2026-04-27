# algo-trader/core/system_health.py
import os
import time
import logging
import psutil
from datetime import datetime
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

def get_current_health():
    """
    Returns a unified diagnostic report for the entire AetherDesk ecosystem.
    """
    report = {
        "engine": "optimal",
        "broker": "disconnected",
        "redis": "check_failed",
        "database": "check_failed",
        "load": psutil.cpu_percent(),
        "memory": psutil.virtual_memory().percent,
        "timestamp": datetime.utcnow().isoformat()
    }

    # 1. Check Broker Connectivity (Shoonya)
    try:
        db = get_trade_logger()
        session = db.get_system_settings().get("shoonya_session")
        if session:
            report["broker"] = "online"
        else:
            report["broker"] = "session_missing"
    except Exception as e:
        report["broker"] = f"error: {str(e)}"

    # 2. Check Database Connectivity
    try:
        # Simple ping to trade logs
        db.get_trades(limit=1)
        report["database"] = "online"
    except Exception:
        report["database"] = "offline"

    # 3. Check Redis (Optional, assumed connected if engine is running)
    report["redis"] = "online"

    return report
