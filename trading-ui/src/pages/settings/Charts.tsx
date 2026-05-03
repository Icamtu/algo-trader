import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, BarChart3, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';

const CHART_ENGINES = [
  { id: 'lightweight', label: 'LightweightCharts', description: 'Zero-latency · TradingView OSS · Live tick updates', color: '#00F5FF', badge: 'OSS' },
  { id: 'tradingview', label: 'TradingView', description: 'Institutional embed · Full drawing tools · ~2s load', color: '#A020F0', badge: 'Free' },
  { id: 'echarts', label: 'Apache ECharts', description: 'Advanced K-line · DataZoom · Open source', color: '#10B981', badge: 'OSS' },
  { id: 'recharts', label: 'Recharts', description: 'Simple area/line · React-native · Lightweight', color: '#F59E0B', badge: 'MIT' },
  { id: 'plotly', label: 'Plotly', description: 'Scientific charts · Best for backtest analytics', color: '#EF4444', badge: 'MIT' },
];

const CHART_STYLES = [
  { id: 'candle', label: 'Candle', color: '#00F5FF', description: 'OHLC candles' },
  { id: 'heikin-ashi', label: 'Heikin-Ashi', color: '#A020F0', description: 'Smoothed candles' },
  { id: 'area', label: 'Area', color: '#10B981', description: 'Filled area chart' },
  { id: 'bar', label: 'Bar', color: '#F59E0B', description: 'OHLC bars' },
  { id: 'renko', label: 'Renko', color: '#EF4444', description: 'Block chart' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'];

const AVAILABLE_INDICATORS = [
  { id: 'sma', label: 'SMA (20)', category: 'Trend' },
  { id: 'ema', label: 'EMA (20)', category: 'Trend' },
  { id: 'macd', label: 'MACD', category: 'Momentum' },
  { id: 'rsi', label: 'RSI (14)', category: 'Momentum' },
  { id: 'bb', label: 'Bollinger Bands', category: 'Volatility' },
  { id: 'atr', label: 'ATR (14)', category: 'Volatility' },
  { id: 'adx', label: 'ADX (14)', category: 'Strength' },
  { id: 'stoch', label: 'Stochastic', category: 'Momentum' },
];

export default function Charts() {
  const { settings, updateSettings } = useTerminalSettings();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    indicators: true,
    advanced: false,
  });

  const [presetNameInput, setPresetNameInput] = useState('');
  const handleSettingChange = (key: string, value: any) => {
    updateSettings({ [key]: value } as any);
  };

  const toggleIndicator = (id: string) => {
    const current = settings.defaultIndicators || [];
    const updated = current.includes(id)
      ? current.filter(i => i !== id)
      : [...current, id];
    handleSettingChange('defaultIndicators', updated);
  };

  const savePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPresets = [
      ...(settings.indicatorPresets || []),
      { name: presetNameInput, indicators: [...(settings.defaultIndicators || [])] },
    ];
    handleSettingChange('indicatorPresets', newPresets);
    setPresetNameInput('');
  };

  const loadPreset = (preset: { name: string; indicators: string[] }) => {
    handleSettingChange('defaultIndicators', preset.indicators);
  };

  const deletePreset = (name: string) => {
    const updated = (settings.indicatorPresets || []).filter(p => p.name !== name);
    handleSettingChange('indicatorPresets', updated);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-6">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
            Charts Configuration
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-2">
            Chart engine, styles, indicators, and visualization settings
          </p>
        </div>
      </div>

      {/* Chart Engine Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Chart Engine
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Select the charting library for OHLC rendering
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CHART_ENGINES.map((engine) => (
            <button
              key={engine.id}
              onClick={() => handleSettingChange('chartEngine', engine.id)}
              className={cn(
                'p-4 border rounded-lg transition-all text-left',
                settings.chartEngine === engine.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 bg-white/5 hover:border-primary/40'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="w-6 h-6 rounded"
                  style={{ background: `linear-gradient(135deg, ${engine.color}40, ${engine.color}20)` }}
                />
                <span className="text-[8px] font-bold text-primary/60 uppercase">{engine.badge}</span>
              </div>
              <div className="text-[10px] font-black text-foreground uppercase tracking-wider">
                {engine.label}
              </div>
              <div className="text-[8px] text-muted-foreground/60 mt-1">
                {engine.description}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Default Chart Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Default Chart Style
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Primary visualization for price charts
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CHART_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => handleSettingChange('chartStyle', style.id)}
              className={cn(
                'p-4 border rounded-lg transition-all text-left',
                settings.chartStyle === style.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 bg-white/5 hover:border-primary/40'
              )}
            >
              <div
                className="w-full h-8 rounded mb-2 border border-white/10"
                style={{
                  background: `linear-gradient(to right, ${style.color}20, ${style.color}40)`,
                }}
              />
              <div className="text-[10px] font-black text-foreground uppercase tracking-wider">
                {style.label}
              </div>
              <div className="text-[8px] text-muted-foreground/60 mt-1">
                {style.description}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Default Timeframe */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Default Timeframe
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Opening timeframe for new chart windows
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleSettingChange('defaultTimeframe', tf)}
              className={cn(
                'p-2 border rounded-lg text-[10px] font-mono font-black uppercase tracking-wider transition-all',
                settings.defaultTimeframe === tf
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Default Indicators + Presets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Collapsible
          open={expandedSections.indicators}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, indicators: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Default Indicators
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Indicators added to new charts ({(settings.defaultIndicators?.length || 0)} selected)
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.indicators && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            {/* Indicator Selection */}
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_INDICATORS.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-all',
                      settings.defaultIndicators?.includes(ind.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 bg-white/5 hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-4 h-4 border rounded transition-all',
                        settings.defaultIndicators?.includes(ind.id)
                          ? 'bg-primary border-primary'
                          : 'border-border/40'
                      )}>
                        {settings.defaultIndicators?.includes(ind.id) && (
                          <div className="w-full h-full flex items-center justify-center text-black text-[10px]">✓</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-foreground uppercase">
                          {ind.label}
                        </div>
                        <div className="text-[8px] text-muted-foreground/50">
                          {ind.category}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preset Management */}
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <h4 className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Save Preset
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Preset name (e.g., Momentum-Setup)"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
                />
                <button
                  onClick={savePreset}
                  disabled={!presetNameInput.trim()}
                  className="px-4 py-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>

              {/* Saved Presets List */}
              {(settings.indicatorPresets || []).length > 0 && (
                <div className="space-y-2 mt-4">
                  <h5 className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                    Saved Presets
                  </h5>
                  {(settings.indicatorPresets || []).map((preset) => (
                    <div
                      key={preset.name}
                      className="flex items-center justify-between p-2 bg-black/20 border border-border/20 rounded text-[9px] font-mono"
                    >
                      <div>
                        <div className="font-black text-foreground">{preset.name}</div>
                        <div className="text-muted-foreground/40">
                          {preset.indicators.length} indicator{preset.indicators.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadPreset(preset)}
                          className="px-2 py-1 border border-primary/20 bg-primary/5 text-primary text-[8px] font-black rounded hover:bg-primary/10 transition-all"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deletePreset(preset.name)}
                          className="px-2 py-1 border border-destructive/20 bg-destructive/5 text-destructive text-[8px] font-black rounded hover:bg-destructive/10 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Grid Visibility */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg flex items-center justify-between"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider cursor-pointer">
            Show Grid Lines
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Display grid overlay on charts
          </p>
        </div>
        <button
          onClick={() => handleSettingChange('gridVisible', !settings.gridVisible)}
          className={cn(
            'w-12 h-6 rounded-full p-1 transition-all flex-shrink-0',
            settings.gridVisible ? 'bg-primary' : 'bg-white/10'
          )}
        >
          <motion.div
            layout
            className={cn(
              'w-4 h-4 bg-white rounded-full transition-all',
              settings.gridVisible ? 'ml-6' : 'ml-0'
            )}
          />
        </button>
      </motion.div>

      {/* Scale Type */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Y-Axis Scale
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Linear or logarithmic price scaling
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['linear', 'logarithmic'].map((scale) => (
            <button
              key={scale}
              onClick={() => handleSettingChange('scaleType', scale as 'linear' | 'logarithmic')}
              className={cn(
                'p-3 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                settings.scaleType === scale
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
              )}
            >
              {scale.charAt(0).toUpperCase() + scale.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Crosshair Magnet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg flex items-center justify-between"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider cursor-pointer">
            Crosshair Magnet
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Snap to nearest OHLC value instead of free cursor
          </p>
        </div>
        <button
          onClick={() => handleSettingChange('crosshairMagnet', !settings.crosshairMagnet)}
          className={cn(
            'w-12 h-6 rounded-full p-1 transition-all flex-shrink-0',
            settings.crosshairMagnet ? 'bg-primary' : 'bg-white/10'
          )}
        >
          <motion.div
            layout
            className={cn(
              'w-4 h-4 bg-white rounded-full transition-all',
              settings.crosshairMagnet ? 'ml-6' : 'ml-0'
            )}
          />
        </button>
      </motion.div>

      {/* Advanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Collapsible
          open={expandedSections.advanced}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, advanced: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Advanced Chart Settings
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Volume, session labels, extended view
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.advanced && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            {/* Show Volume */}
            <div className="flex items-center justify-between p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <div>
                <label className="text-[10px] font-black text-foreground uppercase tracking-wider cursor-pointer">
                  Volume Overlay
                </label>
                <p className="text-[8px] text-muted-foreground/60 mt-1">
                  Display volume bars below chart
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('showVolume', !settings.showVolume)}
                className={cn(
                  'w-10 h-5 rounded-full p-1 transition-all flex-shrink-0',
                  settings.showVolume ? 'bg-primary' : 'bg-white/10'
                )}
              >
                <motion.div
                  layout
                  className={cn(
                    'w-3 h-3 bg-white rounded-full transition-all',
                    settings.showVolume ? 'ml-5' : 'ml-0'
                  )}
                />
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 border border-primary/20 bg-primary/5 rounded-lg"
      >
        <p className="text-[9px] text-muted-foreground">
          <span className="font-bold text-primary">💡 Tip:</span> Chart settings persist automatically to localStorage. Switch chart engines in the Settings → Charts section to find the perfect fit for your trading style.
        </p>
      </motion.div>
    </div>
  );
}
