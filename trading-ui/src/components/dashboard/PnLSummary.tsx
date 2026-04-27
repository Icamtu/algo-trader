import React from "react";
import { useTelemetryPnl } from "@/features/openalgo/hooks/useTrading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Clock, Calendar, BarChart3, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface PnLCardProps {
  label: string;
  value: number;
  charges: number;
  unrealized?: number;
  icon: React.ReactNode;
  loading?: boolean;
}

const PnLCard = ({ label, value, charges, unrealized, icon, loading }: PnLCardProps) => {
  const isPositive = value >= 0;

  if (loading) {
    return (
      <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md">
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-all backdrop-blur-md group overflow-hidden relative">
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 opacity-5 rounded-full",
        isPositive ? "bg-emerald-500" : "bg-rose-500"
      )} />

      <CardContent className="p-4 pt-5">
        <div className="flex items-center gap-2 mb-2 text-slate-400">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className={cn(
            "text-2xl font-bold tracking-tight",
            isPositive ? "text-emerald-400" : "text-rose-400"
          )}>
            {isPositive ? "+" : ""}
            {value.toLocaleString("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0
            })}
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>Charges: ₹{charges.toLocaleString("en-IN")}</span>
              {unrealized !== undefined && Math.abs(unrealized) > 0 && (
                <span className="text-slate-400 font-medium">
                  • MTM: ₹{unrealized.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={cn(
                "text-[10px] py-0 px-1.5 border-slate-800",
                isPositive ? "text-emerald-500 bg-emerald-500/5" : "text-rose-500 bg-rose-500/5"
              )}>
                {isPositive ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {isPositive ? "Profit" : "Loss"}
              </Badge>
              {unrealized !== undefined && Math.abs(unrealized) > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-800 text-slate-400 bg-slate-400/5">
                  Floating
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PnLSummary = () => {
  const { data, isLoading, error } = useTelemetryPnl();

  if (error) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <PnLCard
        label="Today"
        value={data?.daily.net ?? 0}
        charges={data?.daily.charges ?? 0}
        unrealized={data?.all_time.unrealized ?? 0}
        icon={<Clock className="w-3.5 h-3.5" />}
        loading={isLoading}
      />
      <PnLCard
        label="Weekly"
        value={data?.weekly.net ?? 0}
        charges={data?.weekly.charges ?? 0}
        unrealized={data?.all_time.unrealized ?? 0}
        icon={<Calendar className="w-3.5 h-3.5" />}
        loading={isLoading}
      />
      <PnLCard
        label="Monthly"
        value={data?.monthly.net ?? 0}
        charges={data?.monthly.charges ?? 0}
        unrealized={data?.all_time.unrealized ?? 0}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        loading={isLoading}
      />
      <PnLCard
        label="All Time"
        value={data?.all_time.net ?? 0}
        charges={data?.all_time.charges ?? 0}
        unrealized={data?.all_time.unrealized ?? 0}
        icon={<Globe className="w-3.5 h-3.5" />}
        loading={isLoading}
      />
    </div>
  );
};
