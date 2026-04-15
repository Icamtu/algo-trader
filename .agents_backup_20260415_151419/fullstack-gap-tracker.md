# AetherDesk Gap Remediation Tracker
> Last updated: 2026-04-06T06:44Z

## P0 — Production Blockers
- [x] GAP-13/14: Wire NewOrderModal to real backend via `/api/terminal/command`
- [x] GAP-15: Fix heartbeat port 5000 → 5001
- [x] GAP-08: Create `ApiError` class with status codes in `src/types/api.ts`
- [x] GAP-35: Add min/max validation on risk limit inputs (+ quantity validation in NewOrderModal)

## P1 — UX/Data Integrity
- [x] GAP-17: Create `src/types/api.ts` with 25+ TypeScript interfaces for all API contracts
- [x] GAP-03/04: Wire Portfolio to `/api/pnl` endpoint (replaced hardcoded MTD/YTD/Alpha/Beta/Sharpe)
- [x] GAP-10: Add loading skeleton to TradeJournal (6-row pulsing placeholder)
- [x] GAP-11: Add error state to Portfolio (error banner + loading spinner)
- [x] GAP-01: Add `max_order_quantity` and `max_position_qty` inputs to RiskDashboard (was 4 fields, now 6)
- [x] GAP-09: RiskDashboard now shows loading spinner instead of blank null return

## P2 — Performance
- [x] GAP-22: Remove double mode filtering in TradeJournal (backend already filters)
- [x] GAP-20: Reduce settings polling from 5s → 30s in MarketScanner
- [ ] GAP-18: Consolidate risk status polling (RiskDashboard + useRiskStatus)
- [ ] GAP-23: Delete dead TradingDesk.tsx
- [ ] GAP-29: Wire symbol search autocomplete
- [ ] GAP-30: Fetch scanner indices from backend

## P3 — Feature Completeness
- [ ] GAP-07: Build Optimizer UI
- [ ] GAP-26: Add Cancel All button
- [ ] GAP-31: Add Run Backtest button
- [ ] GAP-38: Create backend alerts API
- [ ] GAP-32/33: Expose smart/basket/modify orders

## Type Safety Progress
- [x] `api-client.ts` — All 5 `any` params replaced with typed imports
- [x] `useTrading.ts` — All 4 `error: any` replaced with `Error`
- [x] `useWebSocket.ts` — `useState<any>` → `useState<WebSocketMessage | null>`
- [x] `RiskDashboard.tsx` — `useState<any>` → `useState<RiskStatus | null>`, `as any` casts removed
- [x] `TradeJournal.tsx` — `useState<any[]>` → `useState<Trade[]>`, `(t: any)` filter removed
- [x] `Portfolio.tsx` — `(p: any)` → `(p: Position)`, icon `any` → `LucideIcon`
- [x] `MarketNavbar.tsx` — `icon: any` → `icon: LucideIcon`
- [x] `LiveBlotter.tsx` — `(p: any)` → `(p: ApiPosition)`
- [x] `NewOrderModal.tsx` — Added proper `ApiError` catch handling

### Remaining `any` (lower priority, in less critical paths)
- `BacktestCanvas.tsx` — 3 `any` (result state)
- `IndicatorAnalyzer.tsx` — 4 `any` (candle/indicator mapping)
- `AnalyticsPanel.tsx` — 1 `any` (positions state)
- `Infrastructure.tsx` — 2 `any` (interval, icon)
- `Auth.tsx` / `ForgotPassword.tsx` / `ResetPassword.tsx` — 3 `any` (error catches)
- `CommandBar.tsx` — 1 `any` (response callback)
- `MarketScanner.tsx` — 4 `any` (results, settings, analysis)
- `TradingDesk.tsx` — 1 `any` (icon) — DEAD CODE, to be deleted
- `BacktestAnalyticsView.tsx` — 3 `any` (tooltip, error, payload)
- `BrokerManagementPanel.tsx` — 1 `any` (error)

## Files Modified
| File | Changes |
|------|---------|
| `src/types/api.ts` | **NEW** — 25+ interfaces, `ApiError` class |
| `src/lib/api-client.ts` | Full rewrite — typed params, all endpoints, `ApiError` import |
| `src/hooks/useHeartbeat.ts` | Port 5000 → 5001 |
| `src/hooks/useTrading.ts` | `error: any` → `Error`, `queryFn` lambda fix |
| `src/hooks/useWebSocket.ts` | `WebSocketMessage` interface, typed state |
| `src/components/trading/NewOrderModal.tsx` | Real API call, `ApiError` handling, validation |
| `src/components/trading/RiskDashboard.tsx` | Typed state, 2 new fields, min validation, loading |
| `src/components/trading/MarketNavbar.tsx` | `LucideIcon` type |
| `src/components/trading/LiveBlotter.tsx` | `ApiPosition` type |
| `src/pages/TradeJournal.tsx` | `Trade` type, loading skeleton, no double filter |
| `src/pages/Portfolio.tsx` | Real P&L fetch, error state, `LucideIcon` types |
| `src/pages/MarketScanner.tsx` | Settings poll 5s → 30s |

## Build Status
✅ `tsc --noEmit --skipLibCheck` — **0 errors**
