import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Zap, RefreshCw } from "lucide-react";

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
  const maxDD = Math.min(...drawdown.map(d => d.value));

  const metrics = [
    { label: "Net Equity", value: `₹${(currentEquity / 100000).toFixed(2)}L`, icon: TrendingUp, color: "text-neon-emerald" },
    { label: "Day P&L", value: "+₹3,840", icon: TrendingUp, color: "text-neon-green" },
    { label: "Max DD", value: `${maxDD.toFixed(1)}%`, icon: TrendingDown, color: "text-neon-red" },
    { label: "Win Rate", value: "64.2%", icon: Activity, color: "text-primary" },
    { label: "Risk Score", value: "42", icon: AlertTriangle, color: "text-neon-orange" },
    { label: "Exposure", value: "68%", icon: Zap, color: "text-neon-cyan" },
  ];

  return (
    <div className="w-72 glass-panel border-l border-border flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Performance</h3>
        <div className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin-slow" />
          <span className="text-[8px] text-muted-foreground">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="p-3 border-b border-border">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="glass-panel rounded-md p-2">
              <m.icon className={`w-3 h-3 mb-1 ${m.color}`} />
              <div className={`metric-value ${m.color}`}>{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Equity Bars */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Equity Trail</h4>
        <div className="h-20 flex items-end gap-px">
          {equityBars.map((e, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/80 to-primary/20 transition-all duration-300"
              style={{ height: `${(e.value / maxEquity) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Drawdown Mini Chart */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Drawdown</h4>
        <div className="h-12 flex items-end gap-px">
          {drawdown.map((d, i) => (
            <div
              key={i}
              className="flex-1 rounded-b-sm bg-gradient-to-t from-neon-red/60 to-neon-red/10"
              style={{ height: `${Math.abs(d.value) * 8}%` }}
            />
          ))}
        </div>
      </div>

      {/* Trade Heatmap */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Weekly Heatmap</h4>
        <div className="space-y-1.5">
          {tradeHeatmapData.map((d) => (
            <div key={d.day} className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground w-8">{d.day}</span>
              <div className="flex-1 h-4 rounded-sm overflow-hidden flex">
                <div
                  className="bg-neon-green/60"
                  style={{ width: `${(d.profit / (d.profit + Math.abs(d.loss))) * 100}%` }}
                />
                <div
                  className="bg-neon-red/60"
                  style={{ width: `${(Math.abs(d.loss) / (d.profit + Math.abs(d.loss))) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Alerts */}
      <div className="p-3 flex-1">
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          Risk Alerts
        </h4>
        <div className="space-y-2">
          {riskAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-2 rounded-md text-[10px] ${
                alert.type === "warning" ? "bg-neon-orange/10 border border-neon-orange/20" :
                alert.type === "success" ? "bg-neon-green/10 border border-neon-green/20" :
                "bg-primary/10 border border-primary/20"
              }`}
            >
              <p className="text-foreground/80">{alert.message}</p>
              <span className="text-[8px] text-muted-foreground">{alert.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}