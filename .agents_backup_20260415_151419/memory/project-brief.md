# AetherDesk Prime — Project Brief
# Type: Core Context (Manual setup, AI-maintained history)
# Purpose: Foundational mission and status reference.

## What This Is
**AetherDesk Prime** is a unified, high-performance algorithmic trading ecosystem designed for the Indian Markets (NSE/NFO). It fuses the reliability of **OpenAlgo** with a custom **Analytical Engine** (DuckDB/GEX) and a premium, institutional-grade **React Frontend**.

## Strategic Goals
- **Execution**: Seamless order routing via port 18788 targeting Shoonya (Finvasia).
- **Analytics**: Real-time GEX (Gamma Exposure), IV Surface, and Max Pain visualization.
- **Historify**: High-speed historical tick-to-candle conversion stored in DuckDB.
- **Intelligence**: Integrated Decision Agent (AI) for signal filtering and risk audit.
- **Reliability**: Automated headless session management for broker login.

## System Readiness Scorecard
| Layer | Component | Status | Progress |
|-------|-----------|--------|----------|
| Core | Engine Flow | DONE | 100% |
| Auth | Shoonya Sync| DONE | 100% |
| Data | DuckDB Sync | DONE | 90% |
| UI | Modernization| DONE | 100% |
| Risk | Action Center| NOW | 75% |

## Primary Tooling
- **Engine**: Port **18788** (Control Plane)
- **Feeds**: Port **5002** (WebSocket Relay)
- **Database**: `historify.duckdb` (Core) | `trades.db` (Logs)
- **Frontend**: Vite + Tailwind + Shadcn UI

## Critical Broker Constraints (Shoonya)
- **Exchange Support**: NSE, BSE, NFO, MCX.
- **Symbol Encoding**: F&O symbols must be correctly mapped (e.g., `NIFTY24APR22000CE`).
- **Session Lifecycle**: Totals refresh at 09:15 AM IST. Headless sync triggers daily.
- **Rate Limits**: Respect the 3 requests/sec threshold for sensitive endpoints.

## Active Phase: Performance Optimization
Focus is currently on minimizing WebSocket latency and maximizing the throughput of the DuckDB ingestion pipeline.

## Application Routes (Sitemap)

### Main Navigation
- `/` - **Index**: Dashboard overview.
- `/terminal` - **Expert Terminal**: High-performance execution interface.
- `/charting` - **AetherAI Charting**: AI-enhanced technical analysis.
- `/risk` - **Risk Management**: Portfolio-level risk controls.
- `/scanner` - **Market Scanner**: Real-time signal detection.
- `/portfolio` - **Portfolio**: Holdings and live PnL.
- `/journal` - **Trade Journal**: Historical performance audit.
- `/infrastructure` - **Infrastructure**: System health and service status.
- `/alerts` - **Alerts**: Notification management.
- `/brokers` - **Broker Registry**: Connectivity and account management.

### OpenAlgo Suite (Nested `/openalgo/*`)
- `/openalgo` - **Hub**: Central command for OpenAlgo tools.
- `/openalgo/orders` - **Order Book**: Real-time order tracking.
- `/openalgo/trades` - **Trade Book**: Confirmed executions.
- `/openalgo/positions` - **Positions**: Net open positions.
- `/openalgo/holdings` - **Holdings**: Equity inventory.
- `/openalgo/logs` - **System Logs**: Backend telemetry.
- `/openalgo/connectivity` - **Connectivity**: Bridge status.
- `/openalgo/action-center` - **Action Center**: Incident response and risk overrides.
- `/openalgo/analyzer` - **Analyzer**: Post-trade analytics.
- `/openalgo/health` - **Health Monitor**: Real-time performance metrics.

### Advanced Analytics
- `/openalgo/gex` - **GEX Dashboard**: Gamma Exposure analysis.
- `/openalgo/option-chain` - **Option Chain**: Interactive volatility surface.
- `/openalgo/oi-profile` - **OI Profile**: Open Interest distribution.
- `/openalgo/oi-tracker` - **OI Tracker**: Intraday OI shifts.
- `/openalgo/max-pain` - **Max Pain**: Expiry-based price magnet analysis.
- `/openalgo/vol-surface` - **Volatility Surface**: 3D IV visualization.
- `/openalgo/iv-smile` - **IV Smile**: Skew analysis.
- `/openalgo/straddle-lab` - **Straddle Lab**: Multi-leg strategy builder.
- `/openalgo/historify` - **Historify**: Tick-to-candle historical data miner.

### Infrastructure & System
- `/auth` - **Authentication**: Secure login gateway.
- `/forgot-password` - **Recovery**: Password reset flow.
- `/openalgo/sandbox` - **Sandbox Config**: Paper trading settings.
- `/openalgo/playground` - **Playground**: Component testing lab.

## GitHub Repos
- [Unified Hub](https://github.com/Icamtu/algo-trader)
- [OpenAlgo Base](https://github.com/Icamtu/openalgo-web)
