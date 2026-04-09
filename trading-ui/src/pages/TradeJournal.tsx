import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/lib/api-client";
import { useTradingMode } from "@/hooks/useTrading";
import type { Trade } from "@/types/api";
import { 
  Download, Calendar, History, Hash,
  Activity, TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

const pageTabs = ["Log", "Statistics"] as const;

export default function TradeJournal() {
  const { mode } = useTradingMode();
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Log");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = async () => {
    setIsLoading(true);
    try {
      const response = await algoApi.getOrders();
      setTrades(response.trades || []);
    } catch (error) {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [mode]);

  const stats = {
    total: trades.length,
    filled: trades.filter(t => t.status === 'filled').length,
    buys: trades.filter(t => t.side === 'BUY').length,
    sells: trades.filter(t => t.side === 'SELL').length,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/journal" />

      {/* Industrial Sub-Tabs */}
      <div className="flex px-4 bg-card/5 border-b border-border/20 relative z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-background/50 border border-border/20 p-1">
            {pageTabs.map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`px-4 py-1 text-[9px] font-mono font-black uppercase tracking-widest transition-all ${
                  activeTab === tab ? "bg-primary text-black" : "text-muted-foreground/30 hover:text-foreground/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 border-l border-border/20 pl-4">
             <div className="text-[8px] font-mono font-black text-primary/40 uppercase tracking-widest">MODE::{mode?.toUpperCase()}</div>
          </div>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => window.open(algoApi.exportTradesUrl(), "_blank")}
            className="flex items-center gap-2 px-3 py-1 bg-foreground text-background hover:bg-primary transition-all text-[8px] font-mono font-black uppercase"
          >
            <Download className="w-3 h-3" /> EXPORT_LEDGER
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 overflow-auto p-4 no-scrollbar">
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
                    <div className={`w-1 h-10 ${trade.side === "BUY" ? "bg-secondary" : "bg-destructive"}`} />
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-black font-syne uppercase text-foreground">{trade.symbol}</span>
                        <span className={`text-[8px] font-mono font-black px-1.5 border ${trade.side === "BUY" ? "border-secondary/20 text-secondary" : "border-destructive/20 text-destructive"}`}>
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
                    <div className="text-right">
                      <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">UNITS</div>
                      <IndustrialValue value={trade.quantity} className="text-xs font-black font-mono text-foreground" />
                    </div>
                    <div className="text-right">
                      <div className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">PRICE</div>
                      <IndustrialValue value={trade.price || 0} prefix="₹" className="text-xs font-black font-mono text-foreground" />
                    </div>
                    <div className="w-20 text-right">
                      <span className={`text-[8px] font-mono font-black px-2 py-0.5 border uppercase ${trade.status === "filled" ? "text-secondary border-secondary/20" : "text-primary border-primary/20"}`}>
                        {trade.status?.toUpperCase()}
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
                <h3 className="text-[9px] font-mono font-black uppercase tracking-widest text-primary mb-4">Direction_Pulse</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{v:stats.buys, c:"#00D4D4"}, {v:stats.sells, c:"#FF4D4D"}]} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="v" stroke="none">
                        {[{c:"#00D4D4"}, {c:"#FF4D4D"}].map((e, i) => (<Cell key={i} fill={e.c} fillOpacity={0.4} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="col-span-8 grid grid-cols-2 gap-4">
                <StatMetric label="TOTAL_LOG" value={stats.total} icon={Activity} color="text-foreground" />
                <StatMetric label="FILLED_EXEC" value={stats.filled} icon={TrendingUp} color="text-secondary" />
                <StatMetric label="BUY_BIAS" value={stats.buys} icon={TrendingUp} color="text-secondary" />
                <StatMetric label="SELL_BIAS" value={stats.sells} icon={TrendingDown} color="text-destructive" />
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

function StatMetric({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="border border-border/10 bg-card/5 p-4 group hover:bg-card/10 transition-all">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest">{label}</span>
        <Icon className={`w-3 h-3 ${color} opacity-20`} />
      </div>
      <IndustrialValue value={value} className={`text-2xl font-black font-syne ${color}`} />
    </div>
  );
}
