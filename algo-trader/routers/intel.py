from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
from datetime import datetime

# Import global context from the main app file
# Note: In a production app, we'd use Dependency Injection properly,
# but here we follow the established app_context pattern.
from core.context import app_context
from database.trade_logger import get_trade_logger
from fastapi import APIRouter, HTTPException, Depends, Query

router = APIRouter(tags=["Intelligence Hub"])
logger = logging.getLogger(__name__)

@router.get("/regime")
@router.get("/market_regime")
async def get_market_regime():
    """
    Returns the current global market regime and risk multipliers.
    Detected by the AI Market Regime Agent every 15 minutes.
    """
    runner = app_context.get("strategy_runner")
    if not runner:
        raise HTTPException(status_code=503, detail="Strategy Runner not initialized")

    telemetry = runner.get_telemetry() if hasattr(runner, "get_telemetry") else {}
    return {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "data": telemetry
    }

@router.get("/intel/sectors")
async def get_sector_sentiment():
    """
    Returns sentiment analysis for all Tier 1 and Tier 2 sectors.
    Includes conviction levels and reasoning from the AI cluster.
    """
    runner = app_context.get("strategy_runner")
    if not runner:
        raise HTTPException(status_code=503, detail="Strategy Runner not initialized")

    sector_data = getattr(runner, "sector_sentiment", {})
    return {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "data": {
            "tier_1": {name: data for name, data in sector_data.items() if data.get("tier") == "tier_1"},
            "tier_2": {name: data for name, data in sector_data.items() if data.get("tier") == "tier_2"},
            "all": sector_data
        }
    }

@router.get("/intel/status")
async def get_intel_status():
    """
    Returns the operational health of the Intelligence Hub.
    """
    runner = app_context.get("strategy_runner")
    if not runner:
        return {"status": "offline", "message": "Runner missing"}

    last_regime_update = getattr(runner, "current_regime_data", {}).get("last_update")

    return {
        "status": "online",
        "regime_agent_active": True,
        "sector_agent_active": True,
        "last_regime_update": last_regime_update,
        "sectors_tracked": len(getattr(runner, "sector_sentiment", {}))
    }

@router.get("/backtest/results")
async def get_backtest_results(strategy_id: str = Query(None)):
    """
    GET /api/v1/backtest/results
    Returns the latest backtest result from persistent storage.
    Returns 200 with status=no_data when no results exist yet (avoids retry loops in UI).
    """
    try:
        db_logger = get_trade_logger()
        result = await db_logger.get_latest_backtest_run_async(strategy_id)
        if not result:
            return {
                "status": "no_data",
                "message": "No backtest results available. Run a backtest first.",
                "tradesCount": 0,
                "winRate": 0,
                "sharpe": 0,
                "sortino": 0,
                "maxDD": 0,
                "cagr": 0,
                "equityCurve": [],
                "trades": []
            }

        m = result.get("metrics", {})
        return {
            "status": "success",
            "strategy_id": result["strategy_id"],
            "symbol": result["symbol"],
            "tradesCount": m.get("total_trades", 0),
            "winRate": m.get("win_rate_pct", 0),
            "sharpe": m.get("sharpe_ratio", 0),
            "sortino": m.get("sortino_ratio", 0),
            "maxDD": m.get("max_drawdown_pct", 0),
            "cagr": m.get("cagr", 0),
            "equityCurve": m.get("equity_curve", []),
            "benchmarkCurve": m.get("benchmark_curve", []),
            "metrics": m,
            "trades": result["trades"][-50:],
            "created_at": result.get("created_at"),
        }
    except Exception as e:
        logger.error(f"Error fetching backtest results: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
