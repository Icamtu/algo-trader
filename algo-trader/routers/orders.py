from fastapi import APIRouter, Request, HTTPException, Depends, Header
import logging
import time
from typing import Optional, Dict, Any
from core.context import app_context
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["Orders"])

class OrderRequest(BaseModel):
    symbol: str
    action: str
    quantity: int
    strategy: Optional[str] = "UI_MANUAL"
    pricetype: Optional[str] = "MARKET"
    price: Optional[float] = 0.0
    product: Optional[str] = "MIS"
    exchange: Optional[str] = "NSE"
    human_approval: Optional[bool] = False
    ai_reasoning: Optional[str] = None
    conviction: Optional[float] = None

class SmartOrderRequest(BaseModel):
    symbol: str
    action: str
    quantity: int
    position_size: Optional[int] = 0
    strategy: Optional[str] = "UI_SMART"
    pricetype: Optional[str] = "MARKET"
    price: Optional[float] = 0.0
    product: Optional[str] = "MIS"
    exchange: Optional[str] = "NSE"

@router.post("/placeorder")
async def api_place_order(
    request: OrderRequest,
    x_trading_mode: Optional[str] = Header(None)
):
    """FastAPI port of /api/v1/placeorder."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    mode_override = None
    if x_trading_mode:
        x_trading_mode = x_trading_mode.lower()
        if x_trading_mode in {"sandbox", "live"} and order_manager.mode != x_trading_mode:
            logger.warning(f"UI Mode ({x_trading_mode}) differs from Engine Mode ({order_manager.mode}). Overriding.")
            mode_override = x_trading_mode

    try:
        result = await order_manager.place_order(
            strategy_name=request.strategy,
            symbol=request.symbol,
            action=request.action,
            quantity=request.quantity,
            order_type=request.pricetype,
            price=request.price,
            product=request.product,
            exchange=request.exchange,
            human_approval=request.human_approval,
            ai_reasoning=request.ai_reasoning,
            conviction=request.conviction,
            mode=mode_override
        )
        return result
    except Exception as e:
        logger.error(f"API order placement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/placesmartorder")
async def api_place_smart_order(
    request: SmartOrderRequest,
    x_trading_mode: Optional[str] = Header(None)
):
    """FastAPI port of /api/v1/placesmartorder."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    mode_override = None
    if x_trading_mode:
        x_trading_mode = x_trading_mode.lower()
        if x_trading_mode in {"sandbox", "live"} and order_manager.mode != x_trading_mode:
            mode_override = x_trading_mode

    try:
        result = await order_manager.place_smart_order(
            strategy_name=request.strategy,
            symbol=request.symbol,
            action=request.action,
            quantity=request.quantity,
            position_size=request.position_size,
            order_type=request.pricetype,
            price=request.price,
            product=request.product,
            exchange=request.exchange,
        )
        return result
    except Exception as e:
        logger.error(f"API smart order placement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders")
async def get_orders():
    """FastAPI port of /api/v1/orders."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        orders = await order_manager.get_orders()
        return orders
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str):
    """FastAPI port of /api/v1/orders/{id}/cancel."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        result = await order_manager.cancel_order(order_id)
        return result
    except Exception as e:
        logger.error(f"Error cancelling order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
