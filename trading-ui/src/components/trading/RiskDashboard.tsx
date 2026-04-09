import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Shield, TrendingUp, TrendingDown, Activity, Save, AlertTriangle, CheckCircle2, Settings, Loader2 } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { type RiskStatus, ApiError } from "@/types/api";
import { IndustrialValue } from "./IndustrialValue";

// --- Sector Allocation (Keep as visual mock for now) ---
const sectorData = [
  { name: "Tech", value: 28, color: "#ffb000" },
  { name: "Fin", value: 22, color: "#00d4d4" },
  { name: "Hlth", value: 15, color: "#9333ea" },
  { name: "Enrg", value: 12, color: "#f97316" },
  { name: "Cons", value: 10, color: "#10b981" },
  { name: "Ind", value: 8, color: "#ef4444" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function RiskDashboard() {
  const { toast } = useToast();
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editedLimits, setEditedLimits] = useState({
    max_daily_loss: 0,
    max_daily_trades: 0,
    max_open_positions: 0,
    max_order_notional: 0,
    max_order_quantity: 0,
    max_position_qty: 0,
  });

  const fetchStatus = async () => {
    try {
      const status = await algoApi.getRiskStatus();
      setRiskStatus(status);
      setApiError(null);
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
      if (!riskStatus) setApiError("ENGINE_TIMEOUT: RISK_CORE_NOT_RESPONDING");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await algoApi.updateRiskLimits(editedLimits);
      toast({ title: "KERNEL_UPDATED", description: "GUARDRAILS_SYNCHRONIZED_SUCCESSFULLY" });
      await fetchStatus();
    } catch (error) {
       toast({ variant: "destructive", title: "UPDATE_ABORTED", description: "WRITE_ACCESS_DENIED" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (apiError && !riskStatus) return (
    <div className="flex-1 flex items-center justify-center p-4 industrial-grid relative">
       <div className="noise-overlay" />
       <div className="p-4 border border-destructive bg-destructive/5 max-w-sm text-center">
          <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-3 animate-pulse" />
          <h2 className="text-[10px] font-mono font-black text-destructive uppercase tracking-[0.3em] mb-2">{apiError}</h2>
          <button onClick={fetchStatus} className="px-5 py-1.5 border border-destructive text-destructive font-mono font-black text-[9px] uppercase hover:bg-destructive hover:text-white transition-all">Retry Link</button>
       </div>
    </div>
  );

  if (!riskStatus) return (
    <div className="flex-1 flex items-center justify-center p-4 industrial-grid relative">
      <div className="noise-overlay" />
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-[9px] font-mono font-black uppercase tracking-[0.4em] text-primary animate-pulse">Syncing...</span>
      </div>
    </div>
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar industrial-grid relative"
    >
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      
      {/* Risk Telemetry */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Capital Delta", value: riskStatus.daily_realised_loss, max: riskStatus.max_daily_loss, unit: "₹", color: "text-destructive" },
          { label: "Ops Cycle", value: riskStatus.daily_trades, max: riskStatus.max_daily_trades, unit: "ops", color: "text-primary" },
          { label: "Active Nodes", value: riskStatus.open_positions, max: riskStatus.max_open_positions, unit: "node", color: "text-secondary" },
          { label: "Kernel Load", value: riskStatus.daily_loss_pct, max: 100, unit: "%", color: "text-primary" },
        ].map((m) => (
          <motion.div key={m.label} variants={item} className="bg-background border border-border/50 p-2.5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3 border-b border-border/20 pb-1.5">
              <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40">{m.label}</span>
              <div className={`w-1 h-1 rounded-full ${m.color} animate-pulse shadow-[0_0_8px_currentColor]`} />
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <IndustrialValue 
                value={typeof m.value === 'number' ? m.value : parseFloat(String(m.value).replace(/[₹%]/g, ''))} 
                prefix={m.unit === "₹" ? "₹" : ""}
                suffix={m.unit === "%" ? "%" : ""}
                className={`text-xl font-black font-syne tracking-tighter ${m.color}`} 
              />
            </div>
            <div className="flex items-center justify-between text-[7px] font-mono font-bold uppercase tracking-tight text-muted-foreground/30">
              <span>Limit: {m.max}</span>
              <span className={m.color}>{m.max > 0 ? (parseFloat(String(m.value).replace(/[₹%]/g, '')) / m.max * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="mt-1.5 h-0.5 bg-border/20 overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(100, (parseFloat(String(m.value).replace(/[₹%]/g, '')) / (m.max || 1) * 100))}%` }}
                 className={`h-full ${m.color.replace('text', 'bg')}`}
               />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Guardrail Control Panel */}
        <motion.div variants={item} className="col-span-2 bg-background border border-border p-3.5 relative">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <Settings className="w-3 h-3 text-primary" /> Guardrail_Console
            </h3>
            <div className="flex items-center gap-2 text-[7px] font-mono font-black uppercase text-secondary">
               <span className="animate-pulse">Kernel Locked</span>
               <Shield className="w-2.5 h-2.5" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
            <RiskInput label="Daily Loss Limit (₹)" value={editedLimits.max_daily_loss} onChange={(v) => setEditedLimits({...editedLimits, max_daily_loss: v})} />
            <RiskInput label="Max Trade Cycles" value={editedLimits.max_daily_trades} onChange={(v) => setEditedLimits({...editedLimits, max_daily_trades: v})} />
            <RiskInput label="Max Node Capacity" value={editedLimits.max_open_positions} onChange={(v) => setEditedLimits({...editedLimits, max_open_positions: v})} />
            <RiskInput label="Max Flux Notional (₹)" value={editedLimits.max_order_notional} onChange={(v) => setEditedLimits({...editedLimits, max_order_notional: v})} />
            <RiskInput label="Max Atomic Vol" value={editedLimits.max_order_quantity} onChange={(v) => setEditedLimits({...editedLimits, max_order_quantity: v})} />
            <RiskInput label="Max Agg Exposure" value={editedLimits.max_position_qty} onChange={(v) => setEditedLimits({...editedLimits, max_position_qty: v})} />
          </div>

          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`w-full py-2 border transition-all font-mono font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 ${
              isUpdating 
                ? "border-muted text-muted-foreground cursor-not-allowed" 
                : "border-primary text-primary hover:bg-primary hover:text-black shadow-[0_0_15px_rgba(255,176,0,0.1)]"
            }`}
          >
            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isUpdating ? "Syncing kernel..." : "Commit_Kernel_Changes"}
          </button>
        </motion.div>

        {/* Neural Distribution */}
        <motion.div variants={item} className="bg-background border border-border p-3.5">
          <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-foreground mb-4 border-b border-border/50 pb-2">Sector_Map</h3>
          <div className="space-y-4">
            <div className="w-full h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    paddingAngle={2}
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
                        <div className="bg-background border border-primary p-1.5 text-[8px] font-mono font-black uppercase">
                          {d.name}: {d.value}%
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-mono font-black text-primary leading-none">100%</span>
                  <span className="text-[6px] font-mono text-muted-foreground uppercase">Load</span>
              </div>
            </div>
            <div className="space-y-1 max-h-[100px] overflow-y-auto no-scrollbar">
              {sectorData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 group">
                  <div className="w-1.5 h-1.5" style={{ background: s.color }} />
                  <span className="text-[8px] font-mono font-bold text-muted-foreground uppercase flex-1 group-hover:text-foreground transition-colors">{s.name}</span>
                  <span className="text-[8px] font-mono font-black text-foreground">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Emergency Lockdown */}
      <motion.div variants={item} className="p-3 border border-destructive bg-destructive/5 flex items-start gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-0.5 h-full bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        <div className="p-2 border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h4 className="text-[11px] font-mono font-black uppercase text-destructive tracking-[0.2em] mb-0.5">Emergency_Kill_Switch</h4>
          <p className="text-[9px] font-mono text-muted-foreground uppercase leading-relaxed">
            FORCE_SHUTDOWN_ALL_CONNECTORS : TRIGGER_FATAL_STOP.
          </p>
        </div>
        <button
          onClick={async () => {
             if (!window.confirm("FATAL_STOP?")) return;
             await algoApi.cancelAllOrders();
             toast({ title: "STOP_SIGNAL_EMITTED" });
          }}
          className="px-4 py-1.5 border border-destructive text-destructive font-mono font-black text-[9px] uppercase hover:bg-destructive hover:text-white transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
        >
          FATAL_STOP
        </button>
      </motion.div>
    </motion.div>
  );
}

function RiskInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1 group">
      <label className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest group-hover:text-primary transition-colors leading-none">{label}</label>
      <div className="relative">
        <input 
          type="number" 
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full bg-transparent border-b border-border/30 px-0 py-1 text-[10px] font-mono font-bold text-foreground outline-none focus:border-primary transition-all"
        />
        <div className="absolute bottom-0 right-0 p-0.5 opacity-10 group-hover:opacity-100 transition-opacity">
           <div className="w-1 h-1 bg-primary" />
        </div>
      </div>
    </div>
  );
}
