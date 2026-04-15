# AetherDesk Prime — AntiGravity Agent System

Drop this entire `.agentss/` folder into your project root.
Then type `/audit-and-fix` in the AntiGravity Agent Manager to evaluate the unified core.

```
trading-workspace/
├── AGENTS.md                          ← cross-tool rules, loaded every session
├── GEMINI.md                          ← project memory map
├── .agentss/
│   ├── rules/
│   │   └── trading-stack.md           ← always-on rules (loaded every session)
│   ├── skills/
│   │   ├── docker-audit/
│   │   │   └── SKILL.md               ← auto-loaded for Docker/Compose work
│   │   └── trading-stack/
│   │       └── SKILL.md               ← auto-loaded for algo_engine / broker / auth
│   └── workflows/
│       └── audit-and-fix.md           ← trigger with: /audit-and-fix
├── algo-trader/                       ← Native Execution Engine (Port 18788)
├── trading-ui/                        ← Unified React Frontend (Vite)
├── docker-compose.yml                 ← Unified service orchestrator
└── ...
```

## Project Identity: AetherDesk Prime
- **Stack**: React, Python (Flask), DuckDB, Redis, Docker
- **Unified Gateway**: Port **18788** (REST) | Port **5002** (WebSocket Ticks)
- **Goal**: Unified algorithmic trading platform with native GEX analytics, Shoonya integration, and real-time DuckDB historical logging.

## What happens when you run `/audit-and-fix`

1. **Phase 1 — Fan-Out (parallel)**
   Specialist agents run simultaneously, each owning one domain:
   - `frontend-auditor` → trading-ui (Vite env, auth guards, Nginx, TS, bundle)
   - `backend-auditor` → algo-trader (WebSocket, JWT, DuckDB, Redis, API envelope)
   - `broker-agent` → OpenAlgo + Shoonya (token lifecycle, F&O encoding, idempotency)
   - `security-agent` → JWT/PostgREST mismatch, secrets scan, RLS, CORS
   - `infra-agent` → Docker Compose (health chain, memory limits, port exposure)
   - `perf-agent` → Redis caching, WS limits, bundle size, startup time
   - `test-agent` → generates all missing pytest + Vitest + Playwright tests

2. **Phase 2 — Quality Check**
   Each output is verified: no truncated files, no placeholders, CRITICAL findings addressed.
   Failures are sent back for revision automatically.

3. **Phase 3 — Consolidation**
   Findings are deduplicated, cross-cutting fixes are coordinated, and a
   Production Readiness Scorecard + ordered fix sequence + GO/NO-GO verdict is emitted.

## Pre-loaded known issues
The workflow and rules have these pre-wired so agents don't need to rediscover them:
- JWT/PostgREST secret mismatch between `supabase-auth` and `supabase-rest`.
- WebSocket exhaustion in `algo_engine` (missing disconnect cleanup).
- `VITE_SUPABASE_URL` env vars not injecting in `trading-ui` production builds.
- `supabase-studio` OOM failures (missing memory limits).
- Historical data sync latency with DuckDB `historify.duckdb`.
- Missing `service_healthy` conditions in `docker-compose.yml`.

## Memory Bank — How It Saves Tokens

| Component | Role |
|-----------|------|
| `memory/architecture.md` | Tracks unified 18788/5002 port decisions |
| `memory/tech-stack.md` | Pinned versions of Flask, React, and OpenAlgo |
| `memory/context.md` | Real-time audit progress table |
| `patterns/common-tasks.md` | Reusable Shoonya session handlers |

**Estimated savings: 40-60% fewer tokens per session after initial setup.**

---

## Skills Auto-Trigger Reference
| You're working on... | Skill auto-loaded |
|----------------------|-------------------|
| Any UI page audit | page-auditor |
| Tailwind / components / loading states | ui-ux-fix |
| FastAPI/Flask routes / endpoints | backend-fix |
| JWT / WebSocket / Shoonya / DuckDB | trading-stack |
| Dockerfile / docker-compose.yml | docker-audit |
| /start or /update-memory | memory-manager |
