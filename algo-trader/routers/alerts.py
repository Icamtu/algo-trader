from fastapi import APIRouter, HTTPException, Depends, Body, Request
import logging
import os
import time
import jwt
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])

JWT_SECRET = os.environ.get("JWT_SECRET", "")

VALID_ALERT_TYPES = {"price_above", "price_below", "price_change_pct", "volume_spike", "technical_signal"}

# Rate limit tracker: {user_key: (count, window_start)}
_alert_rate: Dict[str, tuple] = {}


def _authenticate(request: Request, allowed_roles: tuple) -> dict:
    """Validate JWT Bearer token and enforce role-based access. Returns payload on success."""
    # Internal-key bypass (system services / trusted triggers)
    internal_key = request.headers.get("X-Internal-Key")
    if internal_key and internal_key == JWT_SECRET:
        return {"email": "internal@aetherdesk.dev", "role": "internal"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Token")

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token, JWT_SECRET, algorithms=["HS256"],
            options={"verify_aud": False}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        logger.warning("Auth failure (invalid token)", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed")

    role = payload.get("role", "viewer").lower()
    if role != "internal" and role not in allowed_roles:
        raise HTTPException(status_code=403, detail="INSUFFICIENT_PERMISSIONS")

    return payload


class AlertCreate(BaseModel):
    type: str
    symbol: str
    condition: str
    value: float
    channel: Optional[str] = "telegram"
    message: Optional[str] = ""

@router.get("")
async def get_alerts(request: Request, limit: int = 100):
    """Retrieves all active alerts from the database."""
    _authenticate(request, ("admin", "trader", "viewer"))
    limit = min(limit, 100)
    try:
        logger_db = get_trade_logger()
        # Note: get_alerts is sync in trade_logger, but we use it as is
        # If it becomes a bottleneck, we'll wrap it in to_thread
        import asyncio
        alerts = await asyncio.to_thread(logger_db.get_alerts, limit)
        return {"status": "success", "alerts": alerts}
    except Exception:
        logger.error("Error fetching alerts", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("")
async def create_alert(request: Request, alert: AlertCreate):
    """Creates a new persistent alert."""
    user_payload = _authenticate(request, ("admin", "trader"))

    # Rate limiting: max 10 alerts per minute per user
    now = time.time()
    user_key = user_payload.get("email", "unknown")
    count, window_start = _alert_rate.get(user_key, (0, now))
    if now - window_start > 60:
        count, window_start = 0, now
    if count >= 10:
        raise HTTPException(status_code=429, detail="Rate limit: max 10 alerts per minute")
    _alert_rate[user_key] = (count + 1, window_start)

    # Type validation
    if alert.type not in VALID_ALERT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid alert type. Allowed: {', '.join(sorted(VALID_ALERT_TYPES))}"
        )

    # Message sanitization
    if alert.message:
        alert.message = alert.message[:500].strip()

    try:
        logger_db = get_trade_logger()
        import asyncio
        alert_id = await asyncio.to_thread(
            logger_db.create_alert,
            alert.type,
            alert.symbol,
            alert.condition,
            alert.value,
            alert.channel,
            alert.message
        )
        if not alert_id:
            raise HTTPException(status_code=500, detail="Failed to create alert in database")

        return {"status": "success", "id": alert_id}
    except HTTPException:
        raise
    except Exception:
        logger.error("Error creating alert", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.delete("/{alert_id}")
async def delete_alert(request: Request, alert_id: int):
    """Deletes an alert by ID."""
    _authenticate(request, ("admin", "trader"))
    try:
        logger_db = get_trade_logger()
        import asyncio
        success = await asyncio.to_thread(logger_db.delete_alert, alert_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

        return {"status": "success", "message": f"Alert {alert_id} deleted"}
    except HTTPException:
        raise
    except Exception:
        logger.error(f"Error deleting alert {alert_id}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(request: Request, alert_id: int):
    """Mark an alert as acknowledged."""
    _authenticate(request, ("admin", "trader", "viewer"))
    try:
        logger_db = get_trade_logger()
        import asyncio
        success = await asyncio.to_thread(logger_db.acknowledge_alert, alert_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        return {"status": "success", "message": f"Alert {alert_id} acknowledged"}
    except HTTPException:
        raise
    except Exception:
        logger.error(f"Error acknowledging alert {alert_id}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")
