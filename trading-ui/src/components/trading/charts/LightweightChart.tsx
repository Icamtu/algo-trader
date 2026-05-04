import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, ISeriesApi, Time, CandlestickSeries, IChartApi } from 'lightweight-charts';

interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface LightweightChartProps {
  data: CandleData[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

export const LightweightChart: React.FC<LightweightChartProps> = ({
  data,
  colors: {
    backgroundColor = 'transparent',
    lineColor = '#2962FF',
    textColor = '#d1d4dc',
    areaTopColor = '#2962FF',
    areaBottomColor = 'rgba(41, 98, 255, 0.28)',
  } = {},
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 400,
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
        fontFamily: 'IBM Plex Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.05)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.1)',
      },
    });

    // Use modern addSeries API (lightweight-charts v5)
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = series as any;

    // Use ResizeObserver for flex layout support
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      // Format data for lightweight charts — handle multiple timestamp formats
      const formattedData = data
        .map(item => {
          const close = Number(item.close) || 0;
          if (close === 0) return null;
          const open = Number(item.open) || close;
          const high = Number(item.high) || Math.max(open, close);
          const low = Number(item.low) || Math.min(open, close);

          return {
            time: (new Date(item.date).getTime() / 1000) as Time,
            open,
            high,
            low,
            close,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => (a.time as number) - (b.time as number));

      // Deduplicate by time
      const seen = new Set<number>();
      const unique = formattedData.filter(d => {
        const t = d.time as number;
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
      });

      seriesRef.current.setData(unique);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" style={{ minHeight: '300px' }} />;
};
