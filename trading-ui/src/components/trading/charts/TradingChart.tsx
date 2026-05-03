import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { ChartCandle } from '@/hooks/useChartData';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateBB,
  calculateMACD
} from '@/lib/indicators';

interface TradingChartProps {
  data: ChartCandle[];
  liveCandle: ChartCandle | null;
  colors?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export interface TradingChartRef {
  fitContent: () => void;
}

/**
 * Normalize raw candle data from various sources (API, mock, fallback)
 * into a valid ChartCandle format with UNIX timestamps.
 */
function normalizeCandles(raw: any[]): ChartCandle[] {
  if (!raw || raw.length === 0) return [];

  const seen = new Set<number>();
  const result: ChartCandle[] = [];

  for (const c of raw) {
    let time: number;
    if (typeof c.time === 'number' && c.time > 0) {
      time = c.time > 1e12 ? Math.floor(c.time / 1000) : c.time;
    } else if (c.date || c.timestamp) {
      const ts = c.date || c.timestamp;
      const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
      time = Math.floor(ms / 1000);
    } else {
      continue;
    }

    if (isNaN(time) || time <= 0) continue;
    if (seen.has(time)) continue;
    seen.add(time);

    const close = Number(c.close) || 0;
    const open = Number(c.open) || close;
    const high = Number(c.high) || Math.max(open, close);
    const low = Number(c.low) || Math.min(open, close);
    const volume = Number(c.volume) || 0;

    if (close === 0) continue;

    result.push({ time, open, high, low, close, volume });
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(({
  data,
  liveCandle,
  colors = {
    backgroundColor: 'transparent',
    textColor: '#888888',
  }
}, ref) => {
  const { settings } = useTerminalSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);

  useImperativeHandle(ref, () => ({
    fitContent: () => {
      chartRef.current?.timeScale().fitContent();
    }
  }));

  // 1. Initialize Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor },
        textColor: colors.textColor,
        fontFamily: 'IBM Plex Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)', style: 1 },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)', style: 1 },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 400,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 176, 0, 0.4)',
          labelBackgroundColor: '#ffb000',
        },
        horzLine: {
          color: 'rgba(255, 176, 0, 0.4)',
          labelBackgroundColor: '#ffb000',
        }
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries as any;
    volumeSeriesRef.current = volumeSeries as any;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 2. Data & Indicators Update
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const normalized = normalizeCandles(data);

    // Update Candles & Volume
    if (normalized.length > 0) {
      candleSeriesRef.current.setData(normalized.map(c => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
      })));

      volumeSeriesRef.current.setData(normalized.map(c => ({
          time: c.time as Time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
      })));

      // --- INDICATOR FACTORY ---

      // Cleanup existing indicator series
      indicatorSeriesRef.current.forEach(s => chartRef.current?.removeSeries(s));
      indicatorSeriesRef.current = [];

      const activeIndicators = settings.defaultIndicators || [];

      // SMA
      if (activeIndicators.includes('sma')) {
        const smaData = calculateSMA(normalized, 20);
        const smaSeries = chartRef.current.addSeries(LineSeries, {
          color: '#00F5FF',
          lineWidth: 2,
          title: 'SMA (20)'
        });
        smaSeries.setData(smaData.map(d => ({ time: d.time as Time, value: d.value! })));
        indicatorSeriesRef.current.push(smaSeries);
      }

      // EMA
      if (activeIndicators.includes('ema')) {
        const emaData = calculateEMA(normalized, 20);
        const emaSeries = chartRef.current.addSeries(LineSeries, {
          color: '#A020F0',
          lineWidth: 2,
          title: 'EMA (20)'
        });
        emaSeries.setData(emaData.map(d => ({ time: d.time as Time, value: d.value! })));
        indicatorSeriesRef.current.push(emaSeries);
      }

      // BB
      if (activeIndicators.includes('bb')) {
        const bbData = calculateBB(normalized, 20, 2);
        const upper = chartRef.current.addSeries(LineSeries, { color: '#10B981', lineWidth: 1, lineStyle: 2 });
        const middle = chartRef.current.addSeries(LineSeries, { color: '#10B981', lineWidth: 1 });
        const lower = chartRef.current.addSeries(LineSeries, { color: '#10B981', lineWidth: 1, lineStyle: 2 });

        upper.setData(bbData.map(d => ({ time: d.time as Time, value: d.values!.upper })));
        middle.setData(bbData.map(d => ({ time: d.time as Time, value: d.values!.middle })));
        lower.setData(bbData.map(d => ({ time: d.time as Time, value: d.values!.lower })));

        indicatorSeriesRef.current.push(upper, middle, lower);
      }

      // RSI (Usually separate pane, but for now overlaying or skipping ifPaneRequired)
      if (activeIndicators.includes('rsi')) {
        const rsiData = calculateRSI(normalized, 14);
        const rsiSeries = chartRef.current.addSeries(LineSeries, {
          color: '#F59E0B',
          lineWidth: 1,
          title: 'RSI (14)',
          priceScaleId: 'rsi-pane', // Custom pane
        });

        chartRef.current.priceScale('rsi-pane').applyOptions({
          scaleMargins: { top: 0.1, bottom: 0.7 },
          visible: true,
        });

        rsiSeries.setData(rsiData.map(d => ({ time: d.time as Time, value: d.value! })));
        indicatorSeriesRef.current.push(rsiSeries);
      }

      chartRef.current.timeScale().fitContent();
    } else {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
    }
  }, [data, settings.defaultIndicators]);

  // 3. Update Live Candle
  useEffect(() => {
      if (candleSeriesRef.current && liveCandle) {
          candleSeriesRef.current.update({
              time: liveCandle.time as Time,
              open: liveCandle.open,
              high: liveCandle.high,
              low: liveCandle.low,
              close: liveCandle.close
          });
      }
  }, [liveCandle]);

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: '300px' }} />;
});
TradingChart.displayName = 'TradingChart';
