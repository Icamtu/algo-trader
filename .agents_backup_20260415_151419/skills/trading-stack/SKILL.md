---
name: trading-stack
description: Use when working with algo_engine, Shoonya API, DuckDB Historify, or WebSocket relays. Triggers on: "algo_engine", "shoonya", "finvasia", "JWT mismatch", "WebSocket", "DuckDB", "historify", "broker session", "F&O symbol", "PGRST301", "port 18788", "port 5002".
---

# Trading Stack — AetherDesk Prime Domain

## 1. Unified Connectivity Map
- **Trading API**: Port **18788** (Orchestration & Control).
- **Tick Stream**: Port **5002** (WebSocket Relay from Engine).
- **Broker Bridge**: `http://openalgo-web:5000` (Internal).

## 2. Shoonya OAuth Session Lifecycle
Automated headless login pattern (see `algo-trader/utils/get_shoonya_token.py`).
```python
from utils.get_shoonya_token import get_shoonya_auth_code
from utils.finalize_shoonya_auth import finalize_shoonya_session

# Call at 09:15 AM IST or on 401 Unauthorized
auth_code = get_shoonya_auth_code()
if auth_code and "ERROR" not in auth_code:
    session = finalize_shoonya_session(auth_code)
    # Susertoken must be stored in Redis/State for global use
```

## 3. WebSocket Relay (Port 5002)
Broadcasts ticks and strategy events to the React UI.
```python
# Standard Frame Structure
{
    "t": "tk",       # tk: Tick, om: Order, sys: System
    "s": "RELIANCE", # Symbol
    "lp": 2985.40,   # Last Price
    "v": 124500,     # Volume
    "ts": "10:34:05" # Timestamp
}
```

## 4. DuckDB Historify — High-Speed Queries
Used for institutional-grade historical analysis.
```python
import duckdb
conn = duckdb.connect("/app/storage/historify.duckdb")

# Efficient OHLC aggregation
query = """
SELECT 
    symbol, 
    date_trunc('minute', ts) as time,
    first(price) as open, max(price) as high,
    min(price) as low, last(price) as close
FROM ticks
WHERE symbol = ?
GROUP BY 1, 2 ORDER BY 2
"""
candles = conn.execute(query, [symbol]).df()
```

## 5. Risk Management Enforcement (Action Center)
Every execution request MUST have a status check.
```python
# Pending -> Approved -> Executed/Failed
if risk_profile.check_daily_loss() > MAX_LOSS:
    action_manager.reject_all_pending("Daily risk limit hit")
```

## 6. F&O Symbol Encoding Rules
- Basic: `NIFTY24APR22000CE`
- Complex: `BANKNIFTY 24th APR 48000 PE` (Normalize to broker format before routing).

## [Agents: update domain logic here as the engine evolves]
