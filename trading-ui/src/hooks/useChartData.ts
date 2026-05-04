import { useState, useEffect } from 'react';
import { algoApi } from '@/features/aetherdesk/api/client';

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Normalize a raw candle response into standard ChartCandle format.
 * Handles multiple field naming conventions from different data sources.
 */
function normalizeResponse(raw: any[]): ChartCandle[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const seen = new Set<number>();
  const result: ChartCandle[] = [];

  for (const c of raw) {
    // Extract timestamp — handle multiple formats
    let time: number;
    const rawTime = c.time || c.timestamp || c.date;
    if (typeof rawTime === 'number') {
      // Could be seconds or milliseconds
      time = rawTime > 1e12 ? Math.floor(rawTime / 1000) : rawTime;
    } else if (typeof rawTime === 'string') {
      time = Math.floor(new Date(rawTime).getTime() / 1000);
    } else {
      continue;
    }

    if (isNaN(time) || time <= 0) continue;
    if (seen.has(time)) continue;
    seen.add(time);

    const close = Number(c.close) || 0;
    if (close === 0) continue;

    const open = Number(c.open) || close;
    const high = Number(c.high) || Math.max(open, close);
    const low = Number(c.low) || Math.min(open, close);
    const volume = Number(c.volume) || 0;

    result.push({ time, open, high, low, close, volume });
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

export function useChartData(symbol: string, timeframe: string) {
  const [data, setData] = useState<ChartCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const interval = timeframe === 'D' ? '1' : timeframe;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        const params = {
            symbol,
            exchange: "NSE",
            interval,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
        };

        const res = await algoApi.getHistory(params);

        if (!active) return;

        if (Array.isArray(res)) {
          const mapped = normalizeResponse(res);
          setData(mapped);
        } else if (res && typeof res === 'object' && res.data && Array.isArray(res.data)) {
          // Some APIs return { status: "success", data: [...] }
          const mapped = normalizeResponse(res.data);
          setData(mapped);
        } else {
          setData([]);
        }
      } catch (err: any) {
        if (active) {
            console.error("Chart data fetch error:", err);
            setError(err.message || "Failed to load chart data");
            setData([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchHistory();

    return () => {
      active = false;
    };
  }, [symbol, timeframe]);

  return { data, isLoading, error };
}
