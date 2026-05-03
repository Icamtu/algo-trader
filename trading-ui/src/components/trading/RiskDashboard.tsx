import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Shield, Activity, Save, AlertTriangle,
  Settings, Loader2, BarChart3, Clock, Network,
  Lock, Unlock, Zap, ShieldAlert, Cpu, Globe,
  ShieldCheck, Crosshair, ZapOff
} from "lucide-react";
import { algoApi } from "@/features/aetherdesk/api/client";
import { useToast } from "@/hooks/use-toast";
import { type RiskStatus, type StrategyMetrics } from "@/types/api";
import { IndustrialValue } from "./IndustrialValue";
import { cn } from "@/lib/utils";
import { useAether } from "@/contexts/AetherContext";
import { AetherPanel } from "@/components/ui/AetherPanel";
import { RiskShieldAudit } from "./RiskShieldAudit";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const sectorData = [
  { name: "TECH_ALPHA", value: 32, color: "rgba(0, 245, 255, 0.8)" },
  { name: "FIN_OMEGA", value: 24, color: "rgba(0, 245, 255, 0.6)" },
  { name: "METAL_DELTA", value: 18, color: "rgba(0, 245, 255, 0.4)" },
  { name: "ENERGY_GAMMA", value: 14, color: "rgba(0, 245, 255, 0.2)" },
  { name: "CONS_SIGMA", value: 12, color: "rgba(0, 245, 255, 0.1)" },
];

export function RiskDashboard() {
  const { toast } = useToast();
  const { riskStatus: liveRiskStatus, strategyMatrix, connectionStatus } = useAether();
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedLimits, setEditedLimits] = useState({
    max_daily_loss: 50000,
    max_daily_trades: 200,
    max_open_positions: 10,
    max_order_notional: 500000,
    max_order_quantity: 500,
    max_position_qty: 2000,
  });
  const [hasInitializedLimits, setHasInitializedLimits] = useState(false);
  const [activeRegistryTab, setActiveRegistryTab] = useState('ALL');

  useEffect(() => {
    if (liveRiskStatus && !hasInitializedLimits && !isUpdating) {
      setEditedLimits({
        max_daily_loss: liveRiskStatus.max_daily_loss ?? 50000,
        max_daily_trades: liveRiskStatus.max_daily_trades ?? 200,
        max_open_positions: liveRiskStatus.max_open_positions ?? 10,
        max_order_quantity: liveRiskStatus.max_order_quantity ?? 500,
        max_order_notional: liveRiskStatus.max_order_notional ?? 500000,
        max_position_qty: liveRiskStatus.max_position_qty ?? 2000,
      });
      setHasInitializedLimits(true);
    }
  }, [liveRiskStatus, hasInitializedLimits, isUpdating]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await algoApi.updateRiskLimits(editedLimits);
      toast({ title: "PROTOCOL::KERNAL_UPDATE_SUCCESS", description: "GUARDRAILS_SYNCHRONIZED_WITH_ENGINE" });
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::WRITE_ACCESS_DENIED", description: "Terminal failed to synchronize guardrails." });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!liveRiskStatus && connectionStatus === "connecting") {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
        </div>
        <span className="text-[10px] font-mono font-black text-primary uppercase tracking-[0.8em] animate-pulse">Initializing_Aether_Gate...</span>
      </div>
    );
  }

  const riskStatus = liveRiskStatus;
  const filteredStrategies = strategyMatrix.filter((s: any) => {
    if (activeRegistryTab === 'ALL') return true;
    if (activeRegistryTab === 'ACTIVE') return s.status === 'active';
    if (activeRegistryTab === 'DORMANT') return s.status !== 'active';
    return true;
  });

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-8 space-y-10 bg-transparent min-h-screen relative overflow-hidden font-mono"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.02] blur-[150px] pointer-events-none rounded-full" />

      {/* 🔴 HEADER SECTION: STATUS HUD */}
      <div className="flex items-end justify-between border-b border-white/5 pb-10">
        <div className="flex items-start gap-8">
           <div className="w-20 h-20 bg-black border border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,245,255,0.1)]">
              <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
           </div>
           <div className="space-y-3">
              <h1 className="text-5xl font-black tracking-[0.2em] uppercase text-white">Risk_Control</h1>
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                    <span className="text-[10px] font-black text-secondary tracking-widest uppercase">Guardian_v4_Active</span>
                 </div>
                 <div className="h-4 w-px bg-white/10" />
                 <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Node_01_HYPERVISOR_SECURE</span>
              </div>
           </div>
        </div>

        <div className="flex gap-12">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest mb-1">System_Clock</span>
              <span className="text-4xl font-black text-white tabular-nums tracking-tighter">
                 {new Date().toLocaleTimeString([], { hour12: false })}
              </span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest mb-1">Gate_Latency</span>
              <span className="text-4xl font-black text-primary tabular-nums tracking-tighter">42.1ms</span>
           </div>
        </div>
      </div>

      {/* 🟢 TOP SECTION: MISSION CRITICAL BENTO */}
      <div className="grid grid-cols-12 gap-8">
        {/* Real-time Loss Guardrail */}
        <AetherPanel variant="void" glow className="col-span-12 lg:col-span-12 xl:col-span-5 p-10 flex flex-col justify-between group h-[300px] relative overflow-hidden bg-black/40 border-white/5">
          <div className="absolute top-0 right-0 p-6 opacity-5">
             <ShieldAlert className="w-48 h-48 text-destructive" />
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-destructive/10 border border-destructive/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,59,59,0.1)]">
                <Shield className="w-7 h-7 text-destructive" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white">CAPITAL_DRAWDOW_GUARD</h3>
                <span className="text-[10px] font-mono text-destructive/40 uppercase font-black tracking-widest flex items-center gap-2">
                   <Activity className="w-3 h-3 animate-pulse" /> LIVE_INTERCEPTION_LOOP
                </span>
              </div>
            </div>
            <div className="px-4 py-1.5 bg-destructive/10 border border-destructive/20 text-[10px] font-black text-destructive uppercase tracking-widest">
               ARMED
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-4">
                <IndustrialValue
                  value={riskStatus?.daily_realised_loss ?? 0}
                  prefix="₹"
                  className="text-6xl font-black font-display tracking-tighter text-destructive"
                />
                <span className="text-lg font-mono text-muted-foreground/20 font-black">/ ₹{(riskStatus?.max_daily_loss ?? 0).toLocaleString()}</span>
              </div>
              <div className="text-right">
                 <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest block mb-1">Remaining_Buffer</span>
                 <IndustrialValue value={(riskStatus?.max_daily_loss ?? 0) - (riskStatus?.daily_realised_loss ?? 0)} className="text-xl font-black text-white/40" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono font-black">
                <span className="text-muted-foreground/40 uppercase tracking-[0.2em]">EXPOSURE_THRESHOLD_REACHED</span>
                <span className={cn("text-xl tracking-tighter", (riskStatus?.daily_realised_loss ?? 0) > (riskStatus?.max_daily_loss ?? 0) * 0.8 ? "text-destructive animate-pulse" : "text-white/60")}>
                  {Math.round(((riskStatus?.daily_realised_loss ?? 0) / (riskStatus?.max_daily_loss ?? 1)) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-white/5 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((riskStatus?.daily_realised_loss ?? 0) / (riskStatus?.max_daily_loss ?? 1)) * 100)}%` }}
                  className="absolute top-0 left-0 h-full bg-destructive shadow-[0_0_30px_rgba(255,59,59,0.8)]"
                />
              </div>
            </div>
          </div>
        </AetherPanel>

        {/* Trade Velocity Map */}
        <AetherPanel className="col-span-12 md:col-span-6 xl:col-span-4 p-10 flex flex-col justify-between h-[300px] border-white/5 bg-black/40">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-secondary/10 border border-secondary/30 flex items-center justify-center text-secondary shadow-[0_0_20px_rgba(0,245,255,0.1)]">
                <Zap className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white">TRADE_VELOCITY_TX</h3>
                <span className="text-[10px] font-mono text-muted-foreground/30 uppercase font-black tracking-widest">Throttle_Enforcement</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center flex-1">
             <div className="text-7xl font-black font-display tracking-tighter text-secondary mb-2">
                {riskStatus?.daily_trades ?? 0}
             </div>
             <div className="flex items-center gap-3">
                <Crosshair className="w-4 h-4 text-secondary/40" />
                <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-[0.5em] font-black italic">Atoms_Executed</span>
             </div>
          </div>

          <div className="flex gap-1.5 h-6">
             {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className={cn(
                  "flex-1 rounded-[1px] transition-all duration-300",
                  i < ((riskStatus?.daily_trades ?? 0) / (riskStatus?.max_daily_trades ?? 1) * 32)
                    ? "bg-secondary shadow-[0_0_10px_rgba(0,245,255,0.4)]"
                    : "bg-white/5"
                )} />
             ))}
          </div>
        </AetherPanel>

        {/* High-Fidelity Institutional Oversight */}
        <div className="col-span-12 xl:col-span-3">
          <RiskShieldAudit />
        </div>
      </div>

      {/* 🟠 MIDDLE SECTION: SETTINGS & CONCENTRATION */}
      <div className="grid grid-cols-12 gap-10">
        {/* Guardrail Matrix Form */}
        <AetherPanel variant="void" glow className="col-span-12 lg:col-span-7 xl:col-span-8 p-12 relative overflow-hidden min-h-[600px] bg-[#050505] border-primary/20">
           {/* Background Decoration */}
           <div className="absolute -top-24 -right-24 w-120 h-120 bg-primary/5 blur-[150px] pointer-events-none" />
           <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Cpu className="w-96 h-96 text-white" />
           </div>

           <div className="flex items-center justify-between mb-16 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="p-4 bg-primary/10 border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent">
                    <Settings className="w-8 h-8 text-primary" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-black uppercase tracking-[0.5em] text-white">GUARDRAIL_MATRIX</h3>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest font-black italic">Write_Pipe::Operational</span>
                       <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                 </div>
              </div>
              <div className="flex gap-10">
                 <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-widest">Last_Sync</span>
                    <span className="text-xs font-mono text-muted-foreground/40 uppercase tabular-nums font-black">{new Date().toLocaleTimeString()}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16 mb-20 relative z-10">
              <RiskInput label="MAX_DAILY_EXPOSURE" value={editedLimits.max_daily_loss} onChange={(v) => setEditedLimits(l => ({ ...l, max_daily_loss: v }))} description="AUTO_LIQUIDATE_ALL_ON_HIT" prefix="₹" />
              <RiskInput label="TX_THROTTLE_LIMIT" value={editedLimits.max_daily_trades} onChange={(v) => setEditedLimits(l => ({ ...l, max_daily_trades: v }))} description="REJECTS_NEW_SIGNALS" unit="TX" />
              <RiskInput label="FLUX_NODE_CAP" value={editedLimits.max_open_positions} onChange={(v) => setEditedLimits(l => ({ ...l, max_open_positions: v }))} description="CONCURRENT_THREADS" unit="NODES" />
              <RiskInput label="ATOMIC_QUANT_CEILING" value={editedLimits.max_order_quantity} onChange={(v) => setEditedLimits(l => ({ ...l, max_order_quantity: v }))} description="PER_CHANNEL_LIMIT" unit="LOTS" />
           </div>

           <div className="flex flex-col gap-6 relative z-10 pt-10 border-t border-white/5">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="w-full h-20 bg-primary text-black text-sm font-black uppercase tracking-[0.8em] flex items-center justify-center gap-6 hover:shadow-[0_0_50px_rgba(0,245,255,0.4)] hover:-translate-y-1 transition-all disabled:opacity-30 active:scale-[0.98] group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {isUpdating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                SYNCHRONIZE_LIMITS_TO_KERNEL
              </button>
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-3 opacity-20 hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Protocol_Verify: 1024-RSA</span>
                 </div>
                 <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/30">End_to_End_Encryption_Active</span>
              </div>
           </div>
        </AetherPanel>

        {/* Global Concentration Wheel */}
        <AetherPanel className="col-span-12 lg:col-span-5 xl:col-span-4 p-12 flex flex-col justify-between border-white/5 bg-black/40">
           <div className="relative">
              <div className="flex flex-col mb-12 border-l-2 border-primary/20 pl-6">
                <h3 className="text-sm font-black uppercase tracking-[0.5em] text-white mb-1 uppercase">RISK_CONCENTRATION</h3>
                <span className="text-[10px] font-mono text-muted-foreground/30 italic uppercase font-black">Neural_Weighting_Engine</span>
              </div>

              <div className="h-80 relative mb-16 flex items-center justify-center">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,245,255,0.03),transparent)] animate-pulse" />
                 <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                   <PieChart>
                      <Pie data={sectorData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={4} dataKey="value" strokeWidth={0} animationDuration={2500} animationBegin={500}>
                         {sectorData.map((e, i) => <Cell key={i} fill={e.color} className="hover:opacity-80 transition-opacity cursor-crosshair" />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#000', border: '1px solid rgba(0,245,255,0.2)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace', borderRadius: 0, padding: '12px' }}
                        itemStyle={{ color: '#00F5FF', fontWeight: 900 }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                   </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-6xl font-black text-primary tracking-tighter leading-none shadow-primary/20 drop-shadow-[0_0_10px_rgba(0,245,255,0.3)]">0.14</span>
                    <span className="text-[11px] font-black font-mono text-muted-foreground/20 uppercase tracking-[0.5em] mt-4">HERFINDAHL_FACTOR</span>
                 </div>
              </div>
           </div>

           <div className="space-y-5">
              {sectorData.map(s => (
                <div key={s.name} className="flex items-center justify-between text-[11px] font-mono group py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] px-2 transition-colors">
                   <div className="flex items-center gap-6">
                      <div className="w-2 h-6" style={{ background: s.color }} />
                      <span className="text-muted-foreground/50 group-hover:text-primary transition-colors uppercase tracking-[0.2em] font-black">{s.name}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-20 h-1 bg-white/5 overflow-hidden">
                         <div className="h-full bg-primary/40" style={{ width: `${s.value}%` }} />
                      </div>
                      <span className="font-black text-white group-hover:scale-110 transition-transform tabular-nums">{s.value}%</span>
                   </div>
                </div>
              ))}
           </div>
        </AetherPanel>
      </div>

      {/* 🔴 BOTTOM SECTION: STRATEGY NEURAL REGISTRY */}
      <AetherPanel className="p-12 relative overflow-hidden bg-black/40 border-white/5">
         <div className="flex items-center justify-between mb-16 border-b border-white/5 pb-10">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-secondary/10 border border-secondary/30 shadow-[0_0_20px_rgba(0,245,255,0.1)]">
                  <BarChart3 className="w-8 h-8 text-secondary" />
               </div>
               <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-black uppercase tracking-[0.5em] text-white">STRATEGY_NEURAL_REGISTRY</h3>
                  <div className="flex items-center gap-3">
                     <span className="text-[11px] font-mono text-secondary/40 uppercase tracking-widest font-black italic">Lifecycle_Master_Feed</span>
                     <div className="w-2 h-0.5 bg-secondary animate-pulse" />
                  </div>
               </div>
            </div>

            <div className="flex bg-black border border-white/10 p-1">
               {['ALL', 'ACTIVE', 'DORMANT'].map(filter => (
                 <button
                  key={filter}
                  onClick={() => setActiveRegistryTab(filter)}
                  className={cn(
                    "px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-none",
                    activeRegistryTab === filter ? "bg-primary text-black" : "text-muted-foreground/40 hover:text-white hover:bg-white/5"
                  )}
                 >
                    {filter}
                 </button>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredStrategies.map((s: any, idx: number) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="p-8 bg-[#080808] border border-white/10 hover:border-primary/50 transition-all hover:bg-black group cursor-pointer relative overflow-hidden group shadow-2xl"
                >
                   {/* Tech Watermark */}
                   <div className="absolute bottom-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                      <Globe className="w-24 h-24" />
                   </div>

                   <div className="flex justify-between items-start mb-10 relative z-10">
                      <div className="space-y-3">
                         <h4 className="text-base font-black group-hover:text-primary transition-colors uppercase tracking-[0.1em]">{s.name}</h4>
                         <div className="flex items-center gap-3">
                            <div className={cn("w-2.5 h-2.5 rounded-full", s.status === 'active' ? "bg-secondary animate-pulse shadow-[0_0_10px_rgba(0,245,255,0.8)]" : "bg-white/10")} />
                            <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">{s.status === 'active' ? 'NODE_ACTIVE' : 'DORMANT_RESERVE'}</span>
                         </div>
                      </div>
                      <div className="px-3 py-1 bg-black border border-white/10 text-[9px] font-black uppercase text-muted-foreground/20 tracking-widest font-mono">
                         IDX_{idx.toString().padStart(2, '0')}
                      </div>
                   </div>

                    <div className="grid grid-cols-2 gap-10 mb-12 relative z-10">
                      <div className="space-y-1">
                         <span className="text-[9px] font-black uppercase text-muted-foreground/20 tracking-widest block">Sharpe</span>
                         <div className="text-2xl font-mono font-black text-white">{s.sharpe?.toFixed(2) || "0.00"}</div>
                      </div>
                      <div className="text-right space-y-1">
                         <span className="text-[9px] font-black uppercase text-muted-foreground/20 tracking-widest block">Success_Prob</span>
                         <div className="text-2xl font-mono font-black text-secondary">{((s.win_rate || 0) * 100).toFixed(1)}%</div>
                      </div>
                   </div>

                   <div className="pt-10 border-t border-white/[0.05] flex justify-between items-end relative z-10">
                      <div className="flex flex-col gap-2">
                         <span className="text-[9px] font-black uppercase text-muted-foreground/20 tracking-[0.4em]">Current_Yield</span>
                         <IndustrialValue
                          value={s.r_mult || 0}
                          prefix="₹"
                          className={cn("text-4xl font-black tabular-nums tracking-tighter", (s.r_mult || 0) >= 0 ? "text-secondary" : "text-destructive")}
                          showPlus
                         />
                      </div>
                      <div className="w-12 h-12 border border-white/5 bg-black flex items-center justify-center opacity-10 group-hover:opacity-100 group-hover:text-primary transition-all duration-700 shadow-xl group-hover:border-primary/40">
                         {s.status === 'active' ? <Activity className="w-6 h-6" /> : <ZapOff className="w-6 h-6" />}
                      </div>
                   </div>

                   {/* Scanning Line FX */}
                   <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/20 translate-y-[-100%] group-hover:translate-y-[800%] transition-transform duration-[3000ms] ease-linear repeat-infinite pointer-events-none" />
                </motion.div>
              ))}
            </AnimatePresence>
         </div>
      </AetherPanel>
    </motion.div>
  );
}

function RiskInput({
  label,
  value,
  onChange,
  description,
  prefix,
  unit
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description?: string;
  prefix?: string;
  unit?: string;
}) {
  return (
    <div className="space-y-6 group relative">
      <div className="flex items-center gap-5">
         <div className="w-2 h-6 bg-primary/10 group-hover:bg-primary transition-all shadow-[0_0_15px_rgba(0,245,255,0)] group-hover:shadow-[0_0_15px_rgba(0,245,255,0.6)]" />
         <div className="flex flex-col">
            <label className="text-xs font-black uppercase tracking-[0.4em] text-muted-foreground/30 group-hover:text-white transition-colors">
              {label}
            </label>
            {description && <div className="text-[8px] font-mono text-muted-foreground/20 uppercase tracking-widest mt-1 font-black italic">{description}</div>}
         </div>
      </div>

      <div className="flex items-center gap-10 pl-7">
        <div className="relative flex items-baseline gap-4">
          {prefix && <span className="text-2xl font-black text-primary/30 group-hover:text-primary transition-colors">{prefix}</span>}
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="bg-transparent border-none p-0 text-7xl font-black font-display text-white focus:ring-0 w-72 outline-none tracking-tighter tabular-nums group-hover:scale-105 transition-transform origin-left"
          />
          {unit && <span className="text-xs font-black text-muted-foreground/10 uppercase tracking-[0.3em]">{unit}</span>}
        </div>
        <div className="flex flex-col gap-3">
           <button
            onClick={() => onChange(value + 100)}
            className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center hover:bg-primary hover:text-black transition-all group/btn active:scale-90 shadow-2xl hover:border-primary/50"
           >
              <span className="text-2xl font-black">+</span>
           </button>
           <button
            onClick={() => onChange(Math.max(0, value - 100))}
            className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center hover:bg-destructive hover:text-white transition-all group/btn active:scale-90 shadow-2xl hover:border-destructive/50"
           >
              <span className="text-2xl font-black">-</span>
           </button>
        </div>
      </div>
      <div className="h-[1px] w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent mt-4 group-hover:from-primary/20 transition-all duration-700" />
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
