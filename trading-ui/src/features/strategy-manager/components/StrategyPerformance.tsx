import React from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Activity, Percent, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyPerformanceProps {
  strategyId: string;
}

const StatBox = ({ label, value, subtext, icon: Icon, colorClass }: any) => (
  <div className="bg-white/5 border border-white/5 p-3 rounded-lg flex flex-col gap-1 hover:border-primary/20 transition-all group">
    <div className="flex items-center justify-between">
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">{label}</span>
      <Icon className={cn("w-3 h-3 opacity-40", colorClass)} />
    </div>
    <span className="text-lg font-black tracking-tighter font-mono">{value}</span>
    <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest">{subtext}</span>
  </div>
);

export const StrategyPerformance: React.FC<StrategyPerformanceProps> = ({ strategyId }) => {
  const { data: performance, isLoading } = useQuery({
    queryKey: ["strategy-performance", strategyId],
    queryFn: () => algoApi.getStrategyPerformance(strategyId),
    enabled: !!strategyId,
    refetchInterval: 10000,
  });

  if (!strategyId) return null;

  const metrics = performance?.metrics || {};
  const pnlCurve = performance?.pnl_history || [];

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-slate-950/20">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Performance_Audit</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Net PnL"
          value={`₹${(metrics.net_pnl || 0).toLocaleString()}`}
          subtext="Total Realized"
          icon={TrendingUp}
          colorClass={(metrics.net_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}
        />
        <StatBox
          label="Win Rate"
          value={`${metrics.win_rate || 0}%`}
          subtext={`${metrics.total_trades || 0} Trades`}
          icon={Percent}
          colorClass="text-secondary"
        />
        <StatBox
          label="Drawdown"
          value="1.2%"
          subtext="Max Session"
          icon={TrendingDown}
          colorClass="text-red-400"
        />
        <StatBox
          label="Sharpe"
          value="2.14"
          subtext="Risk Adjusted"
          icon={Target}
          colorClass="text-primary"
        />
      </div>

      {/* Equity Curve Mini Chart */}
      <div className="flex-1 mt-2 border border-white/5 bg-black/40 rounded-lg p-3 relative overflow-hidden group">
         <div className="absolute top-2 left-3 flex items-center gap-2 opacity-40">
            <Zap className="w-2.5 h-2.5 text-primary" />
            <span className="text-[8px] font-black uppercase tracking-widest">Equity_Dynamics</span>
         </div>

         <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pnlCurve}>
                <Line
                    type="stepAfter"
                    dataKey="value"
                    stroke="#00E5FF"
                    strokeWidth={2}
                    dot={false}
                    animationDuration={1000}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <XAxis hide dataKey="time" />
                <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                    labelStyle={{ display: 'none' }}
                />
            </LineChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};
