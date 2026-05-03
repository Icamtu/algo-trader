from fastapi import APIRouter, Request, HTTPException, Depends, Query
import logging
import os
import jwt
from typing import List, Dict, Any, Optional
from core.context import app_context
from database.trade_logger import get_trade_logger
from services.portfolio_analytics import portfolio_analytics

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Portfolio"])

_JWT_SECRET = os.environ.get("JWT_SECRET", "")

def _require_admin(request: Request):
    """Raise 401/403 unless caller has admin role via JWT."""
    auth_header = request.headers.get("Authorization", "")
    internal_key = request.headers.get("X-Internal-Key")
    if internal_key and internal_key == _JWT_SECRET:
        return
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Token")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Auth failure (invalid token): {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    role = payload.get("role", "viewer").lower()
    if role not in ("admin", "internal"):
        raise HTTPException(status_code=403, detail="ADMIN_ROLE_REQUIRED")

@router.get("/engine/positions")
@router.post("/engine/positions")
@router.get("/positionbook")
@router.post("/positionbook")
@router.get("/holdings")
@router.post("/holdings")
async def get_engine_positions(request: Request = None):
    """FastAPI port of /api/v1/engine/positions & /api/v1/positionbook."""
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
                "avg_price": pos.average_price,
                "pnl": pos.pnl if hasattr(pos, "pnl") else 0.0,
                "metadata": getattr(pos, "metadata", {})
            })

        return {
            "status": "success",
            "data": {
                "holdings": pos_list,
                "count": len(pos_list)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching engine positions: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/tradebook/open")
async def get_open_position(symbol: Optional[str] = Query(None)):
    """
    GET /api/v1/tradebook/open
    Returns detailed state for open positions.
    If symbol is provided, returns only that specific position.
    """
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    try:
        positions = order_manager.position_manager.all_positions()

        if symbol:
            pos = positions.get(symbol)
            if not pos or pos.quantity == 0:
                return {
                    "status": "success",
                    "data": {
                        "positions": [],
                        "message": f"No open position for {symbol}"
                    }
                }

            return {
                "status": "success",
                "data": {
                    "positions": [{
                        "symbol": symbol,
                        "quantity": pos.quantity,
                        "avg_price": pos.average_price,
                        "pnl": pos.pnl if hasattr(pos, "pnl") else 0.0,
                        "metadata": getattr(pos, "metadata", {})
                    }]
                }
            }

        # Return all open positions
        open_list = [
            {
                "symbol": s,
                "quantity": p.quantity,
                "avg_price": p.average_price,
                "pnl": p.pnl if hasattr(p, "pnl") else 0.0
            }
            for s, p in positions.items()
            if p.quantity != 0
        ]

        return {
            "status": "success",
            "data": {
                "positions": open_list,
                "count": len(open_list)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching open positions: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

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
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/system/reconcile")
async def system_reconcile(request: Request):
    """FastAPI port of /api/v1/system/reconcile."""
    _require_admin(request)
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
            "data": {
                "positions": broker_pos
            }
        }
    except Exception as e:
        logger.error(f"Reconcile failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
        raise HTTPException(status_code=500, detail="Internal error")
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
        raise HTTPException(status_code=500, detail="Internal error")
