# Project Skills

## Adopted Skill: Docker Expert (from sickn33/antigravity)
- Use standard Antigravity patterns for volume management.
- Ensure all SQLite files in /app/db have 777 permissions.

## Adopted Skill: Python Performance (from wshobson/agents)
- Optimize Nifty 50 data processing loops.
- Use asynchronous calls for Shoonya API feed.

## Adopted Skill: Skill Vetter
- Before implementing any new library, run a security check against known vulnerabilities.

## Adopted Skill: Optimization Engine
- **Parameter Sweeping**: Implement nested loops or `itertools.product` to generate combinations of `trend_period`, `rsi_period`, and other strategy parameters.
- **Metric Ranking**: Calculate Net PnL, Maximum Drawdown, and Win Rate for each backtest run.
- **Resource Management**: Run optimizations in small batches to respect the 1GB RAM limit.
- **Result Persistence**: Save the best-performing parameter sets to `run_data/backtests/optimized_params.json` for review.