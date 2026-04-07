import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Shield, TrendingUp, TrendingDown, Activity, Save, AlertTriangle, CheckCircle2, Settings, Loader2 } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { type RiskStatus, ApiError } from "@/types/api";
import { ApiErrorBoundary } from "@/components/ui/ApiErrorBoundary";

// --- Sector Allocation (Keep as visual mock for now) ---
const sectorData = [
  { name: "Technology", value: 28, color: "hsl(234, 89%, 64%)" },
  { name: "Financials", value: 22, color: "hsl(160, 84%, 39%)" },
  { name: "Healthcare", value: 15, color: "hsl(272, 87%, 53%)" },
  { name: "Energy", value: 12, color: "hsl(38, 92%, 50%)" },
  { name: "Consumer", value: 10, color: "hsl(183, 100%, 49%)" },
  { name: "Industrial", value: 8, color: "hsl(0, 72%, 51%)" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const LOAD_TIMEOUT_MS = 5000;

export function RiskDashboard() {
  const { toast } = useToast();
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editedLimits, setEditedLimits] = useState({
    max_daily_loss: 0,
    max_daily_trades: 0,
    max_open_positions: 0,
    max_order_notional: 0,
    max_order_quantity: 0,
    max_position_qty: 0,
  });

  useEffect(() => {
    fetchStatus();
    // Start a timeout—if data hasn't arrived in 5s, show error
    timeoutRef.current = setTimeout(() => {
      if (!riskStatus) {
        setApiError("Backend API did not respond within 5 seconds. The algo-engine may be offline.");
      }
    }, LOAD_TIMEOUT_MS);
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await algoApi.getRiskStatus();
      setRiskStatus(status);
      setApiError(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (!isUpdating) {
        setEditedLimits({
          max_daily_loss: status.max_daily_loss,
          max_daily_trades: status.max_daily_trades,
          max_open_positions: status.max_open_positions,
          max_order_notional: status.max_order_notional,
          max_order_quantity: status.max_order_quantity,
          max_position_qty: status.max_position_qty,
        });
      }
    } catch (error) {
      console.error("Failed to fetch risk status", error);
      if (!riskStatus) {
        setApiError("Cannot connect to the Risk Engine. Ensure the backend (algo-engine :5001) is running.");
      }
    }
  };

  const handleRetry = () => {
    setApiError(null);
    timeoutRef.current = setTimeout(() => {
      if (!riskStatus) setApiError("Backend API still unreachable.");
    }, LOAD_TIMEOUT_MS);
    fetchStatus();
  };

  const handleUpdate = async () => {
    // Validate all limits > 0 before sending
    const invalidFields = Object.entries(editedLimits).filter(([_, v]) => v < 0);
    if (invalidFields.length > 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "All risk limits must be non-negative values." });
      return;
    }
    setIsUpdating(true);
    try {
      await algoApi.updateRiskLimits(editedLimits);
      toast({ title: "Guardrails Updated", description: "Risk engine has synchronized new limits." });
      await fetchStatus();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "An unexpected error occurred.";
      toast({ variant: "destructive", title: "Update Failed", description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (apiError && !riskStatus) return (
    <ApiErrorBoundary error={apiError} onRetry={handleRetry} label="Risk Engine" />
  );

  if (!riskStatus) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading Risk Engine...</span>
      </div>
    </div>
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 space-y-6 custom-scrollbar"
    >
      {/* Risk Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Daily Loss", value: `₹${riskStatus.daily_realised_loss}`, max: riskStatus.max_daily_loss, unit: "limit", icon: TrendingDown, color: "text-destructive" },
          { label: "Daily Trades", value: riskStatus.daily_trades, max: riskStatus.max_daily_trades, unit: "orders", icon: Activity, color: "text-primary" },
          { label: "Open Positions", value: riskStatus.open_positions, max: riskStatus.max_open_positions, unit: "symbols", icon: Shield, color: "text-neon-emerald" },
          { label: "Utilization", value: `${riskStatus.daily_loss_pct}%`, max: 100, unit: "exposure", icon: Activity, color: "text-warning" },
        ].map((m) => (
          <motion.div key={m.label} variants={item} className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{m.label}</span>
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
            </div>
            <div className="text-xl font-black mb-1">{m.value}</div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium">
              <span>Max: {m.max} {m.unit}</span>
              <span className={m.color}>{m.max > 0 ? (parseFloat(String(m.value).replace(/[₹%]/g, '')) / m.max * 100).toFixed(0) : 0}% Used</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Risk Configuration Hub */}
        <motion.div variants={item} className="glass-panel-elevated p-5 rounded-xl border border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Settings className="w-20 h-20 rotate-12" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-primary" /> Risk Configuration Hub
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Daily Loss Limit (₹)</label>
              <input 
                type="number" 
                min="0"
                step="1000"
                value={editedLimits.max_daily_loss}
                onChange={(e) => setEditedLimits({...editedLimits, max_daily_loss: Math.max(0, Number(e.target.value))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Daily Trades</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={editedLimits.max_daily_trades}
                onChange={(e) => setEditedLimits({...editedLimits, max_daily_trades: Math.max(1, Math.floor(Number(e.target.value)))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Open Positions</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={editedLimits.max_open_positions}
                onChange={(e) => setEditedLimits({...editedLimits, max_open_positions: Math.max(1, Math.floor(Number(e.target.value)))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Notional / Order (₹)</label>
              <input 
                type="number" 
                min="0"
                step="10000"
                value={editedLimits.max_order_notional}
                onChange={(e) => setEditedLimits({...editedLimits, max_order_notional: Math.max(0, Number(e.target.value))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Qty / Order</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={editedLimits.max_order_quantity}
                onChange={(e) => setEditedLimits({...editedLimits, max_order_quantity: Math.max(1, Math.floor(Number(e.target.value)))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Position / Symbol</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={editedLimits.max_position_qty}
                onChange={(e) => setEditedLimits({...editedLimits, max_position_qty: Math.max(1, Math.floor(Number(e.target.value)))})}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isUpdating ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Commit & Synchronize Limits
          </button>
        </motion.div>

        {/* Sectoral Exposure (Live-ish) */}
        <motion.div variants={item} className="glass-panel p-5 rounded-xl border border-border/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-4">Capital Allocation</h3>
          <div className="flex items-center gap-8">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {sectorData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="glass-panel-elevated rounded-md p-2 text-[10px] uppercase font-bold border border-border">
                          {d.name}: {d.value}%
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {sectorData.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ color: s.color, background: s.color }} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex-1">{s.name}</span>
                  <span className="text-[10px] font-mono font-bold text-foreground">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Safety Alerts */}
      <motion.div variants={item} className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-4">
        <div className="p-2 bg-destructive/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h4 className="text-[11px] font-black uppercase text-destructive tracking-widest mb-1">Critical Guardrails Active</h4>
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
            Automatic circuit breakers are monitoring your portfolio. If realised loss exceeds ₹{riskStatus.max_daily_loss}, 
            all open orders will be canceled and the engine will lock into <b>EMERGENCY READ-ONLY</b> mode until the next daily reset.
          </p>
        </div>
        <button
          onClick={async () => {
            if (!window.confirm("Cancel ALL open orders? This action cannot be undone.")) return;
            try {
              await algoApi.cancelAllOrders();
              toast({ title: "All Orders Cancelled", description: "Cancel-all command sent to broker." });
            } catch (err) {
              toast({ title: "Cancel Failed", description: String(err), variant: "destructive" });
            }
          }}
          className="shrink-0 px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Cancel All Orders
        </button>
      </motion.div>
    </motion.div>
  );
}
