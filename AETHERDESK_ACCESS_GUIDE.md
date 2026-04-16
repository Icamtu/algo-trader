# AetherDesk Prime: Tailscale Access Guide

This document outlines the verified working access points for all services when connected via Tailscale.

## Node Information
- **Tailscale IP**: `<YOUR_TAILSCALE_IP>`
- **Machine Name**: `kamaleswaralgo-vcn`

## Service Access Points

| Service | Access URL | Purpose |
|---------|------------|---------|
| **AetherDesk Terminal** | [http://<YOUR_TAILSCALE_IP>](http://<YOUR_TAILSCALE_IP>) | Main Trading & Analytics Dashboard |
| **OpenAlgo Control** | [http://<YOUR_TAILSCALE_IP>:5000](http://<YOUR_TAILSCALE_IP>:5000) | Broker connections and API console |
| **OpenClaw Intelligence** | [http://<YOUR_TAILSCALE_IP>:18789](http://<YOUR_TAILSCALE_IP>:18789) | AI-powered reporting and monitoring |
| **Ollama AI Engine** | [http://<YOUR_TAILSCALE_IP>:11434](http://<YOUR_TAILSCALE_IP>:11434) | Local LLM API for strategy generation |
| **Supabase Dashboard** | [http://<YOUR_TAILSCALE_IP>:3000](http://<YOUR_TAILSCALE_IP>:3000) | Database and Auth management |
| **Algo-Engine API** | [http://<YOUR_TAILSCALE_IP>/algo-api/](http://<YOUR_TAILSCALE_IP>/algo-api/) | Real-time engine health and JSON API |

> [!TIP]
> All services listed above are proxied through a unified Nginx Gateway on Port 80. This eliminates the need to remember multiple port numbers and ensures a consistent security policy.

## Troubleshooting Connectivity

1. **Verify Tailscale Connection**: Ensure your device is connected to the same Tailscale network.
   ```bash
   tailscale ping <YOUR_TAILSCALE_IP>
   ```
2. **Shoonya Fixed IP Rule**: Shoonya API requires a fixed IP whitelist. The server's Oracle Public IP (`80.225.231.3`) is registered with the broker. **Do not change the `REDIRECT_URL` in `.env` to the Tailscale IP**, or the login handshake will fail.
3. **CORS/Mixed Content**: All internal communication is now strictly linked to the Tailscale IP. If you see blank screens, clear your browser cache to flush old redirect settings.

## Design Sync Status
> [!IMPORTANT]
> The platform has been synchronized with the latest codebase. All background containers have been rebuilt to purge "stale" assets. If you still see the "old design", perform a **Hard Refresh (Ctrl + Shift + R)** in your browser.
