---
name: ui-ux-fix
description: Use when fixing or improving the trading-ui. Triggers on: "fix UI", "Shadcn", "glassmorphism", "Framer Motion", "bilingual", "telemetry", "GEX", "Max Pain", "animations", "responsive".
---

# UI/UX Fix Skill — AetherDesk Prime

## 1. Design Tokens: Glassmorphism & High-Contrast Dark Mode
Always use these classes for consistent premium feel.

```css
/* Core Surfaces */
.bg-glass {
  @apply bg-black/40 backdrop-blur-xl border border-white/10;
}

.text-glow-profit {
  @apply text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)];
}

.text-glow-loss {
  @apply text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,113,0.4)];
}
```

## 2. Animation Patterns (Framer Motion)
Prefer `framer-motion` over raw CSS animations for complex transitions.

```tsx
import { motion } from 'framer-motion';

export const FadeIn = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
```

## 3. Bilingual WebSocket Parser Pattern
Handles both OpenAlgo and custom AetherDesk telemetry frames.

```typescript
// trading-ui/src/hooks/useTelemetry.ts
const parseTick = (raw: any) => {
    // OpenAlgo format
    if (raw.t === 'tk') return { ltp: raw.lp, symbol: raw.s };
    // AetherDesk Native format
    if (raw.type === 'TICK') return { ltp: raw.data.price, symbol: raw.data.symbol };
    return null;
}
```

## 4. Analytical Components (Lightweight Charts)
Institutional data viz patterns.

```tsx
// Pattern: High-Performance Chart Options
const chartOptions = {
    layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
    grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
    crosshair: { mode: CrosshairMode.Normal },
};
```

## 5. Responsive Constraints (Mobile-First)
- **Tables**: Use `overflow-x-auto` with fixed left column for symbols.
- **Modals**: Full-screen on mobile, centered dialog on desktop.
- **Navigation**: Bottom tab bar on mobile, sidebar on desktop.

## 6. Shadcn UI Component Fixes
- **Buttons**: Use `variant="outline"` for secondary, `variant="destructive"` for SELL.
- **Select**: Always provide `scroll-area` for large stock lists.
- **Toasts**: Auto-dismiss error notifications after 5s; 2s for success.

## [Agents: append new UI patterns for GEX/Analytics here]
