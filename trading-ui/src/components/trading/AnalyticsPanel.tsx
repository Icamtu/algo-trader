import { TrendingUp, TrendingDown, BarChart3, Shield, Zap, Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { algoApi } from "@/lib/api-client";

const equityData = [10, 12, 11, 14, 13, 16, 15, 18, 20, 19, 22, 24, 23, 26, 28, 27, 30, 32, 31, 34, 33, 36, 38, 40, 39, 42, 44, 43, 46, 48];
const drawdownData = [0, -1, -2, -1, -3, -1, -2, -1, 0, -1, -2, 0, -1, -2, 0, -1, 0, -1, -2, -1, -3, -1, 0, -1, -2, 0, -1, 0, -1, 0];

export function AnalyticsPanel() {
  const [positions, setPositions] = useState<any[]>([]);
  const [pnlSummary, setPnlSummary] = useState<any>(null);
  const [riskMetricsData, setRiskMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [posData, pnlData, riskData] = await Promise.all([
        algoApi.getPositions(),
        algoApi.getPnl(),
        algoApi.getRiskMetrics()
      ]);
      if (posData.positions) setPositions(posData.positions);
      setPnlSummary(pnlData);
      setRiskMetricsData(riskData);
    } catch (e) {
      console.error("Analytics fetch failed", e);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    
    // Real-time subscription for positions table
    const channel = supabase
      .channel("analytics-positions")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPositions((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setPositions((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
        } else if (payload.eventType === "DELETE") {
          setPositions((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const metrics = [
    { label: "Net P&L", value: pnlSummary ? `₹${Math.round(pnlSummary.total_pnl).toLocaleString()}` : "₹0", icon: TrendingUp, color: (pnlSummary?.total_pnl || 0) >= 0 ? "text-neon-green" : "text-neon-red" },
    { label: "Positions", value: positions.length.toString(), icon: BarChart3, color: "text-primary" },
    { label: "Margin Use", value: riskMetricsData ? `${riskMetricsData.margin_utilization}%` : "0%", icon: Shield, color: "text-primary" },
    { label: "P&L %", value: pnlSummary ? `${pnlSummary.pnl_percentage.toFixed(2)}%` : "0%", icon: Zap, color: "text-neon-purple" },
    { label: "Max DD", value: riskMetricsData ? `${riskMetricsData.drawdown}%` : "0%", icon: TrendingDown, color: "text-neon-red" },
    { label: "Win Rate", value: "64%", icon: TrendingUp, color: "text-neon-green" },
  ];

  const riskMetrics = [
    { label: "Exposure", value: riskMetricsData ? `₹${(riskMetricsData.max_exposure || 0).toLocaleString()}` : "₹0", color: "text-primary" },
    { label: "VaR (95%)", value: "-₹1.2L", color: "text-neon-red" },
    { label: "CVaR", value: "-₹1.8L", color: "text-neon-red" },
    { label: "Alpha", value: "12.4%", color: "text-neon-green" },
  ];

  const maxEq = Math.max(...equityData);
  const minDD = Math.min(...drawdownData);

  if (loading) {
     return (
       <div className="w-80 glass-panel border-l border-border flex items-center justify-center">
         <Loader2 className="w-6 h-6 text-primary animate-spin" />
       </div>
     );
  }

  return (
    <div className="w-80 glass-panel border-l border-border flex flex-col shrink-0 overflow-y-auto">
      {/* Metrics Grid */}
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Performance Metrics</h3>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="glass-panel rounded-md p-2 text-center">
              <m.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${m.color}`} />
              <div className={`metric-value ${m.color}`}>{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Equity Curve */}
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Equity Curve</h3>
        <div className="h-24 flex items-end gap-px">
          {equityData.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${(v / maxEq) * 100}%`,
                background: `linear-gradient(180deg, hsl(var(--neon-cyan)) 0%, hsl(var(--neon-cyan) / 0.2) 100%)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Drawdown */}
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Drawdown</h3>
        <div className="h-16 flex items-start gap-px">
          {drawdownData.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-b-sm"
              style={{
                height: `${(Math.abs(v) / Math.abs(minDD)) * 100}%`,
                background: `linear-gradient(0deg, hsl(var(--neon-red) / 0.6) 0%, hsl(var(--neon-red) / 0.1) 100%)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Risk Dashboard */}
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Risk Dashboard</h3>
        <div className="space-y-2">
          {riskMetrics.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className={`data-cell font-semibold ${r.color}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Correlation Heatmap Placeholder */}
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Correlation Matrix</h3>
        <div className="grid grid-cols-5 gap-0.5">
          {Array.from({ length: 25 }).map((_, i) => {
            const val = Math.random();
            const hue = val > 0.5 ? "var(--neon-cyan)" : "var(--neon-red)";
            return (
              <div
                key={i}
                className="aspect-square rounded-sm"
                style={{
                  background: `hsl(${hue} / ${0.1 + val * 0.5})`,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-neon-red">-1.0</span>
          <span className="text-[8px] text-muted-foreground">0.0</span>
          <span className="text-[8px] text-neon-cyan">+1.0</span>
        </div>
      </div>

      {/* P&L Heatmap */}
      <div className="p-3">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5">Monthly P&L Heatmap</h3>
        <div className="grid grid-cols-6 gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const val = (Math.random() - 0.3) * 10;
            return (
              <div
                key={i}
                className="aspect-square rounded-sm flex items-center justify-center"
                style={{
                  background: val > 0
                    ? `hsl(var(--neon-green) / ${0.15 + (val / 10) * 0.4})`
                    : `hsl(var(--neon-red) / ${0.15 + (Math.abs(val) / 10) * 0.4})`,
                }}
              >
                <span className="text-[7px] text-foreground/70">{val.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
