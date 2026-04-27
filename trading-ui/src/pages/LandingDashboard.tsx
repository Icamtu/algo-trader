import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, Globe, Zap,
  ShieldCheck, Clock, ArrowRightLeft, Target,
  Cpu, LayoutGrid, BarChart3, ChevronRight, ZapOff, Loader2,
  Database, Fingerprint, ShieldAlert, Cpu as CpuIcon
} from "lucide-react";
import { useAether } from "@/contexts/AetherContext";
import { cn } from "@/lib/utils";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { TelemetryOscilloscope } from "@/components/trading/TelemetryOscilloscope";
import { useSystemHealth, useStrategies, useOrders, usePositions, useReconcilePositions } from "@/features/openalgo/hooks/useTrading";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { PnLSummary } from "@/components/dashboard/PnLSummary";
import { PerformanceVitals } from "@/components/dashboard/PerformanceVitals";
import { AetherPanel } from "@/components/ui/AetherPanel";
import { HeroChart } from "@/components/trading/charts/HeroChart";

export default function LandingDashboard() {
  const { setSelectedSymbol, selectedSymbol, ticks, tickerSymbols } = useAether();
  const [universe, setUniverse] = useState<"nifty50" | "broad">("nifty50");

  const { data: healthRes } = useSystemHealth();
  const health = healthRes?.data || healthRes;
  const { data: strategiesRes } = useStrategies();
  const { data: orders } = useOrders();
  const { data: positions } = usePositions();

  const strategies = strategiesRes?.strategies || [];
  const activeStrategies = strategies.filter((s: any) => s.is_active).length;

  const { mutate: reconcile, isPending: isReconciling } = useReconcilePositions();
  const driftDetected = health?.checks?.drift === "drift_detected";

  const selectedTick = selectedSymbol ? ticks[selectedSymbol] : null;

  const movers = tickerSymbols.slice(2).map(sym => {
    const live = ticks[sym];
    return {
      symbol: sym,
      ltp: live?.ltp || 0,
      change: parseFloat(live?.chg_pct || "0"),
      volume: "LIVE",
      sentiment: "Analyzing",
      signal: "WAIT"
    };
  });
  const isLoading = tickerSymbols.length === 0;

  return (
    <div className="relative space-y-6 pb-12 overflow-hidden">
      {/* Decorative Neural Flow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] neural-flow-bg opacity-30 animate-neural-pulse" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] neural-flow-bg opacity-20 animate-neural-pulse" style={{ animationDelay: '1s' }} />

      {/* Prime Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 bg-white/[0.02] p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" />
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-4">
             <div className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" />
                Institutional_Intelligence // Alpha_v4.0
             </div>
             <div className="flex items-center gap-2 text-muted-foreground/30 font-mono text-[9px] uppercase tracking-widest font-black">
                <Fingerprint className="w-3 h-3 text-primary/40" />
                <span>Node_Auth: PASSED</span>
             </div>
          </div>
          <h1 className="text-6xl font-black tracking-tight uppercase leading-none text-foreground">
            Aether_Prime <span className="text-primary/30">.Control</span>
          </h1>
          <p className="text-muted-foreground/40 font-mono text-[11px] uppercase tracking-[0.4em] max-w-3xl leading-relaxed">
            Universal algorithmic execution framework // Real-time GEX analytics and sub-millisecond signal validation.
          </p>
        </div>

        <div className="flex bg-black/40 border border-white/10 p-1 rounded-sm backdrop-blur-md relative z-10">
           {["nifty50", "broad"].map(u => (
             <button
               key={u}
               onClick={() => setUniverse(u as any)}
               className={cn(
                 "px-8 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden",
                 universe === u ? "bg-primary text-black" : "text-muted-foreground/40 hover:text-foreground/60 hover:bg-white/5"
               )}
             >
               {universe === u && <div className="absolute inset-0 bg-white/10 animate-scan-fast pointer-events-none" />}
               {u.replace('50', '_50')}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {driftDetected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6"
          >
            <div className="bg-destructive/10 border border-destructive/20 p-4 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-destructive/20 flex items-center justify-center animate-pulse">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-destructive">Positional_Drift_Detected</h4>
                  <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mt-1">
                    Local engine state mismatched with broker truth. Execution safety compromised.
                  </p>
                </div>
              </div>
              <button
                onClick={() => reconcile()}
                disabled={isReconciling}
                className="px-6 py-2 bg-destructive text-black text-[10px] font-black uppercase tracking-widest hover:bg-destructive/80 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isReconciling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                Sync_Reality
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-6 px-6">
        {/* Main Feed */}
        <div className="col-span-8 space-y-6">
           {/* Hero Graph */}
           {selectedSymbol && (
             <HeroChart
               symbol={selectedSymbol}
               ltp={selectedTick?.ltp || 0}
               change={parseFloat(selectedTick?.chg_pct || "0")}
             />
           )}

           {/* New PnL Period Summaries */}
           <PnLSummary />

           <AetherPanel
             showGreebles
             scanning
             className="p-6 bg-black/40 border border-white/5 relative overflow-hidden backdrop-blur-md"
           >
              <div className="noise-overlay opacity-[0.05]" />

              <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-6">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/5 border border-primary/20 flex items-center justify-center">
                       <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Active_Momentum_Matrices</h3>
                       <span className="text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Neural_Signal_Processor_v4 // Port_5002</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-4 text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
                       <span>Registry_Index: {universe.toUpperCase()}</span>
                       <span className="text-secondary/60 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                          Sync: Ultra_Low_Latency
                       </span>
                    </div>
                    <TelemetryOscilloscope height={30} className="w-48 opacity-40" color="#00F5FF" />
                 </div>
              </div>

              {isLoading ? (
                <div className="py-32 flex flex-col items-center gap-6">
                   <div className="relative">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                   </div>
                   <span className="text-[10px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.5em] animate-pulse">Hydrating_Neural_Buffers...</span>
                </div>
               ) : (
                 <motion.div
                    variants={{
                      animate: { transition: { staggerChildren: 0.05 } }
                    }}
                    initial="initial"
                    animate="animate"
                    className="grid grid-cols-1 gap-2 h-[450px] overflow-auto custom-scrollbar pr-2"
                 >
                   {movers?.map((mover) => (
                     <motion.div
                       key={mover.symbol}
                       variants={{
                         initial: { opacity: 0, x: -10 },
                         animate: { opacity: 1, x: 0 }
                       }}
                       onClick={() => setSelectedSymbol(mover.symbol)}
                       className="group flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden"
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                       <div className="flex items-center gap-8 relative z-10">
                          <div className={cn("w-1 h-12 shadow-[0_0_15px]", mover.change > 0 ? "bg-secondary shadow-secondary/40" : "bg-destructive shadow-destructive/40")} />
                          <div className="flex flex-col">
                             <div className="flex items-center gap-3">
                                <span className="text-xl font-black tracking-tight uppercase group-hover:text-primary transition-colors">{mover.symbol}</span>
                                <div className="px-2 py-0.5 border border-white/5 bg-white/5 text-[8px] font-black text-muted-foreground/40 tracking-widest uppercase">NSE:EQ</div>
                             </div>
                             <span className="text-[9px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.3em] mt-1">GEX_Node // Vol: {mover.volume}</span>
                          </div>
                       </div>

                       <div className="flex items-center gap-16 relative z-10 pr-4">
                          <div className="flex flex-col items-end">
                             <span className="text-[8px] font-black text-muted-foreground/20 uppercase mb-1 tracking-widest">Price_Flux</span>
                             <IndustrialValue value={mover.ltp} prefix="₹" className="text-lg font-black text-foreground font-mono tabular-nums" />
                          </div>
                          <div className="flex flex-col items-end w-24">
                             <span className="text-[8px] font-black text-muted-foreground/20 uppercase mb-1 tracking-widest">Momentum</span>
                             <div className={cn("text-lg font-black font-mono tabular-nums flex items-center gap-2",
                                mover.change > 0 ? "text-secondary" : "text-destructive")}>
                                {mover.change > 0 ? "▲" : "▼"}{Math.abs(mover.change).toFixed(2)}%
                             </div>
                          </div>
                          <div className="flex flex-col items-end w-24">
                             <span className="text-[8px] font-black text-muted-foreground/20 uppercase mb-1 tracking-widest">Aether_Pulse</span>
                             <div className={cn("w-full px-4 py-1.5 border font-mono font-black text-[10px] uppercase tracking-[0.2em] text-center",
                                mover.signal === 'LONG' ? 'border-secondary/20 bg-secondary/5 text-secondary shadow-[inset_0_0_10px_rgba(0,245,255,0.05)]' :
                                mover.signal === 'SHORT' ? 'border-destructive/20 bg-destructive/5 text-destructive shadow-[inset_0_0_10px_rgba(255,59,59,0.05)]' :
                                'border-border/20 bg-white/2 text-muted-foreground/20')}>
                                {mover.signal}
                             </div>
                          </div>
                          <div className="w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                          </div>
                       </div>
                     </motion.div>
                   ))}
                 </motion.div>
              )}
           </AetherPanel>

           {/* Integrated Trade Blotter */}
           <div className="h-[400px]">
              <RecentTrades />
           </div>
        </div>

        {/* Right Sidebar: Vitals */}
        <div className="col-span-4 space-y-6">
           {/* Institutional Risk Ratios */}
           <PerformanceVitals />

           <AetherPanel
             showGreebles
             className="p-6 bg-black/40 border border-white/5 backdrop-blur-md relative overflow-hidden"
           >
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
                 <ShieldCheck className="w-5 h-5 text-primary" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Global_Integrity_Index</h3>
              </div>

              <div className="space-y-10">
                 <VitalProgress label="System_Entropy" value={health?.status === 'success' ? 12 : 85} color="bg-secondary" status={health?.status === 'success' ? "Stable // Optimal" : "Critical // Syncing"} />
                 <VitalProgress label="Active_Strategies" value={strategies.length > 0 ? (activeStrategies / strategies.length) * 100 : 0} color="bg-primary" status={`${activeStrategies}/${strategies.length} Deployed`} />
                 <VitalProgress label="Position_Flux" value={positions?.length > 0 ? 65 : 10} color="bg-primary" status={positions?.length > 0 ? "Exposure_Active" : "Nominal"} />
              </div>

              <div className="mt-12 pt-8 border-t border-white/5 flex flex-col gap-4">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
                    <span>Engine_Latency</span>
                    <span className="text-primary">{health?.latency || '12ms'} [SIM]</span>
                 </div>
                 <TelemetryOscilloscope height={40} data={[20, 30, 25, 45, 60, 55, 40, 30, 35, 50]} color="#FFA000" />
              </div>
           </AetherPanel>

           <div className="p-6 bg-black/40 border border-white/5 backdrop-blur-md relative">
              <div className="flex items-center gap-4 mb-8">
                 <Activity className="w-4 h-4 text-primary animate-pulse" />
                 <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Aether_Registry_Status</h3>
              </div>
              <div className="space-y-5 font-mono text-[10px] uppercase leading-relaxed relative">
                 <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/5" />
                 {[
                   { t: "SYNC", msg: `Brokers: ${health?.brokers || 'SHNY'} [SECURE]`, c: "text-secondary" },
                   { t: "ACTIVE", msg: `Strategies_Live: ${activeStrategies}`, c: "text-primary" },
                   { t: "TRADES", msg: `Pending_Approvals: 0`, c: "text-foreground/60" },
                   { t: "SYSTEM", msg: "Core_Module_V4: STABLE", c: "text-foreground/60" }
                 ].map((log, i) => (
                   <div key={i} className="flex gap-4 relative z-10 group/log">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/10 bg-black flex items-center justify-center shrink-0 mt-0.5 group-hover/log:border-primary/50 transition-colors">
                         <div className={cn("w-1 h-1 rounded-full", log.c.replace('text-', 'bg-'))} />
                      </div>
                      <div className="flex flex-col gap-1">
                         <span className="text-[8px] font-black tracking-tighter opacity-30">{log.t} // LOG_ID: {4020 + i}</span>
                         <span className={cn("font-black tracking-wide", log.c)}>{log.msg}</span>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Power Actions */}
           <div className="grid grid-cols-2 gap-4">
              <QuickAction icon={Zap} label="Flash_Exit" color="text-destructive" desc="Liquidity_Protocol" />
              <QuickAction icon={ShieldCheck} label="Lock_Kernel" color="text-secondary" desc="Auth::Level_4" />
           </div>
        </div>
      </div>
    </div>
  );
}

function VitalProgress({ label, value, color, status }: { label: string; value: number; color: string; status: string }) {
  return (
    <div className="space-y-4">
       <div className="flex justify-between items-end">
          <div>
             <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80 block">{label}</span>
             <span className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em]">Sensor_ID: {Math.floor(Math.random() * 900) + 100}</span>
          </div>
          <div className="text-right">
             <span className={cn("text-[9px] font-mono font-black uppercase tracking-widest block", color.replace('bg-', 'text-'))}>{status}</span>
             <span className="text-[10px] font-black text-foreground tabular-nums">{value}%</span>
          </div>
       </div>
       <div className="h-1.5 bg-white/5 relative rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${value}%` }}
            viewport={{ once: true }}
            className={cn("absolute top-0 left-0 h-full shadow-[0_0_15px]",
              color,
              color === 'bg-secondary' ? 'shadow-secondary/30' : 'shadow-primary/30'
            )}
          />
       </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, color, desc }: { icon: any; label: string; color: string; desc: string }) {
  return (
    <button className="flex flex-col items-center justify-center p-6 bg-black/40 border border-white/5 hover:border-primary/40 hover:bg-primary/[0.03] transition-all group backdrop-blur-md relative overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
       <Icon className={cn("w-6 h-6 mb-4 transition-transform group-hover:scale-125 group-hover:-rotate-6", color)} />
       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground group-hover:text-primary transition-colors">{label}</span>
       <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mt-2">{desc}</span>

       {/* Corner Decals */}
       <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-white/10 group-hover:border-primary/40 transition-colors" />
       <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-white/10 group-hover:border-primary/40 transition-colors" />
    </button>
  );
}
