import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BacktestState {
  engine: 'native' | 'vectorbt' | 'ml-augmented';
  startingCapital: number;
  currencySymbol: '₹' | '$' | '€';
  slippageModel: 'fixed' | 'volume-aware' | 'spread-aware';
  slippageBps: number;
  commissionProfile: 'zero' | 'shoonya' | 'ib' | 'custom';
  customMaker: number;
  customTaker: number;
  fillModel: 'next-bar' | 'same-bar-conservative' | 'same-bar-aggressive';
  warmupBars: number;
  walkForwardInSample: number;
  walkForwardOutOfSample: number;
  walkForwardStepSize: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
}

const commissionDefaults: Record<string, { maker: number; taker: number }> = {
  zero: { maker: 0, taker: 0 },
  shoonya: { maker: 0.03, taker: 0.05 },
  ib: { maker: 0.002, taker: 0.002 },
  custom: { maker: 0, taker: 0 },
};

export default function BacktestDefaults() {
  const [backtest, setBacktest] = useState<BacktestState>({
    engine: 'native',
    startingCapital: 100000,
    currencySymbol: '₹',
    slippageModel: 'fixed',
    slippageBps: 1,
    commissionProfile: 'shoonya',
    customMaker: 0.03,
    customTaker: 0.05,
    fillModel: 'next-bar',
    warmupBars: 20,
    walkForwardInSample: 70,
    walkForwardOutOfSample: 30,
    walkForwardStepSize: 10,
    rebalanceFrequency: 'daily',
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    slippage: false,
    commission: false,
    advanced: false,
  });

  const handleChange = (key: keyof BacktestState, value: any) => {
    setBacktest(prev => {
      const updated = { ...prev, [key]: value };
      // Update custom commission fields when profile changes
      if (key === 'commissionProfile' && value !== 'custom') {
        const defaults = commissionDefaults[value];
        updated.customMaker = defaults.maker;
        updated.customTaker = defaults.taker;
      }
      return updated;
    });
  };

  const formatCurrency = (value: number): string => {
    const symbol = backtest.currencySymbol;
    const formatted = new Intl.NumberFormat(symbol === '₹' ? 'en-IN' : symbol === '$' ? 'en-US' : 'de-DE', {
      style: 'currency',
      currency: symbol === '₹' ? 'INR' : symbol === '$' ? 'USD' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return formatted;
  };

  const summary = useMemo(() => {
    const engineLabel = {
      native: 'Native',
      vectorbt: 'VectorBT',
      'ml-augmented': 'ML-Augmented',
    }[backtest.engine];

    const fillLabel = {
      'next-bar': 'Next-bar',
      'same-bar-conservative': 'Same-bar (Conservative)',
      'same-bar-aggressive': 'Same-bar (Aggressive)',
    }[backtest.fillModel];

    const commissionLabel = {
      zero: 'Zero',
      shoonya: 'Shoonya',
      ib: 'Interactive Brokers',
      custom: 'Custom',
    }[backtest.commissionProfile];

    return { engineLabel, fillLabel, commissionLabel };
  }, [backtest.engine, backtest.fillModel, backtest.commissionProfile]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-6">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
            Backtest Defaults
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-2">
            Engine, capital, fills, and commission defaults for all backtests
          </p>
        </div>
      </div>

      {/* Engine Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Backtest Engine
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Primary computation engine for all backtests
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['native', 'vectorbt', 'ml-augmented'].map((engine) => (
            <button
              key={engine}
              onClick={() => handleChange('engine', engine)}
              className={cn(
                'p-4 border rounded-lg text-left transition-all',
                backtest.engine === engine
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 bg-white/5 hover:border-primary/40'
              )}
            >
              <div className="text-[11px] font-black text-foreground uppercase tracking-wider">
                {engine === 'native' ? 'Native' : engine === 'vectorbt' ? 'VectorBT' : 'ML-Augmented'}
              </div>
              <div className="text-[8px] text-muted-foreground/60 mt-2">
                {engine === 'native'
                  ? 'Fast, pure Python'
                  : engine === 'vectorbt'
                  ? 'Vectorized NumPy'
                  : 'Neural network enhanced'}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Starting Capital & Currency */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Starting Capital
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Default initial account balance: {formatCurrency(backtest.startingCapital)}
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="number"
            value={backtest.startingCapital}
            onChange={(e) => handleChange('startingCapital', parseInt(e.target.value) || 0)}
            className="flex-1 bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/60 transition-all"
          />
          <select
            value={backtest.currencySymbol}
            onChange={(e) => handleChange('currencySymbol', e.target.value)}
            className="bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/60 transition-all min-w-[100px]"
          >
            <option value="₹">₹ INR</option>
            <option value="$">$ USD</option>
            <option value="€">€ EUR</option>
          </select>
        </div>
      </motion.div>

      {/* Slippage Model */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Collapsible
          open={expandedSections.slippage}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, slippage: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Slippage Model
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Execution cost estimation
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.slippage && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['fixed', 'volume-aware', 'spread-aware'].map((model) => (
                  <button
                    key={model}
                    onClick={() => handleChange('slippageModel', model)}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-all',
                      backtest.slippageModel === model
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 bg-white/5 hover:border-primary/40'
                    )}
                  >
                    <div className="text-[10px] font-black text-foreground uppercase">
                      {model === 'fixed' ? 'Fixed BPS' : model === 'volume-aware' ? 'Volume-Aware' : 'Spread-Aware'}
                    </div>
                    <div className="text-[8px] text-muted-foreground/60 mt-1">
                      {model === 'fixed'
                        ? 'Constant cost'
                        : model === 'volume-aware'
                        ? 'Scale with volume'
                        : 'Based on bid-ask'}
                    </div>
                  </button>
                ))}
              </div>

              {backtest.slippageModel === 'fixed' && (
                <div className="space-y-2 mt-4 p-3 border border-primary/20 bg-primary/5 rounded-lg">
                  <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                    Slippage (BPS): {backtest.slippageBps}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={backtest.slippageBps}
                    onChange={(e) => handleChange('slippageBps', parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="text-[8px] text-muted-foreground/60">
                    {backtest.slippageBps.toFixed(1)} basis points per trade
                  </div>
                </div>
              )}

              {backtest.slippageModel === 'volume-aware' && (
                <div className="p-3 border border-primary/20 bg-primary/5 rounded-lg">
                  <p className="text-[9px] text-muted-foreground/60">
                    Slippage scales with trade size relative to available volume. Default: 0.5% of trade size.
                  </p>
                </div>
              )}

              {backtest.slippageModel === 'spread-aware' && (
                <div className="p-3 border border-primary/20 bg-primary/5 rounded-lg">
                  <p className="text-[9px] text-muted-foreground/60">
                    Slippage estimated from bid-ask spread data. Requires tick-level market microstructure.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Commission Profile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Collapsible
          open={expandedSections.commission}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, commission: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Commission Profile
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                {summary.commissionLabel} commission structure
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.commission && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['zero', 'shoonya', 'ib', 'custom'].map((profile) => (
                  <button
                    key={profile}
                    onClick={() => handleChange('commissionProfile', profile)}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-all',
                      backtest.commissionProfile === profile
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 bg-white/5 hover:border-primary/40'
                    )}
                  >
                    <div className="text-[10px] font-black text-foreground uppercase">
                      {profile === 'zero' ? 'Zero' : profile === 'shoonya' ? 'Shoonya' : profile === 'ib' ? 'IB' : 'Custom'}
                    </div>
                    <div className="text-[8px] text-muted-foreground/60 mt-1">
                      {profile === 'zero'
                        ? 'No fees'
                        : profile === 'shoonya'
                        ? 'India'
                        : profile === 'ib'
                        ? 'US'
                        : 'User-defined'}
                    </div>
                  </button>
                ))}
              </div>

              {backtest.commissionProfile !== 'zero' && (
                <div className="space-y-3 mt-4 p-3 border border-primary/20 bg-primary/5 rounded-lg">
                  <div>
                    <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                      Maker Fee: {backtest.customMaker.toFixed(3)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.001"
                      value={backtest.customMaker}
                      onChange={(e) => handleChange('customMaker', parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                      Taker Fee: {backtest.customTaker.toFixed(3)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.001"
                      value={backtest.customTaker}
                      onChange={(e) => handleChange('customTaker', parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                    />
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Fill Model */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Fill Model
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            When orders are filled during backtests
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['next-bar', 'same-bar-conservative', 'same-bar-aggressive'].map((model) => (
            <button
              key={model}
              onClick={() => handleChange('fillModel', model)}
              className={cn(
                'p-3 border rounded-lg text-left transition-all',
                backtest.fillModel === model
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 bg-white/5 hover:border-primary/40'
              )}
            >
              <div className="text-[10px] font-black text-foreground uppercase">
                {model === 'next-bar' ? 'Next-Bar' : model === 'same-bar-conservative' ? 'Conservative' : 'Aggressive'}
              </div>
              <div className="text-[8px] text-muted-foreground/60 mt-1">
                {model === 'next-bar'
                  ? 'Realist'
                  : model === 'same-bar-conservative'
                  ? 'OHLC realistic'
                  : 'Optimistic'}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Advanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Collapsible
          open={expandedSections.advanced}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, advanced: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Advanced Settings
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Warmup bars, walk-forward, rebalance frequency
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.advanced && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            {/* Warmup Bars */}
            <div className="space-y-2 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Warmup Bars: {backtest.warmupBars}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={backtest.warmupBars}
                onChange={(e) => handleChange('warmupBars', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[8px] text-muted-foreground/60">
                Bars to ignore before starting backtest (for indicator warmup)
              </p>
            </div>

            {/* Walk-Forward */}
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <h4 className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Walk-Forward Parameters
              </h4>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                  In-Sample: {backtest.walkForwardInSample}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={backtest.walkForwardInSample}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    handleChange('walkForwardInSample', val);
                    handleChange('walkForwardOutOfSample', 100 - val);
                  }}
                  className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                  Out-Of-Sample: {backtest.walkForwardOutOfSample}%
                </label>
                <div className="text-[8px] text-muted-foreground/60">
                  Auto-adjusted (100% - In-Sample)
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                  Step Size: {backtest.walkForwardStepSize}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={backtest.walkForwardStepSize}
                  onChange={(e) => handleChange('walkForwardStepSize', parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[8px] text-muted-foreground/60">
                  Rolling window overlap distance
                </p>
              </div>
            </div>

            {/* Rebalance Frequency */}
            <div className="space-y-2 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Rebalance Frequency
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['daily', 'weekly', 'monthly'].map((freq) => (
                  <button
                    key={freq}
                    onClick={() => handleChange('rebalanceFrequency', freq)}
                    className={cn(
                      'p-2 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all',
                      backtest.rebalanceFrequency === freq
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
                    )}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="p-6 border border-primary/20 bg-primary/5 rounded-lg"
      >
        <h3 className="text-[11px] font-black text-primary uppercase tracking-wider mb-4">
          Current Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[9px]">
          <div>
            <span className="text-muted-foreground/60">Engine</span>
            <div className="font-black text-foreground mt-1">{summary.engineLabel}</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Capital</span>
            <div className="font-black text-foreground mt-1">{formatCurrency(backtest.startingCapital)}</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Fill Model</span>
            <div className="font-black text-foreground mt-1">{summary.fillLabel}</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Commission</span>
            <div className="font-black text-foreground mt-1">{summary.commissionLabel}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
