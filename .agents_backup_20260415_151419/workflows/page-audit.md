---
description: End-to-end audit and fix for a specific UI page, covering UI, backend routes, and execution risk.
---

# AetherDesk Prime — Page-Specific Audit & Fix
# Workflow: /page-audit [page_name]

Use this workflow to sanitize, optimize, and fix specific UI views (e.g., `/strategy`, `/actioncenter`, `/dashboard`).

## 🔍 PHASE 1 — Distributed Multi-Agent Scan

### 🎨 ui-scanner
- **Visuals**: Check for glassmorphism consistency, backdrop blurs, and premium dark mode.
- **Motion**: Verify `framer-motion` enter/exit transitions; check for layout shifts.
- **Telemetry**: Confirm the **Bilingual WS Parser** handles incoming Port 5002 ticks.
- **Shadcn**: Audit component variants (e.g., secondary buttons for SELL actions).
- **Report**: `.agents/reports/pages/REPORT_UI_[PAGE].md`

### ⚙️ backend-scanner
- **Endpoints**: Map all Port 18788 REST calls made by this page.
- **Structure**: Ensure routes are isolated in Flask Blueprints.
- **Data**: Verify DuckDB/SQLite parameterization and correct table routing.
- **Auth**: Confirm JWT pass-through to the unified gateway.
- **Report**: `.agents/reports/pages/REPORT_BE_[PAGE].md`

### ⚖️ risk-scanner
- **Authority**: Does this page allow unauthorized order submission?
- **Validation**: Are trade parameters (Qty, SL, Target) validated before routing to the engine?
- **Sync**: Is the broker connectivity status (Shoonya) visible to the user?
- **Report**: `.agents/reports/pages/REPORT_RISK_[PAGE].md`

## 📊 PHASE 2 — Master Synthesis
Merge scanner findings into `.agents/reports/pages/REPORT_[PAGE]_MASTER.md`.
1. List **Blockers** (High risk/broken flows).
2. List **Friction** (UI polish/UX clarity).
3. List **Performance** (Excessive re-renders/API latency).

**PAUSE: Present the Master Report and request approval for Phase 3.**

## 🛠️ PHASE 3 — Atomic Repair
1. **Apply UI Fixes**: Use patterns from `.agents/memory/patterns/common-tasks.md`.
2. **Apply Backend Fixes**: Ensure thread-safe state management in Flask.
3. **Unified Test**: Verify Port 18788 responses sync correctly with Shadcn states.

## ✅ PHASE 4 — Deployment Verification
1. Run `bun run build` in `trading-ui` to confirm static integrity.
2. Verify Port 5002 message handling for the specific page.
3. Check `algo_engine` logs for any blueprint routing errors.

## 🧠 PHASE 5 — Memory Commitment
Run `/update-memory` to mark the page as **FIXED** in `context.md` and document any new reusable patterns.
