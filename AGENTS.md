# AetherDesk Prime: Project Map

## Project Identity
- **Stack**: React, Python (Flask), DuckDB, Redis, Docker
- **Goal**: Unified algorithmic trading platform with native GEX analytics, Shoonya integration, and real-time DuckDB historical logging.

## Current State
- **Done**: Full Unification of AetherDesk × OpenAlgo; Unified API Gateway on port **18788**; WebSocket Relay on port **5002**; Native Analytical Engine (GEX, IV, Max Pain); DuckDB Historify integration; Standardized volume storage at `/app/storage`.
- **Now**: Strategy onboarding and live production monitoring.
- **Blockers**: None.

## Key Files & Modules
- `docker-compose.yml`: Unified service orchestrator
- `algo-trader/`: Native execution engine & Analytics core (Port 18788)
- `trading-ui/`: Unified React frontend (Bilingual WS parser)
- `algo-trader/database/`: Persistent trade logs & session data
- `scratch/verify_telemetry.py`: Deep-health audit suite

## Response Guidelines
- ** Concise, code-first, minimal. **
- ** UNIFIED Ports **: Always use **18788** for REST and **5002** for Ticks.
- ** Native Modules **: Prefer `algo-trader/api.py` for all new endpoints.

## Technical Commands
| Task | Command |
|------|---------|
| Start All | `docker compose up -d` |
| Deep Audit | `python3 scratch/verify_telemetry.py` |
| Rebuild Engine | `docker compose build algo-trader && docker compose up -d algo-trader` |
| Check Logs | `docker logs -f algo_engine` |
| UI Dev | `cd trading-ui && bun dev` |
| UI Sync | Auto-managed by `ui-builder` container |

## Skills & Agent Docs (Unified)
- **Single folder**: `.agents/` — all skills, rules, docs, workflows live here.
- **Skills**: `.agents/skills/` — 201 skills total (general + trading-domain).
  - Trading skills: `backtest`, `vectorbt-expert`, `indicator-*`, `live-feed`, `optimize`, `quick-stats`, `setup`, `strategy-compare`, `custom-indicator`
- **Rules**: `.agents/rules/`
- **Progress**: `.agents/progress/`
- **Consolidated**: Use `.agents/` exclusively.
