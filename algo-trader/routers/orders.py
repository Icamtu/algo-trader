from fastapi import APIRouter, Request, HTTPException, Depends, Header
from datetime import datetime
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

class SplitOrderRequest(BaseModel):
    symbol: str
    action: str
    quantity: int
    num_splits: int
    strategy: Optional[str] = "UI_SPLIT"
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
@router.post("/orders")
@router.get("/orderbook")
@router.post("/orderbook")
async def get_orders(request: Request = None):
    """FastAPI port of /api/v1/orders & /api/v1/orderbook."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        orders = await order_manager.get_orders()
        return {
            "status": "success",
            "data": {
                "orders": orders,
                "count": len(orders)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tradebook")
@router.post("/tradebook")
async def get_tradebook(request: Request = None):
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
            "data": {
                "trades": mode_trades,
                "count": len(mode_trades)
            }
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
            "data": {
                "trades": sandbox_trades,
                "count": len(sandbox_trades)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox trades: {e}")
        return {"status": "success", "mode": "sandbox", "data": {"trades": [], "count": 0}}

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
            "data": {
                "positions": formatted_positions,
                "count": len(formatted_positions)
            }
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
            "data": {
                "summary": {
                    "total_trades": len(trades),
                    "filled_trades": len(filled_trades),
                    "blocked_trades": len(blocked_trades),
                    "reconciled_trades": 0, # Placeholder for now
                    "open_positions": len(open_positions), # Standardize key
                    "open_positions_count": len(open_positions),
                    "status_breakdown": status_counts,
                    "database_file": db_logger.db_file
                },
                "recent_trades": [
                    t.to_dict() if hasattr(t, 'to_dict') else t.__dict__
                    for t in trades[:10]
                ],
                "positions": open_positions
            }
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/splitorder")
async def api_split_order(
    request: SplitOrderRequest,
    x_trading_mode: Optional[str] = Header(None)
):
    """
    POST /api/v1/splitorder
    Executes a large order by splitting it into multiple smaller chunks.
    """
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    if request.num_splits <= 0:
        raise HTTPException(status_code=400, detail="num_splits must be greater than 0")

    try:
        # Determine the split quantity
        base_qty = request.quantity // request.num_splits
        remainder = request.quantity % request.num_splits

        results = []
        for i in range(request.num_splits):
            qty = base_qty + (1 if i < remainder else 0)
            if qty <= 0: continue

            res = await order_manager.place_order(
                strategy_name=request.strategy,
                symbol=request.symbol,
                action=request.action,
                quantity=qty,
                product=request.product,
                exchange=request.exchange
            )
            results.append(res)

        return {
            "status": "success",
            "message": f"Split order into {len(results)} chunks",
            "results": results
        }
    except Exception as e:
        logger.error(f"Split order execution failed: {e}", exc_info=True)
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
@router.get("/sandbox/pnl/api/data")
async def get_sandbox_pnl_data():
    """GET /api/v1/sandbox/pnl/api/data - Unified sandbox PnL and analytics data."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        from database.trade_logger import get_trade_logger
        db_logger = get_trade_logger()

        # 1. Get sandbox trades
        trades = await db_logger.get_trades_by_mode_async(mode="sandbox", limit=1000)

        # 2. Get sandbox positions
        pm = order_manager.sandbox_position_manager
        positions = pm.all_positions()
        pos_list = []
        positions_unrealized = 0.0
        for symbol, pos in positions.items():
            if pos.quantity != 0:
                pnl = getattr(pos, 'pnl', 0.0)
                positions_unrealized += pnl
                pos_list.append({
                    "symbol": symbol,
                    "tradingsymbol": symbol,
                    "quantity": pos.quantity,
                    "netqty": pos.quantity,
                    "avg_price": pos.avg_price,
                    "average_price": pos.avg_price,
                    "ltp": getattr(pos, 'last_price', pos.avg_price),
                    "last_price": getattr(pos, 'last_price', pos.avg_price),
                    "pnl": pnl
                })

        # 3. Get real PnL summary and curve
        pnl_stats = await db_logger.get_pnl_summary(unrealized_pnl=positions_unrealized, mode="sandbox")

        summary = {
            "today_realized_pnl": pnl_stats.get("daily", {}).get("pnl", 0.0),
            "positions_unrealized_pnl": positions_unrealized,
            "holdings_unrealized_pnl": 0.0,
            "today_total_mtm": pnl_stats.get("daily", {}).get("net", positions_unrealized),
            "all_time_realized_pnl": pnl_stats.get("all_time", {}).get("pnl", 0.0)
        }

        # 4. Process Equity Curve into Daily PnL for frontend chart
        equity_curve = pnl_stats.get("equity_curve", [])
        daily_map = {}

        # Initialize with today if empty
        today_str = datetime.now().strftime("%Y-%m-%d")
        daily_map[today_str] = {
            "date": today_str,
            "realized_pnl": pnl_stats.get("daily", {}).get("pnl", 0.0),
            "total_unrealized": positions_unrealized,
            "total_mtm": pnl_stats.get("daily", {}).get("net", positions_unrealized),
            "portfolio_value": 1000000.0 + pnl_stats.get("all_time", {}).get("net", positions_unrealized)
        }

        for point in equity_curve:
            # point["time"] is likely ISO string "2026-04-30T..."
            d_str = point["time"][:10] if point["time"] else today_str
            daily_map[d_str] = {
                "date": d_str,
                "realized_pnl": point["value"], # This is cumulative in the curve
                "total_unrealized": 0.0,
                "total_mtm": point["value"],
                "portfolio_value": 1000000.0 + point["value"]
            }

        daily_pnl = sorted(list(daily_map.values()), key=lambda x: x["date"])

        return {
            "status": "success",
            "data": {
                "summary": summary,
                "daily_pnl": daily_pnl,
                "positions": pos_list,
                "holdings": [],
                "trades": [
                    t.to_dict() if hasattr(t, 'to_dict') else t.__dict__
                    for t in trades[:50]
                ]
            }
        }
    except Exception as e:
        logger.error(f"Error fetching sandbox pnl data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandbox/api/configs")
async def get_sandbox_configs():
    """GET /sandbox/api/configs - Returns sandbox/paper trading simulation settings."""
    return {
        "status": "success",
        "data": {
            "initial_capital": 1000000,
            "currency": "INR",
            "slippage_model": "fixed_0.05",
            "latency_simulation": "enabled_50ms",
            "execution_mode": "asynchronous",
            "isolation": "enabled",
            "last_reset": datetime.now().isoformat()
        }
    }
