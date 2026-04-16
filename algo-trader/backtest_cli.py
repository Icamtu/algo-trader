import asyncio
import argparse
import logging
import sys
import os

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), "algo-trader"))

from core.backtest_engine import BacktestEngine
from core.performance import PerformanceCalculator
from strategies.intraday_strategy import IntradayStrategy
from strategies.aether_scalper import AetherScalper
from strategies.aether_swing import AetherSwing
from strategies.aether_vault import AetherVault

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AetherSim")

STRATEGIES = {
    "IntradayStrategy": IntradayStrategy,
    "AetherScalper": AetherScalper,
    "AetherSwing": AetherSwing,
    "AetherVault": AetherVault
}

async def main():
    parser = argparse.ArgumentParser(description="AetherDesk Standardized Backtester")
    parser.add_argument("--strategy", choices=STRATEGIES.keys(), default="IntradayStrategy", help="Strategy to test")
    parser.add_argument("--symbol", default="RELIANCE-EQ", help="Symbol to test (e.g. RELIANCE-EQ)")
    parser.add_argument("--days", type=int, default=7, help="Days of history to test")
    parser.add_argument("--interval", default="1m", help="Candle interval (1m, 1d, 1wk)")
    parser.add_argument("--optimize", action="store_true", help="Run Grid Search Optimization")
    parser.add_argument("--no-ai", action="store_true", help="Bypass AI synthesis and use perfect conviction")

    args = parser.parse_args()

    strat_class = STRATEGIES[args.strategy]

    # 1. Handle Optimization Mode
    if args.optimize:
        from core.optimizer import GridSearchOptimizer
        param_grid = {
            "rsi_window": [7, 14, 21],
            "vol_window": [10, 20, 30]
        }
        optimizer = GridSearchOptimizer(strat_class, args.symbol, param_grid, days=args.days, interval=args.interval)
        results = await optimizer.run()

        print("\n" + "="*50)
        print(f" AETHERSIM: OPTIMIZATION RESULTS (Top 3)")
        print("="*50)
        for res in results[:3]:
            m = res['metrics']
            print(f" Params: {res['params']}")
            print(f" >> Profit: ₹{m['net_profit']:.2f} | PF: {m['profit_factor']:.2f}")
        print("="*50)
        return

    # 2. Standard Backtest Mode
    engine = BacktestEngine(strat_class, args.symbol, interval=args.interval)
    engine.no_ai = args.no_ai

    print("\n" + "="*50)
    print(f" AETHERSIM: STARTING VALIDATION")
    print(f" Strategy : {args.strategy}")
    print(f" Symbol   : {args.symbol}")
    print(f" Horizon  : {args.days} Days | {args.interval} Int")
    print("="*50)

    trades = await engine.run(days=args.days)

    from core.performance import PerformanceCalculator
    perf = PerformanceCalculator(trades)
    metrics = perf.calculate_metrics()

    print("\n" + "="*50)
    print(" AETHERSIM: PERFORMANCE SUMMARY")
    print("="*50)
    if metrics.get("status") == "error":
        print(f" [!] {metrics['message']}")
    else:
        print(f" TOTAL_TRADES    : {metrics['total_trades']}")
        print(f" WIN_RATE        : {metrics['win_rate']*100:.1f}%")
        print(f" PROFIT_FACTOR   : {metrics['profit_factor']:.2f}")
        print(f" NET_PROFIT      : ₹{metrics['net_profit']:.2f}")
        print(f" MAX_DRAWDOWN    : {metrics['max_drawdown_pct']:.2f}%")
        print(f" SHARPE_RATIO    : {metrics['sharpe_ratio']:.2f}")

        # 3. Export for UI
        import json
        results_path = "/app/storage/backtest_results.json"
        os.makedirs(os.path.dirname(results_path), exist_ok=True)
        with open(results_path, "w") as f:
            json.dump(metrics, f)
        print(f"\n [✓] Results exported to: {results_path}")
    print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
