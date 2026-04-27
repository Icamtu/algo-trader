import React from "react";
import { useTelemetryPerformance } from "@/features/openalgo/hooks/useTrading";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, ShieldCheck, Activity, Target, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface VitalItemProps {
  label: string;
  value: number | string;
  subtext: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

const VitalItem = ({ label, value, subtext, icon, color, loading }: VitalItemProps) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3 border border-slate-800 rounded-lg bg-slate-900/20">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-3.5 border border-slate-800 rounded-xl bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <div className={cn("p-1.5 rounded-md", color)}>
            {icon}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
        </div>
        <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>

      <div className="flex flex-col">
        <span className="text-xl font-bold text-slate-100">{value}</span>
        <span className="text-[10px] text-slate-500 font-medium">{subtext}</span>
      </div>
    </div>
  );
};

export const PerformanceVitals = () => {
  const { data, isLoading, error } = useTelemetryPerformance();

  if (error) return null;

  return (
    <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-200">System Integrity</h3>
            <p className="text-[10px] text-slate-500">Institutional Risk Ratios (Real-time)</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase">Live Audit</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <VitalItem
            label="Sharpe"
            value={data?.sharpe ?? "0.00"}
            subtext="Risk-Adj. Return"
            icon={<Zap className="w-3.5 h-3.5 text-blue-400" />}
            color="bg-blue-500/10"
            loading={isLoading}
          />
          <VitalItem
            label="Sortino"
            value={data?.sortino ?? "0.00"}
            subtext="Downside Risk"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            color="bg-emerald-500/10"
            loading={isLoading}
          />
          <VitalItem
            label="Profit Factor"
            value={data?.profit_factor ?? "0.00"}
            subtext="Gross Win/Loss"
            icon={<Target className="w-3.5 h-3.5 text-amber-400" />}
            color="bg-amber-500/10"
            loading={isLoading}
          />
          <VitalItem
            label="Max Drawdown"
            value={`${data?.max_drawdown ?? "0.00"}%`}
            subtext="Peak-to-Valley"
            icon={<Activity className="w-3.5 h-3.5 text-rose-400" />}
            color="bg-rose-500/10"
            loading={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider mb-1">
            <span className="text-slate-500">Execution Quality</span>
            <span className="text-indigo-400">{data?.total_trades ?? 0} Trades</span>
          </div>
          <Progress value={Math.min(((data?.total_trades ?? 0) / 100) * 100, 100)} className="h-1 bg-slate-800" indicatorClassName="bg-indigo-500" />
          <p className="text-[9px] text-slate-600 italic">Confidence score derived from multi-regime execution logs.</p>
        </div>
      </CardContent>
    </Card>
  );
};
