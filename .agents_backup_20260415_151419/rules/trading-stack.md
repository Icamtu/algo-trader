---
trigger: always_on
description: These rules apply to ALL agents in every session. Never override them.
---

# Trading Workspace — Agent Rules

These rules apply to ALL agents in every session. Never override them.

## Stack Identity
- Frontend: `trading-ui` — React 18, Vite, TypeScript, Tailwind CSS, Supabase JS client, Nginx (prod)
- Backend: `algo_engine` — FastAPI, Python 3.11, Redis (async), DuckDB, vectorbt
- Broker bridge: `openalgo-web` — OpenAlgo → Shoonya/Finvasia
- Reporting: `openclaw_reports` — Flask, read-only OpenAlgo proxy
- Auth/DB: `supabase-db`, `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), `supabase-studio`
- Cache: `trading_cache` — Redis 7
- Infra: Docker Compose, Oracle Cloud ARM (aarch64), Tailscale ingress

## Non-Negotiable Output Rules
1. **Never truncate files.** Every output file must be complete. "// rest unchanged" or "# ... existing code ..." is a hard FAIL.
2. **Always provide runnable code.** No pseudo-code, no placeholder comments, no TODOs in fix output.
3. **Severity first.** Always address CRITICAL → HIGH → MEDIUM → LOW in that order.
4. **ARM64 awareness.** All Docker base images must be compatible with `linux/arm64`. Verify before suggesting.
5. **Env vars only.** No hardcoded secrets, URLs, or credentials anywhere — ever.
6. **Structured output.** Every finding: `SEVERITY | SERVICE | FILE | LINE | ISSUE | FIX`.
7. use english language only to reply/exlain to me.

## Known Production Issues (pre-loaded context)
- JWT secret mismatch between supabase-auth and supabase-rest → PostgREST 401 errors
- WebSocket connections in algo_engine not cleaned up on disconnect → exhaustion under load
- VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not injecting into trading-ui prod build
- supabase-studio was OOM-killed (no memory limit set)
- Ghost service was on host port 80 — audit all port bindings
- supabase-auth had SCRAM-SHA-256 crash-loop (missing supabase_auth_admin password)
- Missing `depends_on: condition: service_healthy` on most services

## Code Style
- Python: PEP 8, type hints everywhere, async/await (no sync blocking in async context)
- TypeScript: strict mode, no implicit any, functional components only
- Docker: multi-stage builds, non-root USER, pinned tags, .dockerignore present
- SQL: always parameterized — zero exceptions