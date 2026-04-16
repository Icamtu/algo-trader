import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Shield, TrendingUp, TrendingDown, Activity, Save, AlertTriangle, CheckCircle2, Settings, Loader2 } from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { useAppModeStore } from "@/stores/appModeStore";
import { type RiskStatus, type StrategyMetrics, ApiError } from "@/types/api";
import { IndustrialValue } from "./IndustrialValue";
import { BarChart3, Target, Zap, Clock, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const getSectorPalette = (isAD: boolean) => [
  { name: "Tech", value: 28, color: isAD ? "#FFB000" : "#14B8A6" },
  { name: "Fin", value: 22, color: isAD ? "#D97706" : "#0D9488" },
  { name: "Hlth", value: 15, color: isAD ? "#B45309" : "#0F766E" },
  { name: "Enrg", value: 12, color: isAD ? "#92400E" : "#115E59" },
  { name: "Cons", value: 10, color: isAD ? "#78350F" : "#134E4A" },
  { name: "Ind", value: 8, color: isAD ? "#FFD600" : "#2DD4BF" },
];

export function RiskDashboard() {
  const { toast } = useToast();
  const { mode: appMode } = useAppModeStore();
  const isAD = appMode === 'AD';
  const sectorData = useMemo(() => getSectorPalette(isAD), [isAD]);
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [riskMatrix, setRiskMatrix] = useState<Record<string, StrategyMetrics>>({});
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
  const [hasInitializedLimits, setHasInitializedLimits] = useState(false);

  const fetchStatus = async () => {
    try {
      const statusRes = await algoApi.getRiskStatus();
      if (statusRes && statusRes.status === "success") {
        setRiskStatus(statusRes.data);
        
        if (!hasInitializedLimits && !isUpdating) {
          setEditedLimits({
          max_daily_loss: statusRes.data.max_daily_loss ?? 50000,
          max_daily_trades: statusRes.data.max_daily_trades ?? 200,
          max_open_positions: statusRes.data.max_open_positions ?? 10,
          max_order_quantity: statusRes.data.max_order_quantity ?? 500,
          max_order_notional: statusRes.data.max_order_notional ?? 500000,
          max_position_qty: statusRes.data.max_position_qty ?? 2000,
        });
          setHasInitializedLimits(true);
        }
      }
      
      const matrixRes = await algoApi.getRiskMatrix();
      if (matrixRes && matrixRes.status === "success") {
        setRiskMatrix(matrixRes.matrix || {});
      }
      
      setApiError(null);
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

  if (!riskStatus) {
    if (apiError) return (
      <div className="flex-1 flex items-center justify-center p-4 industrial-grid relative">
         <div className="noise-overlay" />
         <div className="p-4 border border-destructive bg-destructive/5 max-w-sm text-center">
            <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-3 animate-pulse" />
            <h2 className="text-[10px] font-mono font-black text-destructive uppercase tracking-[0.3em] mb-2">{apiError}</h2>
            <button onClick={fetchStatus} className="px-5 py-1.5 border border-destructive text-destructive font-mono font-black text-[9px] uppercase hover:bg-destructive hover:text-white transition-all">Retry Link</button>
         </div>
      </div>
    );

    return (
      <div className="flex-1 flex items-center justify-center p-4 industrial-grid relative">
        <div className="noise-overlay" />
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <h2 className="text-[10px] font-mono font-black text-primary uppercase tracking-[0.3em] animate-pulse">INITIALIZING_KERNEL_TELEMETRY...</h2>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar industrial-grid relative"
    >
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      
      {/* Risk Telemetry & Broker Health */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Capital Delta", value: riskStatus?.daily_realised_loss ?? 0, max: riskStatus?.max_daily_loss ?? 0, unit: "₹", color: "text-destructive" },
          { label: "Ops Cycle", value: riskStatus?.daily_trades ?? 0, max: riskStatus?.max_daily_trades ?? 0, unit: "ops", color: isAD ? "text-amber" : "text-teal" },
          { label: "Active Nodes", value: riskStatus?.open_positions ?? 0, max: riskStatus?.max_open_positions ?? 0, unit: "node", color: isAD ? "text-amber" : "text-teal" },
          { label: "Kernel Load", value: riskStatus?.daily_loss_pct ?? 0, max: 100, unit: "%", color: isAD ? "text-amber" : "text-teal" },
        ].map((m) => {
          const numericValue = typeof m.value === 'number' ? m.value : 0;
          const displayPercentage = m.max > 0 ? (Math.abs(numericValue) / m.max * 100).toFixed(1) : "0.0";
          
          return (
            <motion.div 
              key={m.label} 
              variants={item} 
              className="bg-background border border-border/50 p-2.5 relative overflow-hidden group"
              role="status"
              aria-label={m.label}
            >
              <div className="flex items-center justify-between mb-3 border-b border-border/20 pb-1.5">
                <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40">{m.label}</span>
                <div className={`w-1 h-1 rounded-full ${m.color} animate-pulse shadow-[0_0_8px_currentColor]`} />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <IndustrialValue 
                  value={numericValue} 
                  prefix={m.unit === "₹" ? "₹" : ""}
                  suffix={m.unit === "%" ? "%" : ""}
                  className={`text-xl font-black font-display tracking-tighter ${m.color}`} 
                />
              </div>
              <div className="flex items-center justify-between text-[7px] font-mono font-bold uppercase tracking-tight text-muted-foreground/30">
                <span>Limit: {m.max}</span>
                <span className={m.color}>{displayPercentage}%</span>
              </div>
            </motion.div>
          );
        })}

        {/* Phase 8: Broker Connectivity Monitor */}
        <motion.div variants={item} className={cn(
          "bg-background border p-2.5 relative overflow-hidden group",
          riskStatus?.broker_session?.is_healthy ? "border-border/50" : "border-destructive/40 bg-destructive/5"
        )}>
          <div className="flex items-center justify-between mb-3 border-b border-border/20 pb-1.5">
            <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40">Broker_Sync</span>
            <Network className={cn(
              "w-2.5 h-2.5", 
              riskStatus?.broker_session?.is_healthy ? (isAD ? "text-amber" : "text-secondary") : "text-destructive animate-pulse"
            )} />
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-[10px] font-black font-mono uppercase tracking-[0.1em]",
                riskStatus?.broker_session?.is_healthy ? (isAD ? "text-amber" : "text-secondary") : "text-destructive"
              )}>
                {riskStatus?.broker_session?.reauth_in_progress ? "REFRESHING..." : (riskStatus?.broker_session?.is_healthy ? "LINK_STABLE" : "LINK_TERMINATED")}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-[7px] font-mono font-bold text-muted-foreground/30 uppercase mt-1">
              <Clock className="w-2.5 h-2.5" />
              <span>
                {riskStatus?.broker_session?.last_check 
                  ? `Sync: ${!isNaN(new Date(riskStatus.broker_session.last_check).getTime()) 
                      ? new Date(riskStatus.broker_session.last_check).toLocaleTimeString() 
                      : "Pending..."}` 
                  : "WAITING_FOR_HANDSHAKE"}
              </span>
            </div>
            
            {riskStatus?.broker_session?.reauth_in_progress && (
              <div className="mt-2 text-[6px] font-mono font-black text-amber-500 animate-pulse uppercase tracking-widest bg-amber-500/10 px-1 py-0.5 text-center">
                AUTOMATED_REAUTH_IN_PROGRESS
              </div>
            )}
            
            {!riskStatus.broker_session?.is_healthy && !riskStatus.broker_session?.reauth_in_progress && (
              <div className="mt-2 text-[6px] font-mono font-black text-destructive uppercase tracking-tighter truncate">
                ERROR: {riskStatus.broker_session?.last_error || "UNKNOWN_AUTH_FAULT"}
              </div>
            )}
          </div>
        </motion.div>
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
            <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
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

      {/* Strategy Performance Matrix */}
      <motion.div variants={item} className="bg-background border border-border p-3.5 relative">
        <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" /> Strategy_Performance_Matrix
          </h3>
          <div className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase">30D Rolling Analytics</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(riskMatrix).map(([name, metrics]) => {
            const m = metrics as StrategyMetrics;
            return (
              <div key={name} className={`border p-3 relative group transition-all ${m.is_halted ? "border-destructive bg-destructive/5" : "border-border/50 bg-card/5 hover:border-primary/30"}`}>
                {m.is_halted && (
                  <div className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground text-[6px] font-black uppercase tracking-tighter z-20">
                    BREACHED_HALT
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-mono font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      {name}
                      {m.safeguard?.is_armed && !m.is_halted && (
                        <Shield className={cn("w-2.5 h-2.5 animate-pulse", isAD ? "text-amber" : "text-teal")} />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1 h-1 rounded-full", m.is_active ? (isAD ? "bg-amber animate-pulse" : "bg-teal animate-pulse") : "bg-muted-foreground/20")} />
                      <span className="text-[7px] font-mono font-bold text-muted-foreground/40 uppercase">
                        {m.is_active ? "RUNNING" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="p-1 px-2 border border-border/20 bg-background text-[8px] font-mono font-black text-primary">
                      {m.total_trades} TXNS
                    </div>
                    {m.safeguard?.last_breach_at && (
                       <div className="text-[6px] font-mono font-bold text-destructive uppercase">LAST_BREACH: {!isNaN(new Date(m.safeguard.last_breach_at).getTime()) ? new Date(m.safeguard.last_breach_at).toLocaleTimeString() : "N/A"}</div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <MiniMetric label="SHARPE" value={m.sharpe} color={isAD ? "text-amber" : "text-teal"} />
                  <MiniMetric label="MAX_DD" value={m.max_drawdown} suffix="%" color={Math.abs(m.max_drawdown) >= (m.safeguard?.max_drawdown_pct || 15) ? "text-destructive font-black" : "text-destructive"} />
                  <MiniMetric label="WIN_RATE" value={m.win_rate} suffix="%" color={isAD ? "text-amber" : "text-teal"} />
                  <MiniMetric label="P_FACTOR" value={m.profit_factor} color="text-foreground" />
                </div>
                
                <div className="mt-3 pt-2 border-t border-border/10 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-[7px] font-mono font-bold text-muted-foreground/30 uppercase">NET_PNL_DELTA</span>
                      {m.safeguard?.is_armed && (
                        <span className={cn("text-[6px] font-mono font-black uppercase tracking-tighter", isAD ? "text-amber/40" : "text-teal/40")}>GUARD_LIMIT: ₹{m.safeguard.max_loss_inr}</span>
                      )}
                   </div>
                   <IndustrialValue value={m.net_pnl ?? 0} prefix="₹" className={`text-xs font-black ${(m.net_pnl ?? 0) >= 0 ? (isAD ? "text-amber" : "text-teal") : "text-destructive"}`} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

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
             try {
               await Promise.all([
                 algoApi.cancelAllOrders(),
                 algoApi.closePosition()
               ]);
               toast({ title: "STOP_SIGNAL_EMITTED", description: "ORDERS_CANCELLED_AND_POSITIONS_LIQUIDATED" });
             } catch (e: any) {
               toast({ variant: "destructive", title: "STOP_PARTIAL_FAILURE", description: e?.message || "KERNEL_REJECTION" });
             }
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
      <label 
        htmlFor={`risk-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
        className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest group-hover:text-primary transition-colors leading-none"
      >
        {label}
      </label>
      <div className="relative">
        <input 
          id={`risk-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
          type="number" 
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          aria-label={label}
          className="w-full bg-transparent border-b border-border/30 px-0 py-1 text-[10px] font-mono font-bold text-foreground outline-none focus:border-primary transition-all"
        />
        <div className="absolute bottom-0 right-0 p-0.5 opacity-10 group-hover:opacity-100 transition-opacity">
           <div className="w-1 h-1 bg-primary" />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, prefix = "", suffix = "", color }: { label: string; value: number; prefix?: string; suffix?: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[7px] font-mono font-bold text-muted-foreground/30 uppercase">{label}</span>
      <span className={`text-[9px] font-mono font-black ${color}`}>{prefix}{value}{suffix}</span>
    </div>
  );
}
