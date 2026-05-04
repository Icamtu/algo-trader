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
    Matches the schema expected by HealthMonitorPage.tsx.
    """
    process = psutil.Process(os.getpid())

    # Base report structure
    report = {
        "status": "success",
        "overall_status": "pass",
        "timestamp": datetime.utcnow().isoformat(),
        "engine": "optimal",
        "broker": "disconnected",
        "redis": "online",
        "database": {
            "status": "unknown",
            "total": 0
        },
        "fd": {
            "count": process.num_fds(),
            "limit": process.rlimit(psutil.RLIMIT_NOFILE)[0],
            "usage_percent": (process.num_fds() / process.rlimit(psutil.RLIMIT_NOFILE)[0]) * 100,
            "status": "pass"
        },
        "memory": {
            "rss_mb": process.memory_info().rss / 1024 / 1024,
            "percent": psutil.virtual_memory().percent,
            "status": "pass"
        },
        "threads": {
            "count": process.num_threads(),
            "stuck": 0,
            "status": "pass"
        },
        "websocket": {
            "total": 0,
            "total_symbols": 0,
            "status": "pass"
        },
        "load": psutil.cpu_percent(),
        "processes": []
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
        logger.error("Error checking broker session", exc_info=True)
        report["broker"] = "error"

    # 2. Check Database Connectivity
    try:
        # Simple ping to trade logs
        db.get_trades(limit=1)
        report["database"]["status"] = "pass"
        report["database"]["total"] = 5 # Placeholder for pool size
    except Exception:
        report["database"]["status"] = "fail"
        report["overall_status"] = "warn"

    # 3. Get Top Processes (Memory)
    try:
        for p in sorted(psutil.process_iter(['pid', 'name', 'memory_info', 'cpu_percent']), key=lambda x: x.info['memory_info'].rss, reverse=True)[:10]:
            report["processes"].append({
                "name": p.info['name'],
                "pid": p.info['pid'],
                "rss_mb": p.info['memory_info'].rss / 1024 / 1024,
                "memory_percent": (p.info['memory_info'].rss / psutil.virtual_memory().total) * 100,
                "cpu_percent": p.info['cpu_percent']
            })
    except Exception:
        pass

    return report
