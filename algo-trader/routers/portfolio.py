from fastapi import APIRouter, Request, HTTPException, Depends
import logging
from typing import List, Dict, Any
from core.context import app_context
from database.trade_logger import get_trade_logger
from services.portfolio_analytics import portfolio_analytics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["Portfolio"])

@router.get("/engine/positions")
async def get_engine_positions():
    """FastAPI port of /api/v1/engine/positions."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        positions = order_manager.position_manager.all_positions()
        pos_list = []
        for symbol, pos in positions.items():
            pos_list.append({
                "symbol": symbol,
                "quantity": pos.quantity,
                "avg_price": pos.avg_price,
                "pnl": pos.pnl if hasattr(pos, "pnl") else 0.0,
                "metadata": getattr(pos, "metadata", {})
            })

        return {
            "status": "success",
            "positions": pos_list,
            "count": len(pos_list)
        }
    except Exception as e:
        logger.error(f"Error fetching engine positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/broker/positions")
async def get_broker_positions():
    """FastAPI port of /api/v1/broker/positions."""
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        positions = await order_manager.get_positions()
        return positions
    except Exception as e:
        logger.error(f"Error fetching broker positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/reconcile")
async def system_reconcile():
    """FastAPI port of /api/v1/system/reconcile."""
    order_manager = app_context.get("order_manager")
    db_logger = get_trade_logger()
    if not order_manager:
        raise HTTPException(status_code=503, detail="Services not initialized")

    try:
        broker_pos = await order_manager.get_positions()

        # Reconciliation logic (Simplified)
        if isinstance(broker_pos, list):
            for pos in broker_pos:
                symbol = pos.get("symbol")
                qty = int(pos.get("quantity", 0))
                if symbol:
                    await db_logger.reconcile_positions_async(symbol, qty)

        return {
            "status": "success",
            "message": "Reconciliation triggered",
            "positions": broker_pos
        }
    except Exception as e:
        logger.error(f"Reconcile failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/reset-positions")
async def system_reset_positions():
    """FastAPI port of /api/v1/system/reset-positions."""
    try:
        db_logger = get_trade_logger()
        order_manager = app_context.get("order_manager")

        await db_logger.reset_positions_async()

        if order_manager and order_manager.position_manager:
            order_manager.position_manager.positions = {}

        return {"status": "success", "message": "All local positions reset to zero"}
    except Exception as e:
        logger.error(f"Reset positions failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/portfolio/risk")
async def get_portfolio_risk(confidence: float = 0.95, horizon: int = 1):
    """
    Calculate portfolio risk metrics (VaR/CVaR) using Monte Carlo simulation.
    """
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        # Get live positions
        positions = order_manager.position_manager.all_positions()
        pos_list = []
        for symbol, pos in positions.items():
            if pos.quantity != 0:
                pos_list.append({
                    "symbol": symbol,
                    "quantity": pos.quantity,
                    "avg_price": pos.avg_price
                })

        if not pos_list:
            return {
                "status": "success",
                "message": "No open positions to analyze",
                "metrics": {
                    "portfolio_value": 0,
                    "var_inr": 0,
                    "cvar_inr": 0,
                    "var_pct": 0,
                    "cvar_pct": 0
                }
            }

        risk_data = await portfolio_analytics.calculate_portfolio_risk(
            pos_list,
            confidence_level=confidence,
            horizon_days=horizon
        )
        return risk_data
    except Exception as e:
        logger.error(f"Portfolio risk endpoint failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))
