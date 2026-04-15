# AetherDesk Prime — Shared Agent Rules (AGENTS.md)
# Read by: Antigravity, Claude Code, Cursor

## Session Startup
1. **Load Project Map**: Use `GEMINI.md` and root `AGENTS.md` for high-level state.
2. **Context Sync**: Check `.agentss/progress/` for the current active task.
3. **Identity**: This is **AetherDesk Prime**, a unified trading ecosystem.

## Stack & Ports
| Component     | Container     | Tech Stack            | Unified Port |
|---------------|---------------|-----------------------|--------------|
| Engine Core   | `algo_engine` | Flask, DuckDB, Redis  | **18788**    |
| Ticks Relay   | `algo_engine` | WebSocket Relay       | **5002**     |
| Broker Bridge | `openalgo-web`| OpenAlgo (Shoonya)    | **5000**     |
| AI Backend    | `local_ollama`| Ollama                | **11434**    |
| Analytics     | `openclaw`    | OpenClaw              | **18789**    |
| Frontend      | `trading-ui`  | React, Vite, Tailwind | **80**       |
| Auth Gateway  | `supabase-kong`| Kong (Supabase)      | **8000**     |

## OpenAlgo API Mapping
Internal engine routes for coordination:
- `/api/v1/placeorder` (POST)
- `/api/v1/telemetry` (GET) - Engine heartbeats
- `/api/v1/strategies` (GET) - Active strategies
- `/api/v1/positionbook` (GET) - Open positions
- `/api/v1/backtest/run` (POST) - Trigger simulation

## Absolute Rules
1. **No Truncation**: Always return full file contents. Snippets are forbidden.
2. **Standardized Ports**: Never use 5001 or 8000 for the engine; use **18788**.
3. **DuckDB First**: Use DuckDB for historical analytics; SQLite for trade logging.
4. **Environment Isolation**: No hardcoded secrets. Use `.env` variables only.
5. **ARM64 Native**: All Docker images/builds must be `linux/arm64` compatible.
6. **One Issue Per Commit**: Maintain strict atomic commit history.
7. **Unified Directory**: Use `.agentss/` for all metadata.

## Banned Patterns
- **`any`** in TypeScript.
- **`shell=True`** in Python sub-processes.
- **Direct Broker API** calls from UI (always proxy via 18788 for risk checks).
- **Blocking I/O** in async Flask routes.

## Memory Bank
Load these on every task to ensure consistency:
1. `.agentss/memory/architecture.md`
2. `.agentss/memory/tech-stack.md`
3. `.agentss/progress/` (tracks active sprints)

## Output Format
Every finding must follow: `SEVERITY | SERVICE | FILE | LINE | ISSUE | FIX`.
Fixes must be complete, runnable files.
