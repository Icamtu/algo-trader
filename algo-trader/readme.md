Algo-Trader — Lightweight algorithmic trading platform

Overview
--------
Algo-Trader is a modular trading engine for research and strategy execution. It fetches market data, runs strategies, produces signals, sizes positions, enforces risk rules, and executes orders through OpenAlgo.

Quick start
-----------
1. Create a Python virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Populate environment variables (copy `.env.example` → `.env` if present) with API keys and endpoints.

3. Launch the dashboard for interactive control and monitoring:

```bash
streamlit run app/dashboard.py
```

Repository layout
-----------------
- `app/` — UI and dashboard (`app/dashboard.py`).
- `core/` — Orchestration and utilities (`core/config.py`, `core/logger.py`, `core/scheduler.py`, `core/strategy_runner.py`).
- `data/` — Market data and indicators (`data/market_data.py`, `data/indicators.py`).
- `strategies/` — Strategy implementations (e.g., `intraday_strategy.py`, `swing_strategy.py`, `longterm_strategy.py`).
- `signals/` — Signal aggregation engine (`signals/signal_engine.py`).
- `portfolio/` — Position sizing and portfolio logic (`portfolio/portfolio_manager.py`).
- `risk/` — Risk checks and limits (`risk/risk_manager.py`).
- `execution/` — Broker clients and order flow (`execution/openalgo_client.py`, `execution/order_manager.py`).
- `database/` — Trade logging utilities (`database/trade_logger.py`).
- `config/` — YAML configuration (`config/settings.yaml`).

How data flows
-------------
1. `data/market_data.py` obtains market data.
2. Strategies in `strategies/` generate candidate trades.
3. `signals/signal_engine.py` consolidates strategy outputs.
4. `portfolio/portfolio_manager.py` determines sizes.
5. `risk/risk_manager.py` validates trades against limits.
6. `execution/order_manager.py` places orders through `execution/openalgo_client.py`.
7. `database/trade_logger.py` records fills and events.

Configuration
-------------
- Primary configuration lives in `config/settings.yaml` and environment variables read by `core/config.py`.
- Strategy enable/disable lives under the `strategies` section in `config/settings.yaml`.
- Runtime overrides are available through `ENABLED_STRATEGIES` and `DISABLED_STRATEGIES` with comma-separated strategy keys such as `intraday,long_term`.
- `trading.mode` supports `paper`, `fronttest`, and `live`.
- `paper` and `fronttest` are expected to run against OpenAlgo Sandbox/Analyzer instead of a separate local paper broker.

Development notes
-----------------
- Add new strategies under `strategies/` and test them via the dashboard.
- Reuse OpenAlgo for positions, holdings, orders, trades, analyzer logs, and sandbox P&L instead of rebuilding those features locally.

Contributing
------------
Contributions are welcome. Open an issue or PR describing changes; include tests where feasible.

License
-------
See the `LICENSE` file at the project root for licensing details. If absent, contact the repository owner.

Disclaimer
----------
This project is intended for learning and research. Do not use it with real capital without thorough testing, backtesting, and risk controls.
