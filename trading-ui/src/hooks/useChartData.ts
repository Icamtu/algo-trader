import { useState, useEffect } from 'react';
import { algoApi } from '@/features/openalgo/api/client';

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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
          // Normalize to UNIX timestamp in seconds for lightweight-charts
          const mapped = res.map((c: any) => ({
             time: new Date(c.date || c.timestamp || c.time).getTime() / 1000,
             open: Number(c.open || 0),
             high: Number(c.high || 0),
             low: Number(c.low || 0),
             close: Number(c.close || 0),
             volume: Number(c.volume) || 0
          })).sort((a, b) => a.time - b.time);
          
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
