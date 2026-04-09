import { useState, useEffect, useMemo } from "react";
import { usePositions, useFunds } from "@/hooks/useTrading";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/lib/api-client";
import type { PnlResponse, Position } from "@/types/api";
import { Briefcase, TrendingUp, TrendingDown, PieChart, AlertTriangle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

const pageTabs = ["Overview", "Allocation", "Performance"] as const;

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Overview");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");

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
    return positionsData.positions.map((p: Position, i: number) => ({
      name: p.symbol,
      value: p.current_value,
      color: [`#FFB000`, `#00D4D4`, `#FF4D4D`, `#A555EE`][i % 4]
    }));
  }, [positionsData]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/portfolio" />

      {/* Industrial Sub-Tabs */}
      <div className="flex px-4 bg-card/5 border-b border-border/20 relative z-10">
        <div className="flex items-center gap-3 pr-4 mr-4 border-r border-border/20">
            <Briefcase className="w-3 h-3 text-primary animate-pulse" />
            <div className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.2em]">Vault_v4</div>
        </div>
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === tab ? "text-primary bg-primary/5" : "text-muted-foreground/30 hover:text-foreground/60"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activePortTab" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 overflow-auto p-4 no-scrollbar">
          {hasError && (
            <div className="border border-destructive bg-destructive/5 p-4 mb-4 flex items-center gap-4">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-[10px] font-mono font-black text-destructive uppercase">TELEMETRY_LINK_FAULT</span>
            </div>
          )}
          
          {(isLoadingPositions || isLoadingFunds) && !hasError && (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}

          {activeTab === "Overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="AGGREGATE_PNL" value={metrics.dayPnL} prefix="₹" color={metrics.dayPnL >= 0 ? "text-secondary" : "text-destructive"} />
                <MetricCard label="UNREALIZED_CORE" value={metrics.unrealizedPnL} prefix="₹" color={metrics.unrealizedPnL >= 0 ? "text-secondary" : "text-destructive"} />
                <MetricCard label="REALIZED_BUFFER" value={metrics.realizedPnL} prefix="₹" color="text-foreground/60" />
                <MetricCard label="YIELD_INDEX" value={metrics.pnlPct} suffix="%" color="text-primary" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="GROSS_VALUATION" value={metrics.totalValue} prefix="₹" color="text-foreground" />
                <MetricCard label="ACCOUNT_LIQUIDITY" value={fundsData?.cash || 0} prefix="₹" color="text-primary" />
              </div>

              <div className="border border-border/20 bg-card/5 p-4">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black font-syne uppercase tracking-[0.2em]">Growth_Telemetry</h3>
                    <div className="px-2 py-0.5 border border-primary/20 bg-primary/5 text-[7px] font-mono font-black text-primary">LIVE_STREAM</div>
                 </div>
                 <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ m: "JAN", v: 100 }, { m: "FEB", v: 120 }, { m: "MAR", v: 115 }, { m: "APR", v: 140 }]}>
                        <Bar dataKey="v" fill="#ffb000" fillOpacity={0.1} stroke="#ffb000" strokeWidth={1} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Allocation" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border/20 bg-card/5 p-4 flex gap-8">
               <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                        {allocation.map((e, i) => (<Cell key={i} fill={e.color} fillOpacity={0.4} />))}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
               </div>
               <div className="flex-1 grid grid-cols-2 gap-2">
                  {allocation.map(a => (
                    <div key={a.name} className="p-3 border border-border/10 bg-background/50 flex justify-between items-center">
                       <span className="text-[9px] font-mono font-black text-muted-foreground/30">{a.name}</span>
                       <IndustrialValue value={a.value} suffix="%" className="text-xs font-black" />
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
    <div className="p-4 border border-border/10 bg-card/5 group hover:border-primary/20 transition-all">
      <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mb-2">{label}</div>
      <IndustrialValue value={value} prefix={prefix} suffix={suffix} className={`text-xl font-black font-syne ${color}`} />
    </div>
  );
}
