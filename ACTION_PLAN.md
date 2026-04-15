# AlgoDesk Action Plan (Rebuild Phase)

## P0 — Security & Data Integrity
- [ ] Remove hardcoded API key from `lib/config.ts`.
- [ ] Add trading mode gate to backend proxy calls (Backend Fix).
- [ ] Ensure all fetch calls use `CONFIG.API_BASE_URL` and respect environment variables.

## P1 — Core Trading Flow (OpenAlgo v1 Alignment)
- [ ] Add `modifyorder` to `algoApi`.
- [ ] Align `cancelorder` and `cancelallorder` with POST methods in `algoApi`.
- [ ] Add `getOpenPosition` and `splitOrder` to `algoApi`.
- [ ] Add confirmation modal to `GlobalHeader.tsx` for LIVE mode switch.
- [ ] Add amber banner for Sandbox mode to `GlobalHeader.tsx`.

## P2 — Engineering & Real-time
- [ ] Refactor `UnifiedSettings.tsx` to 380px right-side slide-over panel.
- [ ] Implement all 5 sections in Settings: Broker Manager, View Styles, AI Config, System Config, Security.
- [ ] Fix WebSocket URL to `/algo-ws`.
- [ ] Add abort controllers to health/log fetches in `Infrastructure.tsx`.

## P3 — Industrial Polish & Layout
- [ ] Apply `JetBrains Mono` and `Inter` font system.
- [ ] Refactor main layout structure (Header, Nav, Main, Right, Footer).
- [ ] Add price flash micro-animations to tick updates.
- [ ] Implement remaining view panels (Basket Orders, Strategy Webhooks).
