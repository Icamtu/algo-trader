# Superpowers Core
@.agents/skills/using-superpowers/SKILL.md
@.agents/skills/using-superpowers/references/gemini-tools.md
@.agents/skills/gstack-ceo/SKILL.md
@.agents/skills/gstack-cso/SKILL.md
@.agents/skills/gstack-qa/SKILL.md
@.agents/skills/gstack-designer/SKILL.md

# GEMINI.md — Project Memory Map

## Full Architecture
The project is a unified algorithmic trading platform (**AetherDesk Prime**) that integrates **OpenAlgo** with a custom high-performance execution engine and a React-based analytics frontend.

### Services Overview:
- **algo-trader**: Custom Python engine (Flask) handling strategy execution, order management, and real-time analytics.
- **trading-ui**: React frontend built with Vite, Shadcn UI, and Framer Motion for a premium, bilingual experience.
- **openalgo**: The base trading platform providing market connectivity and core infrastructure.
- **supabase-***: Full local stack for Authentication (GoTrue), database (Postgres), and API gateway (Kong).
- **redis**: Infrastructure used for caching and potentially inter-service signaling.
- **ollama_engine**: Local AI engine providing LLM capabilities to the trading agents and developers.
- **openclaw**: Advanced analytics and AI reporting gateway.
- **claude-code**: Containerized agentic development environment.

## Current State & Milestones
- **Done**: 100% Core Design "Kernalization" (Phase 1-6). 
- **Done**: System Integrity & P0 Security Vectorization (Phase 7).
- **Done**: UI Normalization (Title, README, Metadata cleanup).
- **Done**: Shoonya session sync automated verification (Phase 8).
- **Now**: Performance optimization & Strategy execution audit.

## Container Map
| Container Name | Ports | Dependencies | Role |
|----------------|-------|--------------|------|
| `algo_engine` | 18788, 5002 | `redis`, `openalgo` | Execution & Analytics Core |
| `trading-ui` | 80, 3001 | `supabase-kong` | Unified React Frontend |
| `openalgo-web` | 5000, 8765 | `redis` | Base Trading Platform |
| `supabase-kong`| 8000, 8443 | `supabase-auth`, `supabase-rest` | API Gateway |
| `supabase-db` | 54322 | None | Central Metadata Store |
| `local_ollama` | 11434 | None | Local AI Engine |
| `openclaw` | 18789 | `local_ollama` | Analytics Gateway |
| `ui-builder` | N/A | None | Auto-builds Frontend |

## Environment Variables (Keys)
Selected critical keys found across `.env` files:
- `API_KEY`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
- `SHOONYA_USER_ID`, `SHOONYA_PASSWORD`, `SHOONYA_TOTP_SECRET`
- `OPENALGO_API_KEY`, `OPENALGO_BASE_URL`
- `OLLAMA_API_KEY`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`
- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
- `RISK_MAX_DAILY_LOSS`, `RISK_MAX_DAILY_TRADES`

## Key Design Decisions
1. **Unified API Gateway**: Port **18788** handles all REST requests for the engine.
2. **WebSocket Relay**: Port **5002** allows the React UI to consume real-time ticks and engine events without direct broker connection.
3. **DuckDB Historify**: Uses DuckDB for high-speed local logging of historical candle data (`historify.duckdb`).
4. **Bilingual WS Parser**: UI is designed to handle both OpenAlgo and custom AetherDesk telemetry streams.
5. **Zero-Touch Sync**: `ui-builder` container ensures the production UI stays in sync with source changes automatically.

## Inter-service Communication
- **Frontend → Engine**: REST API on 18788, WebSocket on 5002.
- **Engine → OpenAlgo**: REST API on 5000 (Internal Docker network: `http://openalgo-web:5000`).
- **Engine → AI**: REST requests to `http://local_ollama:11434`.
- **UI → Supabase**: Authenticates via Kong on port 8000.

## Database Schemas & Storage
- **DuckDB**: `/app/storage/historify.duckdb` (Local high-speed analytical storage).
- **SQLite**: `/app/storage/trades.db` (Trade logs, settings, safeguards, risk limits).
- **Postgres**: Supabase internal DB for user management and metadata.
- **Redis**: In-memory store for session and transient state.

## Known Issues & TODOs
- **Security**: Vectorized Tailwind/Tailscale IPs for dynamic networking.
- **UI**: Institutional metadata and README documentation finalized.
- **Auth**: Shoonya session sync requires automated verification periodically.

## Coding Conventions
- **Backend (Python)**: Flask Blueprints for feature isolation (`analytics`, `action_center`). Async strategy runner loop.
- **Frontend (TSX)**: Shadcn components, feature-based directory structure, Tailwind CSS for styling.
- **Deployment**: `docker-compose` as the source of truth for all service configurations.

## What NOT to do
- **Do NOT** bypass the Engine (18788) to talk to OpenAlgo directly for execution logic; the Engine manages risk.
- **Do NOT** commit raw secrets to the repository (use `.env`).
- **Do NOT** use legacy port 5001 for the engine; 18788 is the unified port.
