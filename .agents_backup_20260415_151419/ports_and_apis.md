# Ports and APIs Reference

This document lists all the ports and API endpoints used in the AetherDesk Prime / OpenAlgo trading platform.

## Services & Ports

| Service            | External Port | Internal Port | Protocol | Description                                     |
|--------------------|---------------|---------------|----------|-------------------------------------------------|
| **Trading UI**     | `3001`        | `3001`        | HTTP     | Main web interface (React/Vite)                 |
| **Supabase Kong**  | `8000`        | `8000`        | HTTP     | API Gateway for Supabase services               |
| **Supabase Kong**  | `8443`        | `8443`        | HTTPS    | Secure API Gateway                              |
| **Supabase Studio**| `54321`       | `3000`        | HTTP     | Supabase Dashboard / Database Manager           |
| **Supabase DB**    | `54322`       | `5432`        | TCP      | PostgreSQL Database                             |
| **OpenAlgo API**   | `5000`        | `5000`        | HTTP     | Core Trading API (REST)                         |
| **OpenAlgo WS**    | `8765`        | `8765`        | WS       | Real-time WebSocket Feed                        |
| **Ollama**         | `11434`       | `11434`       | HTTP     | Local AI Inference Engine                       |
| **OpenClaw UI**    | `18789`       | `18789`       | HTTP     | OpenClaw Agent Interface                        |
| **Redis**          | N/A           | `6379`        | TCP      | Message broker / Cache (Internal only)          |
| **Algo Engine**    | N/A           | `5001`        | HTTP     | Trading Execution Engine (Health check only)    |

## Internal API Endpoints

-   **OpenAlgo API**: `http://openalgo-web:5000`
-   **Ollama API**: `http://ollama_engine:11434`
-   **Supabase Auth**: `http://supabase-auth:9999`
-   **Supabase Rest**: `http://supabase-rest:3000`

## Accessing Services

-   **Trading Dashboard**: [http://localhost:3001](http://localhost:3001)
-   **Database Manager**: [http://localhost:54321](http://localhost:54321)
-   **OpenClaw**: [http://localhost:18789](http://localhost:18789)
