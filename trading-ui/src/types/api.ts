// ============================================================
// src/types/api.ts — Shared TypeScript interfaces for all API contracts
// Bridges the gap between algo-trader backend and trading-ui frontend.
// ============================================================

// ─── Trade (from /api/orders, /api/backtests) ─────────────────────
export interface Trade {
  id: number;
  timestamp: string;
  strategy: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  status: "filled" | "pending" | "rejected" | "blocked";
  order_id: string | null;
  pnl: number | null;
  mode: "sandbox" | "live";
  created_at: string;
}

// ─── Positions (from /api/positions) ──────────────────────────────
export interface Position {
  symbol: string;
  quantity: number;
  average_price: number;
  current_value: number;
}

export interface PositionsResponse {
  positions: Position[];
  count: number;
  total_value: number;
}

// ─── Orders (from /api/orders) ────────────────────────────────────
export interface OrdersResponse {
  trades: Trade[];
  count: number;
  mode: string;
}

// ─── Strategy (from /api/strategies) ──────────────────────────────
export interface Strategy {
  id: string;
  name: string;
  symbols: string[];
  is_active: boolean;
  mode: string;
  description: string;
  params: Record<string, string | number | boolean>;
}

export interface StrategiesResponse {
  strategies: Strategy[];
  count: number;
}

// ─── Risk Status (from /api/risk/status) ──────────────────────────
export interface RiskStatus {
  daily_trades: number;
  max_daily_trades: number;
  daily_realised_loss: number;
  max_daily_loss: number;
  open_positions: number;
  max_open_positions: number;
  max_order_quantity: number;
  max_order_notional: number;
  max_position_qty: number;
  daily_loss_pct: number;
}

// ─── Risk Limit Updates (PUT /api/risk/limits) ────────────────────
export interface RiskLimitUpdates {
  max_daily_loss?: number;
  max_daily_trades?: number;
  max_open_positions?: number;
  max_order_notional?: number;
  max_order_quantity?: number;
  max_position_qty?: number;
}

// ─── P&L (from /api/pnl) ─────────────────────────────────────────
export interface PnlResponse {
  account_capital: number;
  total_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  pnl_percentage: number;
}

// ─── Risk Metrics (from /api/risk-metrics) ────────────────────────
export interface RiskMetrics {
  active_positions_count: number;
  margin_utilization: number;
  concentration_risk: number;
  max_exposure: number;
  drawdown: number;
}

// ─── System Status (from /api/system/status) ──────────────────────
export interface ServiceStatus {
  status: "HEALTHY" | "OFFLINE" | "ERROR" | "DISCONNECTED" | "READ_ONLY";
  latency?: number;
  details?: string;
  integrity?: string;
}

export interface SystemHealth {
  algo_engine: ServiceStatus;
  broker: ServiceStatus;
  openalgo: ServiceStatus;
  ollama_local: ServiceStatus;
  openclaw_agent: ServiceStatus;
  database: ServiceStatus;
}

// ─── System Settings (from /api/system/settings) ──────────────────
export interface SystemSettings {
  decision_mode: "ai" | "program" | "human";
  llm_model: string;
  provider: "ollama" | "openclaw";
  agent_enabled: boolean;
  agent_error_reason: string;
}

// ─── Scanner (from /api/scanner/*) ────────────────────────────────
export interface ScanResult {
  symbol: string;
  price: number;
  change: number;
  score: number;
  rsi: number | null;
  ai_reasoning?: string;
  ai_conviction?: number;
  provider?: string;
}

export interface ScanResponse {
  status: string;
  index: string;
  count: number;
  results: ScanResult[];
}

// ─── Option Chain (from /api/options/chain) ───────────────────────
export interface OptionGreeks {
  ltp: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  oi: number;
}

export interface OptionStrike {
  strike: number;
  ce: OptionGreeks;
  pe: OptionGreeks;
  is_atm: boolean;
}

export interface OptionChainResponse {
  symbol: string;
  expiry: string;
  underlying_price: number;
  matrix: OptionStrike[];
}

// ─── Order Placement ──────────────────────────────────────────────
export interface PlaceOrderRequest {
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  order_type: "MARKET" | "LIMIT" | "SL" | "SL-M";
  price?: number;
  product?: string;
  exchange?: string;
  strategy?: string;
}

export interface PlaceOrderResponse {
  status: string;
  message: string;
  order_id?: string;
  result?: Record<string, unknown>;
}

// ─── Trading Mode (from /api/system/mode) ─────────────────────────
export interface TradingModeResponse {
  mode: "sandbox" | "live";
  status?: string;
}

// ─── Funds (from /api/funds) ──────────────────────────────────────
export interface FundsResponse {
  cash?: number;
  margin_used?: number;
  margin_available?: number;
  [key: string]: unknown;
}

// ─── Indicator Calculation (POST /api/indicators) ─────────────────
export interface IndicatorRequest {
  name: string;
  params: number[];
}

export interface IndicatorPayload {
  symbol: string;
  candles: Record<string, number | string>[];
  indicators: IndicatorRequest[];
}

export interface IndicatorResponse {
  symbol: string;
  results: Record<string, number[]>;
}

// ─── Backtesting (POST /api/backtest/run) ────────────────────────
export interface BacktestRequest {
  strategy_key: string;
  symbol: string;
  candles?: Record<string, unknown>[];
  from_date?: string;
  to_date?: string;
  initial_cash?: number;
}

export interface BacktestResponse {
  status: string;
  strategy_key: string;
  symbol: string;
  net_pnl: number;
  sharpe: number;
  trades: any[];
  equity_curve: { timestamp: string; value: number }[];
  error?: string;
}

// ─── API Error ────────────────────────────────────────────────────
export class ApiError extends Error {
  public status: number;
  public body: Record<string, unknown>;

  constructor(status: number, message: string, body?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body || {};
  }

  get isServiceUnavailable(): boolean {
    return this.status === 503;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}
