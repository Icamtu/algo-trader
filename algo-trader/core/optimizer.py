import asyncio
import logging
from typing import Dict, List, Any, Type
import itertools

from core.backtest_engine import BacktestEngine
from core.performance import PerformanceCalculator

logger = logging.getLogger(__name__)

class GridSearchOptimizer:
    """
    Runs multiple backtests across a grid of parameters to find the optimal strategy config.
    """

    def __init__(self,
                 strategy_class: Type,
                 symbol: str,
                 param_grid: Dict[str, List[Any]],
                 days: int = 7,
                 interval: str = "1m"):
        self.strategy_class = strategy_class
        self.symbol = symbol
        self.param_grid = param_grid
        self.days = days
        self.interval = interval
        self.results = []

    async def run(self, target_metric: str = "profit_factor") -> List[Dict[str, Any]]:
        """
        Executes the grid search and returns a ranked list of results.
        """
        # Generate all combinations
        keys = self.param_grid.keys()
        combinations = [dict(zip(keys, v)) for v in itertools.product(*self.param_grid.values())]

        logger.info(f"Starting Grid Search Optimization: {len(combinations)} combinations found.")

        for i, params in enumerate(combinations):
            logger.info(f"[{i+1}/{len(combinations)}] Testing Params: {params}")

            # Setup engine
            engine = BacktestEngine(self.strategy_class, self.symbol, interval=self.interval)
            engine.no_ai = True # Always bypass AI during heavy optimization

            # Note: We need a way to pass these params into the strategy.
            # We'll monkey-patch the __init__ or just inject attributes.
            # Subclassing the strategy or updating the constructor is better.

            # For now, we'll use a wrapper that injects params
            class OptimizedStrategy(self.strategy_class):
                def __init__(self, om, pm=None):
                    super().__init__(om, pm)
                    for k, v in params.items():
                        setattr(self, k, v)

            engine.strategy_class = OptimizedStrategy
            trade_logs = await engine.run(days=self.days)

            # Analyze
            calc = PerformanceCalculator(trade_logs)
            metrics = calc.calculate_metrics()

            if metrics.get("status") != "error":
                result = {
                    "params": params,
                    "metrics": metrics,
                    "score": metrics.get(target_metric, 0)
                }
                self.results.append(result)

        # Sort by score descending
        self.results.sort(key=lambda x: x["score"], reverse=True)

        return self.results
