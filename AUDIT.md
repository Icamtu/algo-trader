# AlgoDesk Frontend Audit

## 2a · Frontend Logic Audit

| SEVERITY | FILE:LINE | Description | Proposed Fix |
|---|---|---|---|
| **CRITICAL** | `lib/config.ts:23` | Hardcoded API Key as fallback in production-ready config. | Remove hardcoded key; ensure it only draws from `import.meta.env`. |
| **HIGH** | `components/trading/GlobalHeader.tsx:155` | Trading mode switch to LIVE has no confirmation modal. | Implement confirmation modal as per 5d rules. |
| **HIGH** | `lib/api-client.ts` | Multiple OpenAlgo v1 endpoints missing or using incorrect HTTP methods (DELETE instead of POST for cancellations). | Add missing endpoints and align methods with OpenAlgo v1 spec. |
| **HIGH** | `lib/config.ts:22` | WebSocket URL mismatch. Uses `/ws` but `Infrastructure.tsx` diags point to `/algo-ws`. | Unify WS endpoint to `/algo-ws` for consistency with Nginx proxy. |
| **MEDIUM** | `pages/Infrastructure.tsx:46,59` | Async calls in `useEffect` without abort controllers. | Implement `AbortController` or use React Query for all health/log fetches. |
| **MEDIUM** | `types/api.ts:238` | `any` types in `BacktestResponse`. | Define strong types for backtest trade objects. |
| **MEDIUM** | `components/trading/UnifiedSettings.tsx` | UI is a centered Dialog instead of the requested 380px right-side slide-over panel. | Refactor to slide-over layout. |
| **LOW** | `components/trading/GlobalHeader.tsx:17` | Hardcoded market symbols in header. | Move to a centralized registry or dynamic fetch. |

## 2b · OpenAlgo Feature Gap Audit

| Endpoint | Status | Proposed Fix |
|---|---|---|
| `POST /api/v1/placeorder` | OK | - |
| `POST /api/v1/placesmartorder` | MISMATCH | Rename `smartOrder` to `placeSmartOrder` and point to correct slug. |
| `POST /api/v1/modifyorder` | **MISSING** | Add to `algoApi`. |
| `POST /api/v1/cancelorder` | MISMATCH | Change from `DELETE /id` to `POST` with payload. |
| `POST /api/v1/cancelallorder` | MISMATCH | Change from `DELETE` to `POST`. |
| `POST /api/v1/closeposition` | OK | - |
| `GET /api/v1/orderbook` | OK | - |
| `GET /api/v1/tradebook` | OK | - |
| `GET /api/v1/positionbook` | OK | - |
| `GET /api/v1/holdings` | OK | - |
| `GET /api/v1/openposition` | **MISSING** | Add `getOpenPosition` calling `/api/v1/openposition`. |
| `GET /api/v1/funds` | OK | - |
| `GET /api/v1/quotes` | OK | - |
| `GET /api/v1/depth` | OK | - |
| `GET /api/v1/history` | OK | - |
| `POST /api/v1/basketorder` | OK | - |
| `POST /api/v1/splitorder` | **MISSING** | Add `splitOrder` to `algoApi`. |
