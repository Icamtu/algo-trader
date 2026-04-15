# AetherDesk Gap Closure — Completed Changes

## Date: 2026-04-06

### Backend Changes (algo-trader)

#### `database/trade_logger.py`
- Added `alerts` table to SQLite schema (type, symbol, condition, value, channel, is_active, message, created_at)
- Added `create_alert()` — inserts alert, returns ID
- Added `get_alerts(active_only=False)` — fetches all or active-only alerts
- Added `delete_alert(alert_id)` — deletes by ID, returns success boolean

#### `api.py` — 4 new routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/alerts` | GET | List all alerts from DB |
| `/api/alerts` | POST | Create new alert (validates type, symbol, condition, value) |
| `/api/alerts/<id>` | DELETE | Delete alert by ID (404 if not found) |
| `/api/trades/export` | GET | Download trades as CSV (mode-filtered, Content-Disposition header) |

### Frontend Changes (trading-ui)

#### `src/lib/api-client.ts`
- Added `getAlerts()`, `createAlert()`, `deleteAlert()` wrappers
- Added `exportTradesUrl()` for CSV download link

#### `src/components/trading/BacktestCanvas.tsx` — Run Backtest wired
- Button now: fetches history via `GET /api/history` → passes to `POST /api/backtest/run`
- Shows loading spinner during execution, disables button (prevents double-click)
- Toast on success/failure, auto-refreshes results table

#### `src/pages/Alerts.tsx` — Full rewrite for persistence
- Replaced `useState(initialAlerts)` with `useEffect` → `GET /api/alerts`
- Create alert → `POST /api/alerts` → refreshes from backend
- Delete alert → `DELETE /api/alerts/:id`
- Added loading skeleton, empty state, relative time formatting
- Read state tracked client-side via `Set<number>` (not critical to persist)

#### `src/pages/TradeJournal.tsx` — Export Ledger wired
- Button now calls `window.open(algoApi.exportTradesUrl(), "_blank")` → triggers CSV download

#### `src/components/trading/RiskDashboard.tsx` — Cancel All Orders
- New "Cancel All Orders" button in the Safety Alerts section
- Calls `POST /api/orders/cancel-all` with `window.confirm()` guard
- Toast feedback on success/error

#### `src/components/trading/NewOrderModal.tsx` — Symbol Autocomplete
- Added debounced search (300ms) via `GET /api/symbols/search?q=X`
- Dropdown appears below input with symbol + exchange
- Clicking suggestion populates the symbol field

### Verification
- `tsc --noEmit --skipLibCheck` → 0 errors
- `python3 py_compile` → 0 syntax errors on api.py and trade_logger.py

### OpenAlgo Backend Functions Already Available (used directly)
- `POST /api/backtest/run` — existed, just needed frontend button onClick
- `POST /api/orders/cancel-all` — existed, just needed UI button
- `GET /api/symbols/search` — existed, just needed autocomplete wiring
- `POST /api/strategies/:id/start|stop` — existed (sidebar wiring deferred to next session)
- `POST /api/backtest/optimize` — existed (optimizer UI deferred to next session)
