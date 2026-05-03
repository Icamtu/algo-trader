import { TrendingUp, TrendingDown, BarChart3, Shield, Zap, Loader2, Activity } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { algoApi } from "@/features/aetherdesk/api/client";
import { IndustrialValue } from "./IndustrialValue";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function AnalyticsPanel() {
  const [positions, setPositions] = useState<any[]>([]);
  const [pnlSummary, setPnlSummary] = useState<any>(null);
  const [riskMetricsData, setRiskMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Rolling live history replacement
  const [equityData, setEquityData] = useState<number[]>(Array(30).fill(0));
  const [drawdownData, setDrawdownData] = useState<number[]>(Array(30).fill(0));

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

      // Dynamically map real-time PNL to the rolling visual oscilloscope
      if (pnlData && pnlData.total_pnl !== undefined) {
        setEquityData(prev => {
          const newArr = [...prev.slice(1), pnlData.total_pnl];
          return newArr;
        });

        // Calculate a naive drawdown array from equity peak
        setEquityData(eqLine => {
           const peak = Math.max(...eqLine, 0.01);
           const currentEq = pnlData.total_pnl;
           const dd = currentEq < peak ? (currentEq - peak) : 0;
           setDrawdownData(prev => [...prev.slice(1), dd]);
           return eqLine;
        });
      }

    } catch (e) {
      console.error("ANALYTICS_FETCH_FAULT", e);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [loading]);

  const metrics = [
    { label: "NET_PNL_RT", value: pnlSummary?.total_pnl || 0, isCurrency: true, color: (pnlSummary?.total_pnl || 0) >= 0 ? "text-secondary" : "text-destructive" },
    { label: "MARGIN_USE", value: riskMetricsData?.margin_utilization || 0, suffix: "%", color: "text-primary" },
    { label: "ALPHA_GEN", value: 12.4, suffix: "%", color: "text-primary" },
  ];

  const riskMetrics = [
    { label: "MAX_EXPO", value: riskMetricsData?.max_exposure || 0, isCurrency: true, color: "text-primary" },
    { label: "VAR_NSE", value: -120000, isCurrency: true, color: "text-destructive" },
    { label: "CVAR_AG", value: -180000, isCurrency: true, color: "text-destructive" },
  ];

  const maxEq = Math.max(...equityData);
  const minDD = Math.min(...drawdownData);

  if (loading) {
     return (
       <div className="w-80 bg-background border-l border-border h-full flex flex-col items-center justify-center industrial-grid relative">
         <div className="noise-overlay" />
         <div className="scanline" />
         <Loader2 className="w-5 h-5 text-primary animate-spin" />
         <span className="text-[8px] font-mono font-black text-primary animate-pulse mt-4 tracking-[0.4em]">SYNCING...</span>
       </div>
     );
  }

  return (
    <div className="w-80 bg-background border-l border-border flex flex-col shrink-0 overflow-y-auto custom-scrollbar industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Primary Metrics Registry */}
      <div className="p-3 border-b border-border aether-panel relative z-10 m-2 rounded-sm shadow-2xl">
        <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3 flex items-center gap-2">
          <Activity className="w-3 h-3 text-teal" />
          Core_Telemetry
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-end justify-between border-l-2 border-teal/30 pl-3 py-0.5 group">
              <div className="flex flex-col">
                <span className="text-[7px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5">{m.label}</span>
                <IndustrialValue
                  value={m.value}
                  prefix={m.isCurrency ? "₹" : ""}
                  suffix={m.suffix}
                  className={cn("text-lg font-black font-display tracking-tighter transition-all group-hover:scale-105 origin-left", m.color)}
                />
              </div>
              <div className="h-0.5 w-10 bg-border/20 mb-1.5 overflow-hidden">
                 <div className={`h-full animate-scan-fast ${m.color.replace('text', 'bg')}`} style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Oscilloscope */}
      <div className="p-3 border-b border-border aether-panel relative z-10 m-2 rounded-sm shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40">Performance_Map</h3>
          <span className="text-[8px] font-mono font-black text-teal tracking-widest">+4.28%</span>
        </div>
        <div className="h-20 flex items-end gap-0.5 px-0.5">
          {equityData.map((v, i) => (
            <div
              key={i}
              className="flex-1 min-w-[2px] transition-all bg-teal/10 hover:bg-teal cursor-pointer relative group"
              style={{ height: `${(Math.max(v, 1) / Math.max(maxEq, 1)) * 100}%` }}
            >
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-background border border-border px-1.5 py-0.5 text-[7px] font-mono font-black whitespace-nowrap z-50">
                  VAL::{v}
               </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2.5 border-t border-border/30 pt-2 text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.3em]">
            <span>30D_HISTORY</span>
            <span>LIVE_BUFFER</span>
        </div>
      </div>

      {/* Internal Risk Matrix */}
      <div className="p-3 border-b border-border aether-panel relative z-10 m-2 rounded-sm shadow-2xl">
        <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3">Risk_Exposure_Matrix</h3>
        <div className="h-12 flex items-start gap-0.5 px-0.5">
          {drawdownData.map((v, i) => (
            <div
              key={i}
              className="flex-1 min-w-[2px] bg-destructive/10 hover:bg-destructive/60 transition-colors"
              style={{ height: `${(Math.abs(v) / Math.max(Math.abs(minDD), 1)) * 100}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-px bg-border/20 border border-border mt-3 overflow-hidden rounded-sm">
          {riskMetrics.map((r) => (
            <div key={r.label} className="p-2 bg-background/40 flex flex-col">
              <span className="text-[7px] font-mono font-black uppercase tracking-widest text-muted-foreground/30 mb-0.5">{r.label}</span>
              <IndustrialValue
                value={r.value}
                prefix={r.isCurrency ? "₹" : ""}
                className={`text-[9px] font-mono font-black tracking-tight ${r.color}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scalar Correlation Matrix */}
      <div className="p-3 border-b border-border aether-panel relative z-10 m-2 rounded-sm shadow-2xl">
        <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3">Neural_Correlation_Grid</h3>
        <div className="grid grid-cols-10 gap-0.5">
          {Array.from({ length: 40 }).map((_, i) => {
            const val = Math.random();
            // Pro Max palette: deep navy to emerald/blue
            const color = val > 0.6 ? `rgba(34, 197, 94, ${0.1 + val * 0.4})` : `rgba(59, 130, 246, ${0.1 + val * 0.4})`;
            return (
              <div
                key={i}
                className="aspect-square border border-white/5 transition-all hover:border-white/20 cursor-crosshair hover:scale-110"
                style={{ background: color }}
              />
            );
          })}
        </div>
      </div>

      {/* Alpha Sector Distribution */}
      <div className="p-3 pb-8 aether-panel relative z-10 m-2 rounded-sm shadow-2xl">
        <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3">Sector_Load</h3>
        <div className="space-y-4">
            {[
                { name: 'TREND_A', value: 42, color: 'bg-teal' },
                { name: 'VOL_X', value: 28, color: 'bg-primary' },
                { name: 'ARB_SEQ', value: 15, color: 'bg-muted-foreground/20' }
            ].map(s => (
                <div key={s.name} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-0.5 leading-none">
                        <span className="text-[8px] font-mono font-black text-foreground/40 uppercase tracking-widest">{s.name}</span>
                        <span className="text-[9px] font-mono font-black text-foreground tabular-nums">{s.value}%</span>
                    </div>
                    <div className="h-1 w-full bg-border/20 relative group overflow-hidden rounded-full">
                        <div className={`h-full ${s.color} relative overflow-hidden transition-all duration-1000`} style={{ width: `${s.value}%` }}>
                           <div className="absolute inset-0 bg-white/20 animate-scan-fast opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
