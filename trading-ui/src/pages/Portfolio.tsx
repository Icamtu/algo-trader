import { useState, useEffect, useMemo } from "react";
import { usePositions, useFunds } from "@/features/openalgo/hooks/useTrading";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/features/openalgo/api/client";
import type { PnlResponse, Position } from "@/types/api";
import { Briefcase, TrendingUp, PieChart, AlertTriangle, Loader2, ShieldCheck, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

const pageTabs = ["Overview", "Allocation", "Performance"] as const;

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Overview");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const primaryBgClass = isAD ? "bg-amber-500" : "bg-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const { data: positionsData, isLoading: isLoadingPositions, error: posError } = usePositions();
  const { data: fundsData, isLoading: isLoadingFunds, error: fundsError } = useFunds();
  const [pnlData, setPnlData] = useState<PnlResponse | null>(null);

  useEffect(() => {
    algoApi.getPnl().then(setPnlData).catch(() => {});
  }, []);

  const hasError = posError || fundsError;

  const metrics = useMemo(() => {
    return {
      totalValue: positionsData?.total_value || 0,
      dayPnL: pnlData?.total_pnl || 0,
      unrealizedPnL: pnlData?.unrealized_pnl || 0,
      realizedPnL: pnlData?.realized_pnl || 0,
      pnlPct: pnlData?.pnl_percentage || 0,
    };
  }, [positionsData, fundsData, pnlData]);

  const allocation = useMemo(() => {
    if (!positionsData?.positions) return [];
    
    // Group by strategy
    const grouped: Record<string, { value: number; symbols: string[] }> = {};
    positionsData.positions.forEach((p: Position) => {
      const strat = p.metadata?.strategy || "MANUAL";
      if (!grouped[strat]) {
        grouped[strat] = { value: 0, symbols: [] };
      }
      grouped[strat].value += p.current_value;
      grouped[strat].symbols.push(p.symbol);
    });

    return Object.entries(grouped).map(([name, data], i) => ({
      name,
      value: data.value,
      symbols: data.symbols,
      color: [isAD ? "#FFB000" : "#14B8A6", `#00D4D4`, `#FF4D4D`, `#A555EE`, `#00C853`][i % 5]
    }));
  }, [positionsData, isAD]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/portfolio" />

      {/* Kernel Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 pb-0 z-10">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Briefcase className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Institutional_Vault_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">ASSET_INVENTORY // CUSTODY_VERIFIED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn("px-4 py-1 border font-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-2", accentBorderClass, accentBgClass, primaryColorClass)}>
            <Activity className="w-3.5 h-3.5" /> 
            LIVE_NAV_TELEMETRY
          </div>
        </div>
      </div>

      {/* Industrial Sub-Tabs */}
      <div className="flex px-4 bg-card/5 border-b border-border/20 relative z-10 mt-4">
        <div className="flex items-center gap-3 pr-4 mr-4 border-r border-border/20">
            <TrendingUp className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
            <div className={cn("text-[9px] font-mono font-black uppercase tracking-[0.2em]", primaryColorClass)}>Vault_v4</div>
        </div>
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === tab ? primaryColorClass + " bg-primary/5" : "text-muted-foreground/30 hover:text-foreground/60"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activePortTab" className={cn("absolute bottom-0 left-0 right-0 h-[1.5px] shadow-[0_0_10px_rgba(255,176,0,0.5)]", primaryBgClass)} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          {hasError && (
            <div className="border border-destructive bg-destructive/5 p-4 mb-4 flex items-center gap-4">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-[10px] font-mono font-black text-destructive uppercase">TELEMETRY_LINK_FAULT</span>
            </div>
          )}
          
          {(isLoadingPositions || isLoadingFunds) && !hasError && (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className={cn("w-5 h-5 animate-spin", primaryColorClass)} />
            </div>
          )}

          {activeTab === "Overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="AGGREGATE_PNL" value={metrics.dayPnL} prefix="₹" color={metrics.dayPnL >= 0 ? "text-secondary" : "text-destructive"} />
                <MetricCard label="UNREALIZED_CORE" value={metrics.unrealizedPnL} prefix="₹" color={metrics.unrealizedPnL >= 0 ? "text-secondary" : "text-destructive"} />
                <MetricCard label="REALIZED_BUFFER" value={metrics.realizedPnL} prefix="₹" color="text-foreground/60" />
                <MetricCard label="YIELD_INDEX" value={metrics.pnlPct} suffix="%" color={primaryColorClass} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="GROSS_VALUATION" value={metrics.totalValue} prefix="₹" color="text-foreground" />
                <MetricCard label="ACCOUNT_LIQUIDITY" value={fundsData?.cash || 0} prefix="₹" color={primaryColorClass} />
              </div>

              <div className="border border-border/20 bg-card/5 p-4 industrial-glint relative overflow-hidden">
                 <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="text-[10px] font-black font-display uppercase tracking-[0.2em]">Growth_Telemetry</h3>
                    <div className="px-2 py-0.5 border border-secondary/20 bg-secondary/5 text-[7px] font-mono font-black text-secondary">REALTIME_BUFFER</div>
                 </div>
                 <div className="h-48 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ m: "JAN", v: 100 }, { m: "FEB", v: 120 }, { m: "MAR", v: 115 }, { m: "APR", v: 140 }]}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isAD ? "#ffb000" : "#14B8A6"} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={isAD ? "#ffb000" : "#14B8A6"} stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="m" hide />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ background: '#0d0d0f', border: `1px solid ${isAD ? '#ffb00030' : '#14B8A630'}`, color: isAD ? '#ffb000' : '#14B8A6', fontSize: '9px', fontFamily: 'IBM Plex Mono' }}
                          cursor={{ fill: 'rgba(255, 176, 0, 0.05)' }}
                        />
                        <Bar dataKey="v" fill="url(#barGradient)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Allocation" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="border border-border/20 bg-card/5 p-4 flex gap-8 items-center">
                <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={allocation} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke="none">
                          {allocation.map((e, i) => (<Cell key={i} fill={e.color} fillOpacity={0.6} />))}
                        </Pie>
                      </RePieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1">
                   <h3 className={cn("text-[10px] font-mono font-black uppercase tracking-[0.3em] mb-2", primaryColorClass)}>Strategy_Distribution</h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                     {allocation.map(a => (
                       <div key={a.name} className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5" style={{ backgroundColor: a.color }} />
                         <span className="text-[8px] font-mono font-bold text-muted-foreground/60 uppercase">{a.name}</span>
                       </div>
                     ))}
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allocation.map(group => (
                  <div key={group.name} className="border border-border/10 bg-card/10 p-4 industrial-glint relative overflow-hidden group">
                     <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2">
                           <PieChart className={cn("w-3 h-3", primaryColorClass)} />
                           <span className="text-[10px] font-mono font-black text-foreground uppercase tracking-widest">{group.name}</span>
                        </div>
                        <IndustrialValue value={group.value} prefix="₹" className={cn("text-sm font-black", primaryColorClass)} />
                     </div>
                     <div className="space-y-1.5">
                        {group.symbols.map(sym => (
                          <div key={sym} className="flex justify-between items-center text-[9px] font-mono">
                             <span className="text-muted-foreground/40 font-bold uppercase">{sym}</span>
                             <div className="flex-1 mx-2 border-b border-dotted border-border/20" />
                             <span className="text-foreground/80 font-black">
                                ₹{positionsData?.positions.find(p => p.symbol === sym)?.current_value.toFixed(2)}
                             </span>
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
        <RightPanel />
      </div>
      <NewOrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} prefilledSymbol={prefilledSymbol} />
    </div>
  );
}

function MetricCard({ label, value, prefix = "", suffix = "", color }: { label: string; value: number; prefix?: string; suffix?: string; color: string }) {
  return (
    <div className="p-4 border border-border/10 bg-card/5 industrial-glint relative overflow-hidden group hover:border-primary/20 transition-all">
      <div className="relative z-10 text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mb-2">{label}</div>
      <IndustrialValue value={value} prefix={prefix} suffix={suffix} className={`relative z-10 text-xl font-black font-display ${color}`} />
    </div>
  );
}
