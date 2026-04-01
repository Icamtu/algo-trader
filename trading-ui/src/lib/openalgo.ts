import type { UTCTimestamp } from 'lightweight-charts';
import type { OrderBookLevel, PricePoint } from '$lib/types';

export type SubscriptionMode = 'LTP' | 'Quote' | 'Depth';

export type DepthLevel = {
  price: number;
  quantity: number;
  orders?: number;
};

export type DepthSnapshot = {
  buy: DepthLevel[];
  sell: DepthLevel[];
};

export type MarketDataPayload = {
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  change_percent?: number;
  timestamp?: string;
  bid_price?: number;
  ask_price?: number;
  bid_size?: number;
  ask_size?: number;
  depth?: DepthSnapshot;
};

export type MarketDataMessage = {
  type: 'market_data';
  symbol: string;
  exchange: string;
  mode: number;
  data: MarketDataPayload;
};

export type OpenAlgoAuthMessage = {
  type: 'auth';
  status: string;
  message?: string;
  user_id?: string;
  broker?: string;
};

export type OpenAlgoControlMessage = {
  type: 'subscribe' | 'unsubscribe' | 'error';
  status?: string;
  message?: string;
};

export type OpenAlgoMessage = OpenAlgoAuthMessage | OpenAlgoControlMessage | MarketDataMessage;

export type OpenAlgoSessionResponse =
  | {
      status: 'success';
      apiBaseUrl: string;
      apiKey: string;
      websocketUrl: string;
      rawWebsocketUrl?: string;
    }
  | {
      status: 'error';
      message: string;
    };

export function normalizeOpenAlgoSymbol(rawSymbol: string): string {
  return rawSymbol.trim().toUpperCase().replace(/^[A-Z_]+:/, '').replace(/-EQ$/, '');
}

export function toOrderBook(
  depth?: DepthSnapshot | null
): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
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

export function appendPricePoint(
  series: PricePoint[],
  value: number,
  timestamp?: string,
  maxPoints = 180
): PricePoint[] {
  const nextPoint: PricePoint = {
    time: resolveUnixTime(timestamp),
    value: Number(value.toFixed(2))
  };

  const lastPoint = series[series.length - 1];
  if (lastPoint?.time === nextPoint.time) {
    return [...series.slice(0, -1), nextPoint];
  }

  return [...series, nextPoint].slice(-maxPoints);
}

export function formatPayloadPreview(payload: unknown, maxLength = 260): string {
  const raw = JSON.stringify(payload);
  if (raw.length <= maxLength) {
    return raw;
  }

  return `${raw.slice(0, maxLength - 3)}...`;
}

function resolveUnixTime(timestamp?: string): UTCTimestamp {
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  if (Number.isNaN(parsed)) {
    return Math.floor(Date.now() / 1000) as UTCTimestamp;
  }

  return Math.floor(parsed / 1000) as UTCTimestamp;
}
