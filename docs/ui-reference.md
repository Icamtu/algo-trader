# AlgoDesk — UI Desk Reference

## Navigation Structure

The platform uses a two-tier navigation:
1. **Global Header** — always visible, contains engine toggle, trading mode, panic kill-switch, AI core status, market tickers, broker status, strategy selector, script groups, capital metrics.
2. **MarketNavbar** — tab bar below header with 9 top-level sections + AI Charts (10 total after 3.9).

---

## Page Reference

### 1. Trading Desk (`/`)

**Purpose**: Primary operator interface for live trading sessions.

**Component Hierarchy**:
```
Index.tsx
├── GlobalHeader
├── MarketNavbar (activeTab="/")
├── View Switcher: "Execution Station" | "Safety Console"
│
├── [Execution Station]
│   ├── StrategySidebar (left, 240px)
│   │   └── Strategy list with active/paused status
│   ├── Main Area
│   │   ├── BacktestCanvas (chart + order entry area)
│   │   └── AnalyticsPanel (metrics strip)
│   ├── LiveBlotter (bottom, trade feed)
│   └── RightPanel (performance sidebar)
│
├── [Safety Console]
│   ├── StrategySidebar
│   ├── RiskDashboard (center, full risk controls)
│   └── RightPanel
│
├── AICopilotOrb (floating bottom-right)
└── NewOrderModal (dialog, triggered by trade clicks)
```

**API Dependencies**:
| Component | Endpoint | Interval |
|-----------|----------|----------|
| StrategySidebar | `GET /api/strategies` | 10s |
| LiveBlotter | `GET /api/orders` | 5s |
| RiskDashboard | `GET /api/risk/status` | 5s |
| RightPanel | `GET /api/pnl`, `GET /api/risk-metrics` | 5s |
| NewOrderModal | `POST /api/terminal/command` | on-submit |

**Status**: ✅ Functional (with mock market tickers, real API integration for orders/strategies)

---

### 2. Strategy Lab (`/strategy-lab`)

**Purpose**: Strategy comparison, backtesting, and equity analysis.

**Component Hierarchy**:
```
StrategyLab.tsx
├── GlobalHeader
├── MarketNavbar (activeTab="/strategy-lab")
├── Sub-tabs: Compare | Equity Curve | Monthly Returns | Analyzer | Editor* | Backtest* | Universe*
│
├── [Compare] — Strategy comparison matrix table
├── [Equity Curve] — Multi-strategy equity chart (recharts)
├── [Monthly Returns] — Heatmap grid of monthly returns
├── [Analyzer] — IndicatorAnalyzer component (technical indicator testing)
├── [Editor]* — Monaco code editor (Task 3.5, new)
├── [Backtest]* — Relocated from Trading Desk (Task 3.7, new)
└── [Universe]* — Stock universe selector per strategy (Task 3.11, new)
```

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Compare tab | Mock data (no API) |
| Analyzer | `GET /api/history`, `POST /api/indicators` |
| Editor | `GET /api/strategies`, `GET /api/strategies/{id}/source`, `PUT /api/strategies/{id}/source` |
| Backtest | `POST /api/backtest/run`, `POST /api/backtest/optimize` |
| Universe | `GET /api/strategies/{id}/universe`, `PUT /api/strategies/{id}/universe`, `GET /api/instruments?q=` |

**Status**: ⚠️ Partially functional — Compare/Equity/Monthly are mock; Analyzer is real

---

### 3. Risk Dashboard (`/risk`)

**Purpose**: Dedicated risk monitoring with limit controls.

**Component Hierarchy**:
```
Risk.tsx
├── GlobalHeader
├── MarketNavbar (activeTab="/risk")
├── RiskDashboard (center)
│   ├── Risk meters (daily trades, loss, positions, notional)
│   ├── Sector allocation pie chart
│   └── Risk limit editor with save button
└── RightPanel
```

**API Dependencies**:
| Component | Endpoint | Interval |
|-----------|----------|----------|
| RiskDashboard | `GET /api/risk/status` | 5s |
| Limit editor | `PUT /api/risk/limits` | on-save |

**Status**: ✅ Functional (hangs when backend down — fixed in 3.3)

**API Contract — `GET /api/risk/status`**:
```json
{
  "daily_trades": 12,
  "max_daily_trades": 200,
  "daily_realised_loss": -1200.50,
  "max_daily_loss": 50000,
  "open_positions": 3,
  "max_open_positions": 5,
  "max_order_quantity": 1000,
  "max_order_notional": 500000,
  "max_position_qty": 5000,
  "daily_loss_pct": 2.4
}
```

---

### 4. Market Scanner (`/scanner`)

**Purpose**: Index-wide stock screening with AI-powered analysis.

**Component Hierarchy**:
```
MarketScanner.tsx
├── GlobalHeader
├── MarketNavbar (activeTab="/scanner")
├── Intelligence Settings panel (decision mode, LLM model, provider, agent toggle)
├── Index selector + Run Discovery button
├── Results table (symbol, price, change, score, RSI)
├── AI Analysis panel (conviction scores, reasoning)
└── RightPanel
```

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Index selector | `GET /api/scanner/indices` |
| Scanner | `POST /api/scanner/run` |
| AI Analysis | `POST /api/scanner/analyze` |
| Settings | `GET/PUT /api/system/settings` |

**Status**: ✅ Functional (requires backend + AI gateway)

---

### 5. Portfolio (`/portfolio`)

**Purpose**: Position overview, allocation visualization, PnL tracking.

**Component Hierarchy**:
```
Portfolio.tsx
├── GlobalHeader
├── MarketNavbar (activeTab="/portfolio")
├── Sub-tabs: Overview | Allocation | Performance
├── [Overview] — Position table + metrics cards
├── [Allocation] — Pie chart by symbol
├── [Performance] — Bar chart of returns
└── RightPanel
```

**API Dependencies**:
| Component | Endpoint | Interval |
|-----------|----------|----------|
| Positions | `GET /api/positions` | 5s (via usePositions) |
| Funds | `GET /api/funds` | 30s (via useFunds) |
| PnL | `GET /api/pnl` | on-mount |

**Status**: ✅ Functional

---

### 6. Trade Journal (`/journal`)

**Purpose**: Historical trade log with statistics.

**Sub-tabs**: Log | Statistics

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Trade log | `GET /api/orders` |
| Export | `GET /api/trades/export` (CSV download) |

**Status**: ✅ Functional (empty state when no trades)

---

### 7. Expert Terminal (`/terminal`)

**Purpose**: Institutional-grade derivatives command surface.

**Components**: Option Matrix, Command Bar (⌘K), Market Breath Radar, Kill Switch.

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Option Matrix | `GET /api/options/chain?symbol=&expiry=` |
| Command Bar | `POST /api/terminal/command` |
| Kill Switch | `POST /api/system/panic` |

**Status**: ✅ Functional (mock Greeks via Black-Scholes engine)

---

### 8. Infrastructure (`/infrastructure`)

**Purpose**: System health monitoring and diagnostics.

**Sub-tabs**: System Status | API Health* (Task 3.6, new)

**API Dependencies**:
| Component | Endpoint | Interval |
|-----------|----------|----------|
| Status cards | `GET /api/system/status` | 10s |
| API Health | Direct HEAD/GET to each service | 10s |

**Status**: ⚠️ Shows "Establishing Signal Link..." when backend unreachable (fixed in 3.3)

---

### 9. Alerts (`/alerts`)

**Purpose**: Alert creation and feed management.

**Sub-tabs**: Feed | Create

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Feed | `GET /api/alerts` |
| Create | `POST /api/alerts` |
| Delete | `DELETE /api/alerts/{id}` |

**Status**: ✅ Functional

---

### 10. AI Charts (`/charting`) — NEW (Task 3.9)

**Purpose**: AI-assisted charting with natural language annotation.

**API Dependencies**:
| Component | Endpoint |
|-----------|----------|
| Chart data | `GET /api/history` |
| AI Annotation | `POST /api/ai/chart-annotate` |

---

## Global Components

### GlobalHeader
Controls: Engine toggle, Trading Mode (sandbox/live), PANIC kill-switch, AI Core status, market tickers (simulated), strategy switcher, script groups button, broker connectivity, capital/PnL metrics, user actions.

### MarketNavbar
10 tabs: Trading Desk, Strategy Lab, Risk Dashboard, Market Scanner, Portfolio, Trade Journal, Expert Terminal, AI Charts, Infrastructure, Alerts.

### RightPanel
Performance sidebar: Net Equity, Day P&L, Max DD, Win Rate, Risk Score, Exposure, Equity Trail chart, Drawdown chart, Weekly Heatmap.

### AICopilotOrb
Floating chat assistant (bottom-right). Currently mock responses, planned OpenClaw integration.

---

## API Contract Summary

All endpoints are prefixed with `http://localhost:5001`.

### Strategies
- `GET /api/strategies` → `{ strategies: Strategy[], count: number }`
- `GET /api/strategies/{id}` → `Strategy`
- `POST /api/strategies/{id}/start` → `{ message, is_active }`
- `POST /api/strategies/{id}/stop` → `{ message, is_active }`
- `PUT /api/strategies/{id}/params` → `{ message, updated: string[] }`

### Orders & Positions
- `GET /api/orders?limit=&symbol=&strategy=` → `{ trades: Trade[], count, mode }`
- `GET /api/positions` → `{ positions: Position[], count, total_value }`
- `POST /api/terminal/command` → `{ status, message, result }`
- `POST /api/orders/cancel-all` → result
- `POST /api/orders/{id}/cancel` → result
- `GET /api/orders/{id}/status` → status

### Risk
- `GET /api/risk/status` → `RiskStatus`
- `PUT /api/risk/limits` → `{ status, message, new_limits }`
- `GET /api/risk-metrics` → `RiskMetrics`

### System
- `GET /api/system/status` → `SystemHealth` (6 services)
- `GET /api/system/settings` → `SystemSettings`
- `PUT /api/system/settings` → `{ status, message }`
- `GET /api/system/mode` → `{ mode }`
- `POST /api/system/mode` → `{ status, mode }`
- `POST /api/system/panic` → `{ status, message, details }`

### Market Data
- `GET /api/history?symbol=&exchange=&interval=&start_date=` → candle data
- `GET /api/quotes?symbols=X,Y` → quote data
- `POST /api/indicators` → `{ symbol, results }`
- `GET /api/options/chain?symbol=&expiry=` → `OptionChainResponse`

### Scanner
- `GET /api/scanner/indices` → `{ indices: string[] }`
- `POST /api/scanner/run` → `{ results: ScanResult[] }`
- `POST /api/scanner/analyze` → `{ results: analyzed[] }`

### Backtesting
- `POST /api/backtest/run` → backtest result
- `POST /api/backtest/optimize` → `{ best_params, best_pnl, top_runs }`
- `GET /api/backtests` → `Trade[]`

### Alerts
- `GET /api/alerts` → `{ alerts: Alert[], count }`
- `POST /api/alerts` → `{ status, id, message }`
- `DELETE /api/alerts/{id}` → `{ status, message }`

### Other
- `GET /api/funds` → `FundsResponse`
- `GET /api/pnl` → `PnlResponse`
- `GET /api/symbols/search?q=` → `{ results: [{symbol, exchange}] }`
- `GET /api/trades/export` → CSV file download
