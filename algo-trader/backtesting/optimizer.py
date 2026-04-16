import itertools
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from backtesting.runner import BacktestResult, BacktestRunner

logger = logging.getLogger(__name__)


@dataclass
class OptimizationResult:
    best_params: Dict[str, Any]
    best_pnl: float
    all_runs: List[Dict[str, Any]]
    metric_used: str


class StrategyOptimizer:
    """
    Performs parameter sweeps for strategies using historical data.
    Supports Grid Search by default.
    """

    def __init__(self, runner: Optional[BacktestRunner] = None):
        self.runner = runner or BacktestRunner()

    def optimize(
        self,
        strategy_key: str,
        symbol: str,
        candles: List[Dict[str, Any]],
        param_ranges: Dict[str, List[Any]],
        metric: str = "net_pnl",
        max_iterations: int = 100,
    ) -> OptimizationResult:
        """
        Run a Grid Search over the provided parameter ranges.
        """
        combinations = self._generate_combinations(param_ranges)

        if len(combinations) > max_iterations:
            logger.warning(
                "Optimization space (%d) exceeds max_iterations (%d). Truncating.",
                len(combinations),
                max_iterations,
            )
            combinations = combinations[:max_iterations]

        all_results = []
        best_pnl = float("-inf")
        best_params = {}

        logger.info(
            "Starting optimization for %s on %s with %d combinations.",
            strategy_key,
            symbol,
            len(combinations),
        )

        for params in combinations:
            try:
                result = self.runner.run(
                    strategy_key=strategy_key,
                    symbol=symbol,
                    candles=candles,
                    params=params,
                )

                metric_value = getattr(result, metric, 0.0)
                all_results.append({
                    "params": params,
                    "result_id": result.result_id,
                    "net_pnl": result.net_pnl,
                    "win_rate": result.win_rate,
                    "max_drawdown": result.max_drawdown,
                })

                if metric_value > best_pnl:
                    best_pnl = metric_value
                    best_params = params

            except Exception as e:
                logger.error("Error during optimization run with params %s: %s", params, e)

        # Sort all results by the chosen metric descending
        all_results.sort(key=lambda x: x.get(metric, 0.0), reverse=True)

        return OptimizationResult(
            best_params=best_params,
            best_pnl=best_pnl,
            all_runs=all_results,
            metric_used=metric,
        )

    def _generate_combinations(self, param_ranges: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        """
        Helper to generate all possible combinations of parameters.
        """
        keys = list(param_ranges.keys())
        values = list(param_ranges.values())

        combinations = []
        for combination_values in itertools.product(*values):
            combinations.append(dict(zip(keys, combination_values)))

        return combinations
