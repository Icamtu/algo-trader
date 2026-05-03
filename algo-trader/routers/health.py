from fastapi import APIRouter, Request, Header
from core.system_health import get_current_health
from datetime import datetime, timedelta
import random

router = APIRouter(tags=["Legacy Health"])

@router.get("/current")
async def get_legacy_health_current(apikey: str = Header(None)):
    """Legacy endpoint for current health metrics."""
    return get_current_health()

@router.get("/stats")
async def get_legacy_health_stats(hours: int = 24, apikey: str = Header(None)):
    """Legacy endpoint for health statistics history."""
    return {
        "status": "success",
        "fd": {
            "avg": random.uniform(50, 150),
            "warn_count": 0
        },
        "memory": {
            "max_mb": random.uniform(200, 400),
            "warn_count": 0
        },
        "period_hours": hours
    }

@router.get("/history")
async def get_legacy_health_history(hours: int = 24, apikey: str = Header(None)):
    """Legacy endpoint for health history data."""
    return {
        "status": "success",
        "history": []
    }

@router.get("/alerts")
async def get_legacy_health_alerts(apikey: str = Header(None)):
    """Legacy endpoint for active health alerts."""
    return {
        "status": "success",
        "alerts": []
    }

@router.post("/acknowledge/{alert_id}")
async def acknowledge_legacy_alert(alert_id: int, apikey: str = Header(None)):
    """Legacy endpoint to acknowledge health alerts."""
    return {"status": "success", "message": f"Alert {alert_id} acknowledged"}
