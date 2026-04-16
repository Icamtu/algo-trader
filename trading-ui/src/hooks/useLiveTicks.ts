import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { ChartCandle } from './useChartData';

export function useLiveTicks(symbol: string, timeframe: string, currentData: ChartCandle[]) {
  const { prices, isConnected } = useWebSocket([symbol]);
  const [liveCandle, setLiveCandle] = useState<ChartCandle | null>(null);

  const currentPrice = prices[symbol];

  useEffect(() => {
    if (!currentPrice || currentData.length === 0) return;

    // Grab the last historical candle
    const lastCandle = currentData[currentData.length - 1];

    setLiveCandle(prev => {
        // If we don't have a live override yet, start with the last historical
        const baseCandle = prev ? prev : lastCandle;

        // In a strictly accurate system, we would calculate if we crossed into a new timeframe 'bucket'.
        // For this real-time overlay, we continually update the 'close' (and high/low) of the latest active candle.
        return {
            ...baseCandle,
            close: currentPrice,
            high: Math.max(baseCandle.high, currentPrice),
            low: Math.min(baseCandle.low, currentPrice)
        };
    });
  }, [currentPrice, currentData]);

  // If symbol/timeframe changes, clear out our live candle state until new data arrives
  useEffect(() => {
    setLiveCandle(null);
  }, [symbol, timeframe]);

  return { liveCandle, isConnected, currentPrice };
}
