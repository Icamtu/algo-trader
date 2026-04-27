# AetherDesk Prime: Project Map

## Project Identity
- **Stack**: React, Python (Flask), DuckDB, Redis, Docker
- **Goal**: Unified algorithmic trading platform with native GEX analytics, Shoonya integration, and real-time DuckDB historical logging.

## Current State
- **Done**: 100% Core Design "Kernalization" (Phase 1-16).
- **Done**: System Integrity & P0 Security Vectorization (Phase 7).
- **Done**: UI Normalization (Title, README, Metadata cleanup).
- **Done**: Shoonya session sync automated verification (Phase 8).
- **Now**: Performance optimization & Strategy execution audit.

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
  - `commands/`: Slash command definitions (MD).
  - `agents/`: Specialized subagents (MD with frontmatter).
  - `skills/`: Reusable capabilities (SKILL.md).
- **Skills**: `.agents/skills/` — 201 skills total (general + trading-domain).
- **Best Practice**: Follow [BEST_PRACTICE.md](file:///home/ubuntu/trading-workspace/.agents/BEST_PRACTICE.md) for all new additions.
- **Consolidated**: Use `.agents/` exclusively.
