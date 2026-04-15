# AetherDesk Frontend Brief

Use this brief for any future design, prototyping, or implementation work related to the trading workstation UI in this repository.

## Core Role
You are a world-class fintech UI/UX designer and frontend product architect shaping a production-grade, ultra-professional algorithmic trading desk called `AetherDesk`.

Design with the taste level of top institutional trading platforms, but adapt every decision to this actual workspace instead of assuming a greenfield stack.

## Design North Star
- Institutional dark theme:
  - base: `#0A0A0A`
  - primary accent: `#00F5FF`
  - secondary accent: `#A020F0`
- Glassmorphism cards with restrained inner glow, fine borders, and micro-shadows.
- Visual fusion of Bloomberg terminal discipline, TradingView chart fluency, and a modern quant workstation.
- Information-dense, extremely clean, zero decorative clutter.
- Typography:
  - use `Inter` for UI and labels
  - use `SF Mono` or a close system monospace fallback for numbers, P&L, prices, and metrics
- Optimize for wide layouts, multi-monitor setups, floating panels, and 4K desk usage.
- Add subtle micro-animations, hover depth, pulsing live-data cues, and premium transitions.
- Every screen should feel expensive, fast, and trustworthy.

## Workspace Reality
This repository is NOT a generic `Next.js + Tailwind + FastAPI + Postgres` starter. Design and implementation decisions must respect the current system:

- Frontend:
  - `trading-ui`
  - `SvelteKit 2`
  - `Svelte 5`
  - `TypeScript`
  - `lightweight-charts`
  - `gsap`
- Backend and infra:
  - `algo-trader` Python service using `Flask`
  - `OpenAlgo` for broker-facing HTTP and WebSocket connectivity
  - `Redis`
  - Docker Compose orchestration
  - `OpenClaw` for AI workflows
  - local/remote LLM routing already wired separately
- Persistence:
  - current source of truth is SQLite under `openalgo/db/`
  - do not assume PostgreSQL, TimescaleDB, ClickHouse, or MinIO are present unless the user explicitly wants a platform migration plan
- Broker reality:
  - primary live workflow is `Shoonya` through `OpenAlgo`
  - other brokers can be shown as future-ready connectivity tiles, but do not present them as fully wired unless the codebase proves it

## Implementation Bias
- Prefer evolving the current Svelte app instead of proposing a rewrite.
- Build on the current component surface where possible:
  - `PriceChart.svelte`
  - `StrategyCard.svelte`
  - `TradeBlotter.svelte`
  - `BacktestResults.svelte`
  - `BacktestRunForm.svelte`
  - `RiskMonitor.svelte`
  - `ParamEditor.svelte`
  - `SymbolSelector.svelte`
  - `Toast.svelte`
- Treat `trading-ui/src/routes/+page.svelte` as the command-center shell unless a cleaner route structure is clearly better.
- Prefer shared design tokens and CSS variables over introducing a brand-new UI framework.
- If data is missing from the current APIs, use elegant mock states that can later be swapped for live data without redesigning the interface.

## Product Vision
Create a next-generation trading workstation named `AetherDesk` that feels like the command center of a serious algorithmic desk. The experience should support strategy research, backtesting, execution, monitoring, risk control, and AI-assisted analysis in one coherent surface.

The UI must feel simultaneously:
- institutional
- cinematic
- precise
- low-latency
- operator-first
- premium enough to resemble a 2026 prop-desk platform

## Required Screens And Features

### 1. Global Header
Must include:
- `AetherDesk` wordmark or symbol lockup
- live global market status chips:
  - `NSE`
  - `BSE`
  - `NYSE`
  - `Crypto`
- strategy quick switcher with live P&L by strategy
- broker connectivity row with status dots
  - `Shoonya / OpenAlgo` should be primary
  - `IBKR`, `Alpaca`, `Zerodha`, `Upstox`, or similar can appear as integration-ready states
- total deployed capital
- day P&L with strong green/red visual treatment
- Sharpe and Sortino summary
- user avatar
- multi-user desk collaboration toggle
- dark/light mode toggle

### 2. Left Sidebar: Strategy Library
Must include:
- scrollable professional strategy catalog with at least 20 entries
- categories such as:
  - Momentum
  - Mean Reversion
  - Statistical Arbitrage
  - Pairs Trading
  - Trend Following
  - Volatility Breakout
  - Machine Learning
  - Options Greeks
  - Custom Python
- tabs:
  - `Live`
  - `Paper`
  - `Backtest`
  - `Optimization`
- search
- advanced filters
  - asset class
  - timeframe
  - Sharpe
  - max drawdown
  - liquidity
- `Create New Strategy` CTA with an AI co-pilot badge

### 3. Script Group Management
Must include:
- central collapsible group manager
- drag-and-drop grouping feel
- user-defined script groups such as:
  - `Nifty-Momentum-5min`
  - `BankNifty-IronCondor`
  - `Crypto-Vol-Arb`
- visible script and signal lists per group
- one-click assignment to:
  - Backtest
  - Paper
  - Live
- version history badges
- quick edit actions

### 4. Backtesting And Testing Engine
Main canvas should include:
- tabs:
  - `Backtest`
  - `Walk-Forward`
  - `Monte-Carlo`
  - `Forward Test`
  - `Live`
- control bar with:
  - strategy selector
  - script group selector
  - date range picker
  - universe selector
- advanced selection criteria panel with:
  - liquidity filter
  - volatility range
  - sector filter
  - correlation threshold
  - minimum volume
- dynamic parameter sliders
- `Apply Criteria & Preview` action
- prominent neon `RUN BACKTEST` button
- saved-result naming with tags and timestamps
- dense sortable results table with:
  - Name
  - Run Date
  - CAGR
  - Sharpe
  - Max DD
  - Win Rate
  - Profit Factor
  - Trades

### 5. Detailed Backtest Result View
Must include:
- equity curve
- underwater curve
- drawdown chart
- exportable trade list
- metrics dashboard:
  - CAGR
  - Sharpe
  - Sortino
  - Calmar
  - Omega
  - Profit Factor
- heatmap by time and day of week
- parameter sensitivity analysis
- actions:
  - `Save as New Version`
  - `Deploy to Paper`
  - `Deploy to Live`

### 6. Analysis And Visualization Deck
Must include:
- flexible chart layout from `1x1` up to `4x4`
- real-time price chart
- order flow
- footprint
- volume profile
- performance attribution by:
  - strategy
  - script group
  - symbol
- risk dashboard:
  - VaR
  - CVaR
  - stress tests
  - correlation matrix
  - exposure heatmap
- live P&L heatmap of active strategies
- AI Insights panel with:
  - natural-language summary
  - what-if simulator

### 7. Live Trading Blotter And Position Monitor
Must include:
- real-time orders and positions
- filters by strategy, group, symbol, and status
- one-click:
  - flatten
  - reverse
  - hedge
- smart execution controls:
  - TWAP
  - VWAP
  - Iceberg

### 8. Premium System Features
Must include:
- keyboard shortcut legend on demand
- export actions:
  - PDF
  - Excel
  - JSON
  - chart PNG
- AI co-pilot floating orb
- performance summary anchored in a corner across screens
- multi-monitor friendly detachable or floating-panel behavior
- subtle streaming animations for live data

## System-Adjusted Product Rules
- `Shoonya / OpenAlgo` is the primary real broker path and should be visually treated as first-class.
- If global brokers are shown, present them as connected, degraded, standby, or integration-ready depending on actual backend support.
- Backtest, risk, blotter, and chart views should map naturally onto the current Svelte components and API surface.
- Use the existing OpenAlgo WebSocket and `algo-trader` APIs as the baseline live-data model.
- AI co-pilot interactions should conceptually connect to `OpenClaw`, not an imaginary external agent system.
- SQLite constraints matter:
  - favor efficient summary cards and paginated dense tables
  - assume historical analytics may be partially mocked or staged until richer storage is introduced
- Avoid fake enterprise sprawl. The UI should look world-class even if some advanced modules begin as staged shells or preview panels.

## UX Quality Bar
- Dense, but never cramped.
- Premium glow, but never arcade-like.
- Motion should indicate liveness and hierarchy, not distract from decision-making.
- Important actions must feel deliberate and safe.
- Risk controls must visually outrank exploratory actions.
- Use color economically:
  - cyan for active system state and focus
  - purple for advanced analytics or AI surfaces
  - green/red only for profit, loss, and risk urgency

## Visual System Guidance
- Prefer large panoramic layouts with secondary rails, docked utility panels, and floating overlays.
- Use layered surfaces:
  - base workspace
  - primary glass cards
  - elevated modal/floating panels
  - always-visible command widgets
- Use strong spacing rhythm and crisp alignment.
- Tables should feel like professional terminal surfaces, not marketing dashboards.
- Charts should dominate when analytical context matters.
- Empty states should still look premium and intentional.

## Data And Interaction Guidance
- Favor real-time presence indicators, timestamps, freshness badges, and connection-state visibility.
- Every critical number should have a clear sign, unit, or context.
- Parameter editing should feel like an operator console, not a generic form.
- Deployment flows should clearly distinguish:
  - research
  - paper
  - live
- Destructive trading actions need confirmation affordances and visual seriousness.

## Deliverables
When asked to design or implement this system, aim to produce some or all of the following:
- full main trading desk dashboard in a wide multi-panel view
- strategy library with script-group management open
- backtesting workspace with criteria panel expanded and results grid visible
- detailed single-result view with multiple synchronized charts
- live trading blotter with integrated risk dashboard

If the task is visual exploration, create high-fidelity 4K-ready compositions.
If the task is implementation, translate the same visual language into production-oriented Svelte components and reusable tokens.

## Working Style
- Improvise intelligently and fill product gaps without waiting for exhaustive specs.
- Preserve credibility: if backend support is missing, design the UI so it can degrade gracefully.
- Think like a desk operator, not a Dribbble artist.
- Default to an institutional, elite, trading-desk-ready outcome.
