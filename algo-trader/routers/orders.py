from fastapi import APIRouter, Request, HTTPException, Depends, Header
import logging
import time
from typing import Optional, Dict, Any
from core.context import app_context
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Orders"])

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
@router.get("/orderbook")
async def get_orders():
    """FastAPI port of /api/v1/orders & /api/v1/orderbook."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        orders = await order_manager.get_orders()
        return orders
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tradebook")
async def get_tradebook():
    """FastAPI port of /api/v1/tradebook. Returns mode-filtered trades."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        current_mode = order_manager.mode

        # Use optimized mode-filtered query
        trades = await db_logger.get_trades_by_mode_async(mode=current_mode, limit=500)

        # Serialize trades to dict
        mode_trades = [
            trade.to_dict() if hasattr(trade, 'to_dict') else trade.__dict__
            for trade in trades
        ]

        logger.info(f"Tradebook: returning {len(mode_trades)} {current_mode.upper()} trades")
        return {
            "status": "success",
            "mode": current_mode,
            "trades": mode_trades,
            "count": len(mode_trades)
        }
    except Exception as e:
        logger.error(f"Error fetching tradebook: {e}", exc_info=True)
        return {
            "status": "success",
            "mode": order_manager.mode if order_manager else "sandbox",
            "trades": [],
            "count": 0
        }

@router.get("/sandbox/trades")
async def get_sandbox_trades():
    """GET /api/v1/sandbox/trades - Returns only sandbox mode trades."""
    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        # Use optimized query
        trades = await db_logger.get_trades_by_mode_async(mode="sandbox", limit=500)

        sandbox_trades = [
            trade.to_dict() if hasattr(trade, 'to_dict') else trade.__dict__
            for trade in trades
        ]

        return {
            "status": "success",
            "mode": "sandbox",
            "trades": sandbox_trades,
            "count": len(sandbox_trades)
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox trades: {e}")
        return {"status": "success", "mode": "sandbox", "trades": [], "count": 0}

@router.get("/sandbox/positions")
async def get_sandbox_positions():
    """GET /api/v1/sandbox/positions - Returns sandbox position manager state."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        pm = order_manager.sandbox_position_manager
        positions = pm.all_positions()

        formatted_positions = [
            {
                "symbol": symbol,
                "quantity": pos.quantity,
                "avg_price": pos.avg_price,
                "entry_price": getattr(pos, 'entry_price', pos.avg_price),
                "metadata": getattr(pos, 'metadata', {})
            }
            for symbol, pos in positions.items()
            if pos.quantity != 0
        ]

        return {
            "status": "success",
            "mode": "sandbox",
            "positions": formatted_positions,
            "count": len(formatted_positions)
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandbox/summary")
async def get_sandbox_summary():
    """GET /api/v1/sandbox/summary - Comprehensive sandbox state snapshot."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        # Get sandbox trades
        trades = await db_logger.get_trades_by_mode_async(mode="sandbox", limit=1000)

        # Count by status
        status_counts = {}
        for trade in trades:
            status = trade.status or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1

        # Calculate metrics
        filled_trades = [t for t in trades if t.status == "filled"]
        blocked_trades = [t for t in trades if t.status == "blocked"]

        # Positions
        pm = order_manager.sandbox_position_manager
        positions = pm.all_positions()
        open_positions = [
            {"symbol": s, "quantity": p.quantity, "avg_price": p.avg_price}
            for s, p in positions.items()
            if p.quantity != 0
        ]

        return {
            "status": "success",
            "mode": "sandbox",
            "summary": {
                "total_trades": len(trades),
                "filled_trades": len(filled_trades),
                "blocked_trades": len(blocked_trades),
                "status_breakdown": status_counts,
                "open_positions_count": len(open_positions),
                "database_file": db_logger.db_file
            },
            "recent_trades": [
                t.to_dict() if hasattr(t, 'to_dict') else t.__dict__
                for t in trades[:10]
            ],
            "positions": open_positions
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox summary: {e}", exc_info=True)
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
