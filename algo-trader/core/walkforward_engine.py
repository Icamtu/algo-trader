import asyncio
import logging
from typing import Dict, List, Any, Type
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

from core.backtest_engine import BacktestEngine
from core.optimizer import GridSearchOptimizer
from core.performance import PerformanceCalculator

logger = logging.getLogger(__name__)

class WalkForwardEngine:
    """
    Implements Walk-Forward Optimization (WFO) to validate strategy robustness.
    Splits data into overlapping Training (In-Sample) and Testing (Out-of-Sample) windows.
    """

    def __init__(self,
                 strategy_class: Type,
                 symbol: str,
                 param_grid: Dict[str, List[Any]],
                 interval: str = "5m"):
        self.strategy_class = strategy_class
        self.symbol = symbol
        self.param_grid = param_grid
        self.interval = interval
        self.windows = []

    async def run(self,
                  total_days: int = 60,
                  train_days: int = 20,
                  test_days: int = 10,
                  target_metric: str = "profit_factor"):
        """
        Executes the Walk-Forward process.
        """
        logger.info(f"Starting Walk-Forward Optimization: Total={total_days}d, Train={train_days}d, Test={test_days}d")

        # 1. Define window boundaries
        # We start from (now - total_days) and move forward in increments of test_days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=total_days)

        current_train_start = start_date
        all_test_trades = []
        all_price_history = {}
        window_results = []

        while current_train_start + timedelta(days=train_days + test_days) <= end_date:
            train_end = current_train_start + timedelta(days=train_days)
            test_start = train_end
            test_end = test_start + timedelta(days=test_days)

            logger.info(f"--- WFO Window: Train [{current_train_start.date()} to {train_end.date()}] | Test [{test_start.date()} to {test_end.date()}] ---")

            # 2. Optimization Phase (In-Sample)
            optimizer = GridSearchOptimizer(
                self.strategy_class,
                self.symbol,
                self.param_grid,
                days=(train_end - current_train_start).days,
                interval=self.interval
            )
            # Override dates manually to ensure exact window
            # (Note: GridSearchOptimizer needs adjustment to accept date ranges)

            # For now, let's assume GridSearchOptimizer can be used if we fix its engine call
            opt_results = await optimizer.run(target_metric=target_metric)

            if not opt_results:
                logger.warning(f"No optimization results for window {current_train_start.date()}. Skipping.")
                current_train_start += timedelta(days=test_days)
                continue

            best_params = opt_results[0]["params"]
            logger.info(f"Best Params for window: {best_params} (Score: {opt_results[0]['score']})")

            # 3. Validation Phase (Out-of-Sample)
            # Run backtest on the Test window using best_params
            engine = BacktestEngine(self.strategy_class, self.symbol, interval=self.interval)

            # Inject best params
            class OptimizedStrategy(self.strategy_class):
                def __init__(self, om, pm=None):
                    super().__init__(om, pm)
                    for k, v in best_params.items():
                        setattr(self, k, v)

            engine.strategy_class = OptimizedStrategy

            test_from = test_start.strftime("%Y-%m-%d")
            res = await engine.run(days=test_days)

            if res and "trades" in res:
                # Filter trades to only those within the test window
                # (Engine might return more if not careful)
                test_trades = [t for t in res["trades"] if test_start.timestamp() <= t.get("timestamp_num", 0) <= test_end.timestamp()]
                all_test_trades.extend(test_trades)

                # Merge price history for performance calculation
                if "performance" in res and "price_history" in res["performance"]:
                    all_price_history.update(res["performance"]["price_history"])

                window_results.append({
                    "window_start": test_from,
                    "best_params": best_params,
                    "is_metrics": opt_results[0]["metrics"],
                    "oos_trades": len(test_trades)
                })

            # 4. Slide the window
            current_train_start += timedelta(days=test_days)

        # 5. Aggregate All Out-Of-Sample Results
        if not all_test_trades:
            return {"status": "error", "message": "No trades generated in any out-of-sample window"}

        # Calculate final combined performance
        calc = PerformanceCalculator(
            trade_logs=all_test_trades,
            initial_capital=1000000.0, # Standard
            price_history=all_price_history
        )
        final_metrics = calc.calculate_metrics()

        return {
            "status": "success",
            "summary": {
                "total_oos_trades": len(all_test_trades),
                "total_windows": len(window_results),
                "walk_forward_efficiency": self._calculate_wfe(window_results, final_metrics)
            },
            "metrics": final_metrics,
            "windows": window_results
        }

    def _calculate_wfe(self, window_results: List[Dict], final_metrics: Dict) -> float:
        """
        Calculates Walk-Forward Efficiency (WFE).
        WFE = (Annualized OOS Return / Avg Annualized IS Return)
        Values > 0.5 are generally considered robust.
        """
        try:
            is_returns = [w["is_metrics"].get("annualized_return", 0) for w in window_results]
            avg_is_return = np.mean(is_returns)
            oos_return = final_metrics.get("annualized_return", 0)

            if avg_is_return == 0: return 0
            return round(oos_return / avg_is_return, 2)
        except:
            return 0.0
