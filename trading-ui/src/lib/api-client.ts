import { CONFIG } from "@/lib/config";
import {
  ApiError,
  type PlaceOrderRequest,
  type RiskLimitUpdates,
  type IndicatorPayload,
  type SystemSettings,
} from "@/types/api";

const ALGO_TRADER_URL = CONFIG.API_BASE_URL;

// ─── Core API Clients ──────────────────────────────────────────

const baseFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || `HTTP error! status: ${response.status}`, body);
  }
  return response.json();
};

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    "apikey": CONFIG.API_KEY,
    ...options.headers,
  };
  return baseFetch(`${ALGO_TRADER_URL}${endpoint}`, { ...options, headers });
};

export const webClient = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": localStorage.getItem("csrfToken") || "",
    ...options.headers,
  };
  return baseFetch(`${ALGO_TRADER_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "omit",
  });
};

export const authClient = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  return baseFetch(`${ALGO_TRADER_URL}${endpoint}`, { ...options, headers });
};

// ─── API Schemas ───────────────────────────────────────────────

export const algoApi = {
  // Strategies
  getStrategies: () => apiClient("/api/v1/strategies"),
  getStrategy: (id: string) => apiClient(`/api/v1/strategies/${id}`),
  startStrategy: (id: string) => apiClient(`/api/v1/strategies/${id}/start`, { method: "POST" }),
  stopStrategy: (id: string) => apiClient(`/api/v1/strategies/${id}/stop`, { method: "POST" }),
  updateStrategyParams: (id: string, params: Record<string, unknown>) =>
    apiClient(`/api/v1/strategies/${id}/params`, { method: "PUT", body: JSON.stringify(params) }),

  // Positions & P&L
  getPositions: () => apiClient("/api/v1/positionbook"),
  getHoldings: () => apiClient("/api/v1/holdings"),
  getPnl: () => apiClient("/api/v1/pnl"),
  getRiskMetrics: () => apiClient("/api/v1/risk-metrics"),

  // Orders
  getOrders: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiClient(`/api/v1/orderbook${query}`);
  },
  getTradesBySymbol: (symbol: string, limit = 50) =>
    apiClient(`/api/v1/tradebook?symbol=${symbol}&limit=${limit}`),
  getTradesByStrategy: (strategy: string, limit = 100) =>
    apiClient(`/api/v1/tradebook?strategy=${strategy}&limit=${limit}`),
  getOpenPositions: () => apiClient("/api/v1/tradebook/open"),
  getOrderStatus: (orderId: string) => apiClient(`/api/v1/orderstatus/${orderId}`),
  cancelOrder: (id: string) => apiClient(`/api/v1/cancelorder/${id}`, { method: "DELETE" }),
  cancelAllOrders: () => apiClient("/api/v1/cancelallorder", { method: "DELETE" }),

  // Order Placement
  placeOrder: (order: PlaceOrderRequest) =>
    apiClient("/api/v1/placeorder", { method: "POST", body: JSON.stringify(order) }),
  smartOrder: (order: Record<string, unknown>) =>
    apiClient("/api/v1/smartorder", { method: "POST", body: JSON.stringify(order) }),
  basketOrder: (orders: Record<string, unknown>[]) =>
    apiClient("/api/v1/basketorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Square-off
  exitPosition: (symbol: string) => apiClient("/api/v1/exitposition", { method: "POST", body: JSON.stringify({ symbol }) }),
  closePosition: () => apiClient("/api/v1/closeposition", { method: "POST" }),

  // Funds
  getFunds: () => apiClient("/api/v1/funds"),

  // Risk Management
  getRiskStatus: () => apiClient("/api/v1/risk/status"),
  updateRiskLimits: (updates: RiskLimitUpdates) =>
    apiClient("/api/v1/risk/limits", { method: "PUT", body: JSON.stringify(updates) }),

  // Mode
  getMode: () => apiClient("/api/v1/mode"),
  setMode: (mode: string) =>
    apiClient("/api/v1/mode", { method: "POST", body: JSON.stringify({ mode }) }),

  // System
  getSystemSettings: () => apiClient("/api/v1/settings"),
  updateSystemSettings: (updates: Partial<SystemSettings>) =>
    apiClient("/api/v1/settings", { method: "PUT", body: JSON.stringify(updates) }),
  getSystemStatus: () => apiClient("/api/v1/health"),
  getSystemLogs: () => apiClient("/api/v1/logs"),

  // Scanner
  getScannerIndices: () => apiClient("/api/v1/scanner/indices"),
  runScanner: (index: string) =>
    apiClient("/api/v1/scanner/run", { method: "POST", body: JSON.stringify({ index }) }),
  analyzeScanner: (results: Record<string, unknown>[]) =>
    apiClient("/api/v1/scanner/analyze", { method: "POST", body: JSON.stringify({ results }) }),

  // Symbols & Quotes
  searchSymbols: (query: string) => apiClient(`/api/v1/symbol/search?q=${encodeURIComponent(query)}`),
  getQuotes: (symbols: string[]) => apiClient(`/api/v1/quotes?symbols=${symbols.join(",")}`),
  getDepth: (symbol: string) => apiClient(`/api/v1/depth?symbol=${encodeURIComponent(symbol)}`),

  // Historical Data & Indicators
  getHistory: (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/api/v1/history?${query}`);
  },
  calculateIndicators: (data: IndicatorPayload) =>
    apiClient("/api/v1/indicators", { method: "POST", body: JSON.stringify(data) }),

  // Expert Terminal & Options
  getOptionChain: (symbol: string, expiry: string) =>
    apiClient(`/api/v1/optionchain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`),
  getOptionGreeks: (symbol: string) =>
    apiClient(`/api/v1/optiongreeks?symbol=${encodeURIComponent(symbol)}`),
  getMargins: (order: Record<string, unknown>) =>
    apiClient("/api/v1/margins", { method: "POST", body: JSON.stringify(order) }),
  sendTerminalCommand: (command: string) =>
    apiClient("/api/v1/terminal/command", { method: "POST", body: JSON.stringify({ command }) }),
  triggerPanic: () => apiClient("/api/v1/system/panic", { method: "POST" }),

  // Backtesting
  listBacktests: (limit = 100) => apiClient(`/api/v1/backtests?limit=${limit}`),
  runBacktest: (data: import("@/types/api").BacktestRequest): Promise<import("@/types/api").BacktestResponse> =>
    apiClient("/api/v1/backtest/run", { method: "POST", body: JSON.stringify(data) }),
  optimizeStrategy: (data: Record<string, unknown>) => apiClient("/api/v1/backtest/optimize", { method: "POST", body: JSON.stringify(data) }),

  // Alerts
  getAlerts: () => apiClient("/api/v1/alerts"),
  createAlert: (alert: Record<string, unknown>) =>
    apiClient("/api/v1/alerts", { method: "POST", body: JSON.stringify(alert) }),
  deleteAlert: (id: number) => apiClient(`/api/v1/alerts/${id}`, { method: "DELETE" }),
  sendTelegramAlert: (params: Record<string, unknown>) =>
    apiClient("/api/v1/telegram", { method: "POST", body: JSON.stringify(params) }),

  // Trade Export
  exportTradesUrl: () => `${ALGO_TRADER_URL}/api/v1/tradebook/export`,
  
  // Analyzer toggle
  toggleAnalyzer: (state: boolean) => apiClient("/api/v1/analyzertoggle", { method: "POST", body: JSON.stringify({ state }) }),
  getAnalyzerStatus: () => apiClient("/api/v1/analyzerstatus"),
};
