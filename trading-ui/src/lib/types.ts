import type { UTCTimestamp } from 'lightweight-charts';

export type TradingSignal = 'BUY' | 'SELL' | 'HOLD';

export type StrategyCard = {
  id: string;
  name: string;
  mode: string;
  symbol: string;
  description: string;
  signal: TradingSignal;
  pnl: number;
  winRate: number;
  activity: string;
  params: Record<string, string | number>;
};

export type PricePoint = {
  time: UTCTimestamp;
  value: number;
};

export type OrderBookLevel = {
  price: number;
  quantity: number;
};
