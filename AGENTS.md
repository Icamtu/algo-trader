# AetherDesk Prime: Project Map

## Project Identity
- **Stack**: React, Python (Flask), DuckDB, Redis, Docker
- **Goal**: Unified algorithmic trading platform with native GEX analytics, Shoonya integration, and real-time DuckDB historical logging.

## Current State
- **Done**: 100% Core Design "Kernalization" (Phase 1-16).
- **Done**: System Integrity & P0 Security Vectorization (Phase 7).
- **Done**: UI Normalization (Title, README, Metadata cleanup).
- **Done**: Institutional Observability (Loki/Jaeger/Prom) (Phase 4).
- **Done**: Phase 5: Advanced AI (Stat-Arb, Genetic GA, Sentiment, Indicator UI).
- **Now**: Phase 6: Multi-broker bridge & High-frequency connectivity.

## Key Files & Modules
- `docker-compose.yml`: Unified service orchestrator
- `algo-trader/`: Native execution engine & Analytics core (Port 18788)
- `trading-ui/`: Unified React frontend (Bilingual WS parser)
- `algo-trader/database/`: Persistent trade logs & session data
- `scratch/verify_telemetry.py`: Deep-health audit suite

## Response Guidelines
- **Concise, code-first, minimal.**
- **SUPERPOWERS**: Invoke relevant skills BEFORE every response. Use `using-superpowers` as entry point.
- **GSTACK ROLES**: Invoke specialized personas for deep audits: `/ceo`, `/cso`, `/qa`, `/designer`.
- **ARCHITECTURE**: Prefer **Command → Agent → Skill** for complex features.
- **GIT & FLOW**:
  - One file per commit (strict).
  - Manual `/compact` at 50% context.
  - Start with Plan mode for tasks > 10 lines of code.
- **UNIFIED Ports**: 18788 (REST), 5002 (Ticks).
- **Native Modules**: Prefer `algo-trader/api.py`.

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
- **Structure**:
  - `commands/` → synced to `.claude/commands/` (slash commands).
  - `agents/`: Specialized subagents (MD with frontmatter).
  - `skills/`: 1449 skills registered as `aetherdesk-local` plugin — all accessible via Skill tool.
  - `workflows/` → synced to `.claude/commands/` as `/graphify`, `/update-memory`, `/audit-and-fix`, etc.
  - `memory/` → synced to `~/.claude/projects/-workspace/memory/` (auto-imported each session).
  - `rules/` + `.agents-rules` → architectural guardrails (see below).
- **Best Practice**: Follow `.agents/BEST_PRACTICE.md` for all new additions.
- **Auto-Sync**: `agents-sync.js` runs on every session start + file change. Watcher daemon: `bash .agents/scripts/watch.sh status`.
- **Skill Catalog**: `.agents/core/skill-catalog.md` (64 categories, 1449 skills indexed).

## Architectural Rules (from .agents-rules)
- **Database**: Pure SQLite ONLY. No PostgreSQL.
- **Network**: All services on `trading_net`. Access via container names + internal ports.
- **Secrets**: NEVER hardcode credentials. Always use `.env`.
- **WebSocket**: Preserve heartbeats in `live_feed.py`. Never break live feed connectivity.
- **Frontend**: Consult `.agents/aetherdesk-frontend-brief.md` before any UI work.
- **Memory**: After significant milestones, run `/update-memory` to consolidate.
- **Graphify**: Run `/graphify .agents` to rebuild the knowledge graph after major changes.
- **Design Guardrail**: DO NOT modify the Left Sidebar (`Sidebar.tsx`), Global Header (`GlobalHeader.tsx`), or the Sub-Header/Market Navbar (`MarketNavbar.tsx`) layout/design. These are locked to the Institutional v6 aesthetic (40px compact, cyan-400 accents).

## Page Development Workflow
**For all 48 UI pages** (dashboard, execution, intelligence, aetherdesk sections, settings):
- **Use `/page-craft [page-name] --mode=[new|improve|responsive|chrome]`** to develop, improve, or polish pages.
- **Inventory**: `.agents/PAGE_CATALOG.md` — canonical registry of all 48 pages (live, planned, refactor-pending).
- **Workflow**: `.agents/workflows/page-craft.md` — slash command dispatcher.
- **Skill**: `.agents/skills/page-craft/SKILL.md` — 6-phase workflow (Inventory → Design → Build → Responsive → Test → Document).
- **Agent**: `.agents/agents/page-craftsman.md` — specialized subagent that owns the full page lifecycle.
- **Standards**: Mobile-first, WCAG AA, institutional dark theme, design-token-only, component-reuse-first, zero console warnings.
- **Design tokens**: base `#0A0A0A`, primary `#00F5FF`, secondary `#A020F0`. Use only these; no new colors.
- **Components**: Reuse PriceChart, StrategyCard, TradeBlotter, etc. before building new primitives.
- **State**: TanStack Query for server state, Zustand for client state.
- **Breakpoints**: mobile (≤767px), tablet (768–1279px), desktop (≥1280px).

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
