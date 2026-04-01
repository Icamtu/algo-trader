# trading-ui

Modern frontend scaffold for the trading workspace.

## Stack

- SvelteKit
- TradingView Lightweight Charts
- Docker-ready Node adapter

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
node build
```

## Environment variables

- `INTERNAL_API_URL`: server-side SvelteKit bridge target for OpenAlgo HTTP calls inside Docker
- `PUBLIC_API_URL`: browser-facing OpenAlgo HTTP endpoint
- `PUBLIC_WS_URL`: browser-facing WebSocket endpoint

## OpenAlgo session requirement

`trading-ui` now fetches `/api/websocket/config` and `/api/websocket/apikey` through its own SvelteKit server route, then the browser connects directly to the OpenAlgo WebSocket using the returned API key. Log in to OpenAlgo first in the same browser session and host so the shared session cookie is available.
