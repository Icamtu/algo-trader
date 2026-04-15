---
name: page-auditor
description: Use when auditing or fixing specialized UI pages end-to-end. Triggers on: "audit page", "scan page", "GEX dashboard", "Action Center", "Strategy Lab", "Backtest Engine". Covers analytical data integrity and real-time synchronization checks.
---

# AetherDesk Prime Page Auditor

## 🛠️ Specialized Audit Targets

### 1. Analytical Dashboards (GEX, IV, Max Pain)
- **Data Integrity**: Are the strikes correctly aligned with the price chart?
- **Refresh Sync**: Does the "GEX Profile" update when a new tick arrives?
- **Visualization**: Are the call/put bars clearly distinguished?
- **Gradients**: Use emerald/rose for directional exposure.

### 2. Action Center (Order Approval Pipeline)
- **Pending Actions**: Are pending orders clearly separated from historical logs?
- **Approval Flow**: Is there a one-click "Approve All" and "Reject All"?
- **Audit Detail**: Can the user see the "Why" (Decision Agent log) before approving?
- **Notification**: Do toast alerts trigger on completion/failure?

### 3. Strategy Lab (Backtest & Optimization)
- **Progress Sync**: Does the "Backtest Progress" bar update via Redis pub/sub?
- **Parameter Mapping**: Are all grid search params correctly passed to port 18788?
- **Comparison**: Can the user load two backtest results side-by-side?

## 📊 UX Checklist: AetherDesk Prime Standard

| Category | Requirement | Aether-Standard |
|----------|-------------|-----------------|
| Feeds | Connection Badge | Pulsing neon ring on Port 5002 |
| Price | Precision | Correct decimal formatting per exchange |
| Labels | Bilingual | Handles both "TICK" and "tk" data frames |
| Theme | Visuals | Glassmorphism applied to all sidebars |
| Risk | Safeguards | Order buttons disabled if Shoonya session expired |

## 📐 Formatting Rules
When reporting, categorize findings by **Execution Risk** (High/Med/Low).

```markdown
# UI Audit: [Page Name]

## Execution Blockers (High)
- [ ] Shoonya session token refresh not triggering on 401.

## UI Friction (Medium)
- [ ] GEX chart tooltip overflows on 13" screens.

## Technical Debt (Low)
- [ ] Implicit 'any' in telemetry parser utility.
```

## [Agents: add new institutional audit patterns here]
