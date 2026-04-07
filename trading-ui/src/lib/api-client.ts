
import { createClient } from "@supabase/supabase-js";
import {
  ApiError,
  type PlaceOrderRequest,
  type RiskLimitUpdates,
  type IndicatorPayload,
  type SystemSettings,
} from "@/types/api";

const ALGO_TRADER_URL = "http://localhost:5001";

/**
 * Core fetch wrapper with structured error handling.
 * Throws ApiError with status code so consumers can branch on error type.
 */
export async function fetchAlgo(endpoint: string, options: RequestInit = {}) {
  const url = `${ALGO_TRADER_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(
      response.status,
      body.error || `HTTP error! status: ${response.status}`,
      body
    );
  }

  return response.json();
}

export const algoApi = {
  // ─── Strategies ────────────────────────────────────────────────
  getStrategies: () => fetchAlgo("/api/strategies"),
  getStrategy: (id: string) => fetchAlgo(`/api/strategies/${id}`),
  startStrategy: (id: string) => fetchAlgo(`/api/strategies/${id}/start`, { method: "POST" }),
  stopStrategy: (id: string) => fetchAlgo(`/api/strategies/${id}/stop`, { method: "POST" }),
  updateStrategyParams: (id: string, params: Record<string, unknown>) =>
    fetchAlgo(`/api/strategies/${id}/params`, { method: "PUT", body: JSON.stringify(params) }),

  // ─── Positions & P&L ──────────────────────────────────────────
  getPositions: () => fetchAlgo("/api/positions"),
  getHoldings: () => fetchAlgo("/api/holdings"),
  getPnl: () => fetchAlgo("/api/pnl"),
  getRiskMetrics: () => fetchAlgo("/api/risk-metrics"),

  // ─── Orders ────────────────────────────────────────────────────
  getOrders: (params?: { limit?: number; symbol?: string; strategy?: string }) => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
    return fetchAlgo(`/api/orders${query}`);
  },
  getTradesBySymbol: (symbol: string, limit = 50) =>
    fetchAlgo(`/api/trades/by-symbol/${symbol}?limit=${limit}`),
  getTradesByStrategy: (strategy: string, limit = 100) =>
    fetchAlgo(`/api/trades/by-strategy/${strategy}?limit=${limit}`),
  getOpenPositions: () => fetchAlgo("/api/trades/open-positions"),
  getOrderStatus: (orderId: string) => fetchAlgo(`/api/orders/${orderId}/status`),
  cancelOrder: (id: string) => fetchAlgo(`/api/orders/${id}/cancel`, { method: "POST" }),
  cancelAllOrders: () => fetchAlgo("/api/orders/cancel-all", { method: "POST" }),

  // ─── Order Placement (GAP-13/14 fix) ──────────────────────────
  placeOrder: (order: PlaceOrderRequest) =>
    fetchAlgo("/api/terminal/command", {
      method: "POST",
      body: JSON.stringify({
        command: `/${order.action} ${order.symbol} ${order.quantity}${order.price ? ` ${order.price}` : ""}`,
      }),
    }),

  // ─── Funds ─────────────────────────────────────────────────────
  getFunds: () => fetchAlgo("/api/funds"),

  // ─── Risk Management ──────────────────────────────────────────
  getRiskStatus: () => fetchAlgo("/api/risk/status"),
  updateRiskLimits: (updates: RiskLimitUpdates) =>
    fetchAlgo("/api/risk/limits", { method: "PUT", body: JSON.stringify(updates) }),

  // ─── Trading Mode ─────────────────────────────────────────────
  getMode: () => fetchAlgo("/api/system/mode"),
  setMode: (mode: string) =>
    fetchAlgo("/api/system/mode", { method: "POST", body: JSON.stringify({ mode }) }),

  // ─── System ───────────────────────────────────────────────────
  getSystemSettings: () => fetchAlgo("/api/system/settings"),
  updateSystemSettings: (updates: Partial<SystemSettings>) =>
    fetchAlgo("/api/system/settings", { method: "PUT", body: JSON.stringify(updates) }),
  getSystemStatus: () => fetchAlgo("/api/system/status"),
  getSystemLogs: () => fetchAlgo("/api/system/logs"),

  // ─── Market Scanner ───────────────────────────────────────────
  getScannerIndices: () => fetchAlgo("/api/scanner/indices"),
  runScanner: (index: string) =>
    fetchAlgo("/api/scanner/run", { method: "POST", body: JSON.stringify({ index }) }),
  analyzeScanner: (results: Record<string, unknown>[]) =>
    fetchAlgo("/api/scanner/analyze", { method: "POST", body: JSON.stringify({ results }) }),

  // ─── Symbols ──────────────────────────────────────────────────
  searchSymbols: (query: string) => fetchAlgo(`/api/symbols/search?q=${encodeURIComponent(query)}`),

  // ─── Historical Data & Indicators ─────────────────────────────
  getHistory: (params: { symbol: string; exchange?: string; interval?: string; start_date?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return fetchAlgo(`/api/history?${query}`);
  },
  calculateIndicators: (data: IndicatorPayload) =>
    fetchAlgo("/api/indicators", { method: "POST", body: JSON.stringify(data) }),

  // ─── Quotes ───────────────────────────────────────────────────
  getQuotes: (symbols: string[]) =>
    fetchAlgo(`/api/quotes?symbols=${symbols.join(",")}`),

  // ─── Expert Terminal & Options ────────────────────────────────
  getOptionChain: (symbol: string, expiry: string) =>
    fetchAlgo(`/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`),
  sendTerminalCommand: (command: string) =>
    fetchAlgo("/api/terminal/command", { method: "POST", body: JSON.stringify({ command }) }),
  triggerPanic: () => fetchAlgo("/api/system/panic", { method: "POST" }),

  // ─── Backtesting ──────────────────────────────────────────────
  listBacktests: (limit = 100) => fetchAlgo(`/api/backtests?limit=${limit}`),
  runBacktest: (data: { strategy_key: string; symbol: string; candles: Record<string, unknown>[]; initial_cash?: number }) =>
    fetchAlgo("/api/backtest/run", { method: "POST", body: JSON.stringify(data) }),
  optimizeStrategy: (data: {
    strategy_key: string;
    symbol: string;
    candles: Record<string, unknown>[];
    param_ranges: Record<string, unknown>;
    metric?: string;
    max_iterations?: number;
  }) => fetchAlgo("/api/backtest/optimize", { method: "POST", body: JSON.stringify(data) }),

  // ─── Alerts (Persistent CRUD) ─────────────────────────────────
  getAlerts: () => fetchAlgo("/api/alerts"),
  createAlert: (alert: { type: string; symbol: string; condition: string; value: number; channel?: string; message?: string }) =>
    fetchAlgo("/api/alerts", { method: "POST", body: JSON.stringify(alert) }),
  deleteAlert: (id: number) => fetchAlgo(`/api/alerts/${id}`, { method: "DELETE" }),

  // ─── Trade Export ─────────────────────────────────────────────
  exportTradesUrl: () => `${ALGO_TRADER_URL}/api/trades/export`,
};

