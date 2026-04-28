import { CONFIG } from "@/lib/config";
import {
  ApiError,
  type PlaceOrderRequest,
  type RiskLimitUpdates,
  type IndicatorPayload,
  type SystemSettings,
  type BacktestRequest,
  type BacktestResponse
} from "@/types/api";

import { supabase } from "@/integrations/supabase/client";

const ALGO_TRADER_URL = CONFIG.API_BASE_URL;

// ─── Base Fetch Utility ──────────────────────────────────────────
const baseFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText, status: response.status }));
    throw new ApiError(response.status, body.error || `HTTP error! status: ${response.status}`, body);
  }
  return response.json();
};

// ─── OpenAlgo Client Definition ──────────────────────────────────
export const openAlgoClient = async (endpoint: string, options: RequestInit = {}) => {
  const mode = localStorage.getItem("algodesk_mode") || "sandbox";

  // Get current Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    "Content-Type": "application/json",
    "apikey": CONFIG.API_KEY,
    "X-Trading-Mode": mode,
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };
  return baseFetch(`${ALGO_TRADER_URL}${endpoint}`, { ...options, headers });
};

export const algoApi = {
  // Strategies
  getStrategies: () => openAlgoClient("/api/v1/strategies"),
  getStrategy: (id: string) => openAlgoClient(`/api/v1/strategies/${id}`),
  activateStrategy: (id: string) => openAlgoClient(`/api/v1/strategies/${id}/activate`, { method: "POST" }),
  startStrategy: (id: string, config?: Record<string, unknown>) =>
    openAlgoClient(`/api/v1/strategies/${id}/start`, {
      method: "POST",
      ...(config ? { body: JSON.stringify(config) } : {})
    }),
  stopStrategy: (id: string, squareOff = true) =>
    openAlgoClient(`/api/v1/strategies/${id}/stop`, {
      method: "POST",
      body: JSON.stringify({ square_off: squareOff })
    }),
  getStrategyPerformance: (id: string) => openAlgoClient(`/api/v1/strategies/${id}/performance`),
  getStrategyOrders: (id: string, limit = 100) => openAlgoClient(`/api/v1/strategies/${id}/orders?limit=${limit}`),
  liquidateStrategy: (id: string) => openAlgoClient(`/api/v1/strategies/${id}/liquidate`, { method: "POST" }),
  updateStrategyParams: (id: string, params: Record<string, unknown>) =>
    openAlgoClient(`/api/v1/strategies/${id}/config`, { method: "PATCH", body: JSON.stringify(params) }),
  createStrategy: (data: { name: string, template?: string }) =>
    openAlgoClient("/api/v1/strategies", { method: "POST", body: JSON.stringify(data) }),
  deleteStrategy: (id: string) => openAlgoClient(`/api/v1/strategies/${id}`, { method: "DELETE" }),

  // Strategy Files (Physical storage)
  getStrategyFiles: () => openAlgoClient("/api/v1/strategies/files"),
  getStrategyFile: (filename: string) => openAlgoClient(`/api/v1/strategies/files/${filename}`),
  saveStrategyFile: (filename: string, content: string) =>
    openAlgoClient(`/api/v1/strategies/files/${filename}`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteStrategyFile: (filename: string) => openAlgoClient(`/api/v1/strategies/files/${filename}`, { method: "DELETE" }),
  renameStrategyFile: (filename: string, newFilename: string) =>
    openAlgoClient(`/api/v1/strategies/files/${filename}/rename`, { method: "POST", body: JSON.stringify({ new_filename: newFilename }) }),
  getStrategyVersions: (filename: string) => openAlgoClient(`/api/v1/strategies/files/${filename}/versions`),

  // Positions & P&L
  getPositions: () => openAlgoClient("/api/v1/positionbook"),
  getHoldings: () => openAlgoClient("/api/v1/holdings"),
  getPnl: () => openAlgoClient("/api/v1/pnl"),
  getRiskMetrics: () => openAlgoClient("/api/v1/risk-metrics"),

  // Orders
  getOrders: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return openAlgoClient(`/api/v1/orderbook${query}`);
  },
  getTradebook: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return openAlgoClient(`/api/v1/tradebook${query}`);
  },
  getTradesBySymbol: (symbol: string, limit = 50) =>
    openAlgoClient(`/api/v1/tradebook?symbol=${symbol}&limit=${limit}`),
  getTradesByStrategy: (strategy: string, limit = 100) =>
    openAlgoClient(`/api/v1/tradebook?strategy=${strategy}&limit=${limit}`),
  getOpenPositions: () => openAlgoClient("/api/v1/tradebook/open"),
  getOrderStatus: (orderId: string) =>
    openAlgoClient("/api/v1/orderstatus", { method: "POST", body: JSON.stringify({ orderid: orderId }) }),
  cancelOrder: (id: string) =>
    openAlgoClient("/api/v1/cancelorder", { method: "POST", body: JSON.stringify({ orderid: id }) }),
  modifyOrder: (params: Record<string, any>) =>
    openAlgoClient("/api/v1/modifyorder", { method: "POST", body: JSON.stringify(params) }),
  splitOrder: (params: Record<string, any>) =>
    openAlgoClient("/api/v1/splitorder", { method: "POST", body: JSON.stringify(params) }),
  cancelAllOrders: () => openAlgoClient("/api/v1/cancelallorder", { method: "POST" }),

  // Order Placement
  placeOrder: (order: PlaceOrderRequest) =>
    openAlgoClient("/api/v1/placeorder", { method: "POST", body: JSON.stringify(order) }),
  smartOrder: (order: Record<string, unknown>) =>
    openAlgoClient("/api/v1/placesmartorder", { method: "POST", body: JSON.stringify(order) }),
  basketOrder: (orders: Record<string, unknown>[]) =>
    openAlgoClient("/api/v1/basketorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Square-off
  exitPosition: (symbol: string) =>
    openAlgoClient("/api/v1/exitposition", { method: "POST", body: JSON.stringify({ symbol }) }),
  closePosition: () => openAlgoClient("/api/v1/closeposition", { method: "POST" }),

  // Funds
  getFunds: () => openAlgoClient("/api/v1/funds"),

  // Risk Management
  getRiskStatus: () => openAlgoClient("/api/v1/risk/status"),
  getRiskMatrix: () => openAlgoClient("/api/v1/risk/matrix"),
  getStrategySafeguards: (id: string) => openAlgoClient(`/api/v1/risk/safeguards/${id}`),
  updateStrategySafeguards: (id: string, safeguards: any) =>
    openAlgoClient(`/api/v1/risk/safeguards/${id}`, { method: "POST", body: JSON.stringify(safeguards) }),
  updateRiskLimits: (updates: RiskLimitUpdates) =>
    openAlgoClient("/api/v1/risk/limits", { method: "PUT", body: JSON.stringify(updates) }),

  // Mode
  getMode: () => openAlgoClient("/api/v1/mode"),
  setMode: (mode: string) =>
    openAlgoClient("/api/v1/mode", { method: "POST", body: JSON.stringify({ mode }) }),

  // System
  getSystemSettings: () => openAlgoClient("/api/v1/settings"),
  updateSystemSettings: (updates: Partial<SystemSettings>) =>
    openAlgoClient("/api/v1/settings", { method: "PUT", body: JSON.stringify(updates) }),
  getSystemStatus: () => openAlgoClient("/api/v1/system/health"),
  getSystemLogs: () => openAlgoClient("/api/v1/system/logs"),
  reconcilePositions: () => openAlgoClient("/api/v1/system/reconcile", { method: "POST" }),
  getTickerConfig: () => openAlgoClient("/api/v1/system/config/ticker"),
  resetPositions: () => openAlgoClient("/api/v1/system/reconcile/reset", { method: "POST" }),
  getTelemetry: () => openAlgoClient("/api/v1/telemetry"),
  getTelemetryPnl: () => openAlgoClient("/api/v1/telemetry/pnl"),
  getTelemetryPerformance: () => openAlgoClient("/api/v1/telemetry/performance"),

  // Symbols & Quotes
  searchSymbols: (query: string) => openAlgoClient(`/api/v1/symbol/search?q=${encodeURIComponent(query)}`),
  getQuotes: (symbols: string[]) => openAlgoClient(`/api/v1/quotes?symbols=${symbols.join(",")}`),
  getDepth: (symbol: string) => openAlgoClient(`/api/v1/depth?symbol=${encodeURIComponent(symbol)}`),
  getMarketBreadth: () => openAlgoClient("/api/v1/historify/breadth"),
  getHistorifyBreadth: () => openAlgoClient("/api/v1/historify/breadth"),
  getHistorifySymbols: () => openAlgoClient("/api/v1/historify/symbols"),

  // Historical Data & Indicators
  getHistory: (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return openAlgoClient(`/api/v1/history?${query}`);
  },
  calculateIndicators: (data: IndicatorPayload) =>
    openAlgoClient("/api/v1/indicators", { method: "POST", body: JSON.stringify(data) }),

  // Expert Terminal & Options
  getOptionChain: (symbol: string, expiry: string) =>
    openAlgoClient(`/api/v1/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`),
  getOptionGreeks: (symbol: string) =>
    openAlgoClient(`/api/v1/options/greeks?symbol=${encodeURIComponent(symbol)}`),
  getMargins: (order: Record<string, unknown>) =>
    openAlgoClient("/api/v1/margins", { method: "POST", body: JSON.stringify(order) }),
  triggerPanic: () => openAlgoClient("/api/v1/system/panic", { method: "POST" }),

  // Backtesting
  listBacktests: (limit = 100) => openAlgoClient(`/api/v1/backtests?limit=${limit}`),
  runBacktest: (data: BacktestRequest): Promise<BacktestResponse> =>
    openAlgoClient("/api/v1/backtest/run", { method: "POST", body: JSON.stringify(data) }),
  getBacktestResults: () => openAlgoClient("/api/v1/backtest/results"),
  optimizeStrategy: (data: any) =>
    openAlgoClient("/api/v1/strategies/optimize", { method: "POST", body: JSON.stringify(data) }),

  // Alerts
  getAlerts: () => openAlgoClient("/api/v1/alerts"),
  createAlert: (alert: Record<string, unknown>) =>
    openAlgoClient("/api/v1/alerts", { method: "POST", body: JSON.stringify(alert) }),
  deleteAlert: (id: number) => openAlgoClient(`/api/v1/alerts/${id}`, { method: "DELETE" }),

  // Analyzer toggle
  toggleAnalyzer: (state: boolean) => openAlgoClient("/api/v1/analyzertoggle", { method: "POST", body: JSON.stringify({ state }) }),
  getAnalyzerStatus: () => openAlgoClient("/api/v1/analyzerstatus"),

  // Brokers
  listBrokers: () => openAlgoClient("/api/v1/brokers"),
  updateBrokerCredentials: (brokerId: string, data: Record<string, any>) =>
    openAlgoClient(`/api/v1/brokers/${brokerId}/credentials`, { method: "POST", body: JSON.stringify(data) }),
  authorizeBroker: (brokerId: string, credentials?: Record<string, any>) =>
    openAlgoClient(`/api/v1/brokers/${brokerId}/auth`, { method: "POST", body: credentials ? JSON.stringify(credentials) : undefined }),


  exportTradesUrl: () => `${ALGO_TRADER_URL}/api/v1/tradebook/export?apikey=${CONFIG.API_KEY}`,

  // Scanner
  runScanner: (index: string) => openAlgoClient(`/api/v1/scanner?index=${index}`),
  getBrokerHealth: () => openAlgoClient("/api/v1/broker/health"),
  getMarketOverview: (universe = "nifty50", index_type = "spot") =>
    openAlgoClient(`/api/v1/market/overview?universe=${universe}&index_type=${index_type}`),

  // Vault
  listVaultAssets: (type?: string) => openAlgoClient(`/api/v1/vault/assets${type ? `?type=${type}` : ""}`),
  searchVaultAssets: (query: string) => openAlgoClient(`/api/v1/vault/search?q=${encodeURIComponent(query)}`),

  sendTerminalCommand: (command: string) => openAlgoClient("/api/v1/terminal/command", { method: "POST", body: JSON.stringify({ command }) }),

  // Strategy Explorer (Recursive)
  getExplorerTree: (path = ".") => openAlgoClient(`/api/v1/explorer/tree?path=${encodeURIComponent(path)}`),
  getExplorerFile: (path: string) => openAlgoClient(`/api/v1/explorer/file?path=${encodeURIComponent(path)}`),
  saveExplorerFile: (path: string, content: string) =>
    openAlgoClient("/api/v1/explorer/save", { method: "POST", body: JSON.stringify({ path, content }) }),
  deleteExplorerItem: (path: string) => openAlgoClient(`/api/v1/explorer/delete?path=${encodeURIComponent(path)}`, { method: "DELETE" }),

  client: openAlgoClient,
};
