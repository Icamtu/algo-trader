import React from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/aetherdesk/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Library, Zap, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyLibraryProps {
  onSelect: (strategy: any) => void;
  selectedId?: string;
  strategies?: any[];
}

export const StrategyLibrary: React.FC<StrategyLibraryProps> = ({ onSelect, selectedId, strategies: propStrategies }) => {
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => algoApi.getStrategies(),
    refetchInterval: 5000,
    enabled: propStrategies === undefined, // skip fetch when parent provides data
  });

  const strategies = propStrategies !== undefined
    ? { strategies: propStrategies }
    : (fetchedData?.data || fetchedData);

  const showLoading = propStrategies === undefined && isLoading;
  const isEmpty = !showLoading && (strategies?.strategies?.length ?? 0) === 0;

  if (showLoading) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-slate-900/50 h-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full bg-slate-800/40 animate-pulse rounded border border-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container border-r border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between bg-slate-900/30">
        <h2 className="font-h2 text-[14px] text-on-surface uppercase tracking-wider">Strategy Library</h2>
        <button
          aria-label="Filter strategies"
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-2">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 px-4 text-center">
              <Library className="w-8 h-8 text-slate-700" aria-hidden="true" />
              <p className="text-slate-600 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                No strategies deployed.<br />
                <span className="text-slate-500">Go to Strategy Lab to create one.</span>
              </p>
            </div>
          )}
          {Array.isArray(strategies?.strategies) && strategies.strategies.map((strat: any) => (
            <div
              key={strat.id}
              onClick={() => onSelect(strat)}
              className={cn(
                "p-3 rounded-r transition-all cursor-pointer group relative overflow-hidden border-l-4",
                selectedId === strat.id
                  ? "bg-surface-container-highest border-l-secondary shadow-sm brightness-110"
                  : "bg-surface-container-low border-l-transparent hover:bg-surface-container-high"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "font-h2 text-[14px] transition-colors",
                  selectedId === strat.id ? "text-cyan-300" : "text-slate-300"
                )}>
                  {strat.name}
                </span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-tighter",
                  strat.is_active
                    ? "bg-secondary/10 border-secondary/20 text-secondary"
                    : "bg-slate-800 border-slate-700 text-slate-500"
                )}>
                  {strat.is_active && <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />}
                  {strat.is_active ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono uppercase tracking-tight">
                <div>{strat.symbols?.[0] || "—"}</div>
                <div className="text-right">{strat.mode || strat.params?.timeframe || "—"}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-700/50 flex justify-between items-end">
                <span className="text-[10px] text-slate-500 font-mono uppercase">Today's PnL</span>
                <span className={cn(
                  "mono-numbers font-bold text-[14px]",
                  (strat.pnl || 0) >= 0 ? "text-secondary" : "text-error"
                )}>
                  ₹{(strat.pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
