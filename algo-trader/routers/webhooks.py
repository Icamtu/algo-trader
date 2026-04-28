import logging
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from typing import Dict, Any, Optional
from core.context import app_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])

# --- Models ---
# Inbound alerts typically come as raw JSON from TradingView

# --- Security ---
import os
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "AetherDesk_Institutional_Secret_2026")

def verify_webhook(request: Request, x_webhook_token: Optional[str] = Header(None)):
    if x_webhook_token != WEBHOOK_SECRET:
        logger.warning(f"Unauthorized webhook attempt from {request.client.host}")
        raise HTTPException(status_code=401, detail="Invalid Webhook Token")
    return True

# --- Routes ---

@router.post("/tradingview", dependencies=[Depends(verify_webhook)])
async def tradingview_webhook(data: Dict[str, Any]):
    """
    Inbound endpoint for TradingView alerts.
    Example Payload:
    {
      "symbol": "NSE:NIFTY-INDEX",
      "action": "BUY",
      "quantity": 50,
      "strategy": "TV_Trend_Follower",
      "price": 22500
    }
    """
    logger.info(f"Received TradingView Webhook: {data}")

    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order Manager not initialized")

    # Dispatch to order manager
    try:
        # We use background task for execution to respond quickly to TV
        asyncio.create_task(order_manager.place_order(
            strategy_name=data.get("strategy", "TradingView_Alert"),
            symbol=data.get("symbol"),
            action=data.get("action"),
            quantity=data.get("quantity", 1),
            price=data.get("price", 0.0),
            order_type=data.get("order_type", "MARKET")
        ))

        return {"status": "accepted", "message": "Order queued for execution"}
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/external-event")
async def register_outbound_webhook(config: Dict[str, Any]):
    """Registers an external URL to receive outbound trade events."""
    # Logic to save to DB and trigger via a dispatcher service
    return {"status": "success", "message": "Outbound webhook registered"}

# --- Outbound Dispatcher ---
import httpx
import asyncio

async def dispatch_outbound_webhook(url: str, payload: Dict[str, Any]):
    """Sends a trade event to an external listener."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5.0)
    except Exception as e:
        logger.error(f"Failed to dispatch outbound webhook to {url}: {e}")
