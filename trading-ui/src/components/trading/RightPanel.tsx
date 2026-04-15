import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Zap, RefreshCw } from "lucide-react";
import { IndustrialValue } from "./IndustrialValue";
import { LiveTelemetry } from "./LiveTelemetry";

// Mock data generators
const generateEquityBars = () => Array.from({ length: 20 }, (_, i) => ({
  day: i + 1,
  value: 100000 + Math.random() * 50000 + (i * 2000)
}));

const generateDrawdown = () => Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  value: -(Math.random() * 5 + Math.sin(i * 0.5) * 2)
}));

const tradeHeatmapData = [
  { day: "Mon", profit: 12000, loss: -4000 },
  { day: "Tue", profit: 8000, loss: -12000 },
  { day: "Wed", profit: 15000, loss: -3000 },
  { day: "Thu", profit: 6000, loss: -8000 },
  { day: "Fri", profit: 20000, loss: -5000 },
];

const riskAlerts = [
  { id: 1, type: "warning", message: "Portfolio concentration: Tech sector at 42%", time: "2m ago" },
  { id: 2, type: "info", message: "VaR breach: 95% threshold approached", time: "5m ago" },
  { id: 3, type: "success", message: "Daily profit target achieved", time: "15m ago" },
  { id: 4, type: "warning", message: "Unusual volume in NIFTY futures", time: "22m ago" },
];

export function RightPanel() {
  const [equityBars, setEquityBars] = useState(generateEquityBars);
  const [drawdown, setDrawdown] = useState(generateDrawdown);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setEquityBars(prev => {
        const newBars = [...prev.slice(1)];
        const lastValue = prev[prev.length - 1].value;
        newBars.push({
          day: prev.length + 1,
          value: lastValue + (Math.random() - 0.48) * 5000
        });
        return newBars;
      });
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const maxEquity = Math.max(...equityBars.map(e => e.value));
  const currentEquity = equityBars[equityBars.length - 1].value;

  const metrics = [
    { label: "NET_ACTIVE_VAL", value: `₹${(currentEquity / 100000).toFixed(2)}L`, color: "text-secondary" },
    { label: "SESSION_DELTA", value: 3840, isIndustrial: true, color: "text-secondary" },
    { label: "ALPHA_INDEX", value: "6.42", color: "text-primary" },
    { label: "EXPOSURE_RATIO", value: "68.1%", color: "text-primary/40" },
  ];

  return (
    <div className="w-72 bg-background border-l border-border flex flex-col shrink-0 overflow-y-auto custom-scrollbar industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      
      {/* Telemetry Header */}
      <div className="p-2.5 border-b border-border flex items-center justify-between bg-card/20 backdrop-blur-md relative z-10">
        <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-primary">Buffer_Log</h3>
        <div className="flex items-center gap-2 font-mono">
          <RefreshCw className="w-2.5 h-2.5 text-secondary animate-spin-slow" />
          <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-widest tabular-nums">
            {lastUpdate.toLocaleTimeString([], { hour12: false })}
          </span>
        </div>
      </div>

      {/* Metrics Registry */}
      <div className="p-3 border-b border-border bg-card/5 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col border-l border-border/20 pl-3">
              <span className="text-[7px] font-mono font-black uppercase text-muted-foreground/20 tracking-widest leading-tight">{m.label}</span>
              {m.isIndustrial ? (
                <IndustrialValue value={m.value as number} prefix="+₹" className="text-[11px] font-black tabular-nums tracking-tighter text-secondary" />
              ) : (
                <span className={`text-[11px] font-mono font-black tabular-nums tracking-tighter ${m.color}`}>{m.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Equity Trail Readout */}
      <div className="p-3 border-b border-border bg-card/10 backdrop-blur-md relative z-10">
        <h4 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3">Equity_Trail</h4>
        <div className="h-16 flex items-end gap-[1px] px-0.5">
          {equityBars.map((e, i) => (
            <div
              key={i}
              className="flex-1 min-w-[2px] bg-secondary/10 hover:bg-secondary/60 transition-all cursor-pointer relative group"
              style={{ height: `${(e.value / maxEquity) * 100}%` }}
            >
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-background border border-border px-1 py-0.5 text-[6px] font-mono font-black whitespace-nowrap z-50">
                  {e.value.toFixed(0)}
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Intensity Heatmap */}
      <div className="p-3 border-b border-border bg-card/5 relative z-10">
        <h4 className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-3">Load_Intensity</h4>
        <div className="space-y-3">
          {tradeHeatmapData.map((d) => (
            <div key={d.day} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-0.5 leading-none">
                <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">{d.day}_PKT</span>
                <span className="text-[9px] font-mono font-black text-secondary tabular-nums">+{((d.profit / (d.profit + Math.abs(d.loss))) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 w-full bg-border/20 overflow-hidden flex relative group">
                <div
                  className="h-full bg-secondary relative z-10"
                  style={{ width: `${(d.profit / (d.profit + Math.abs(d.loss))) * 100}%` }}
                />
                <div
                  className="h-full bg-destructive/30"
                  style={{ width: `${(Math.abs(d.loss) / (d.profit + Math.abs(d.loss))) * 100}%` }}
                />
                <div className="absolute inset-0 bg-white/5 animate-scan-fast opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-Time Neural Feed */}
      <div className="flex-1 min-h-[300px] border-t border-border relative z-10">
        <LiveTelemetry />
      </div>
    </div>
  );
}