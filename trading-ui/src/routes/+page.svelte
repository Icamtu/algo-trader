<script lang="ts">
  import PriceChart from '$lib/components/PriceChart.svelte';
  import StrategyCard from '$lib/components/StrategyCard.svelte';
  import TradeBlotter from '$lib/components/TradeBlotter.svelte';
  import BacktestResults from '$lib/components/BacktestResults.svelte';
  import { publicConfig } from '$lib/config';
  import {
    appendPricePoint,
    formatPayloadPreview,
    normalizeOpenAlgoSymbol,
    toOrderBook,
    type DepthSnapshot,
    type MarketDataMessage,
    type MarketDataPayload,
    type OpenAlgoMessage,
    type OpenAlgoSessionResponse
  } from '$lib/openalgo';
  import {
    fetchStrategies,
    fetchPositions,
    fetchPnlData,
    startStrategy,
    stopStrategy,
    fetchBacktests,
    type Strategy,
    type Position,
    type BacktestResult
  } from '$lib/algo-trader-api';
  import { strategies as fallbackStrategies } from '$lib/mock-data';
  import type { OrderBookLevel, PricePoint, TradingSignal } from '$lib/types';
  import { onMount } from 'svelte';

  const DEFAULT_EXCHANGE = 'NSE';
  const MAX_PRICE_POINTS = 180;

  type LiveMarketSnapshot = MarketDataPayload;

  // State from real backend
  let strategies: Strategy[] = fallbackStrategies.map(s => ({
    id: s.id,
    name: s.name,
    symbols: [s.symbol],
    is_active: false,
    mode: s.mode,
    description: s.description,
    params: s.params
  }));
  let positions: Position[] = [];
  let backtests: BacktestResult[] = [];
  let totalPortfolioValue = 0;
  let totalPnlValue = 0;
  let backendConnected = false;

  let selectedStrategyId = strategies[0]?.id || '';
  let selectedStrategy = strategies[0];
  let selectedSymbol = selectedStrategy?.symbols?.[0] || 'RELIANCE-EQ';
  let selectedFeedSymbol = normalizeOpenAlgoSymbol(selectedSymbol);
  let selectedMarketKey = `${DEFAULT_EXCHANGE}:${selectedFeedSymbol}`;

  let connected = false;
  let authenticated = false;
  let lastTick = '';
  let wsError = '';
  let wsStatus = 'Disconnected';
  let resolvedWsUrl = publicConfig.publicWsUrl;

  let liveMarketByKey: Record<string, LiveMarketSnapshot> = {};
  let seriesByKey: Record<string, PricePoint[]> = {};
  let priceSeries: PricePoint[] = [];
  let latestPrice = 0;
  let latestPriceLabel = 'Waiting';
  let orderBook: { bids: OrderBookLevel[]; asks: OrderBookLevel[] } = { bids: [], asks: [] };

  let socket: WebSocket | undefined;
  let quoteSubscriptionsSent = false;
  let activeDepthTarget: { symbol: string; exchange: string } | null = null;

  let dominantSignal: TradingSignal = 'HOLD';
  let totalPnl = 0;
  let avgWinRate = 0;

  let startingStrategy: string | null = null;
  let stoppingStrategy: string | null = null;

  async function loadBackendData() {
    try {
      const [strats, posns, pnl, backtestData] = await Promise.all([
        fetchStrategies(),
        fetchPositions(),
        fetchPnlData(),
        fetchBacktests()
      ]);

      if (strats && strats.length > 0) {
        strategies = strats;
        if (!selectedStrategyId && strategies.length > 0) {
          selectedStrategyId = strategies[0].id;
        }
        backendConnected = true;
      }

      if (posns && posns.length > 0) {
        positions = posns;
        totalPortfolioValue = posns.reduce((sum, p) => sum + (p.current_value || 0), 0);
      }
      
      if (pnl) {
        totalPnlValue = pnl.total_pnl || 0;
      }

      if (backtestData) {
        backtests = backtestData;
      }

    } catch (error) {
      console.error('Error loading backend data:', error);
      backendConnected = false;
    }
  }

  async function pickStrategy(strategyId: string) {
    selectedStrategyId = strategyId;
  }

  async function handleStartStrategy(strategyId: string) {
    startingStrategy = strategyId;
    const success = await startStrategy(strategyId);
    if (success) {
      // Update local strategy state
      const idx = strategies.findIndex(s => s.id === strategyId);
      if (idx >= 0) {
        strategies[idx].is_active = true;
        strategies = [...strategies];
      }
    }
    startingStrategy = null;
  }

  async function handleStopStrategy(strategyId: string) {
    stoppingStrategy = strategyId;
    const success = await stopStrategy(strategyId);
    if (success) {
      // Update local strategy state
      const idx = strategies.findIndex(s => s.id === strategyId);
      if (idx >= 0) {
        strategies[idx].is_active = false;
        strategies = [...strategies];
      }
    }
    stoppingStrategy = null;
  }

  $: selectedStrategy = strategies.find((item) => item.id === selectedStrategyId) ?? strategies?.[0];
  $: selectedSymbol = selectedStrategy?.symbols?.[0] || 'RELIANCE-EQ';
  $: selectedFeedSymbol = normalizeOpenAlgoSymbol(selectedSymbol);
  $: selectedMarketKey = `${DEFAULT_EXCHANGE}:${selectedFeedSymbol}`;
  $: priceSeries = seriesByKey[selectedMarketKey] ?? [];
  $: latestPrice = liveMarketByKey[selectedMarketKey]?.ltp ?? priceSeries[priceSeries.length - 1]?.value ?? 0;
  $: latestPriceLabel = latestPrice > 0 ? latestPrice.toFixed(2) : 'Waiting';
  $: orderBook = toOrderBook(liveMarketByKey[selectedMarketKey]?.depth as DepthSnapshot | undefined);
  $: totalPnl = totalPnlValue;
  $: avgWinRate = strategies.length > 0 ? Number((strategies.filter(s => s.is_active).length / strategies.length * 100).toFixed(1)) : 0;
  $: {
    const votes: Record<TradingSignal, number> = { BUY: 0, SELL: 0, HOLD: 0 };
    const activeStrats = strategies.filter(s => s.is_active);
    if (activeStrats.length === 0) {
      dominantSignal = 'HOLD';
    } else {
      dominantSignal = 'HOLD';
    }
  }
  $: if (authenticated) {
    syncDepthSubscription();
  }

  onMount(() => {
    let disposed = false;

    // Load backend data on mount
    void loadBackendData();

    // Refresh backend data every 3 seconds
    const backendRefreshInterval = setInterval(() => {
      if (!disposed) {
        void loadBackendData();
      }
    }, 3000);

    const connect = async () => {
      wsStatus = 'Requesting OpenAlgo session';
      wsError = '';

      try {
        const response = await fetch('/api/openalgo/websocket-session', {
          credentials: 'include'
        });
        const session = (await response.json()) as OpenAlgoSessionResponse;

        if (!response.ok || session.status !== 'success') {
          connected = false;
          authenticated = false;
          wsStatus = 'Session unavailable';
          wsError = session.status === 'error' ? session.message : 'OpenAlgo websocket session request failed.';
          return;
        }

        if (disposed) {
          return;
        }

        resolvedWsUrl = session.websocketUrl || publicConfig.publicWsUrl;
        socket = new WebSocket(resolvedWsUrl);
        wsStatus = 'Connecting';

        socket.onopen = () => {
          if (disposed) {
            socket?.close(1000, 'Page disposed');
            return;
          }

          connected = true;
          authenticated = false;
          quoteSubscriptionsSent = false;
          activeDepthTarget = null;
          wsStatus = 'Authenticating';
          socket?.send(
            JSON.stringify({
              action: 'authenticate',
              api_key: session.apiKey
            })
          );
        };

        socket.onmessage = (event) => {
          if (typeof event.data === 'string') {
            handleWebSocketMessage(event.data);
          }
        };

        socket.onerror = () => {
          connected = false;
          authenticated = false;
          wsStatus = 'Feed error';
          wsError = 'OpenAlgo websocket connection error.';
        };

        socket.onclose = () => {
          connected = false;
          authenticated = false;
          quoteSubscriptionsSent = false;
          activeDepthTarget = null;
          if (!disposed) {
            wsStatus = 'Disconnected';
          }
        };
      } catch (error) {
        connected = false;
        authenticated = false;
        wsStatus = 'Connection failed';
        wsError = error instanceof Error ? error.message : 'Unable to connect to OpenAlgo.';
      }
    };

    void connect();

    return () => {
      disposed = true;
      clearInterval(backendRefreshInterval);
      socket?.close(1000, 'Trading UI closed');
    };
  });

  function handleWebSocketMessage(raw: string) {
    try {
      const message = JSON.parse(raw) as OpenAlgoMessage;
      lastTick = formatPayloadPreview(message);

      switch (message.type) {
        case 'auth':
          if (message.status === 'success') {
            authenticated = true;
            wsError = '';
            wsStatus = 'Authenticated';
            subscribeQuoteFeed();
            syncDepthSubscription();
          } else {
            authenticated = false;
            wsStatus = 'Authentication failed';
            wsError = message.message || 'OpenAlgo rejected websocket authentication.';
          }
          break;

        case 'subscribe':
          wsStatus = message.status === 'partial' ? 'Subscribed with warnings' : 'Subscriptions active';
          if (message.status && !['success', 'partial'].includes(message.status)) {
            wsError = message.message || 'Subscription request failed.';
          }
          break;

        case 'unsubscribe':
          wsStatus = 'Subscriptions updated';
          break;

        case 'error':
          wsStatus = 'Feed error';
          wsError = message.message || 'OpenAlgo websocket returned an error.';
          break;

        case 'market_data':
          wsStatus = 'Streaming real market data';
          mergeMarketData(message);
          break;
      }
    } catch {
      lastTick = raw.slice(0, 260);
    }
  }

  function mergeMarketData(message: MarketDataMessage) {
    const exchange = message.exchange.toUpperCase();
    const symbol = normalizeOpenAlgoSymbol(message.symbol);
    const key = `${exchange}:${symbol}`;
    const payload = message.data || {};
    const existing = liveMarketByKey[key] ?? {};
    const nextSnapshot: LiveMarketSnapshot = {
      ...existing,
      ltp: payload.ltp ?? existing.ltp,
      open: payload.open ?? existing.open,
      high: payload.high ?? existing.high,
      low: payload.low ?? existing.low,
      close: payload.close ?? existing.close,
      volume: payload.volume ?? existing.volume,
      change: payload.change ?? existing.change,
      change_percent: payload.change_percent ?? existing.change_percent,
      timestamp: payload.timestamp ?? existing.timestamp,
      bid_price: payload.bid_price ?? existing.bid_price,
      ask_price: payload.ask_price ?? existing.ask_price,
      bid_size: payload.bid_size ?? existing.bid_size,
      ask_size: payload.ask_size ?? existing.ask_size,
      depth: payload.depth ?? existing.depth
    };

    liveMarketByKey = {
      ...liveMarketByKey,
      [key]: nextSnapshot
    };

    if (typeof payload.ltp === 'number') {
      seriesByKey = {
        ...seriesByKey,
        [key]: appendPricePoint(seriesByKey[key] ?? [], payload.ltp, payload.timestamp, MAX_PRICE_POINTS)
      };
    }
  }

  function subscribeQuoteFeed() {
    if (quoteSubscriptionsSent || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const uniqueTargets = new Map<string, { symbol: string; exchange: string }>();
    for (const strategy of strategies) {
      const stratSymbols = strategy.symbols || [];
      for (const sym of stratSymbols) {
        const symbol = normalizeOpenAlgoSymbol(sym);
        uniqueTargets.set(`${DEFAULT_EXCHANGE}:${symbol}`, {
          symbol,
          exchange: DEFAULT_EXCHANGE
        });
      }
    }

    if (uniqueTargets.size === 0) {
      return;
    }

    socket.send(
      JSON.stringify({
        action: 'subscribe',
        symbols: Array.from(uniqueTargets.values()),
        mode: 'Quote'
      })
    );

    quoteSubscriptionsSent = true;
  }

  function syncDepthSubscription() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !authenticated) {
      return;
    }

    const nextTarget = {
      symbol: selectedFeedSymbol,
      exchange: DEFAULT_EXCHANGE
    };

    if (
      activeDepthTarget &&
      activeDepthTarget.symbol === nextTarget.symbol &&
      activeDepthTarget.exchange === nextTarget.exchange
    ) {
      return;
    }

    if (activeDepthTarget) {
      socket.send(
        JSON.stringify({
          action: 'unsubscribe',
          symbols: [{ ...activeDepthTarget, mode: 3 }],
          mode: 'Depth'
        })
      );
    }

    socket.send(
      JSON.stringify({
        action: 'subscribe',
        symbols: [nextTarget],
        mode: 'Depth'
      })
    );

    activeDepthTarget = nextTarget;
  }
</script>

<svelte:head>
  <title>Trading UI</title>
  <meta
    name="description"
    content="High-performance trading command center for OpenAlgo and algo-trader."
  />
</svelte:head>

<div class="page-shell">
  <aside class="sidebar">
    <div class="brand">
      <p class="kicker">2026 Trading Stack</p>
      <h1>Command Surface</h1>
      <p class="brand-copy">
        A fast control room for strategies, order flow, system status, and market pulse.
      </p>
    </div>

    <section class="env-panel">
      <div>
        <span class="mini-label">API</span>
        <strong>{publicConfig.publicApiUrl}</strong>
      </div>
      <div>
        <span class="mini-label">WebSocket</span>
        <strong>{resolvedWsUrl}</strong>
      </div>
      <div>
        <span class="mini-label">Feed</span>
        <strong class:ok={connected && authenticated}>{wsStatus}</strong>
      </div>
    </section>

    <section class="strategy-list">
      <div class="section-head">
        <h2>Strategy Stack</h2>
        <span>{strategies.length} online</span>
      </div>

      {#each strategies as strategy}
        <button class:selected={strategy.id === selectedStrategyId} on:click={() => pickStrategy(strategy.id)}>
          <span>{strategy.name}</span>
          <small>{strategy.is_active ? '▶ Running' : '⏸ Stopped'}</small>
        </button>
      {/each}
    </section>
  </aside>

  <main class="content">
    <section class="hero">
      <div>
        <p class="kicker">Active Strategy</p>
        <h2>{selectedStrategy.name}</h2>
        <p class="hero-copy">{selectedStrategy.description}</p>
      </div>
      <div class="hero-actions">
        <div class="badge">
          <span>Dominant Signal</span>
          <strong>{dominantSignal}</strong>
        </div>
        <div class="badge">
          <span>Primary Symbol</span>
          <strong>{selectedFeedSymbol}</strong>
        </div>
      </div>
    </section>

    <section class="metrics">
      <article>
        <span class="mini-label">Combined P&L</span>
        <strong>{totalPnl.toLocaleString()}</strong>
        <p>Real-time portfolio performance</p>
      </article>
      <article>
        <span class="mini-label">Active Strategies</span>
        <strong>{strategies.filter(s => s.is_active).length}/{strategies.length}</strong>
        <p>Running strategies count</p>
      </article>
      <article>
        <span class="mini-label">Last Price</span>
        <strong>{latestPriceLabel}</strong>
        <p>{selectedFeedSymbol} live OpenAlgo pulse</p>
      </article>
      <article>
        <span class="mini-label">Backend Status</span>
        <strong class:ok={backendConnected}>{backendConnected ? 'Connected' : 'Connecting'}</strong>
        <p>{backendConnected ? 'Real-time data sync active' : 'Loading algo-trader data...'}</p>
      </article>
    </section>

    <section class="grid">
      <div class="chart-panel">
        <PriceChart data={priceSeries} title={`${selectedStrategy.name} · ${selectedFeedSymbol}`} />
      </div>

      <div class="ops-panel">
        <section class="card-panel">
          <div class="section-head">
            <h2>Live Operator Feed</h2>
            <span>{wsStatus}</span>
          </div>
          <dl class="feed-grid">
            <div>
              <dt>Strategy status</dt>
              <dd>{selectedStrategy?.is_active ? '▶ Running' : '⏸ Stopped'}</dd>
            </div>
            <div>
              <dt>Execution mode</dt>
              <dd>{selectedStrategy?.mode || 'N/A'}</dd>
            </div>
            <div>
              <dt>Last payload</dt>
              <dd class="payload">{lastTick || 'Waiting for authenticated OpenAlgo websocket ticks.'}</dd>
            </div>
            {#if wsError}
              <div>
                <dt>Feed issue</dt>
                <dd class="payload">{wsError}</dd>
              </div>
            {/if}
          </dl>
        </section>

        <section class="card-panel">
          <div class="section-head">
            <h2>Strategy Parameters</h2>
            <span>Python-owned</span>
          </div>
          <div class="param-list">
            {#each Object.entries(selectedStrategy.params) as [key, value]}
              <div>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            {/each}
          </div>
        </section>
      </div>
    </section>

    <section class="cards-grid">
      {#each strategies as strategy}
        <StrategyCard
          strategy={strategy}
          selected={strategy.id === selectedStrategyId}
          onStart={() => handleStartStrategy(strategy.id)}
          onStop={() => handleStopStrategy(strategy.id)}
          isStarting={startingStrategy === strategy.id}
          isStopping={stoppingStrategy === strategy.id}
        />
      {/each}
    </section>

    <section class="backtest-results-section">
      <BacktestResults {backtests} />
    </section>

    <section class="depth-grid">
      <article class="card-panel">
        <div class="section-head">
          <h2>Order Book</h2>
          <span>{DEFAULT_EXCHANGE} · {selectedFeedSymbol}</span>
        </div>
        <div class="book book-asks">
          {#if orderBook.asks.length > 0}
            {#each orderBook.asks.slice().reverse() as ask}
              <div>
                <span>{ask.price.toFixed(2)}</span>
                <strong>{ask.quantity}</strong>
              </div>
            {/each}
          {:else}
            <div class="book-empty">Waiting for live depth asks.</div>
          {/if}
        </div>
        <div class="spread">Spread midpoint {latestPriceLabel}</div>
        <div class="book book-bids">
          {#if orderBook.bids.length > 0}
            {#each orderBook.bids as bid}
              <div>
                <span>{bid.price.toFixed(2)}</span>
                <strong>{bid.quantity}</strong>
              </div>
            {/each}
          {:else}
            <div class="book-empty">Waiting for live depth bids.</div>
          {/if}
        </div>
      </article>

      <article class="card-panel">
        <div class="section-head">
          <h2>Deployment Notes</h2>
          <span>Docker Ready</span>
        </div>
        <ul class="notes">
          <li>Use `INTERNAL_API_URL` so the SvelteKit server can fetch OpenAlgo websocket session data inside Docker.</li>
          <li>Use `PUBLIC_API_URL` and `PUBLIC_WS_URL` for browser-visible OpenAlgo endpoints on Tailscale.</li>
          <li>OpenAlgo login must already exist in the same browser session for websocket API-key exchange.</li>
          <li>Chart and order-book panels now consume real Quote and Depth payloads from OpenAlgo.</li>
        </ul>
      </article>
    </section>

    <!-- Trade History Blotter -->
    <div class="blotter-section">
      <TradeBlotter />
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family:
      'Avenir Next',
      'Segoe UI',
      sans-serif;
    background:
      radial-gradient(circle at top left, rgba(255, 168, 120, 0.18), transparent 24%),
      radial-gradient(circle at top right, rgba(105, 135, 255, 0.18), transparent 26%),
      linear-gradient(180deg, #06101b 0%, #0a1220 42%, #101828 100%);
    color: #eef4ff;
  }

  .page-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 290px 1fr;
  }

  .sidebar {
    padding: 1.35rem;
    border-right: 1px solid rgba(160, 184, 255, 0.08);
    background: rgba(5, 11, 21, 0.74);
    backdrop-filter: blur(22px);
  }

  .brand h1,
  .hero h2,
  .section-head h2 {
    margin: 0;
  }

  .kicker,
  .mini-label {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8ca6d6;
    font-size: 0.72rem;
  }

  .brand-copy,
  .hero-copy {
    color: #abc0e4;
    line-height: 1.6;
  }

  .env-panel,
  .strategy-list,
  .card-panel {
    margin-top: 1.1rem;
    padding: 1rem;
    border-radius: 24px;
    background: rgba(10, 19, 35, 0.88);
    border: 1px solid rgba(160, 184, 255, 0.1);
  }

  .env-panel {
    display: grid;
    gap: 0.9rem;
  }

  .env-panel strong {
    display: block;
    color: #f7fbff;
    word-break: break-all;
  }

  .ok {
    color: #84efb4;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.85rem;
  }

  .section-head span {
    color: #8ca6d6;
    font-size: 0.86rem;
  }

  .strategy-list {
    display: grid;
    gap: 0.75rem;
  }

  .strategy-list button {
    border: 1px solid rgba(160, 184, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 18px;
    color: inherit;
    padding: 0.9rem 1rem;
    display: flex;
    justify-content: space-between;
    cursor: pointer;
  }

  .strategy-list button.selected {
    background: linear-gradient(135deg, rgba(32, 58, 108, 0.7), rgba(22, 104, 86, 0.35));
    border-color: rgba(112, 164, 255, 0.45);
  }

  .content {
    padding: 1.4rem;
  }

  .hero,
  .metrics article {
    background: linear-gradient(135deg, rgba(12, 20, 35, 0.95), rgba(16, 28, 49, 0.86));
    border: 1px solid rgba(162, 186, 255, 0.1);
    box-shadow: 0 25px 60px rgba(4, 9, 18, 0.35);
  }

  .hero {
    padding: 1.2rem 1.35rem;
    border-radius: 28px;
    display: flex;
    justify-content: space-between;
    gap: 1.2rem;
    align-items: center;
  }

  .hero-actions {
    display: flex;
    gap: 0.9rem;
  }

  .badge {
    padding: 0.8rem 1rem;
    min-width: 150px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
  }

  .badge span {
    display: block;
    color: #91a8d6;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .badge strong {
    font-size: 1.1rem;
    margin-top: 0.2rem;
    display: block;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .metrics article {
    padding: 1rem;
    border-radius: 22px;
  }

  .metrics strong {
    display: block;
    font-size: 1.85rem;
    margin: 0.35rem 0;
  }

  .metrics p {
    margin: 0;
    color: #a9bddf;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.75fr) minmax(330px, 0.95fr);
    gap: 1rem;
    margin-top: 1rem;
  }

  .ops-panel {
    display: grid;
    gap: 1rem;
  }

  .feed-grid {
    display: grid;
    gap: 0.9rem;
    margin: 0;
  }

  dt {
    color: #89a4d7;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  dd {
    margin: 0.3rem 0 0;
    font-size: 1rem;
  }

  .payload {
    color: #b9c9e8;
    line-height: 1.45;
  }

  .param-list {
    display: grid;
    gap: 0.75rem;
  }

  .param-list div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid rgba(160, 184, 255, 0.08);
  }

  .param-list span {
    color: #9eb3db;
  }

  .cards-grid,
  .depth-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }

  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .depth-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .book {
    display: grid;
    gap: 0.45rem;
  }

  .book div {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.7rem;
    border-radius: 14px;
  }

  .book-asks div {
    background: rgba(255, 104, 104, 0.09);
  }

  .book-bids div {
    background: rgba(106, 233, 170, 0.08);
  }

  .book-empty {
    padding: 0.85rem 0.95rem;
    border-radius: 14px;
    background: rgba(16, 28, 49, 0.72);
    color: #8fa8d7;
    text-align: center;
  }

  .spread {
    text-align: center;
    margin: 0.8rem 0;
    color: #a4b8dd;
  }

  .notes {
    margin: 0;
    padding-left: 1.1rem;
    color: #b4c6e9;
    line-height: 1.7;
  }

  .blotter-section {
    margin-top: 1.5rem;
    padding: 0;
  }

  .backtest-results-section {
    margin-top: 1.5rem;
  }

  @media (max-width: 1200px) {
    .page-shell,
    .grid,
    .depth-grid,
    .cards-grid,
    .metrics {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid rgba(160, 184, 255, 0.08);
    }

    .hero {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
