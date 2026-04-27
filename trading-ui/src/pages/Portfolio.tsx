import { useState, useEffect, useMemo } from "react";
import { usePositions, useFunds } from "@/features/openalgo/hooks/useTrading";
import { motion, AnimatePresence } from "framer-motion";
import { algoApi } from "@/features/openalgo/api/client";
import type { PnlResponse, Position } from "@/types/api";
import {
  Briefcase, TrendingUp, PieChart, AlertTriangle,
  Loader2, ShieldCheck, Activity, Target, Zap,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  Shield, Lock, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell
} from "recharts";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { cn } from "@/lib/utils";
import { useAether } from "@/contexts/AetherContext";
import { AetherPanel } from "@/components/ui/AetherPanel";

const pageTabs = ["Overview", "Allocation", "Performance"] as const;

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Overview");
  const { setSelectedSymbol } = useAether();

  const { data: positionsData, isLoading: isLoadingPositions, error: posError } = usePositions();
  const { data: fundsData, isLoading: isLoadingFunds, error: fundsError } = useFunds();
  const [pnlData, setPnlData] = useState<PnlResponse | null>(null);

  useEffect(() => {
    algoApi.getPnl().then(setPnlData).catch(() => {});
    const interval = setInterval(() => {
        algoApi.getPnl().then(setPnlData).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const totalValue = positionsData?.total_value || 0;
    const totalEstCharges = positionsData?.positions.reduce((acc: number, p: Position) => acc + (p.est_charges || 0), 0) || 0;
    return {
      totalValue,
      totalEstCharges,
      netValue: totalValue - totalEstCharges,
      dayPnL: pnlData?.total_pnl || 0,
      unrealizedPnL: pnlData?.unrealized_pnl || 0,
      realizedPnL: pnlData?.realized_pnl || 0,
      pnlPct: pnlData?.pnl_percentage || 0,
    };
  }, [positionsData, pnlData]);

  const allocation = useMemo(() => {
    if (!positionsData?.positions) return [];
    const grouped: Record<string, { value: number; symbols: string[] }> = {};
    positionsData.positions.forEach((p: Position) => {
      const strat = p.metadata?.strategy || "MANUAL";
      if (!grouped[strat]) grouped[strat] = { value: 0, symbols: [] };
      grouped[strat].value += p.current_value;
      grouped[strat].symbols.push(p.symbol);
    });
    return Object.entries(grouped).map(([name, data], i) => ({
      name,
      value: data.value,
      symbols: data.symbols,
      color: `rgba(0, 245, 255, ${0.8 - (i * 0.15)})`
    }));
  }, [positionsData]);

  return (
    <div className="space-y-10 pb-12">
      {/* 🟢 HEADER: INSTITUTIONAL BRANDING */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 flex items-center justify-center relative group overflow-hidden">
             <Shield className="w-8 h-8 text-primary relative z-10" />
             <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent group-hover:rotate-180 transition-transform duration-1000" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-5xl font-black uppercase tracking-[0.2em] text-foreground leading-[0.8] mb-2 font-display">Asset_Vault</h1>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/10 border border-secondary/30 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-secondary tracking-widest">REALTIME_SYNC_ON</span>
               </div>
               <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.4em] font-black">CUSTODY_NODE: 0x88.PRIME</span>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Pill */}
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 p-1.5 rounded-sm">
           {pageTabs.map(tab => (
             <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-8 py-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group",
                activeTab === tab ? "text-black bg-primary" : "text-muted-foreground/30 hover:text-foreground/60"
              )}
             >
               <span className="relative z-10">{tab}</span>
               {activeTab === tab && (
                 <motion.div layoutId="tab-bg" className="absolute inset-0 bg-primary" />
               )}
               <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform" />
             </button>
           ))}
        </div>
      </div>

      <div className="space-y-8">
        {posError || fundsError ? (
          <div className="p-8 border border-destructive/20 bg-destructive/5 flex items-center justify-between overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
            <div className="flex items-center gap-6">
               <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
               <div>
                  <h4 className="text-xs font-black text-destructive uppercase tracking-widest mb-1">TELEMETRY_LINK_FAULT_DETECTED</h4>
                  <p className="text-[9px] font-mono text-destructive/40 uppercase tracking-widest leading-none">Kernel_Access_Denied // Retry_Sequence_Active</p>
               </div>
            </div>
            <span className="text-[10px] font-mono text-destructive/40 uppercase font-black">ERR_0x77_BRIDGE</span>
          </div>
        ) : null}

        {isLoadingPositions ? (
          <div className="py-40 flex flex-col items-center gap-8">
             <div className="relative">
                <div className="w-24 h-24 border border-primary/10 rounded-full animate-[spin_3s_linear_infinite] flex items-center justify-center">
                   <div className="w-16 h-16 border border-primary/20 rounded-full animate-[spin_2s_linear_infinite_reverse]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
             </div>
             <div className="flex flex-col items-center">
                <span className="text-[11px] font-mono font-black text-primary uppercase tracking-[0.8em] animate-pulse">Syncing_Vault_Registry</span>
                <span className="text-[8px] font-mono text-muted-foreground/20 uppercase mt-2 italic">Building_Temporal_Index...</span>
             </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "Overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="grid grid-cols-12 gap-8"
              >
                {/* 🟠 LEFT: CORE LIQUIDITY BENTO */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <MetricBlock
                         label="TOTAL_VALUATION"
                         value={metrics.netValue}
                         prefix="₹"
                         color="text-primary"
                         description="MARKET_INDEX_ADJUSTED"
                         variant="void"
                       />
                       <MetricBlock
                         label="AVAILABLE_MARGIN"
                         value={fundsData?.cash || 0}
                         prefix="₹"
                         color="text-secondary"
                         description="REALTIME_LIQUIDITY_BUFFER"
                       />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <SmallMetricBlock label="EXIT_CHARGES" value={metrics.totalEstCharges} prefix="₹" color="text-destructive/60" icon={<TrendingUp className="w-3.5 h-3.5 text-destructive/40" />} />
                       <SmallMetricBlock label="NODE_YIELD" value={metrics.pnlPct} suffix="%" color="text-secondary" icon={<Activity className="w-3.5 h-3.5 text-secondary/40" />} />
                       <SmallMetricBlock label="UNREALISED_PNL" value={metrics.unrealizedPnL} prefix="₹" color={metrics.unrealizedPnL >= 0 ? "text-secondary" : "text-destructive"} />
                       <SmallMetricBlock label="SETTLED_PROFIT" value={metrics.realizedPnL} prefix="₹" color="text-foreground/80" icon={<Zap className="w-3.5 h-3.5 text-primary/40" />} />
                    </div>

                   {/* Valuation Frequency Map: Industrial Style */}
                   <AetherPanel variant="void" glow className="p-10 h-96 relative overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8 relative z-10">
                          <div className="flex items-center gap-4">
                             <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-sm">
                                <BarChart3 className="w-5 h-5 text-primary" />
                             </div>
                             <div className="flex flex-col">
                                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-foreground">VALUATION_FREQUENCY_MAP</h3>
                                <span className="text-[9px] font-mono text-muted-foreground/30 uppercase mt-1 italic tracking-widest font-black">Hist_Window: 24H_Continuous</span>
                             </div>
                          </div>
                          <div className="flex items-center gap-8">
                             <div className="flex flex-col text-right">
                                <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-1">PNL_FLUX_24H</span>
                                <IndustrialValue value={metrics.dayPnL} prefix="₹" className={cn("text-2xl font-black", metrics.dayPnL >= 0 ? "text-secondary" : "text-destructive")} />
                             </div>
                             <div className={cn(
                               "w-12 h-12 flex items-center justify-center border",
                               metrics.dayPnL >= 0 ? "border-secondary/30 bg-secondary/10" : "border-destructive/30 bg-destructive/10"
                             )}>
                                {(metrics.dayPnL >= 0) ? <ArrowUpRight className="w-6 h-6 text-secondary animate-pulse" /> : <ArrowDownRight className="w-6 h-6 text-destructive animate-pulse" />}
                             </div>
                          </div>
                      </div>

                      <div className="flex-1 w-full relative group">
                         <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/[0.03] z-0" />
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{ m: "H1", v: 100 }, { m: "H2", v: 110 }, { m: "H3", v: 105 }, { m: "H4", v: 130 }, { m: "H5", v: 125 }, {m: "H6", v: 140}, {m: "H7", v: 135}]}>
                               <XAxis dataKey="m" hide />
                               <YAxis hide domain={['auto', 'auto']} />
                               <Tooltip
                                 cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                 contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(0,245,255,0.2)', padding: '12px', borderRadius: '0' }}
                                 itemStyle={{ fontSize: '10px', color: '#00F5FF', fontWeight: '900', textTransform: 'uppercase', fontFamily: 'monospace' }}
                                 labelStyle={{ display: 'none' }}
                               />
                               <Bar
                                 dataKey="v"
                                 fill="#00F5FF"
                                 opacity={0.3}
                                 radius={[2, 2, 0, 0]}
                                 className="transition-all duration-500 hover:opacity-100"
                               />
                            </BarChart>
                         </ResponsiveContainer>
                         <div className="absolute bottom-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Activity className="w-32 h-32 text-white" />
                         </div>
                      </div>
                   </AetherPanel>
                </div>

                {/* 🟠 RIGHT: SYSTEM STATE & SECURITY */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                   <AetherPanel className="p-8 relative min-h-[460px] flex flex-col justify-between">
                      <div>
                         <div className="flex items-center gap-4 mb-12 border-b border-white/[0.05] pb-8">
                            <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
                               <Lock className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">VAULT_NODE_STATE</h3>
                               <span className="text-[9px] font-mono text-muted-foreground/30 uppercase mt-0.5 font-black">Link: SECURE_CHANNEL_8</span>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <RegistryBit label="Protocol_Hash" value="INST-V2.4" status="normal" />
                            <RegistryBit label="Custody_Link" value="BROKER_SYNCED" status="success" />
                            <RegistryBit label="Security_Gate" value="ACTIVE_01" status="success" />
                            <RegistryBit label="Valuation_Ref" value="LTP_REALTIME" status="normal" />
                            <RegistryBit label="Audit_ID" value="382-XOR" status="normal" />
                         </div>
                      </div>

                      <div className="mt-12 space-y-4">
                         <div className="p-6 bg-black/40 border border-white/5 relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-3">
                                 <ShieldCheck className="w-4 h-4 text-secondary" />
                                 <span className="text-[10px] font-black uppercase text-secondary tracking-widest">Neural_Guard_Active</span>
                              </div>
                              <p className="text-[10px] font-mono text-muted-foreground/30 leading-snug uppercase tracking-wider font-black">
                                Institutional hardware-level encryption enforced at every valuation flux.
                              </p>
                            </div>
                         </div>

                         <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-sm">
                            <div className="flex items-center gap-3">
                               <Activity className="w-4 h-4 text-primary/40 animate-pulse" />
                               <span className="text-[9px] font-black uppercase text-muted-foreground/20 tracking-widest">Network_Stability</span>
                            </div>
                            <span className="text-[10px] font-mono font-black text-secondary uppercase">99.9%</span>
                         </div>
                      </div>
                   </AetherPanel>

                   {/* Quick Actions / Diagnostic */}
                   <AetherPanel variant="void" className="p-6 flex items-center justify-between group cursor-pointer hover:bg-primary/5 transition-all">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 bg-white/5 flex items-center justify-center group-hover:border-primary/40 transition-all border border-transparent">
                            <Target className="w-6 h-6 text-muted-foreground/20 group-hover:text-primary transition-all" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-foreground tracking-[0.3em]">Run_Diagnostic</span>
                            <span className="text-[8px] font-mono text-muted-foreground/30 uppercase mt-0.5 font-black">Audit_Node_Integrity</span>
                         </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/10 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                   </AetherPanel>
                </div>
              </motion.div>
            )}

            {activeTab === "Allocation" && (
              <motion.div
                key="allocation"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-12 gap-8"
              >
                 {/* Left: Concentration Wheel */}
                 <AetherPanel className="col-span-12 lg:col-span-4 p-10 flex flex-col justify-between min-h-[600px]">
                    <div>
                       <div className="flex flex-col mb-12 border-b border-white/5 pb-8">
                          <h3 className="text-sm font-black uppercase tracking-[0.4em] text-foreground mb-1 uppercase">RISK_CONCENTRATION</h3>
                          <span className="text-[9px] font-mono text-muted-foreground/30 italic uppercase font-black tracking-widest">Weighting_By_Strategy_Node</span>
                       </div>

                       <div className="h-72 relative mb-16 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                             <RePieChart>
                                <Pie
                                  data={allocation}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={90}
                                  outerRadius={120}
                                  paddingAngle={4}
                                  dataKey="value"
                                  strokeWidth={0}
                                  animationDuration={1500}
                                >
                                   {allocation.map((e, i) => <Cell key={i} fill={e.color} className="hover:opacity-80 transition-opacity cursor-pointer" />)}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: '#000', border: '1px solid rgba(0,245,255,0.2)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace' }}
                                  itemStyle={{ color: '#00F5FF' }}
                                />
                             </RePieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black font-mono text-primary/40 uppercase tracking-[0.4em] mb-2">ALLOC_NET</span>
                                <span className="text-5xl font-black text-foreground tracking-tighter tabular-nums">100</span>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-5">
                          {allocation.map(a => (
                            <div key={a.name} className="flex items-center justify-between text-[11px] font-mono group py-2.5 border-b border-white/[0.03]">
                               <div className="flex items-center gap-4">
                                  <div className="w-2 h-5" style={{ background: a.color }} />
                                  <span className="text-muted-foreground/40 group-hover:text-primary transition-colors uppercase tracking-[0.2em] font-black">{a.name}</span>
                               </div>
                               <div className="flex flex-col text-right">
                                  <span className="text-foreground font-black tracking-widest leading-none">₹{a.value.toLocaleString()}</span>
                                  <span className="text-[8px] text-muted-foreground/20 font-black mt-1 uppercase italic">{((a.value / (metrics.totalValue || 1)) * 100).toFixed(1)}% Weight</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </AetherPanel>

                 {/* Right: Asset Table (Vault Ledger) */}
                 <div className="col-span-12 lg:col-span-8 space-y-8">
                    {allocation.length === 0 ? (
                       <div className="h-64 border border-white/5 bg-black/20 flex flex-col items-center justify-center group">
                          <Briefcase className="w-12 h-12 text-muted-foreground/10 mb-4 group-hover:text-primary transition-colors" />
                          <span className="text-[10px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.5em]">No_Assets_Detected_in_Vault</span>
                       </div>
                    ) : (
                       allocation.map((group, gIdx) => (
                          <AetherPanel key={group.name} variant="void" className="p-8 group hover:border-primary/30 transition-all relative overflow-hidden">
                             {/* Index Decoration */}
                             <div className="absolute -top-4 -left-4 text-7xl font-black text-white/[0.02] pointer-events-none select-none">0{gIdx + 1}</div>

                             <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-8 relative z-10">
                                <div className="flex items-center gap-5">
                                   <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center">
                                      <Zap className="w-6 h-6 text-primary" />
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="text-sm font-black uppercase text-foreground tracking-[0.2em] group-hover:text-primary transition-colors leading-none mb-2">{group.name}_KERNEL</span>
                                      <div className="flex items-center gap-2">
                                         <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                                         <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-[0.3em] font-black">Neural_Active_V3</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="flex flex-col text-right">
                                   <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-[0.3em] mb-2">CUMULATIVE_VALUE</span>
                                   <IndustrialValue value={group.value} prefix="₹" className="text-3xl font-black text-foreground group-hover:text-primary transition-colors" />
                                </div>
                             </div>

                             <div className="grid grid-cols-1 gap-4 relative z-10">
                                {group.symbols.map(sym => {
                                   const pos = positionsData?.positions.find(p => p.symbol === sym);
                                   return (
                                     <div
                                       key={sym}
                                       onClick={() => setSelectedSymbol(sym)}
                                       className="flex items-center justify-between py-5 px-6 bg-white/[0.01] border border-white/[0.05] hover:border-primary/20 hover:bg-white/[0.03] cursor-pointer transition-all group/item backdrop-blur-sm"
                                     >
                                        <div className="flex items-center gap-10">
                                           <div className="flex flex-col w-32">
                                              <span className="text-base font-black text-foreground uppercase tracking-widest group-hover/item:text-secondary transition-colors leading-none mb-2">{sym}</span>
                                              <div className="flex items-center gap-2">
                                                 <div className="w-1 h-3 bg-secondary/40" />
                                                 <span className="text-[9px] font-mono text-muted-foreground/30 uppercase font-black uppercase tracking-widest">Active_Equity</span>
                                              </div>
                                           </div>
                                           <div className="flex flex-col">
                                              <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-1">UNIT_COUNT</span>
                                              <span className="text-sm font-mono font-black text-foreground">{pos?.quantity || 0}</span>
                                           </div>
                                        </div>

                                        <div className="flex items-center gap-16">
                                           <div className="flex flex-col text-right min-w-[140px]">
                                              <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-1">MARKET_VALUATION</span>
                                              <IndustrialValue value={pos?.current_value || 0} prefix="₹" className="text-xl font-black group-hover/item:text-primary transition-colors" />
                                           </div>
                                           <ChevronRight className="w-6 h-6 text-muted-foreground/5 group-hover/item:text-primary group-hover/item:translate-x-2 transition-all duration-300" />
                                        </div>
                                     </div>
                                   );
                                })}
                             </div>

                             {/* Bottom Glint */}
                             <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/5 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
                          </AetherPanel>
                       ))
                    )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function MetricBlock({ label, value, prefix = "", color, description, variant = "glass" }: { label: string; value: number; prefix?: string; color: string; description?: string; variant?: "void" | "glass" }) {
  return (
    <AetherPanel variant={variant} className="p-10 relative group flex flex-col justify-center min-h-[200px] overflow-hidden">
      {/* Decorative Glint */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[80px] pointer-events-none group-hover:bg-primary/10 transition-colors" />

      <div className="flex items-center justify-between mb-8 relative z-10">
         <div className="flex items-center gap-3">
            <div className={cn("w-1 h-4 shadow-[0_0_10px_rgba(0,245,255,0.2)]", color.replace('text-', 'bg-'))} />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 group-hover:text-foreground transition-colors">{label}</span>
         </div>
         {description && <span className="text-[9px] font-mono text-muted-foreground/10 uppercase tracking-widest italic font-black">{description}</span>}
      </div>

      <div className="flex items-baseline gap-6 relative z-10">
         <span className={cn("text-6xl font-black font-display tracking-tighter leading-none transition-all group-hover:tracking-normal tabular-nums", color)}>
            {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
         </span>
         <div className={cn(
           "p-2 bg-white/5 border border-white/10 group-hover:border-primary/20 transition-all",
           value >= 0 ? "text-secondary" : "text-destructive"
         )}>
            {(value >= 0) ? <ArrowUpRight className="w-8 h-8 animate-pulse" /> : <ArrowDownRight className="w-8 h-8 animate-pulse" />}
         </div>
      </div>

      <div className="mt-10 h-[2px] bg-white/[0.03] relative overflow-hidden">
         <motion.div
           initial={{ width: 0 }}
           animate={{ width: "100%" }}
           transition={{ duration: 1.5, ease: "circOut" }}
           className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-current to-transparent opacity-40", color.replace('text-', 'bg-'))}
         />
      </div>
    </AetherPanel>
  );
}

function SmallMetricBlock({ label, value, prefix = "", suffix = "", color, icon }: { label: string; value: number; prefix?: string; suffix?: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="p-6 bg-black/40 border border-white/[0.05] group hover:border-primary/30 transition-all flex flex-col justify-between h-36 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-5 transition-opacity">
         <Activity className="w-16 h-16 text-white" />
      </div>
      <div className="flex items-start justify-between relative z-10">
         <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">{label}</span>
         <div className="p-1.5 bg-white/5 border border-white/5 group-hover:border-white/10 transition-all">{icon}</div>
      </div>
      <div className={cn("text-3xl font-black font-display tracking-tight mt-6 transition-all group-hover:scale-105 origin-left tabular-nums", color)}>
         {value >= 0 && prefix === "₹" ? '+' : ''}{prefix}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
      </div>
    </div>
  );
}

function RegistryBit({ label, value, status }: { label: string; value: string; status: 'success' | 'normal' }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.03] group hover:bg-white/[0.01] px-2 transition-all">
       <div className="flex items-center gap-3">
          <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", status === 'success' ? "bg-secondary" : "bg-muted-foreground/20")} />
          <span className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em] transition-colors group-hover:text-muted-foreground/60 font-black">{label}</span>
       </div>
       <span className={cn("text-[10px] font-black uppercase tracking-widest font-mono", status === 'success' ? "text-secondary" : "text-foreground")}>{value}</span>
    </div>
  );
}
