# AetherDesk Prime: Project Map

## Project Identity
- **Stack**: React, Python (Flask), Supabase, Redis, Docker, OpenAlgo
- **Goal**: Containerized algorithmic trading platform with real-time analytics and AI-powered strategy execution.

## Current State
- **Done**: Full Docker orchestration for 13 services; Supabase Auth/DB integration; OpenAlgo broker connectivity; React UI groundwork (Live Blotter, Risk Dashboard, analytics views).
- **Now**: Fixing `algo_engine` container (resolving missing scipy dependency) and stabilizing Supabase service health checks.
- **Blockers**: `algo_engine` restart loop (scipy install); `supabase-rest` unhealthiness; Resource limits (24GB RAM optimization).

## Key Files & Modules
- `docker-compose.yml`: Root service orchestrator
- `trading-ui/`: React frontend
- `algo-trader/`: execution engine
- `supabase/`: Database configuration

## Response Guidelines
- ** Concise, code-first, minimal. **
- ** Skip re-explaining **: Initial Docker/system setup, env vars, OpenAlgo API structure.

## Technical Commands
| Task | Command |
|------|---------|
| Start All | `docker compose up -d` |
| Fix Engine | `docker compose build algo-trader && docker compose up -d algo-trader` |
| Check Health | `docker compose ps` |
| UI Dev | `cd trading-ui && bun dev` |

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: Antigravity <antigravity@gemini.ai>
```
