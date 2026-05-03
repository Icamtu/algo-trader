# Incident Report: Option Chain Rendering Failure (AetherDesk Prime)

**Date:** May 2, 2026
**Status:** Resolved / Verified
**Target URL:** `http://100.66.171.30/intelligence/option-chain`

## 1. Executive Summary
The Option Chain page was failing to render the data grid and technical metrics. The root causes spanned from frontend component property mismatches to backend symbol construction errors and misconfigured API handshake protocols.

## 2. Issues Identified & Actions Taken

### Step 1: Virtualization Engine Fix
*   **Issue:** The `VirtualizedDataTable` component was using incorrect props (`rowCount`/`rowHeight`).
*   **Action:** Updated to `itemCount`/`itemSize` to match `react-window` requirements.
*   **Result:** Restored grid rendering for 9 pages (Holdings, Positions, Orderbook, etc.).

### Step 2: Backend Symbol Construction Correction
*   **Issue:** Incorrect symbol format (inserted "C"/"P" prefix) caused 404s from Shoonya.
*   **Action:** Aligned `MarketDataService` with OpenAlgo standard: `[Base][Expiry][Strike][Type]`.
*   **Verification:** Verified via `pytest tests/test_market_data_service.py` (4/4 PASS).

### Step 3: API Routing & Redundant Prefixes
*   **Issue:** Frontend was double-prefixing URLs (e.g., `/api/v1/api/...`), causing 404s on handshakes.
*   **Action:** Simplified `client.ts` and `MarketDataManager.ts` paths to use institutional `/algo-api/api/v1/...` routing consistently.

### Step 4: Security Hardening (Handshake Logic)
*   **Issue A (CRITICAL):** `fastapi_app.py` allowed `JWT_SECRET` as a direct auth token.
*   **Issue B (HIGH):** Heartbeat auth failures logged `apikey` and `token` in plaintext.
*   **Action:**
    1. Removed the `JWT_SECRET` backdoor in WebSocket `handle_auth`.
    2. Redacted sensitive headers from `system_bp.py` logs.
    3. Injected dynamic Supabase session tokens into WebSocket handshake headers.

### Step 5: Option Chain Math & Realism Fixes (WEEKEND UPDATE)
*   **Issue A:** Requesting `BANKNIFTY` option chain resulted in `math domain error` due to invalid strikes (e.g., `-0.01`) in `symbols.db` being passed to Black-Scholes.
*   **Issue B:** `PaperBroker` was returning a flat `24000.0` price for all underlyings, which is unrealistic for `BANKNIFTY` (50k+) or `SENSEX` (79k+), causing extreme Greek values.
*   **Action:**
    1.  **Robust Greeks:** Updated `BlackScholesEngine` with explicit safeguards for `S <= 0` or `K <= 0` to return zeroed Greeks instead of throwing exceptions.
    2.  **Strike Filtering:** Patched `MarketDataService` to filter out non-positive strikes during option chain discovery.
    3.  **Price Realism:** Enhanced `PaperBroker` to return index-appropriate base prices with random variance.
*   **Verification:** Verified via `curl` for `NIFTY`, `BANKNIFTY`, and `FINNIFTY`. All return valid JSON with enriched Greeks.

## 3. Current System State
*   **Backend:** Greeks calculation is now exception-safe. Symbols discovery handles data quality issues in `symbols.db`.
*   **Frontend:** `ui-builder` has deployed consistent routing. `VirtualizedDataTable` is synchronized.
*   **Simulation:** `PaperBroker` provides realistic pricing for index-based derivatives during weekend testing.

## 4. Key Learnings for Future Agents
1.  **Orchestrated Audits:** Use `parallel-agents` to verify fixes from multiple domains (Security, Arch, Testing).
2.  **Pathing:** Always check the Nginx proxy mapping vs. the mounted router prefix to avoid double-prefixing.
3.  **Credential Safety:** Never log `request.headers` or token variables directly; use generic "Auth Failure" messages.
4.  **Symbol Parity:** Use unit tests to enforce parity between constructed strings and database records.
