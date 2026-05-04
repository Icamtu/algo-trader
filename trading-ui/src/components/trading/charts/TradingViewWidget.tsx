import React, { useMemo, memo } from 'react';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  chartStyle?: 'candle' | 'heikin-ashi' | 'area' | 'bar' | 'renko';
}

const timeframeToInterval: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1H': '60',
  '1d': 'D',
  'D': 'D',
};

const chartStyleToTVStyle: Record<string, string> = {
  'candle': '1',
  'heikin-ashi': '8',
  'area': '3',
  'bar': '0',
  'renko': '4',
};

const indicatorToTVStudy: Record<string, string> = {
  'sma': 'MASimple@tv-basicstudies',
  'ema': 'MAExp@tv-basicstudies',
  'macd': 'MACD@tv-basicstudies',
  'rsi': 'RSI@tv-basicstudies',
  'bb': 'BollingerBands@tv-basicstudies',
  'atr': 'ATR@tv-basicstudies',
  'adx': 'ADX@tv-basicstudies',
  'stoch': 'StochasticRSI@tv-basicstudies',
};

/**
 * TradingView Advanced Chart widget using direct iframe embed.
 * This avoids CSP script-src issues by embedding via iframe URL
 * instead of injecting the external embed script.
 */
function TradingViewWidgetChild({ symbol, interval = '1d', chartStyle = 'candle' }: TradingViewWidgetProps) {
  const { settings } = useTerminalSettings();
  const tvInterval = timeframeToInterval[interval] || 'D';
  const tvStyle = chartStyleToTVStyle[chartStyle] || '1';

  const iframeSrc = useMemo(() => {
    // Map active indicators to TV studies
    const activeStudies = (settings.defaultIndicators || [])
      .map(id => indicatorToTVStudy[id])
      .filter(Boolean);

    const config = {
      autosize: true,
      symbol: `NSE:${symbol}`,
      interval: tvInterval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: tvStyle,
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      backgroundColor: 'rgba(10, 10, 10, 1)',
      gridColor: 'rgba(255, 255, 255, 0.04)',
      support_host: 'https://www.tradingview.com',
      studies: activeStudies,
    };
    const encodedConfig = encodeURIComponent(JSON.stringify(config));
    return `https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodedConfig}`;
  }, [symbol, tvInterval, tvStyle, settings.defaultIndicators]);

  return (
    <div
      className="tradingview-widget-container"
      style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }}
    >
      <iframe
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          border: 'none',
          display: 'block',
        }}
        allow="fullscreen"
        title="TradingView Advanced Chart"
        loading="lazy"
      />
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetChild);
