import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/features/openalgo/api/client";
import { useTradingMode } from "@/features/openalgo/hooks/useTrading";
import { useAppModeStore } from "@/stores/appModeStore";
import { useToast } from "@/hooks/use-toast";
import type { Trade } from "@/types/api";
import {
  Download, Calendar, History, Hash,
  Activity, TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { cn } from "@/lib/utils";

const pageTabs = ["Log", "Statistics"] as const;

export default function TradeJournal() {
  const { mode: tradingMode } = useTradingMode();

  const { mode: appMode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = appMode === 'AD';

  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Log");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = async () => {
    setIsLoading(true);
    try {
      const response = await algoApi.getOrders();
      setTrades(response.trades || []);
    } catch (error) {
      console.error("Failed to fetch trades", error);
      toast({ variant: "destructive", title: "FAULT::LEDGER_SYNC", description: "Failed to synchronize execution history." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [tradingMode]);

  const stats = {
    total: trades.length,
    filled: trades.filter(t => t.status === 'filled').length,
    buys: trades.filter(t => t.side === 'BUY').length,
    sells: trades.filter(t => t.side === 'SELL').length,
    totalCharges: trades.reduce((acc, t) => acc + (t.charges || 0), 0),
    avgCharges: trades.length > 0 ? trades.reduce((acc, t) => acc + (t.charges || 0), 0) / trades.length : 0,
  };

  return (
    <div className="min-h-full flex flex-col bg-background relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      <div className="flex px-4 py-2 bg-card/5 border-b border-border/20 relative z-10 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 border-r border-border/20 pr-6 mr-2">
            <div className={cn("bg-card/20 p-1.5 border rounded-sm shadow-xl", isAD ? "border-amber-500/20" : "border-teal-500/20")}>
              <History className={cn("h-5 w-5", isAD ? "text-amber-500" : "text-teal-500")} />
            </div>
            <div>
              <h1 className={cn("text-lg font-black font-mono tracking-[0.2em] uppercase", isAD ? "text-amber-500" : "text-teal-500")}>Execution_Ledger_Kernel</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className={cn("w-3 h-3", isAD ? "text-amber-500" : "text-teal-500")} />
                <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">MODE::{tradingMode?.toUpperCase() || "SYNC"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-background/50 border border-border/20 p-1 rounded-sm">
            {pageTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1 text-[9px] font-mono font-black uppercase tracking-widest transition-all rounded-sm",
                  activeTab === tab
                    ? (isAD ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(255,176,0,0.3)]" : "bg-teal-500 text-black shadow-[0_0_10px_rgba(0,212,212,0.3)]")
                    : "text-muted-foreground/30 hover:text-foreground/60"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(algoApi.exportTradesUrl(), "_blank")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 text-black transition-all text-[9px] font-mono font-black uppercase rounded-sm shadow-lg",
              isAD ? "bg-amber-500 hover:bg-white" : "bg-teal-500 hover:bg-white"
            )}
          >
            <Download className="w-3.5 h-3.5" /> EXPORT_LEDGER
          </button>
        </div>
      </div>

      <div className="flex relative z-10 p-4 pb-12 gap-4">
        <div className="flex-1">
          {activeTab === "Log" && (
            <div className="space-y-2">
              {isLoading && (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}
               {trades.map((trade, i) => (
                 <motion.div key={trade.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border/10 bg-card/5 p-3 hover:bg-card/10 transition-all flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                     <div className={cn("w-1 h-10", trade.side === "BUY" ? (isAD ? "bg-amber-500" : "bg-teal-500") : "bg-rose-500")} />
                     <div>
                       <div className="flex items-center gap-3 mb-1">
                         <span className="text-sm font-black font-display uppercase text-foreground">{trade.symbol}</span>
                         <span className={cn(
                           "text-[8px] font-mono font-black px-1.5 border",
                           trade.side === "BUY"
                             ? (isAD ? "border-amber-500/20 text-amber-500" : "border-teal-500/20 text-teal-500")
                             : "border-rose-500/20 text-rose-500"
                         )}>
                           {trade.side}
                         </span>
                       </div>
                      <div className="flex items-center gap-2 text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-tighter">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(trade.timestamp || Date.now()), "HH:mm:ss")}
                        <span className="text-muted-foreground/10">|</span>
                        <span>ID_{trade.id || "NULL"}</span>
                      </div>
                    </div>
                  </div>
                         <div className="flex items-center gap-8">
                           {trade.charges !== undefined && (
                             <div className="text-right">
                               <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">TAX_FEE</div>
                               <IndustrialValue value={trade.charges} prefix="₹" className="text-xs font-black font-mono text-rose-500/60" />
                             </div>
                           )}
                           {trade.pnl !== null && trade.pnl !== undefined && (
                             <div className="text-right">
                               <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">NET_RESULT</div>
                               <IndustrialValue
                                 value={(trade.pnl || 0) - (trade.charges || 0)}
                                 prefix="₹"
                                 className={cn(
                                   "text-xs font-black font-mono",
                                   ((trade.pnl || 0) - (trade.charges || 0)) >= 0 ? (isAD ? "text-amber-500" : "text-teal-500") : "text-rose-500"
                                 )}
                               />
                             </div>
                           )}
                           <div className="text-right">
                             <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">UNITS</div>
                             <IndustrialValue value={trade.quantity} className="text-xs font-black font-mono text-foreground" />
                           </div>
                           <div className="text-right">
                             <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">PRICE</div>
                             <IndustrialValue value={trade.price || 0} prefix="₹" className="text-xs font-black font-mono text-foreground" />
                           </div>
                           <div className="w-20 text-right">
                             <span className={cn(
                               "text-[8px] font-mono font-black px-2 py-1 border uppercase rounded-sm",
                               trade.status === "filled"
                                 ? (isAD ? "text-amber-500 border-amber-500/20 bg-amber-500/5 shadow-[0_0_10px_rgba(255,176,0,0.1)]" : "text-teal-500 border-teal-500/20 bg-teal-500/5 shadow-[0_0_10px_rgba(0,212,212,0.1)]")
                                 : "text-muted-foreground border-border/20"
                             )}>
                               {trade.status?.toUpperCase() || "PENDING"}
                             </span>
                           </div>
                         </div>
                </motion.div>
              ))}
              {trades.length === 0 && !isLoading && (
                <div className="h-64 flex flex-col items-center justify-center opacity-20 filter grayscale border border-dashed border-border/20">
                  <History className="w-8 h-8 mb-4" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.4em]">Ledger_Empty</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "Statistics" && (
            <div className="grid grid-cols-12 gap-4">
               <div className="col-span-4 border border-border/10 bg-card/5 p-4">
                 <h3 className={cn("text-[9px] font-mono font-black uppercase tracking-widest mb-4", isAD ? "text-amber-500" : "text-teal-500")}>Direction_Pulse</h3>
                 <div className="h-32">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{v:stats.buys, c:isAD ? "#F59E0B" : "#14B8A6"}, {v:stats.sells, c:"#F43F5E"}]} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="v" stroke="none">
                        {[{c:isAD ? "#F59E0B" : "#14B8A6"}, {c:"#F43F5E"}].map((e, i) => (<Cell key={i} fill={e.c} fillOpacity={0.4} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
                  <div className="col-span-8 grid grid-cols-2 gap-4">
                    <StatMetric label="TOTAL_LOG" value={stats.total} icon={Activity} color="text-foreground" />
                    <StatMetric label="FILLED_EXEC" value={stats.filled} icon={TrendingUp} color={isAD ? "text-amber-500" : "text-teal-500"} />
                    <StatMetric label="TOTAL_TAX_CHARGES" value={stats.totalCharges} icon={TrendingDown} color="text-rose-500/50" prefix="₹" />
                    <StatMetric label="AVG_COST_PER_TRADE" value={stats.avgCharges} icon={TrendingDown} color="text-rose-500/40" prefix="₹" />
                  </div>
            </div>
          )}
        </div>
        <RightPanel />
      </div>
      <NewOrderModal isOpen={false} onClose={() => {}} prefilledSymbol="" />
    </div>
  );
}

function StatMetric({ label, value, icon: Icon, color, prefix }: { label: string, value: number, icon: any, color: string, prefix?: string }) {
  return (
    <div className="border border-border/10 bg-card/5 p-4 group hover:bg-card/10 transition-all">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest">{label}</span>
        <Icon className={`w-3 h-3 ${color} opacity-20`} />
      </div>
      <IndustrialValue value={value} prefix={prefix} className={`text-2xl font-black font-display ${color}`} />
    </div>
  );
}
