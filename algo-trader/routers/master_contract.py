from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any, List, Optional
import logging
import os
from datetime import datetime

router = APIRouter(tags=["MasterContract"])
logger = logging.getLogger(__name__)

@router.get("/master-contract/smart-status")
async def get_master_contract_status():
    """GET /api/master-contract/smart-status - Returns status of symbols database."""
    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        # Check symbols.db existence and basic stats
        symbols_path = os.path.join(os.path.dirname(db_logger.db_file), "symbols.db")
        exists = os.path.exists(symbols_path)

        status = {
            "status": "ready" if exists else "missing",
            "last_sync": datetime.now().isoformat(), # Placeholder
            "symbols_count": 0,
            "path": symbols_path
        }

        if exists:
             import sqlite3
             conn = sqlite3.connect(symbols_path)
             cursor = conn.cursor()
             cursor.execute("SELECT count(*) FROM symtoken")
             status["symbols_count"] = cursor.fetchone()[0]
             conn.close()

        return {"status": "success", "data": status}
    except Exception as e:
        logger.error(f"Error getting master contract status: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/master-contract/download")
async def download_master_contract(request: Request):
    """POST /api/master-contract/download - Triggers a fresh sync of symbols."""
    try:
        from utils.sync_symbols import run_sync
        # Run sync in background or wait? UI usually expects a response.
        # For simplicity and immediate feedback, we wait, but in production this should be a job.
        success = run_sync()
        if success:
            return {"status": "success", "message": "Master contract sync completed"}
        else:
            return {"status": "error", "message": "Master contract sync failed"}
    except Exception as e:
        logger.error(f"Error downloading master contract: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/cache/health")
async def get_cache_health():
    """GET /api/cache/health - Returns health of Redis/local cache."""
    try:
        # Mocking cache health for now as requested by UI integration
        return {
            "status": "success",
            "data": {
                "state": "healthy",
                "provider": "redis",
                "latency_ms": 1,
                "uptime": "active"
            }
        }
    except Exception as e:
        logger.error(f"Error getting cache health: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/cache/reload")
async def reload_cache():
    """POST /api/cache/reload - Triggers a cache reload."""
    try:
        # Mocking for now
        return {"status": "success", "message": "Cache reload triggered"}
    except Exception as e:
        logger.error(f"Error reloading cache: {e}")
        return {"status": "error", "message": str(e)}
