---
description: Full system audit of security, infrastructure, and backend core. Run before page audits.
---

# AetherDesk Prime — System Audit & Fix
# Workflow: /audit-and-fix

Use this for high-level infrastructure, security, and integration audits. Run after `/start` but before `/page-audit`.

## 1. Audit Phase: Distributed Agents

### 🛡️ security-agent
- **Focus**: JWT normalization across Supabase Kong, PostgREST, and `algo_engine`.
- **Target**: `.env` and `supabase/.env` consistency.
- **Goal**: Resolve "Unauthorized" errors or session sync failures.
- **Report**: `.agents/reports/REPORT_SECURITY.md`

### 🏗️ infra-agent
- **Focus**: Docker Compose health-chain, ARM64 image pins, and resource limits.
- **Target**: `docker-compose.yml`, `ui-builder` behavior.
- **Goal**: Ensure zero-touch UI sync and stable container boot order.
- **Report**: `.agents/reports/REPORT_INFRA.md`

### ⚙️ engine-agent (backend)
- **Focus**: Flask Blueprint integrity, Port 18788 REST gateway, logic isolation.
- **Target**: `algo-trader/api.py`, `execution/action_manager.py`.
- **Goal**: Verify order routing through the managed Action Center.
- **Report**: `.agents/reports/REPORT_ENGINE.md`

### 📊 data-agent
- **Focus**: DuckDB ingestion performance, Historify retention, SQLite trade log rotation.
- **Target**: `storage/historify.duckdb`.
- **Goal**: Optimize for high-tick throughput (>100 ticks/sec).
- **Report**: `.agents/reports/REPORT_DATA.md`

## 2. Priority Fix Execution
Apply fixes in the following sequence:
1. **JWT Alignment**: Must be identical for Kong/PostgREST/Engine.
2. **Shoonya Auth**: Verify headless session sync initiates.
3. **Port Unification**: Lock 18788 and 5002 as the primary gateways.
4. **Action Center Gate**: Ensure no orders bypass the risk layer.

## 3. Post-Audit Synchronization
- Run `/update-memory` to persist the new state.
- Proceed to `/page-audit` for specific UI views.
