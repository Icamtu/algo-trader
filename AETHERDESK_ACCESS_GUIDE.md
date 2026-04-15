# AetherDesk Prime: Tailscale Access Guide

This document outlines the verified working access points for all services when connected via Tailscale.

## Node Information
- **Tailscale IP**: `100.66.171.30`
- **Machine Name**: `kamaleswaralgo-vcn`

## Service Access Points

| Service | Access URL | Purpose |
|---------|------------|---------|
| **AetherDesk Terminal** | [http://100.66.171.30](http://100.66.171.30) | Main Trading & Analytics Dashboard |
| **OpenAlgo Control** | [http://100.66.171.30:5000](http://100.66.171.30:5000) | Broker connections and API console |
| **OpenClaw Intelligence** | [http://100.66.171.30:18789](http://100.66.171.30:18789) | AI-powered reporting and monitoring |
| **Ollama AI Engine** | [http://100.66.171.30:11434](http://100.66.171.30:11434) | Local LLM API for strategy generation |
| **Supabase Dashboard** | [http://100.66.171.30:3000](http://100.66.171.30:3000) | Database and Auth management |
| **Algo-Engine API** | [http://100.66.171.30/algo-api/](http://100.66.171.30/algo-api/) | Real-time engine health and JSON API |

> [!TIP]
> All services listed above are proxied through a unified Nginx Gateway on Port 80. This eliminates the need to remember multiple port numbers and ensures a consistent security policy.

## Troubleshooting Connectivity

1. **Verify Tailscale Connection**: Ensure your device is connected to the same Tailscale network.
   ```bash
   tailscale ping 100.66.171.30
   ```
2. **Shoonya Fixed IP Rule**: Shoonya API requires a fixed IP whitelist. The server's Oracle Public IP (`80.225.231.3`) is registered with the broker. **Do not change the `REDIRECT_URL` in `.env` to the Tailscale IP**, or the login handshake will fail.
3. **CORS/Mixed Content**: All internal communication is now strictly linked to the Tailscale IP. If you see blank screens, clear your browser cache to flush old redirect settings.

## Design Sync Status
> [!IMPORTANT]
> The platform has been synchronized with the latest codebase. All background containers have been rebuilt to purge "stale" assets. If you still see the "old design", perform a **Hard Refresh (Ctrl + Shift + R)** in your browser.
