import { a0 as fallback, e as escape_html, a1 as bind_props, a2 as attr_class, a3 as clsx, a4 as attr, a5 as ensure_array_like, a6 as head } from "../../chunks/index.js";
import "lightweight-charts";
function PriceChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = fallback($$props["data"], () => [], true);
    let title = fallback($$props["title"], "Market Pulse");
    $$renderer2.push(`<section class="chart-shell svelte-afumdx"><div class="chart-header svelte-afumdx"><div><p class="eyebrow svelte-afumdx">Live Chart</p> <h3 class="svelte-afumdx">${escape_html(title)}</h3></div></div> <div class="chart-frame svelte-afumdx"></div></section>`);
    bind_props($$props, { data, title });
  });
}
function StrategyCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let strategy = $$props["strategy"];
    let selected = fallback($$props["selected"], false);
    let onStart = fallback($$props["onStart"], void 0);
    let onStop = fallback($$props["onStop"], void 0);
    let isStarting = fallback($$props["isStarting"], false);
    let isStopping = fallback($$props["isStopping"], false);
    const modeIcon = {
      "Scalping": "⚡",
      "Trend Capture": "📈",
      "Position": "🎯",
      "Custom": "⚙️"
    };
    $$renderer2.push(`<article${attr_class("card svelte-1wuilrd", void 0, { "selected": selected })}><div class="top-row svelte-1wuilrd"><div class="svelte-1wuilrd"><p class="mode svelte-1wuilrd">${escape_html(modeIcon[strategy.mode] || "📊")} ${escape_html(strategy.mode)}</p> <h3 class="svelte-1wuilrd">${escape_html(strategy.name)}</h3> <p class="description svelte-1wuilrd">${escape_html(strategy.description)}</p></div> <div class="status-badge svelte-1wuilrd"><span${attr_class(`status ${strategy.is_active ? "active" : "inactive"}`, "svelte-1wuilrd")}>${escape_html(strategy.is_active ? "▶" : "⏸")}</span></div></div> <div class="stats svelte-1wuilrd"><div class="svelte-1wuilrd"><span class="label svelte-1wuilrd">Symbols</span> <strong class="svelte-1wuilrd">${escape_html(strategy.symbols.join(", "))}</strong></div> <div class="svelte-1wuilrd"><span class="label svelte-1wuilrd">Status</span> <strong${attr_class(clsx(strategy.is_active ? "running" : "stopped"), "svelte-1wuilrd")}>${escape_html(strategy.is_active ? "Running" : "Stopped")}</strong></div></div> <div class="actions svelte-1wuilrd">`);
    if (strategy.is_active) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="btn btn-stop svelte-1wuilrd"${attr("disabled", isStopping, true)}>${escape_html(isStopping ? "Stopping..." : "Stop")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button class="btn btn-start svelte-1wuilrd"${attr("disabled", isStarting, true)}>${escape_html(isStarting ? "Starting..." : "Start")}</button>`);
    }
    $$renderer2.push(`<!--]--></div></article>`);
    bind_props($$props, { strategy, selected, onStart, onStop, isStarting, isStopping });
  });
}
async function startStrategy(id) {
  const response = await fetch(`/api/algo-trader/strategies/${id}/start`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    console.error(`Failed to start strategy ${id}:`, response.statusText);
    return false;
  }
  return true;
}
async function stopStrategy(id) {
  const response = await fetch(`/api/algo-trader/strategies/${id}/stop`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    console.error(`Failed to stop strategy ${id}:`, response.statusText);
    return false;
  }
  return true;
}
function TradeBlotter($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let uniqueSymbols, uniqueStrategies;
    let trades = [];
    let filteredTrades = [];
    let selectedSymbol = "";
    let selectedStrategy = "";
    function formatTime(iso) {
      const date = new Date(iso);
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    function formatPrice(price) {
      if (!price) return "-";
      return price.toFixed(2);
    }
    function formatPnl(pnl) {
      if (pnl === void 0 || pnl === null) return "-";
      return pnl.toFixed(2);
    }
    uniqueSymbols = [...new Set(trades.map((t) => t.symbol))].sort();
    uniqueStrategies = [...new Set(trades.map((t) => t.strategy))].sort();
    $$renderer2.push(`<div class="trade-blotter svelte-rbekr2"><div class="header svelte-rbekr2"><h2 class="svelte-rbekr2">Trade History</h2> <div class="trade-count svelte-rbekr2">${escape_html(filteredTrades.length)} / ${escape_html(trades.length)} trades</div></div> <div class="controls svelte-rbekr2"><div class="filter-group svelte-rbekr2"><label for="symbol-filter" class="svelte-rbekr2">Symbol</label> `);
    $$renderer2.select(
      { id: "symbol-filter", value: selectedSymbol, class: "" },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All Symbols`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(uniqueSymbols);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let symbol = each_array[$$index];
          $$renderer3.option({ value: symbol }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(symbol)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-rbekr2"
    );
    $$renderer2.push(`</div> <div class="filter-group svelte-rbekr2"><label for="strategy-filter" class="svelte-rbekr2">Strategy</label> `);
    $$renderer2.select(
      { id: "strategy-filter", value: selectedStrategy, class: "" },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All Strategies`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(uniqueStrategies);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let strategy = each_array_1[$$index_1];
          $$renderer3.option({ value: strategy }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(strategy)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-rbekr2"
    );
    $$renderer2.push(`</div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="table-container svelte-rbekr2"><table class="svelte-rbekr2"><thead class="svelte-rbekr2"><tr><th class="svelte-rbekr2">Time ${escape_html("↓")}</th><th class="svelte-rbekr2">Strategy ${escape_html("")}</th><th class="svelte-rbekr2">Symbol ${escape_html("")}</th><th class="svelte-rbekr2">Side</th><th class="svelte-rbekr2">Quantity</th><th class="svelte-rbekr2">Price</th><th class="svelte-rbekr2">Status</th><th class="svelte-rbekr2">P&amp;L ${escape_html("")}</th></tr></thead><tbody class="svelte-rbekr2">`);
    if (filteredTrades.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<tr class="svelte-rbekr2"><td colspan="8" class="no-data svelte-rbekr2">No trades yet</td></tr>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_2 = ensure_array_like(filteredTrades);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let trade = each_array_2[$$index_2];
        $$renderer2.push(`<tr class="svelte-rbekr2"><td class="time svelte-rbekr2">${escape_html(formatTime(trade.timestamp))}</td><td class="strategy svelte-rbekr2">${escape_html(trade.strategy)}</td><td class="symbol svelte-rbekr2">${escape_html(trade.symbol)}</td><td${attr_class("side svelte-rbekr2", void 0, { "buy": trade.side === "BUY", "sell": trade.side === "SELL" })}>${escape_html(trade.side)}</td><td class="quantity svelte-rbekr2">${escape_html(trade.quantity)}</td><td class="price svelte-rbekr2">${escape_html(formatPrice(trade.price))}</td><td${attr_class("status svelte-rbekr2", void 0, {
          "filled": trade.status === "filled",
          "pending": trade.status === "pending",
          "rejected": trade.status === "rejected"
        })}>${escape_html(trade.status)}</td><td${attr_class("pnl svelte-rbekr2", void 0, {
          "positive": trade.pnl && trade.pnl > 0,
          "negative": trade.pnl && trade.pnl < 0
        })}>${escape_html(formatPnl(trade.pnl))}</td></tr>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></div>`);
  });
}
const publicConfig = {
  publicApiUrl: "http://100.87.27.92:5000",
  publicWsUrl: "ws://100.87.27.92:8765"
};
function normalizeOpenAlgoSymbol(rawSymbol) {
  return rawSymbol.trim().toUpperCase().replace(/^[A-Z_]+:/, "").replace(/-EQ$/, "");
}
function toOrderBook(depth) {
  if (!depth) {
    return { bids: [], asks: [] };
  }
  return {
    bids: depth.buy.map((level) => ({
      price: level.price,
      quantity: level.quantity
    })),
    asks: depth.sell.map((level) => ({
      price: level.price,
      quantity: level.quantity
    }))
  };
}
const strategies = [
  {
    id: "intraday",
    name: "Intraday Strategy",
    mode: "Scalping",
    symbol: "RELIANCE-EQ",
    description: "Fast threshold-based strategy tuned for rapid session reversals.",
    signal: "BUY",
    pnl: 18450,
    winRate: 63.8,
    activity: "High",
    params: {
      buy_above: 101,
      sell_below: 99,
      trade_quantity: 1
    }
  },
  {
    id: "swing",
    name: "Swing Strategy",
    mode: "Trend Capture",
    symbol: "RELIANCE-EQ",
    description: "EMA-based trend tracker for multi-session directional continuation.",
    signal: "HOLD",
    pnl: 9620,
    winRate: 58.2,
    activity: "Medium",
    params: {
      fast_period: 5,
      slow_period: 12,
      trade_quantity: 1
    }
  },
  {
    id: "longterm",
    name: "Long Term Strategy",
    mode: "Position",
    symbol: "RELIANCE-EQ",
    description: "Trend plus RSI confirmation for lower-frequency conviction entries.",
    signal: "BUY",
    pnl: 28120,
    winRate: 67.1,
    activity: "Low",
    params: {
      trend_period: 20,
      rsi_period: 14,
      buy_below_rsi: 45,
      sell_above_rsi: 65
    }
  },
  {
    id: "custom",
    name: "My First Strategy",
    mode: "Custom",
    symbol: "RELIANCE-EQ",
    description: "User-owned starter logic with editable thresholds in the Python backend.",
    signal: "SELL",
    pnl: 3120,
    winRate: 49.5,
    activity: "Medium",
    params: {
      buy_below_price: 95,
      sell_above_price: 105,
      trade_quantity: 1
    }
  }
];
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const DEFAULT_EXCHANGE = "NSE";
    let strategies$1 = strategies.map((s) => ({
      id: s.id,
      name: s.name,
      symbols: [s.symbol],
      is_active: false,
      mode: s.mode,
      description: s.description
    }));
    let totalPnlValue = 0;
    let backendConnected = false;
    let selectedStrategyId = strategies$1[0]?.id || "";
    let selectedStrategy = strategies$1[0];
    let selectedSymbol = selectedStrategy?.symbols?.[0] || "RELIANCE-EQ";
    let selectedFeedSymbol = normalizeOpenAlgoSymbol(selectedSymbol);
    let selectedMarketKey = `${DEFAULT_EXCHANGE}:${selectedFeedSymbol}`;
    let connected = false;
    let wsStatus = "Disconnected";
    let resolvedWsUrl = publicConfig.publicWsUrl;
    let liveMarketByKey = {};
    let seriesByKey = {};
    let priceSeries = [];
    let latestPrice = 0;
    let latestPriceLabel = "Waiting";
    let orderBook = { bids: [], asks: [] };
    let dominantSignal = "HOLD";
    let totalPnl = 0;
    let startingStrategy = null;
    let stoppingStrategy = null;
    async function handleStartStrategy(strategyId) {
      startingStrategy = strategyId;
      const success = await startStrategy(strategyId);
      if (success) {
        const idx = strategies$1.findIndex((s) => s.id === strategyId);
        if (idx >= 0) {
          strategies$1[idx].is_active = true;
          strategies$1 = [...strategies$1];
        }
      }
      startingStrategy = null;
    }
    async function handleStopStrategy(strategyId) {
      stoppingStrategy = strategyId;
      const success = await stopStrategy(strategyId);
      if (success) {
        const idx = strategies$1.findIndex((s) => s.id === strategyId);
        if (idx >= 0) {
          strategies$1[idx].is_active = false;
          strategies$1 = [...strategies$1];
        }
      }
      stoppingStrategy = null;
    }
    selectedStrategy = strategies$1.find((item) => item.id === selectedStrategyId) ?? strategies$1?.[0];
    selectedSymbol = selectedStrategy?.symbols?.[0] || "RELIANCE-EQ";
    selectedFeedSymbol = normalizeOpenAlgoSymbol(selectedSymbol);
    selectedMarketKey = `${DEFAULT_EXCHANGE}:${selectedFeedSymbol}`;
    priceSeries = seriesByKey[selectedMarketKey] ?? [];
    latestPrice = liveMarketByKey[selectedMarketKey]?.ltp ?? priceSeries[priceSeries.length - 1]?.value ?? 0;
    latestPriceLabel = latestPrice > 0 ? latestPrice.toFixed(2) : "Waiting";
    orderBook = toOrderBook(liveMarketByKey[selectedMarketKey]?.depth);
    totalPnl = totalPnlValue;
    strategies$1.length > 0 ? Number((strategies$1.filter((s) => s.is_active).length / strategies$1.length * 100).toFixed(1)) : 0;
    {
      const activeStrats = strategies$1.filter((s) => s.is_active);
      if (activeStrats.length === 0) {
        dominantSignal = "HOLD";
      } else {
        dominantSignal = "HOLD";
      }
    }
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Trading UI</title>`);
      });
      $$renderer3.push(`<meta name="description" content="High-performance trading command center for OpenAlgo and algo-trader."/>`);
    });
    $$renderer2.push(`<div class="page-shell svelte-1uha8ag"><aside class="sidebar svelte-1uha8ag"><div class="brand svelte-1uha8ag"><p class="kicker svelte-1uha8ag">2026 Trading Stack</p> <h1 class="svelte-1uha8ag">Command Surface</h1> <p class="brand-copy svelte-1uha8ag">A fast control room for strategies, order flow, system status, and market pulse.</p></div> <section class="env-panel svelte-1uha8ag"><div><span class="mini-label svelte-1uha8ag">API</span> <strong class="svelte-1uha8ag">${escape_html(publicConfig.publicApiUrl)}</strong></div> <div><span class="mini-label svelte-1uha8ag">WebSocket</span> <strong class="svelte-1uha8ag">${escape_html(resolvedWsUrl)}</strong></div> <div><span class="mini-label svelte-1uha8ag">Feed</span> <strong${attr_class("svelte-1uha8ag", void 0, { "ok": connected })}>${escape_html(wsStatus)}</strong></div></section> <section class="strategy-list svelte-1uha8ag"><div class="section-head svelte-1uha8ag"><h2 class="svelte-1uha8ag">Strategy Stack</h2> <span class="svelte-1uha8ag">${escape_html(strategies$1.length)} online</span></div> <!--[-->`);
    const each_array = ensure_array_like(strategies$1);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let strategy = each_array[$$index];
      $$renderer2.push(`<button${attr_class("svelte-1uha8ag", void 0, { "selected": strategy.id === selectedStrategyId })}><span>${escape_html(strategy.name)}</span> <small>${escape_html(strategy.is_active ? "▶ Running" : "⏸ Stopped")}</small></button>`);
    }
    $$renderer2.push(`<!--]--></section></aside> <main class="content svelte-1uha8ag"><section class="hero svelte-1uha8ag"><div><p class="kicker svelte-1uha8ag">Active Strategy</p> <h2 class="svelte-1uha8ag">${escape_html(selectedStrategy.name)}</h2> <p class="hero-copy svelte-1uha8ag">${escape_html(selectedStrategy.description)}</p></div> <div class="hero-actions svelte-1uha8ag"><div class="badge svelte-1uha8ag"><span class="svelte-1uha8ag">Dominant Signal</span> <strong class="svelte-1uha8ag">${escape_html(dominantSignal)}</strong></div> <div class="badge svelte-1uha8ag"><span class="svelte-1uha8ag">Primary Symbol</span> <strong class="svelte-1uha8ag">${escape_html(selectedFeedSymbol)}</strong></div></div></section> <section class="metrics svelte-1uha8ag"><article class="svelte-1uha8ag"><span class="mini-label svelte-1uha8ag">Combined P&amp;L</span> <strong class="svelte-1uha8ag">${escape_html(totalPnl.toLocaleString())}</strong> <p class="svelte-1uha8ag">Real-time portfolio performance</p></article> <article class="svelte-1uha8ag"><span class="mini-label svelte-1uha8ag">Active Strategies</span> <strong class="svelte-1uha8ag">${escape_html(strategies$1.filter((s) => s.is_active).length)}/${escape_html(strategies$1.length)}</strong> <p class="svelte-1uha8ag">Running strategies count</p></article> <article class="svelte-1uha8ag"><span class="mini-label svelte-1uha8ag">Last Price</span> <strong class="svelte-1uha8ag">${escape_html(latestPriceLabel)}</strong> <p class="svelte-1uha8ag">${escape_html(selectedFeedSymbol)} live OpenAlgo pulse</p></article> <article class="svelte-1uha8ag"><span class="mini-label svelte-1uha8ag">Backend Status</span> <strong${attr_class("svelte-1uha8ag", void 0, { "ok": backendConnected })}>${escape_html("Connecting")}</strong> <p class="svelte-1uha8ag">${escape_html("Loading algo-trader data...")}</p></article></section> <section class="grid svelte-1uha8ag"><div class="chart-panel">`);
    PriceChart($$renderer2, {
      data: priceSeries,
      title: `${selectedStrategy.name} · ${selectedFeedSymbol}`
    });
    $$renderer2.push(`<!----></div> <div class="ops-panel svelte-1uha8ag"><section class="card-panel svelte-1uha8ag"><div class="section-head svelte-1uha8ag"><h2 class="svelte-1uha8ag">Live Operator Feed</h2> <span class="svelte-1uha8ag">${escape_html(wsStatus)}</span></div> <dl class="feed-grid svelte-1uha8ag"><div><dt class="svelte-1uha8ag">Strategy status</dt> <dd class="svelte-1uha8ag">${escape_html(selectedStrategy?.is_active ? "▶ Running" : "⏸ Stopped")}</dd></div> <div><dt class="svelte-1uha8ag">Execution mode</dt> <dd class="svelte-1uha8ag">${escape_html(selectedStrategy?.mode || "N/A")}</dd></div> <div><dt class="svelte-1uha8ag">Last payload</dt> <dd class="payload svelte-1uha8ag">${escape_html("Waiting for authenticated OpenAlgo websocket ticks.")}</dd></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></dl></section> <section class="card-panel svelte-1uha8ag"><div class="section-head svelte-1uha8ag"><h2 class="svelte-1uha8ag">Strategy Parameters</h2> <span class="svelte-1uha8ag">Python-owned</span></div> <div class="param-list svelte-1uha8ag"><!--[-->`);
    const each_array_1 = ensure_array_like(Object.entries(selectedStrategy.params));
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let [key, value] = each_array_1[$$index_1];
      $$renderer2.push(`<div class="svelte-1uha8ag"><span class="svelte-1uha8ag">${escape_html(key)}</span> <strong>${escape_html(value)}</strong></div>`);
    }
    $$renderer2.push(`<!--]--></div></section></div></section> <section class="cards-grid svelte-1uha8ag"><!--[-->`);
    const each_array_2 = ensure_array_like(strategies$1);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let strategy = each_array_2[$$index_2];
      StrategyCard($$renderer2, {
        strategy,
        selected: strategy.id === selectedStrategyId,
        onStart: () => handleStartStrategy(strategy.id),
        onStop: () => handleStopStrategy(strategy.id),
        isStarting: startingStrategy === strategy.id,
        isStopping: stoppingStrategy === strategy.id
      });
    }
    $$renderer2.push(`<!--]--></section> <section class="depth-grid svelte-1uha8ag"><article class="card-panel svelte-1uha8ag"><div class="section-head svelte-1uha8ag"><h2 class="svelte-1uha8ag">Order Book</h2> <span class="svelte-1uha8ag">NSE · ${escape_html(selectedFeedSymbol)}</span></div> <div class="book book-asks svelte-1uha8ag">`);
    if (orderBook.asks.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_3 = ensure_array_like(orderBook.asks.slice().reverse());
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let ask = each_array_3[$$index_3];
        $$renderer2.push(`<div class="svelte-1uha8ag"><span>${escape_html(ask.price.toFixed(2))}</span> <strong>${escape_html(ask.quantity)}</strong></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="book-empty svelte-1uha8ag">Waiting for live depth asks.</div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="spread svelte-1uha8ag">Spread midpoint ${escape_html(latestPriceLabel)}</div> <div class="book book-bids svelte-1uha8ag">`);
    if (orderBook.bids.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_4 = ensure_array_like(orderBook.bids);
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        let bid = each_array_4[$$index_4];
        $$renderer2.push(`<div class="svelte-1uha8ag"><span>${escape_html(bid.price.toFixed(2))}</span> <strong>${escape_html(bid.quantity)}</strong></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="book-empty svelte-1uha8ag">Waiting for live depth bids.</div>`);
    }
    $$renderer2.push(`<!--]--></div></article> <article class="card-panel svelte-1uha8ag"><div class="section-head svelte-1uha8ag"><h2 class="svelte-1uha8ag">Deployment Notes</h2> <span class="svelte-1uha8ag">Docker Ready</span></div> <ul class="notes svelte-1uha8ag"><li>Use \`INTERNAL_API_URL\` so the SvelteKit server can fetch OpenAlgo websocket session data inside Docker.</li> <li>Use \`PUBLIC_API_URL\` and \`PUBLIC_WS_URL\` for browser-visible OpenAlgo endpoints on Tailscale.</li> <li>OpenAlgo login must already exist in the same browser session for websocket API-key exchange.</li> <li>Chart and order-book panels now consume real Quote and Depth payloads from OpenAlgo.</li></ul></article></section> <div class="blotter-section svelte-1uha8ag">`);
    TradeBlotter($$renderer2);
    $$renderer2.push(`<!----></div></main></div>`);
  });
}
export {
  _page as default
};
