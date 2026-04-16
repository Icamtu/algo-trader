import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { ChartCandle } from '@/hooks/useChartData';

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

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(({
  data,
  liveCandle,
  colors = {
    backgroundColor: 'transparent',
    textColor: '#888888',
  }
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

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
      height: containerRef.current.clientHeight,
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
    
    // Scale volume appropriately at the bottom
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

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 2. Set Historical Data
  useEffect(() => {
    if (candleSeriesRef.current && volumeSeriesRef.current && data.length > 0) {
      // Data must be sorted and distinct
      const uniqueData = Array.from(new Map(data.map(item => [item.time, item])).values());
      const sortedData = uniqueData.sort((a, b) => a.time - b.time);

      candleSeriesRef.current.setData(sortedData.map(c => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
      })));

      volumeSeriesRef.current.setData(sortedData.map(c => ({
          time: c.time as Time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
      })));

      chartRef.current?.timeScale().fitContent();
    } else {
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
    }
  }, [data]);

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

  return <div ref={containerRef} className="w-full h-full" />;
});
TradingChart.displayName = 'TradingChart';
