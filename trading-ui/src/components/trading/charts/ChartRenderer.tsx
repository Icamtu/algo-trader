import React, { useMemo } from 'react';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';
import { ChartCandle } from '@/hooks/useChartData';
import { TradingViewWidget } from './TradingViewWidget';
import { TradingChart } from './TradingChart';
import { EChartsKLine } from './EChartsKLine';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Plotly from 'plotly.js-dist-min';
import _createPlotlyComponent from 'react-plotly.js/factory';

// Handle mixed CJS/ESM import patterns for Plotly factory
const createPlotlyComponent = (typeof _createPlotlyComponent === 'function')
  ? _createPlotlyComponent
  : (_createPlotlyComponent as any).default;

const Plot = createPlotlyComponent(Plotly);

interface ChartRendererProps {
  symbol: string;
  data: ChartCandle[];
  timeframe?: string;
  liveCandle?: ChartCandle | null;
  isLoading?: boolean;
}

/**
 * Normalize raw data arrays into valid ChartCandle[] for non-TV engines.
 * Handles mock data that only has {date, close} as well as full OHLCV.
 */
function normalizeChartData(raw: any[]): ChartCandle[] {
  if (!raw || raw.length === 0) return [];

  const seen = new Set<number>();
  const result: ChartCandle[] = [];

  for (const c of raw) {
    let time: number;
    if (typeof c.time === 'number' && c.time > 0) {
      time = c.time > 1e12 ? Math.floor(c.time / 1000) : c.time;
    } else if (c.date || c.timestamp) {
      const rawTs = c.date || c.timestamp;
      const ms = typeof rawTs === 'number' ? rawTs : new Date(rawTs).getTime();
      time = Math.floor(ms / 1000);
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

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  symbol,
  data,
  timeframe,
  liveCandle,
  isLoading
}) => {
  const { settings } = useTerminalSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-900/30" style={{ minHeight: '300px' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Loading chart...</div>
        </div>
      </div>
    );
  }

  const chartEngine = settings.chartEngine;
  const chartStyle = settings.chartStyle;
  const tvInterval = timeframe || settings.defaultTimeframe;

  // Pre-normalize data for non-TradingView engines
  const normalizedData = normalizeChartData(data);

  // If there's no data for local engines, show an empty state
  const showEmptyState = chartEngine !== 'tradingview' && normalizedData.length === 0;
  if (showEmptyState) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-900/20" style={{ minHeight: '300px' }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">No chart data available</span>
          <span className="text-[8px] font-mono uppercase tracking-wider">Switch to TradingView or wait for data sync</span>
        </div>
      </div>
    );
  }

  switch (chartEngine) {
    case 'tradingview':
      return <TradingViewWidget symbol={symbol} interval={tvInterval} chartStyle={chartStyle} />;

    case 'echarts':
      return <EChartsKLine data={normalizedData} chartStyle={chartStyle} showVolume={settings.showVolume} />;

    case 'lightweight':
      return <TradingChart data={normalizedData} liveCandle={liveCandle || null} />;

    case 'recharts': {
      return (
        <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={normalizedData.map((d, idx) => ({
                time: d.time,
                close: d.close,
                open: d.open,
                high: d.high,
                low: d.low,
                idx
              }))}
            >
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00F5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="idx" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number) => value.toFixed(2)}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#00F5FF"
                fill="url(#gradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    case 'plotly': {
      const plotlyData = [{
        x: normalizedData.map((_d, idx) => idx),
        close: normalizedData.map(d => d.close),
        open: normalizedData.map(d => d.open),
        high: normalizedData.map(d => d.high),
        low: normalizedData.map(d => d.low),
        type: 'candlestick' as const,
        increasing: { fillcolor: '#26a69a', line: { color: '#26a69a' } },
        decreasing: { fillcolor: '#ef5350', line: { color: '#ef5350' } }
      }];
      return (
        <Plot data={plotlyData} layout={{ autosize: true, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent' }} useResizeHandler style={{ width: '100%', height: '100%', minHeight: '300px' }} />
      );
    }

    default:
      return <TradingChart data={normalizedData} liveCandle={liveCandle || null} />;
  }
};
