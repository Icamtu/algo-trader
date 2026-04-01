import type { UTCTimestamp } from 'lightweight-charts';
import type { OrderBookLevel, PricePoint, StrategyCard } from '$lib/types';

export const strategies: StrategyCard[] = [
  {
    id: 'intraday',
    name: 'Intraday Strategy',
    mode: 'Scalping',
    symbol: 'RELIANCE-EQ',
    description: 'Fast threshold-based strategy tuned for rapid session reversals.',
    signal: 'BUY',
    pnl: 18450,
    winRate: 63.8,
    activity: 'High',
    params: {
      buy_above: 101,
      sell_below: 99,
      trade_quantity: 1
    }
  },
  {
    id: 'swing',
    name: 'Swing Strategy',
    mode: 'Trend Capture',
    symbol: 'RELIANCE-EQ',
    description: 'EMA-based trend tracker for multi-session directional continuation.',
    signal: 'HOLD',
    pnl: 9620,
    winRate: 58.2,
    activity: 'Medium',
    params: {
      fast_period: 5,
      slow_period: 12,
      trade_quantity: 1
    }
  },
  {
    id: 'longterm',
    name: 'Long Term Strategy',
    mode: 'Position',
    symbol: 'RELIANCE-EQ',
    description: 'Trend plus RSI confirmation for lower-frequency conviction entries.',
    signal: 'BUY',
    pnl: 28120,
    winRate: 67.1,
    activity: 'Low',
    params: {
      trend_period: 20,
      rsi_period: 14,
      buy_below_rsi: 45,
      sell_above_rsi: 65
    }
  },
  {
    id: 'custom',
    name: 'My First Strategy',
    mode: 'Custom',
    symbol: 'RELIANCE-EQ',
    description: 'User-owned starter logic with editable thresholds in the Python backend.',
    signal: 'SELL',
    pnl: 3120,
    winRate: 49.5,
    activity: 'Medium',
    params: {
      buy_below_price: 95,
      sell_above_price: 105,
      trade_quantity: 1
    }
  }
];

export function generateMockSeries(length = 140, seed = 100): PricePoint[] {
  const now = Math.floor(Date.now() / 1000);
  let price = seed;

  return Array.from({ length }, (_, index) => {
    const drift = Math.sin(index / 8) * 0.55 + (Math.random() - 0.5) * 1.6;
    price = Math.max(1, price + drift);
    return {
      time: (now - (length - index) * 60) as UTCTimestamp,
      value: Number(price.toFixed(2))
    };
  });
}

export function generateOrderBook(midPrice: number): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
  const bids = Array.from({ length: 7 }, (_, index) => ({
    price: Number((midPrice - index * 0.12).toFixed(2)),
    quantity: 100 + index * 22
  }));

  const asks = Array.from({ length: 7 }, (_, index) => ({
    price: Number((midPrice + index * 0.12).toFixed(2)),
    quantity: 95 + index * 25
  }));

  return { bids, asks };
}
