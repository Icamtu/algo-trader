from fastapi import APIRouter, Request, HTTPException, Depends
import logging
import numpy as np
from core.context import app_context
from database.trade_logger import get_trade_logger, Trade
from typing import Any, Dict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/risk", tags=["Risk"])

@router.get("/matrix")
async def risk_matrix():
    """
    Advanced Risk Matrix: Computes real-time risk metrics across all strategies.
    Calculates Sharpe Ratio, Max Drawdown, and Win Rate from historical trade data.
    """
    try:
        db_logger = get_trade_logger()
        trades = await db_logger.get_all_trades_async(limit=1000)

        if not trades:
            return {
                "status": "success",
                "data": {
                    "total_sharpe": 0,
                    "max_drawdown": 0,
                    "win_rate": 0,
                    "nodes": []
                }
            }

        # 1. Group trades by strategy
        strategies_data = {}
        for t in trades:
            if t.strategy not in strategies_data:
                strategies_data[t.strategy] = []
            strategies_data[t.strategy].append(t)

        nodes = []
        all_net_pnls = []

        for strategy, s_trades in strategies_data.items():
            # Calculate strategy-specific metrics
            s_pnls = np.array([t.pnl for t in s_trades if t.pnl is not None])
            s_charges = np.array([t.charges or 0.0 for t in s_trades if t.pnl is not None])
            s_net_pnls = s_pnls - s_charges
            all_net_pnls.extend(s_net_pnls.tolist())

            if len(s_net_pnls) == 0:
                continue

            # Win Rate
            wins = s_net_pnls[s_net_pnls > 0]
            win_rate = len(wins) / len(s_net_pnls)

            # Cumulative PnL for Drawdown
            cum_pnl = np.cumsum(s_net_pnls)
            peak = np.maximum.accumulate(cum_pnl)
            # Avoid division by zero if peak is 0
            drawdown = np.where(peak != 0, (peak - cum_pnl) / np.abs(peak), 0)
            max_dd = np.max(drawdown) if len(drawdown) > 0 else 0

            # Sharpe (Simplified per trade for UI representation)
            std = np.std(s_net_pnls)
            sharpe = np.mean(s_net_pnls) / std if std > 0 else 0

            nodes.append({
                "id": strategy,
                "label": strategy,
                "metrics": {
                    "sharpe": round(float(sharpe), 2),
                    "max_drawdown": round(float(max_dd), 2),
                    "win_rate": round(float(win_rate), 2),
                    "net_pnl": round(float(np.sum(s_net_pnls)), 2)
                }
            })

        # 2. Global Metrics
        global_net_pnls = np.array(all_net_pnls)
        global_wins = global_net_pnls[global_net_pnls > 0]
        global_win_rate = len(global_wins) / len(global_net_pnls) if len(global_net_pnls) > 0 else 0

        # Global Sharpe
        g_std = np.std(global_net_pnls)
        global_sharpe = np.mean(global_net_pnls) / g_std if g_std > 0 else 0

        # Global Max Drawdown
        g_cum_pnl = np.cumsum(global_net_pnls)
        g_peak = np.maximum.accumulate(g_cum_pnl)
        g_drawdown = np.where(g_peak != 0, (g_peak - g_cum_pnl) / np.abs(g_peak), 0)
        global_max_dd = np.max(g_drawdown) if len(g_drawdown) > 0 else 0

        return {
            "status": "success",
            "data": {
                "total_sharpe": round(float(global_sharpe), 2),
                "max_drawdown": round(float(global_max_dd), 2),
                "win_rate": round(float(global_win_rate), 2),
                "nodes": nodes
            }
        }
    except Exception as e:
        logger.error(f"Risk matrix failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/status")
async def get_risk_status() -> Dict[str, Any]:
    """
    GET /api/v1/risk/status
    Returns a live snapshot of the risk manager counters for the dashboard.
    """
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager or not hasattr(order_manager, "risk_manager"):
            raise HTTPException(status_code=503, detail="Risk manager unavailable")

        risk_manager = order_manager.risk_manager
        status: Dict[str, Any] = risk_manager.get_status()
        # Attach trading mode from order manager
        status["mode"] = getattr(order_manager, "mode", "sandbox")
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Risk status endpoint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")
