import React from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Percent, Target, Zap, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyPerformanceProps {
  strategyId: string | null;
  capitalAllocation?: number;
}

const StatBox = ({ label, value, subtext, colorClass }: any) => (
  <div className="bg-surface-container-high p-3 rounded border border-slate-800">
    <p className="text-[10px] text-slate-500 uppercase font-mono tracking-widest mb-1">{label}</p>
    <p className={cn("text-xl font-bold mono-numbers", colorClass)}>{value}</p>
    <p className="text-[10px] text-slate-500 font-mono">{subtext}</p>
  </div>
);

export const StrategyPerformance: React.FC<StrategyPerformanceProps> = ({ strategyId, capitalAllocation }) => {
  const { data: performance, isLoading, isError } = useQuery({
    queryKey: ["strategy-performance", strategyId],
    queryFn: () => algoApi.getStrategyPerformance(strategyId),
    enabled: !!strategyId,
    refetchInterval: 10000,
  });

  if (!strategyId) return (
    <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[11px] uppercase tracking-[0.5em]">
      Select a strategy to view performance
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col h-full bg-surface-container rounded-lg border border-border overflow-hidden animate-pulse">
      <div className="p-3 border-b border-border h-10 bg-slate-800/30" />
      <div className="p-4 grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-800/30 rounded border border-slate-800" />)}
      </div>
      <div className="flex-1 m-4 bg-slate-800/30 rounded border border-slate-800" />
    </div>
  );

  if (isError) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-600 font-mono text-[11px] uppercase tracking-widest bg-surface-dim/40">
      <span className="text-error text-[13px]">Performance fetch failed</span>
      <span className="text-[9px] text-slate-700">Check engine connection on port 18788</span>
    </div>
  );

  const metrics = performance?.metrics || {};
  const equityCurve: { t: string; v: number }[] = performance?.equity_curve || [];

  // Normalise equity curve to SVG viewBox 400×100
  const svgPath = (() => {
    if (equityCurve.length < 2) return null;
    const values = equityCurve.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 400;
      const y = 100 - ((v - min) / range) * 90 - 5; // 5px top padding
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pts.join(" L")}`;
  })();

  const winCount = Math.round(((metrics.win_rate || 0) / 100) * (metrics.total_trades || 0));
  const lossCount = (metrics.total_trades || 0) - winCount;
  const netPnl = metrics.net_pnl || 0;
  const capitalRef = capitalAllocation || performance?.safeguards?.max_loss_inr || 500000;
  const pnlPct = capitalRef ? ((netPnl / capitalRef) * 100).toFixed(2) : "0.00";

  return (
    <div className="flex flex-col h-full bg-surface-container rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="font-h2 text-h2 text-on-surface">Performance Dashboard</h2>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 font-mono">LIVE TRACKING</span>
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        <StatBox
          label="Today PnL"
          value={`${netPnl >= 0 ? "+" : ""}₹${netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtext={`${netPnl >= 0 ? "+" : ""}${pnlPct}% vs Capital`}
          colorClass={netPnl >= 0 ? "text-secondary" : "text-error"}
        />
        <StatBox
          label="Win Rate"
          value={metrics.win_rate != null ? `${metrics.win_rate}%` : "--"}
          subtext={metrics.total_trades ? `${winCount} Wins / ${lossCount} Losses` : "No trades yet"}
          colorClass="text-cyan-400"
        />
        <StatBox
          label="Total Trades"
          value={metrics.total_trades ?? "--"}
          subtext={`Gross ₹${(metrics.gross_pnl || 0).toLocaleString('en-IN')}`}
          colorClass="text-tertiary"
        />
        <StatBox
          label="Net After Charges"
          value={`₹${(metrics.net_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtext={`Charges ₹${(metrics.total_charges || 0).toLocaleString('en-IN')}`}
          colorClass={netPnl >= 0 ? "text-secondary" : "text-error"}
        />
      </div>

      <div className="flex-1 p-4 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Equity Curve (Cumulative PnL)</h3>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 text-[9px] bg-slate-800 rounded text-slate-400 border border-slate-700 cursor-pointer hover:border-slate-500">1D</span>
            <span className="px-2 py-0.5 text-[9px] bg-cyan-900/30 rounded text-cyan-400 border border-cyan-500/30 cursor-pointer">1W</span>
            <span className="px-2 py-0.5 text-[9px] bg-slate-800 rounded text-slate-400 border border-slate-700 cursor-pointer hover:border-slate-500">1M</span>
          </div>
        </div>

        <div className="flex-1 bg-slate-900/30 rounded-lg border border-slate-800/50 relative overflow-hidden flex items-end min-h-[200px]">
          {/* Simulated Chart Area */}
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full grid grid-cols-6 grid-rows-4">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="border-r border-b border-slate-700" />
              ))}
            </div>
          </div>

          <div className="w-full h-[180px] p-2 relative z-10">
            {svgPath ? (
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 100">
                <defs>
                  <linearGradient id="gradient-chart-perf" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={svgPath}
                  fill="transparent"
                  stroke="#00E5FF"
                  strokeWidth="2"
                  className="drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                />
                <path
                  d={`${svgPath} V100 H0 Z`}
                  fill="url(#gradient-chart-perf)"
                />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 font-mono text-[10px] uppercase tracking-widest">
                {isLoading ? "Loading curve..." : "No trade data yet"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
