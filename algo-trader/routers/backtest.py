from fastapi import APIRouter, Request, HTTPException, Depends, Body
import logging
from typing import Optional, Dict, Any, List
from core.context import app_context
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/backtest", tags=["Backtest"])

class BacktestRequest(BaseModel):
    strategy_id: str
    symbol: str
    days: Optional[int] = 7
    interval: Optional[str] = "1m"
    params: Optional[Dict[str, Any]] = {}
    initial_cash: Optional[float] = 1000000.0
    slippage: Optional[float] = 0.0005

class WalkForwardRequest(BaseModel):
    strategy_id: str
    symbol: str
    param_grid: Dict[str, List[Any]]
    total_days: int = 60
    train_days: int = 20
    test_days: int = 10
    interval: str = "5m"
    target_metric: str = "profit_factor"

@router.post("/run")
async def run_backtest(request: BacktestRequest):
    """FastAPI port of /api/v1/backtest/run."""
    try:
        from core.backtest_engine import BacktestEngine
        from blueprints.strategies_bp import _load_strategy_class

        strat_class = _load_strategy_class(request.strategy_id)
        if not strat_class:
            raise HTTPException(status_code=404, detail=f"Strategy {request.strategy_id} not found")

        engine = BacktestEngine(
            strategy_class=strat_class,
            symbol=request.symbol,
            days=request.days,
            interval=request.interval,
            params=request.params,
            initial_cash=request.initial_cash,
            slippage=request.slippage
        )

        result = await engine.run()
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Backtest Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize")
async def optimize_strategy(
    strategy_id: str = Body(...),
    symbol: str = Body(...),
    param_grid: Dict[str, list] = Body(...),
    days: int = Body(7),
    target_metric: str = Body("profit_factor")
):
    """FastAPI port of /api/v1/strategies/optimize."""
    try:
        from core.optimizer import GridSearchOptimizer
        from blueprints.strategies_bp import _load_strategy_class

        strat_class = _load_strategy_class(strategy_id)
        if not strat_class:
            raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")

        optimizer = GridSearchOptimizer(strat_class, symbol, param_grid, days=days)
        results = await optimizer.run(target_metric=target_metric)

        return {
            "status": "success",
            "strategy_id": strategy_id,
            "symbol": symbol,
            "results": results[:20]
        }
    except Exception as e:
        logger.error(f"Optimization API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/walk-forward")
async def run_walk_forward(request: WalkForwardRequest):
    """
    Executes Walk-Forward Optimization (WFO) for a strategy.
    """
    try:
        from core.walkforward_engine import WalkForwardEngine
        from blueprints.strategies_bp import _load_strategy_class

        strat_class = _load_strategy_class(request.strategy_id)
        if not strat_class:
            raise HTTPException(status_code=404, detail=f"Strategy {request.strategy_id} not found")

        wfo_engine = WalkForwardEngine(
            strategy_class=strat_class,
            symbol=request.symbol,
            param_grid=request.param_grid,
            interval=request.interval
        )

        result = await wfo_engine.run(
            total_days=request.total_days,
            train_days=request.train_days,
            test_days=request.test_days,
            target_metric=request.target_metric
        )

        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Walk-Forward API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
