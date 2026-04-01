// trading-ui/src/lib/algo-trader-api.ts

import { json } from '@sveltejs/kit';

export interface Strategy {
  id: string;
  name: string;
  symbols: string[];
  is_active: boolean;
  mode: string;
  description: string;
  params: Record<string, any>;
}

export interface Position {
  symbol: string;
  quantity: number;
  average_price: number;
  current_value: number;
}

export interface PnlData {
    account_capital: number;
    total_value: number;
    unrealized_pnl: number;
    realized_pnl: number;
    total_pnl: number;
    pnl_percentage: number;
}

export interface BacktestTrade {
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    quantity: number;
    pnl: number;
}

export interface BacktestResult {
    result_id: string;
    strategy_key: string;
    strategy_name: string;
    symbol: string;
    start_date: string;
    end_date: string;
    total_trades: number;
    win_rate: number;
    gross_pnl: number;
    net_pnl: number;
    max_drawdown: number;
    average_hold_minutes: number;
    equity_curve: number[];
    trades: BacktestTrade[];
}

export interface Trade {
  id: string;
  strategy: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'filled' | 'pending' | 'rejected';
  timestamp: string;
  pnl?: number;
}

export async function fetchTrades(limit = 100, symbol?: string, strategy?: string): Promise<Trade[]> {
  const url = new URL('/api/algo-trader/trades', window.location.origin);
  url.searchParams.append('limit', String(limit));
  if (symbol) {
    url.searchParams.append('symbol', symbol);
  }
  if (strategy) {
    url.searchParams.append('strategy', strategy);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch trades: ${response.statusText}`);
  }
  const data = await response.json();
  return data.trades;
}

export async function fetchTradesBySymbol(symbol: string): Promise<Trade[]> {
    return fetchTrades(100, symbol);
}

export async function fetchTradesByStrategy(strategy: string): Promise<Trade[]> {
    return fetchTrades(100, undefined, strategy);
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const response = await fetch('/api/algo-trader/strategies');
  if (!response.ok) {
    throw new Error(`Failed to fetch strategies: ${response.statusText}`);
  }
  const data = await response.json();
  return data.strategies;
}

export async function fetchPositions(): Promise<Position[]> {
    const response = await fetch('/api/algo-trader/positions');
    if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }
    const data = await response.json();
    return data.positions;
}

export async function fetchPnlData(): Promise<PnlData> {
    const response = await fetch('/api/algo-trader/pnl');
    if (!response.ok) {
        throw new Error(`Failed to fetch pnl: ${response.statusText}`);
    }
    return await response.json();
}

export async function startStrategy(strategyId: string): Promise<boolean> {
    const response = await fetch(`/api/algo-trader/strategies/${strategyId}/start`, {
        method: 'POST',
    });
    return response.ok;
}

export async function stopStrategy(strategyId: string): Promise<boolean> {
    const response = await fetch(`/api/algo-trader/strategies/${strategyId}/stop`, {
        method: 'POST',
    });
    return response.ok;
}

export async function fetchBacktests(): Promise<BacktestResult[]> {
    const response = await fetch('/api/algo-trader/backtests');
    if (!response.ok) {
        throw new Error(`Failed to fetch backtests: ${response.statusText}`);
    }
    const data = await response.json();
    return data.backtests;
}
