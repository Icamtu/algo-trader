---
description: Pre-deployment sanity gate for builds, ports, healthchecks, and broker connectivity.
---

# AetherDesk Prime — Pre-Deployment Gate
# Workflow: /deploy-check

Run this gate before any production release or high-risk configuration change.

## 1. 🏗️ Build & Unification Integrity
- **UI Sync**: Verify `ui-builder` successfully emitted `trading-ui/dist/index.html`.
- **JWT Secret**: Confirm identical string in `.env` (JWT_SECRET) and `supabase/.env` (GOTRUE_JWT_SECRET).
- **Environment**: Check `VITE_SUPABASE_URL` matches `${TAILSCALE_IP}:8000`.
- **Architecture**: `docker context show` must indicate `linux/arm64` if on target hardware.

## 2. 🔌 Port & Network Guardrails
- **Host Exposure**: Only port **80, 18788, 5002, 8000, 11434** should be visible via `netstat -tulpn`.
- **Fail Check**: If `supabase-db` port 5432 is exposed to the internet, **AUTO-BLOCK**.
- **Internal Resolver**: Ping `openalgo-web` from inside `algo_engine` container.

## 3. 💓 System Vital Audit
- **Health Chain**: `docker compose ps` must show `healthy` for Redis, OpenAlgo, and Engine.
- **Resource Pressure**: Any container at > 90% `mem_limit` fails the gate.
- **Shoonya Session**: Run `python3 utils/verify_auth.py` to confirm active broker link.

## 4. 📝 Log Scanner (Deep-Audit)
Scan last 5 minutes of logs for:
- `Connection Pool Exhausted` (Redis/DuckDB).
- `Handshake Error` (WebSocket).
- `401 Unauthorized` (JWT/PostgREST).
- `OOM-Killed`.

## 5. 🏁 Deployment Verdict
| Check | Status | Action Required |
|-------|--------|-----------------|
| UI Integrity | [ ] | Run `bun x vite build` |
| Auth Sync | [ ] | Align JWT_SECRET |
| Data Flow | [ ] | Check Historify mount |

**Verdict**: [GO / NO-GO]
