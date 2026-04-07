# AlgoDesk — Architecture Reference

## 1. Dual-URL Architecture

### Service Mapping

| URL | Service | Description |
|-----|---------|-------------|
| `http://localhost:8080` | **Vite Dev Server** (trading-ui) | The React trading UI served by Vite during development. Hot-reloads on code change. This is the primary UI endpoint for developers. |
| `http://localhost:3001` | **Trading UI (production)** | The same React UI served via the Docker container (`trading-ui`) in production mode. Use this when the full Docker stack is running. |
| `http://localhost:5001` | **algo-engine API** | FastAPI/Flask backend powering all trading logic—strategies, orders, risk, backtesting. The UI's `api-client.ts` talks to this. |
| `http://localhost:5000` | **OpenAlgo** | Broker gateway (Shoonya/Finvasia). Handles authentication, order routing, market data feeds, and WebSocket streams. |
| `http://localhost:18789` | **OpenClaw** | AI gateway. Proxies to OpenRouter/Anthropic/Ollama for LLM-powered features: market scanning analysis, decision agent, chart annotation. |

> **Note**: Port `30012` is not mapped to any service in the current Docker Compose configuration. It was referenced as a secondary endpoint but no service occupies it.

### State Sharing

```
┌─────────────┐     HTTP/WS      ┌──────────────┐     HTTP      ┌──────────────┐
│  Trading UI │ ───────────────> │  algo-engine │ ────────────> │   OpenAlgo   │
│  :8080/3001 │                  │    :5001     │               │    :5000     │
└─────────────┘                  └──────┬───────┘               └──────────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │             │             │
                    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼──────┐
                    │   Redis   │ │  SQLite   │ │  OpenClaw  │
                    │ (cache)   │ │  (WAL)    │ │  :18789    │
                    └───────────┘ └───────────┘ └───────────┘
```

- **algo-engine** and **OpenAlgo** share the SQLite database (`openalgo.db`) via a Docker volume mount.
- **Redis** is used for caching and pub/sub between algo-engine and OpenAlgo.
- **OpenClaw** has read-only access to the shared DB and strategy files.
- **Trading UI** is stateless — all state lives in the backend.

### Which URL to Use (Remote SSH)

| Use Case | Target URL | Why |
|----------|-----------|-----|
| Development (editing UI code) | `:8080` | Vite dev server with HMR |
| Production trading session | `:3001` | Dockerized, stable build |
| Backend API debugging | `:5001` | Direct algo-engine access |
| Broker admin (OpenAlgo dashboard) | `:5000` | OpenAlgo's own web UI |
| AI gateway control | `:18789` | OpenClaw admin panel |
| Database admin | `:54321` | Supabase Studio |

### SSH Tunnel Commands

For a remote user connecting via SSH to the trading server:

```bash
# Primary trading UI (development)
ssh -L 8080:localhost:8080 user@trading-server

# Primary trading UI (production)
ssh -L 3001:localhost:3001 user@trading-server

# Full stack (recommended for remote trading sessions)
ssh -L 8080:localhost:8080 \
    -L 5001:localhost:5001 \
    -L 5000:localhost:5000 \
    -L 18789:localhost:18789 \
    -L 54321:localhost:54321 \
    user@trading-server

# Minimal (UI + API only)
ssh -L 8080:localhost:8080 -L 5001:localhost:5001 user@trading-server
```

---

## 2. Container Port Reference

| Service | Container Name | Container Port | Host Port | Protocol | SSH Tunnel |
|---------|---------------|----------------|-----------|----------|-----------|
| Trading UI (prod) | `trading-ui` | 3001 | **3001** | HTTP | `ssh -L 3001:localhost:3001 user@host` |
| Trading UI (dev) | N/A (local) | 8080 | **8080** | HTTP | `ssh -L 8080:localhost:8080 user@host` |
| OpenAlgo Web | `openalgo-web` | 5000 | **5000** | HTTP | `ssh -L 5000:localhost:5000 user@host` |
| OpenAlgo WebSocket | `openalgo-web` | 8765 | **8765** | WS | `ssh -L 8765:localhost:8765 user@host` |
| algo-engine | `algo_engine` | 5001 | **5001** | HTTP | `ssh -L 5001:localhost:5001 user@host` |
| Redis | `openalgo_redis` | 6379 | *(internal)* | TCP | N/A (no host port) |
| Supabase DB | `supabase-db` | 5432 | **54322** | PostgreSQL | `ssh -L 54322:localhost:54322 user@host` |
| Supabase Auth | `supabase-auth` | 9999 | *(internal)* | HTTP | N/A |
| Supabase REST | `supabase-rest` | 3000 | *(internal)* | HTTP | N/A (via Kong) |
| Supabase API (Kong) | `supabase-kong` | 8000 | **8000** | HTTP | `ssh -L 8000:localhost:8000 user@host` |
| Supabase Studio | `supabase-studio` | 3000 | **54321** | HTTP | `ssh -L 54321:localhost:54321 user@host` |
| Supabase Meta | `supabase-meta` | 8080 | *(internal)* | HTTP | N/A |
| Ollama | `local_ollama` | 11434 | **11434** | HTTP | `ssh -L 11434:localhost:11434 user@host` |
| OpenClaw | `openclaw` | 18789 | **18789** | HTTP | `ssh -L 18789:localhost:18789 user@host` |
| Stack Monitor | `stack_monitor` | — | — | — | N/A (background) |
