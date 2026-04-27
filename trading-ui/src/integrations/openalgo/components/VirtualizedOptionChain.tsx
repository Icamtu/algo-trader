import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPreparedText, PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS } from '@/lib/pretext';
import { layout } from '@chenglou/pretext';
import type { OptionStrike, ColumnKey, BarDataSource, BarStyle } from '../types/option-chain';
import { COLUMN_DEFINITIONS } from '../types/option-chain';

interface VirtualizedOptionChainProps {
  chain: OptionStrike[];
  previousChain: Map<number, OptionStrike>;
  visibleCeColumns: ColumnKey[];
  visiblePeColumns: ColumnKey[];
  maxBarValue: number;
  barDataSource: BarDataSource;
  barStyle: BarStyle;
  onPlaceOrder: (symbol: string, side: 'BUY' | 'SELL') => void;
  isAD: boolean;
}

const ROW_HEIGHT = 40; // Standard Option Chain row height
const STRIKE_WIDTH = 96; // w-24 = 96px

function formatInLakhs(num: number | undefined | null): string {
  if (num === undefined || num === null || num === 0) return '0'
  const lakhs = num / 100000
  if (lakhs >= 100) return lakhs.toFixed(0) + 'L'
  if (lakhs >= 10) return lakhs.toFixed(1) + 'L'
  if (lakhs >= 1) return lakhs.toFixed(2) + 'L'
  const thousands = num / 1000
  if (thousands >= 1) return thousands.toFixed(1) + 'K'
  return num.toLocaleString()
}

function formatPrice(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0.00'
  return num.toFixed(2)
}

export const VirtualizedOptionChain: React.FC<VirtualizedOptionChainProps> = ({
  chain,
  previousChain,
  visibleCeColumns,
  visiblePeColumns,
  maxBarValue,
  barDataSource,
  barStyle,
  onPlaceOrder,
  isAD
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const numClass = 'font-mono tabular-nums text-[11px] tracking-tight';

  // Calculate side widths. Center (Strike) is fixed 96px.
  // The rest of the width is split between CE and PE sides.
  const sideWidth = (containerWidth - STRIKE_WIDTH) / 2;

  const totalHeight = chain.length * ROW_HEIGHT;

  const visibleStrikes = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const endIdx = Math.min(chain.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);
    return chain.slice(startIdx, endIdx).map((s, i) => ({
      strike: s,
      idx: startIdx + i,
      offset: (startIdx + i) * ROW_HEIGHT
    }));
  }, [chain, scrollTop, containerHeight]);

  return (
    <div className="flex flex-col h-full">
      {/* Institutional Table Header */}
      <div className="sticky top-0 z-50 bg-card/60 backdrop-blur-xl border-b-2 border-border/60">
        <div className="flex h-12">
          <div className={cn("flex-1 px-4 flex items-center justify-center font-black text-[10px] uppercase tracking-[0.4em] border-r border-border/60", primaryColorClass)}>
            Call_Side_Intelligence
          </div>
          <div className={cn("w-24 flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em]", isAD ? "bg-primary/10 text-primary" : "bg-teal-500/10 text-teal-500")}>
            Strike
          </div>
          <div className="flex-1 px-4 flex items-center justify-center font-black text-[10px] uppercase tracking-[0.4em] text-rose-500 border-l border-border/60">
            Put_Side_Intelligence
          </div>
        </div>
        <div className="flex h-8 border-t border-border/40 bg-background/20 font-mono text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest italic">
          <div className="flex-1 flex border-r border-border/60">
            {visibleCeColumns.map(key => (
              <div key={key} className="flex-1 px-2 flex items-center justify-end">
                {COLUMN_DEFINITIONS.find(c => c.key === key)?.label}
              </div>
            ))}
          </div>
          <div className="w-24" />
          <div className="flex-1 flex border-l border-border/60">
            {visiblePeColumns.map(key => (
              <div key={key} className="flex-1 px-2 flex items-center justify-start">
                {COLUMN_DEFINITIONS.find(c => c.key === key)?.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar relative"
      >
        <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
          {visibleStrikes.map(({ strike, offset }) => {
            const prevStrike = previousChain.get(strike.strike);
            const ce = strike.ce;
            const pe = strike.pe;
            const label = ce?.label ?? pe?.label ?? '';
            const isATM = label === 'ATM';
            const isCeOTM = label.startsWith('OTM');
            const isPeOTM = label.startsWith('ITM');

            const ceLtpChanged = prevStrike?.ce?.ltp !== undefined && prevStrike.ce.ltp !== ce?.ltp;
            const peLtpChanged = prevStrike?.pe?.ltp !== undefined && prevStrike.pe.ltp !== pe?.ltp;

            const ceFlashClass = ceLtpChanged ? (ce && prevStrike?.ce && ce.ltp > prevStrike.ce.ltp ? (isAD ? 'text-emerald-400 font-bold' : 'text-teal-400 font-bold') : 'text-rose-500 font-bold') : '';
            const peFlashClass = peLtpChanged ? (pe && prevStrike?.pe && pe.ltp > prevStrike.pe.ltp ? (isAD ? 'text-emerald-400 font-bold' : 'text-teal-400 font-bold') : 'text-rose-500 font-bold') : '';

            const ceBarValue = barDataSource === 'oi' ? ce?.oi : ce?.volume;
            const peBarValue = barDataSource === 'oi' ? pe?.oi : pe?.volume;
            const ceBarPercent = ceBarValue ? Math.min((ceBarValue / maxBarValue) * 100, 100) : 0;
            const peBarPercent = peBarValue ? Math.min((peBarValue / maxBarValue) * 100, 100) : 0;

            const ceBarClass = barStyle === 'gradient' ? cn('bg-gradient-to-r from-transparent', isAD ? 'to-amber-500/20' : 'to-teal-500/20') : (isAD ? 'bg-amber-500/10' : 'bg-teal-500/10');
            const peBarClass = barStyle === 'gradient' ? cn('bg-gradient-to-l from-transparent', isAD ? 'to-rose-500/20' : 'to-rose-500/20') : 'bg-rose-500/10';

            return (
              <div
                key={strike.strike}
                className="flex hover:bg-muted/10 group border-b border-border/40"
                style={{
                  position: 'absolute',
                  top: offset,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT
                }}
              >
                {/* CE Side */}
                <div className={cn('flex-1 relative border-r border-border/40', isCeOTM && !isATM && (isAD ? 'bg-amber-500/5' : 'bg-teal-500/5'))}>
                  <div className={cn('absolute left-0 top-0 bottom-0 pointer-events-none z-0 transition-all duration-300', ceBarClass)} style={{ width: `${ceBarPercent}%` }} />
                  {ce && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onPlaceOrder(ce.symbol, 'BUY')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-emerald-600 shadow-emerald-900/40" : "bg-teal-600 shadow-teal-900/40")}>B</button>
                      <button onClick={() => onPlaceOrder(ce.symbol, 'SELL')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-amber-600 shadow-amber-900/40" : "bg-rose-600 shadow-rose-900/40")}>S</button>
                    </div>
                  )}
                  <div className="relative z-10 flex h-full">
                    {visibleCeColumns.map(key => (
                      <div key={key} className="flex-1 px-2 py-2 text-right flex items-center justify-end">
                        {key === 'ce_oi' && <span className={numClass}>{formatInLakhs(ce?.oi)}</span>}
                        {key === 'ce_volume' && <span className={numClass}>{formatInLakhs(ce?.volume)}</span>}
                        {key === 'ce_ltp' && <span className={cn(numClass, ceFlashClass)}>{formatPrice(ce?.ltp)}</span>}
                        {key === 'ce_spread' && <span className={numClass}>{formatPrice(ce && ce.bid > 0 && ce.ask > 0 ? ce.ask - ce.bid : 0)}</span>}
                        {['ce_delta', 'ce_gamma', 'ce_theta', 'ce_vega', 'ce_iv'].includes(key) && (
                           <span className={cn(numClass, isAD ? 'text-amber-400' : 'text-teal-400')}>
                             {formatPrice(ce ? (ce as any)[key.replace('ce_', '')] : 0)}
                           </span>
                        )}
                        {['ce_bid', 'ce_ask', 'ce_bid_qty', 'ce_ask_qty'].includes(key) && (
                           <span className={cn(numClass, key.includes('bid') ? 'text-rose-400' : 'text-teal-400')}>
                             {formatPrice(ce ? (ce as any)[key.replace('ce_', '')] : 0)}
                           </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strike Center */}
                <div className={cn('w-24 text-center font-black flex items-center justify-center text-[11px] font-mono border-x border-border/60', isATM ? (isAD ? 'bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(255,176,0,0.2)]' : 'bg-teal-500/20 text-teal-500 shadow-[inset_0_0_10px_rgba(20,184,166,0.2)]') : 'bg-foreground/5 text-muted-foreground')}>
                  {strike.strike}
                </div>

                {/* PE Side */}
                <div className={cn('flex-1 relative border-l border-border/40', isPeOTM && !isATM && 'bg-rose-500/5')}>
                  <div className={cn('absolute right-0 top-0 bottom-0 pointer-events-none z-0 transition-all duration-300', peBarClass)} style={{ width: `${peBarPercent}%` }} />
                  {pe && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onPlaceOrder(pe.symbol, 'BUY')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-emerald-600 shadow-emerald-900/40" : "bg-teal-600 shadow-teal-900/40")}>B</button>
                      <button onClick={() => onPlaceOrder(pe.symbol, 'SELL')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-amber-600 shadow-amber-900/40" : "bg-rose-600 shadow-rose-900/40")}>S</button>
                    </div>
                  )}
                  <div className="relative z-10 flex h-full">
                    {visiblePeColumns.map(key => (
                      <div key={key} className="flex-1 px-2 py-2 text-left flex items-center justify-start">
                        {key === 'pe_ltp' && <span className={cn(numClass, peFlashClass)}>{formatPrice(pe?.ltp)}</span>}
                        {key === 'pe_oi' && <span className={numClass}>{formatInLakhs(pe?.oi)}</span>}
                        {key === 'pe_volume' && <span className={numClass}>{formatInLakhs(pe?.volume)}</span>}
                        {key === 'pe_spread' && <span className={numClass}>{formatPrice(pe && pe.bid > 0 && pe.ask > 0 ? pe.ask - pe.bid : 0)}</span>}
                        {['pe_delta', 'pe_gamma', 'pe_theta', 'pe_vega', 'pe_iv'].includes(key) && (
                           <span className={cn(numClass, isAD ? 'text-amber-400' : 'text-teal-400')}>
                             {formatPrice(pe ? (pe as any)[key.replace('pe_', '')] : 0)}
                           </span>
                        )}
                        {['pe_bid', 'pe_ask', 'pe_bid_qty', 'pe_ask_qty'].includes(key) && (
                           <span className={cn(numClass, key.includes('bid') ? 'text-rose-400' : 'text-teal-400')}>
                             {formatPrice(pe ? (pe as any)[key.replace('pe_', '')] : 0)}
                           </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
