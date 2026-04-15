# AetherDesk Prime — Tech Stack
# Type: Reference (update when versions or core components change)
# Purpose: Prevents agents hallucinating wrong dependencies

## Frontend (trading-ui / ui-builder)
| Package           | Version  | Notes                        |
|-------------------|----------|------------------------------|
| React             | 18.x     | Institutional Dashboards     |
| Vite              | 5.x      | Build Tool                   |
| Bun               | latest   | Runtime for `ui-builder`     |
| TypeScript        | 5.x      | Strict Mode                  |
| Tailwind CSS      | 3.4+     | Glassmorphism / Dark Mode    |
| Shadcn UI         | latest   | Component Library            |
| Framer Motion     | 11.x     | Micro-animations             |
| Supabase JS       | 2.x      | Auth / Metadata Client       |
| Node (build)      | 20-alpine| ARM64 compatible             |
| Nginx (serve)     | 1.25.x   | Production Web Server        |

## Backend (algo_engine / algo-trader)
| Library           | Version  | Notes                        |
|-------------------|----------|------------------------------|
| Python            | 3.12-slim| ARM64 Native                 |
| Flask             | 3.0.x    | REST API Control Plane       |
| Redis (redis-py)  | 5.x      | Async Caching & Signaling    |
| DuckDB            | 1.0.x    | Historify native analytics   |
| SQLite3           | standard | Trade logging & Risk DB      |
| PyOTP             | 2.x      | Shoonya 2FA automation       |
| Selenium          | 4.x      | Headless OAuth browser       |
| PyJWT             | 2.x      | Token validation             |

## AI & Reporting
| Component         | Integration | Role                        |
|-------------------|-------------|-----------------------------|
| Ollama            | v0.1.x      | Local LLM Core              |
| OpenClaw          | latest      | AI Analytics Gateway        |
| Claude Code       | latest      | Agentic Dev Environment     |

## Infrastructure
| Component         | Version  | Notes                        |
|-------------------|----------|------------------------------|
| Docker Compose    | v2       | Unified Orchestrator         |
| Supabase Auth     | v2.143+  | GoTrue Authentication        |
| PostgREST         | v12.0+   | Supabase REST API            |
| Kong              | 2.8+     | API Gateway / Local Kong     |
| MongoDB           | latest   | Historical strategy storage  |
| Tailscale         | latest   | Zero-config Secure Ingress   |

## Pinned Ports
- **18788**: Unified Engine API (REST)
- **5002**: WebSocket Telemetry (Ticks)
- **80**: Production UI (Nginx)
- **8000**: Supabase Kong (Auth/REST)
- **11434**: Ollama API

## [Agents: update versions here when upgrades are made]
