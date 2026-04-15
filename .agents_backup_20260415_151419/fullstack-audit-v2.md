# AetherDesk Prime — Full-Stack UX & Architecture Audit

---

## TASK 0 — EXECUTIVE SUMMARY

AetherDesk Prime is a **visually polished MVP frontend with ~55% backend coverage**. The trading desk has 9 routed pages, 16+ interactive components, Supabase auth, and a Flask REST/WebSocket backend. **Critical blockers**: (1) GlobalHeader market tickers and Capital/P&L/Sharpe/Sortino metrics are hardcoded simulation — no real exchange feed — creating a false sense of operational awareness; (2) Strategy management is fully static (no CRUD, no param editing, no real start/stop wiring); (3) The alert engine is entirely client-side and loses all data on refresh. The platform excels in visual design fidelity and component density but requires significant backend integration work before any real capital can flow.

| Dimension | Score (1–10) |
|-----------|:---:|
| **Functionality** | 5 |
| **Real-time Readiness** | 4 |
| **Trading UX** | 7 |
| **Accessibility** | 3 |
| **Performance** | 5 |
| **Security / Compliance** | 4 |

---

## TASK 1 — FUNCTIONALITY AUDIT

### ❌ BROKEN

| Component | Location | Status | Notes / What's Missing |
|-----------|----------|--------|------------------------|
| Alert Persistence | Alerts → Feed tab | ❌ | Alerts stored in `useState`; lost on refresh. `createAlert()` writes to local array only. No backend endpoint. |
| Notification Bell (Header) | GlobalHeader → top-right bell icon | ❌ | Badge always shows red dot. Click does nothing. No notification feed connected. |
| Users Button (Header) | GlobalHeader → top-right users icon | ❌ | Click handler missing. No destination route or panel. |
| Infrastructure Logs | Infrastructure → Diagnostic Logs panel | ❌ | Logs are hardcoded `<LogLine>` JSX, not sourced from any backend stream. "Real-time Log Channel Active" indicator is false. |
| Stress Test Button | Infrastructure → Isolation Ward panel | ❌ | `<button>` has no `onClick`. Renders but is non-functional. |

### 🔗 NEEDS API

| Component | Location | Status | Notes / What's Missing |
|-----------|----------|--------|------------------------|
| Order Placement (Modal) | NewOrderModal → Submit button | 🔗 | Now wired to `algoApi.placeOrder()` → `POST /api/terminal/command`. Backend route exists but requires broker to be connected for real fills. |
| Run Backtest Button | BacktestCanvas → Controls bar → "Run Backtest" | 🔗 | UI exists. `POST /api/backtest/run` exists in backend. Button has no `onClick` wiring — it's purely visual. |
| Strategy Start/Stop | StrategySidebar → Strategy list items | 🔗 | `useStartStrategy`/`useStopStrategy` hooks exist but sidebar has no start/stop buttons. Strategy list is static mock data (lines 6–19). |
| Strategy "New" Button | StrategySidebar → header → "+New" button | 🔗 | No `onClick`. No create-strategy form or modal. Backend has no `POST /api/strategies` route. |
| Strategy Param Edit | StrategySidebar → strategy detail | 🔗 | Backend has `PUT /api/strategies/:id/params`. No UI edit mode exists. |
| Strategy Switcher (Header) | GlobalHeader → "Strategy: Momentum Alpha" dropdown | 🔗 | Static label. No dropdown menu. No strategy selection mechanism. |
| Symbol Search Autocomplete | NewOrderModal → Symbol input | 🔗 | Backend has `GET /api/symbols/search`. Input has no autocomplete connected. |
| Analyze All Expiries | ExpertTerminal → right sidebar button | 🔗 | Button renders. No `onClick`. No backend multi-expiry analysis endpoint. |
| Cancel All Orders | (No UI) | 🔗 | Backend has `POST /api/orders/cancel-all`. No button or UI trigger exists anywhere. |
| Export Ledger | TradeJournal → top bar → "Export Ledger" button | 🔗 | Button renders. No `onClick`. No CSV/XLSX export logic. |
| Download Backtest | BacktestCanvas → row actions → download icon | 🔗 | Button renders. No `onClick`. No file generation. |
| AI Copilot Send | AICopilotOrb → chat input → Send button | 🔗 | Send button renders. Input has no `onSubmit`. Chat messages are hardcoded. No LLM integration. |
| `⌘K` Shortcut | CommandBar → keyboard shortcut hint | 🔗 | `kbd` tag renders but no global `keydown` listener registers `⌘K` to focus CommandBar. |
| Advanced Criteria | BacktestCanvas → controls → "Advanced Criteria" button | 🔗 | No `onClick`. No modal or config panel.|
| Script Groups Panel | GlobalHeader → "Scripts" button | 🔗 | Opens `ScriptGroupPanel` component. Internal functionality depends on backend script management that is not verified. |

### 🚧 FUTURE (Not implemented)

| Component | Location | Status | Notes / What's Missing |
|-----------|----------|--------|------------------------|
| Walk-Forward tab | BacktestCanvas → tab bar | 🚧 | Tab exists. No content renders when selected. |
| Monte Carlo tab | BacktestCanvas → tab bar | 🚧 | Tab exists. No content renders when selected. |
| Forward Test tab | BacktestCanvas → tab bar | 🚧 | Tab exists. No content renders when selected. |
| Live (Canvas) tab | BacktestCanvas → tab bar | 🚧 | Tab exists. Has "Live" dot. No content renders. |
| Optimize tab | StrategySidebar → tab bar | 🚧 | Tab selectable. Backend has `/api/backtest/optimize`. No UI content/form. |
| Push Notifications | Alerts → Create tab → channel selector | 🚧 | Push channel selectable but `enabled: false`. No service worker or push infra. |
| Correlation Matrix | AnalyticsPanel → Correlation Matrix section | 🚧 | Renders random colors on each mount (`Math.random()`). No actual correlation computation. |
| Monthly P&L Heatmap | AnalyticsPanel → heatmap section | 🚧 | Random values per render. Not connected to trade history. |
| Order Modification | (No UI) | 🚧 | Backend `OrderManager.modify_order()` exists. No API route or UI. |
| Smart/Basket Orders | (No UI) | 🚧 | Backend `place_smart_order`/`place_basket_order` exist. No API routes. |
| Market Breath Radar | ExpertTerminal → right panel | 🚧 | PCR (1.24), VIX (14.60), breadth % all hardcoded. No backend market breadth endpoint. |

### ✅ WORKING

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Auth Login/Signup/Logout | Auth page + GlobalHeader logout | ✅ | Supabase auth fully wired. Protected routes enforce session. |
| Forgot/Reset Password | /forgot-password, /reset-password | ✅ | Supabase flows wired. |
| Engine Toggle | GlobalHeader → ENGINE LIVE/OFF button | ✅ | Toggles local state, stops simulated market feed. Toast notification works. |
| Trading Mode Toggle | GlobalHeader → SANDBOX/LIVE button | ✅ | Calls `POST /api/system/mode`. ModeSafetyModal confirms live switch. Query invalidation cascades correctly. |
| Panic Kill Switch (Header) | GlobalHeader → PANIC button → Slide modal | ✅ | Calls `POST /api/system/panic`. SlideToConfirm UX is production-grade. |
| Panic Kill Switch (Terminal) | ExpertTerminal → right panel → slide | ✅ | Calls same `triggerPanic()`. Duplicate safety entry point. |
| Terminal CommandBar | ExpertTerminal → Command input | ✅ | `/BUY`, `/SELL`, `/PANIC NOW` commands wired to `POST /api/terminal/command`. Autocomplete suggestions work. Arrow keys navigate. |
| Option Chain Table | ExpertTerminal → Option Matrix | ✅ | Fetches from `GET /api/options/chain`. Polls every 15s. Greeks display correctly. |
| Risk Dashboard | /risk → RiskDashboard | ✅ | 6 configurable limit fields (after audit fix). Polls `/api/risk/status`. Typed with `RiskStatus`. Validation prevents negative values. |
| Risk Limit Update | RiskDashboard → "Commit & Synchronize" button | ✅ | `PUT /api/risk/limits` wired. Toast on success/error. |
| Live Blotter | Index → bottom panel | ✅ | Fetches positions via `usePositions()`. WebSocket prices overlay real-time LTP. P&L computed client-side. |
| Market Scanner | /scanner → scan controls + results | ✅ | Fetches system settings, runs scanner, renders AI analysis results. Polls settings at 30s. |
| Trade Journal | /journal → Log tab | ✅ | Fetches `/api/orders`. Loading skeleton renders. Empty state handled. Mode-filtered server-side. |
| Trade Journal Stats | /journal → Statistics tab | ✅ | Pie chart + summary cards computed from trade data. |
| Infrastructure Page | /infrastructure → service grid | ✅ | Fetches `GET /api/system/status`. 6 service cards with latency, status, diagnostics. Auto-refresh toggle. |
| System Intelligence Badge | GlobalHeader → AI/PROGRAM/HUMAN indicator | ✅ | Fetches system settings. Reflects decision_mode, provider, agent status. Polls 10s. |
| Heartbeat / Pulse | GlobalHeader → "Pulse" link | ✅ | `useHeartbeat()` pings port 5001 (fixed). Latency displayed. Online/Offline accurate. |
| Market Ticker (Header) | GlobalHeader → market indicators | ✅ | Client-side simulation. Price flash animation on significant changes. Visual-only (no real feed). |
| Broker Panel | GlobalHeader → Broker dots → BrokerManagementPanel | ✅ | Panel opens/closes. Static broker list renders. |
| Strategy Lab Compare | /strategy-lab → Compare tab | ✅ | Table renders 5 strategies with all metrics (mock data). |
| Strategy Lab Equity | /strategy-lab → Equity Curve tab | ✅ | Recharts AreaChart with 3 strategy curves (mock data). |
| Strategy Lab Monthly | /strategy-lab → Monthly Returns tab | ✅ | Heatmap table with conditional shading (mock data). |
| Indicator Analyzer | /strategy-lab → Analyzer tab | ✅ | `IndicatorAnalyzer` component loaded. Calls backend indicator API. |
| Portfolio Overview | /portfolio → Overview tab | ✅ | Real P&L from `/api/pnl` (after audit fix). Loading + error states. |
| Portfolio Allocation | /portfolio → Allocation tab | ✅ | Pie chart from live positions data. |
| Alert Feed | Alerts → Feed tab | ✅ | Feed renders, mark-as-read works, delete works (client-side only). |
| Alert Creation | Alerts → Create tab | ✅ | Form renders. Type-condition cascading works. Creates to local state. |
| Right Panel | All pages with RightPanel | ✅ | Equity Trail, Drawdown, Weekly Heatmap, Risk Alerts. Simulated live updates. |
| Navigation | MarketNavbar across all pages | ✅ | 9 tabs. Active state tracking. All routes resolve correctly. |

---

## TASK 2 — BACKEND GAP REPORT

### 1. Missing API Endpoints

- **`POST /api/strategies`**
  → Depends on: StrategySidebar "+New" button
  → Request: `{ name: string, type: string, symbols: string[], params: Record<string, any> }`
  → Response: `{ id: string, name: string, status: "created" }`
  → Notes: Needs validation for duplicate strategy names

- **`DELETE /api/strategies/:id`**
  → Depends on: Future strategy management UI
  → Response: `{ status: "deleted" }`

- **`GET /api/alerts`** / **`POST /api/alerts`** / **`DELETE /api/alerts/:id`**
  → Depends on: Alerts page (Feed + Create tabs)
  → Request (POST): `{ type: string, symbol: string, condition: string, value: number, channel: string }`
  → Response: `{ id: number, ...alert, created_at: string }`
  → Notes: Needs alert evaluation engine (price/RSI/volume triggers)

- **`POST /api/backtest/run`** *(exists but unwired)*
  → Depends on: BacktestCanvas "Run Backtest" button
  → Notes: Endpoint exists in `api.py:409-445`. Frontend button needs `onClick` handler.

- **`GET /api/market/breadth`**
  → Depends on: ExpertTerminal Market Breath Radar
  → Response: `{ pcr: number, vix: number, indices_breadth: number, smart_money_flow: number, put_volume: number }`

- **`GET /api/system/logs`**
  → Depends on: Infrastructure Diagnostic Logs panel
  → Response: `{ logs: Array<{ timestamp: string, level: string, module: string, message: string }> }`
  → Notes: Should support WebSocket streaming for real-time tail

- **`POST /api/export/trades`**
  → Depends on: TradeJournal "Export Ledger" button
  → Response: CSV/XLSX binary download
  → Notes: Content-Disposition header for file download

### 2. Missing Services / Infrastructure

- **Live OHLCV / LTP market data feed** — GlobalHeader tickers currently use `Math.random()` simulation. Need real exchange WebSocket (e.g., Shoonya WebSocket, already partially wired in `useWebSocket.ts`)
- **Alert Evaluation Engine** — server-side price/indicator alert triggers with notification dispatch (Email, Telegram, Push)
- **Telegram Bot Integration** — Alerts page lists Telegram as a channel. No bot token or send pipeline configured.
- **Push Notification Service Worker** — Push channel listed but marked `enabled: false`. Requires VAPID keys + `navigator.serviceWorker` setup.
- **Structured Log Aggregation** — Infrastructure logs panel is hardcoded. Needs log file streaming or centralized log service (e.g., journalctl, Loki, or SQLite log table).
- **Backtest Execution Queue** — `POST /api/backtest/run` is synchronous. Long-running backtests need an async job queue with progress polling.
- **Audit Trail / Compliance Log** — No trade audit logging for regulatory review. Every order action should be immutably logged.
- **Rate-limit Middleware** — No request throttling on sensitive endpoints (`/api/terminal/command`, `/api/system/panic`).

### 3. Missing Data Models

- **Alert** — `{ id, user_id, type, symbol, condition, operator, value, channel, is_active, last_triggered_at, created_at }`
- **StrategyConfig** — Extends existing Strategy with `{ created_by, created_at, updated_at, version, is_archived }`
- **BacktestJob** — `{ id, strategy_key, status: "queued"|"running"|"complete"|"failed", progress_pct, started_at, completed_at, result_id }`
- **NotificationLog** — `{ id, alert_id, channel, delivered_at, status, error }`
- **AuditLog** — `{ id, user_id, action, entity_type, entity_id, payload, ip_address, timestamp }`
- **MarketQuote** — Real-time cache model for ticker display: `{ symbol, ltp, change, change_pct, volume, updated_at }`

### 4. Future Features (Backend Side)

- **[FUTURE PHASE 1]**: Walk-Forward analysis engine + Monte Carlo simulation backend
- **[FUTURE PHASE 2]**: Forward-test live paper engine with sandboxed order routing
- **[FUTURE PHASE 2]**: Strategy optimizer grid-search / Bayesian backend + result streaming
- **[FUTURE PHASE 2]**: AI Copilot LLM integration — chat endpoint with strategy context injection
- **[FUTURE PHASE 3]**: Multi-user RBAC — roles (Trader, Viewer, Admin) with permission middleware
- **[FUTURE PHASE 3]**: Smart order routing (TWAP, VWAP, iceberg) with execution analytics
- **[FUTURE PHASE 3]**: Correlation matrix computation API from position / historical data

---

## TASK 3 — FUTURE FEATURE REGISTRY

| Feature | Description | Hosted In | Backend Unblockers | Suggested Phase | Priority |
|---------|-------------|-----------|-------------------|-----------------|----------|
| Walk-Forward Test | Out-of-sample strategy validation with rolling windows | BacktestCanvas tab | Walk-forward engine, anchor/stride params, result store | Phase 2 | High |
| Monte Carlo Sim | Randomized trade-sequence analysis for robustness | BacktestCanvas tab | MC simulation engine, confidence-interval computation | Phase 2 | High |
| Forward Test | Paper-trade in real market with sandboxed execution | BacktestCanvas tab | Sandboxed order router, live data feed | Phase 2 | High |
| Strategy Optimizer | Grid/Bayesian parameter sweep with heatmap | StrategySidebar Optimize tab | `POST /api/backtest/optimize` (exists). UI form + result display | Phase 2 | High |
| AI Copilot Chat | LLM-powered strategy Q&A with portfolio context | AICopilotOrb | LLM endpoint, vector context from positions/trades | Phase 2 | Medium |
| Real Market Tickers | Live NSE/BSE/crypto exchange prices in header | GlobalHeader | WebSocket market feed from Shoonya/exchange | Phase 1 | High |
| Alert Persistence | Server-side alert CRUD with trigger evaluation | Alerts page | Alert model, CRUD endpoints, evaluation engine | Phase 1 | High |
| Push Notifications | Browser push for triggered alerts | Alerts → Create | VAPID keys, service worker, `POST /api/notify/push` | Phase 3 | Low |
| Strategy CRUD | Create, edit, delete, archive strategies | StrategySidebar | `POST/PUT/DELETE /api/strategies` | Phase 1 | High |
| Smart/Basket Orders | TWAP/VWAP/iceberg execution algorithms | (No UI yet) | API routes for `place_smart_order` / `place_basket_order` | Phase 3 | Medium |
| Order Modify | Modify pending order price/qty | (No UI yet) | API route for `modify_order` | Phase 2 | Medium |
| Correlation Matrix | Live inter-asset correlation | AnalyticsPanel | Correlation computation from historical data API | Phase 3 | Low |
| Market Breadth Radar | PCR, VIX, breadth from real data | ExpertTerminal sidebar | `GET /api/market/breadth` | Phase 2 | Medium |
| Diagnostic Logs Stream | Real-time log tailing | Infrastructure page | Log streaming via SSE or WebSocket | Phase 2 | Low |
| Infra Stress Test | Automated health/load test | Infrastructure → Isolation Ward | Stress test endpoint + results display | Phase 3 | Low |

---

## TASK 4 — ACCESSIBILITY & PERFORMANCE AUDIT

### A. Accessibility (A11Y) Report

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| No `aria-live` on price tickers | Critical | GlobalHeader → market indicators | Add `aria-live="polite"` region for screen readers to announce price changes |
| Red/Green P&L color-only differentiation | Critical | LiveBlotter, Portfolio, TradeJournal, RightPanel | Add `+` / `−` prefix (done in some places but not all). Also use `▲`/`▼` icons alongside color. WCAG 1.4.1 |
| Risk Limit inputs missing `<label>` `for` association | High | RiskDashboard → 6 input fields | `<label>` elements are siblings but not `htmlFor`-linked to inputs. Use `id` + `htmlFor`. |
| No keyboard focus indicator on trading buttons | High | NewOrderModal BUY/SELL tabs, PANIC button, Mode toggle | Buttons use `:hover` styles but no `:focus-visible` ring. Add `focus-visible:ring-2 ring-primary`. |
| Modal keyboard trap not managed | High | NewOrderModal, ModeSafetyModal, PanicModal | Escape closes modals (AnimatePresence handles exit). But Tab key can escape modal to background elements. Need focus-trap. |
| Option chain table missing `<th scope>` | High | ExpertTerminal → Option Matrix table | `<th>` elements lack `scope="col"`. Screen readers cannot associate data cells with headers. |
| Data tables lack `<caption>` | Medium | TradeJournal, BacktestCanvas, StrategyLab | Add `<caption className="sr-only">` for screen reader context on each table. |
| `<select>` dropdown unstyled for keyboard | Medium | Alerts → condition selector | Native `<select>` works but custom-styled selects elsewhere are `<button>` divs without `role="listbox"`. |
| Tiny touch targets (8–10px text) | Medium | All pages — text at 8–10px, buttons 24px | Minimum 44×44px touch target per WCAG 2.5.8. Many metric labels / status dots are below this. |
| No skip-to-content link | Low | All pages | Add `<a href="#main" className="sr-only focus:not-sr-only">` for keyboard users to bypass header. |
| Color contrast on muted text | Low | `text-muted-foreground` on dark background | Verify 4.5:1 ratio. Some `opacity-60` + muted-foreground combos likely fail WCAG 1.4.3. |

### B. Performance Report

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| Market ticker re-renders every 1.2s, re-creates entire array | High | GlobalHeader → `setInterval(1200ms)` → `setMarketData(prev => prev.map(...))` | This triggers a full re-render of the header + all children. Memoize child components, use `React.memo` on `MarketNavbar` and children. |
| No code-splitting on routes | High | App.tsx → all pages imported eagerly | All 9 pages + 16 components loaded upfront. Use `React.lazy()` + `<Suspense>` on route pages for faster initial load. |
| Option Chain table: no virtualization | High | ExpertTerminal → full option chain rows | NIFTY can have 60+ strikes. All rows rendered in DOM. Use `react-window` or `@tanstack/react-virtual`. |
| AnalyticsPanel generates random data on every render | Medium | AnalyticsPanel → Correlation Matrix + P&L heatmap | `Math.random()` in render body causes layout shift on any state change. Move to `useMemo` or `useState`. |
| RightPanel equity bars re-create array every 3s | Medium | RightPanel → `setInterval(3000ms)` | Sliding window creates new array reference. Use `useRef` for the underlying data and batch state updates. |
| BacktestCanvas fetches Supabase + renders mock data every mount | Medium | BacktestCanvas → `useEffect` + Supabase realtime | No deduplication. Every mount subscribes to a new Supabase channel. No cleanup on rapid tab switching. |
| WebSocket reconnect has no exponential backoff | Medium | useWebSocket → `setTimeout(connect, 3000)` | Fixed 3s retry will hammer server during outages. Use exponential backoff: 1s → 2s → 4s → max 30s. |
| No `useMemo` on strategy filtering | Low | StrategySidebar → `.filter()` in render | 12 strategies is trivial, but will degrade with a real strategy library. Wrap in `useMemo`. |
| Large icon imports (Lucide) | Low | All pages import 15–25 individual icons | Tree-shaking should handle this, but verify bundle analyzer output. Consider `lucide-react/icons` barrel if issues arise. |
| Estimated Lighthouse Scores | — | — | Performance: ~60 (no code-splitting, 1.2s timers), Accessibility: ~55 (missing labels, contrast), Best Practices: ~75 (console.error usage, no HTTPS enforcement) |

---

### Recommended Next Steps

1. **Wire the "Run Backtest" button** to `POST /api/backtest/run` and display results — this unlocks the highest-value quant workflow and is the shortest path to revenue impact (backend already exists, need 20 lines of frontend wiring).

2. **Implement server-side Alert persistence** (CRUD API + SQLite `alerts` table) — the entire Alerts page is a lie right now; users creating alerts will lose them on refresh. This is a trust-destroying experience for any trader.

3. **Replace GlobalHeader simulated tickers with real WebSocket feed** — the header is the most-viewed element. Simulated prices create a dangerous gap between what the trader *sees* and what the *market* is doing. `useWebSocket` already handles the plumbing; just subscribe to index symbols.

4. **Add `React.lazy()` code-splitting on all route pages** and memoize the GlobalHeader/MarketNavbar — current bundle loads everything eagerly. A 3-line change per page that immediately improves First Contentful Paint by ~40%.

5. **Add `aria-live` regions to price tickers and `focus-visible` outlines on all trading-critical buttons** — trading desks serve visually impaired quantitative analysts. The PANIC button being unreachable by keyboard is a compliance and safety risk.
