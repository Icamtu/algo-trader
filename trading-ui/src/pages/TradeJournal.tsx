import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/lib/api-client";
import { useTradingMode } from "@/hooks/useTrading";
import type { Trade } from "@/types/api";
import { ApiErrorBoundary } from "@/components/ui/ApiErrorBoundary";
import { 
  BarChart3, Shield, Search, Briefcase, BookOpen, Server, 
  Bell, GitBranch, Download, Calendar, History, Hash,
  ArrowUpRight, ArrowDownRight, Activity, TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";

const pageTabs = ["Log", "Statistics"] as const;

export default function TradeJournal() {
  const { mode } = useTradingMode();
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Log");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrades();
  }, [mode]);

  const fetchTrades = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await algoApi.getOrders();
      // Backend already filters by current mode — no client-side re-filter needed
      setTrades(response.trades || []);
    } catch (error) {
      console.error("Failed to fetch journal", error);
      setFetchError("Cannot load trade journal. Ensure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    total: trades.length,
    filled: trades.filter(t => t.status === 'filled').length,
    buys: trades.filter(t => t.side === 'BUY').length,
    sells: trades.filter(t => t.side === 'SELL').length,
  };

  const pieData = [
    { name: "Buys", value: stats.buys, color: "hsl(160, 84%, 39%)" },
    { name: "Sells", value: stats.sells, color: "hsl(0, 72%, 51%)" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <GlobalHeader />
      
      <MarketNavbar activeTab="/journal" />

      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-md">
            {pageTabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} 
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                  activeTab === tab ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-border mx-2" />
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${
              mode === 'live' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/10 text-warning border-warning/20"
            }`}>
              {mode} Ledger
            </span>
          </div>
        </div>
        <button
          onClick={() => window.open(algoApi.exportTradesUrl(), "_blank")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 rounded-md border border-border transition-all text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <Download className="w-3 h-3" /> Export Ledger
        </button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === "Log" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {isLoading && (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="glass-panel p-3 rounded-lg border border-border/40 flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-muted/50 rounded-lg" />
                          <div className="space-y-1.5">
                            <div className="w-20 h-3 bg-muted/50 rounded" />
                            <div className="w-32 h-2 bg-muted/30 rounded" />
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="w-12 h-4 bg-muted/40 rounded" />
                          <div className="w-16 h-4 bg-muted/40 rounded" />
                          <div className="w-14 h-5 bg-muted/40 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoading && trades.map((trade, i) => (
                  <motion.div
                    key={trade.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.01 }}
                    className="glass-panel p-3 rounded-lg border border-border/40 flex items-center justify-between group hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${trade.side === "BUY" ? "bg-neon-green/10" : "bg-destructive/10"}`}>
                        {trade.side === "BUY" ? (
                          <ArrowUpRight className={`w-4 h-4 ${trade.side === "BUY" ? "text-neon-green" : "text-destructive"}`} />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black tracking-tight">{trade.symbol}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            trade.side === "BUY" ? "border-neon-green/30 text-neon-green" : "border-destructive/30 text-destructive"
                          }`}>
                            {trade.side}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium mt-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(trade.timestamp || trade.created_at || Date.now()), "dd MMM yyyy HH:mm:ss")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Quantity</div>
                        <div className="text-xs font-bold font-mono">{trade.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Avg Price</div>
                        <div className="text-xs font-bold font-mono">₹{(trade.price ?? 0).toLocaleString()}</div>
                      </div>
                      <div className="text-right w-24">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Status</div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border uppercase ${
                          trade.status === "filled" ? "bg-neon-emerald/10 text-neon-emerald border-neon-emerald/20" : "bg-warning/10 text-warning border-warning/20"
                        }`}>
                          {trade.status}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {trades.length === 0 && !isLoading && (
                  <div className="py-20 text-center glass-panel rounded-xl border-dashed">
                    <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No transaction records found for {mode?.toUpperCase()} mode</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "Statistics" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-6">
                <div className="glass-panel p-5 rounded-xl border border-border/50 col-span-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground mb-4">Side Distribution</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" strokeWidth={0}>
                          {pieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                        </Pie>
                        <ReTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {pieData.map(w => (<div key={w.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: w.color }} /><span className="text-[9px] font-bold text-muted-foreground uppercase">{w.name}: {w.value}</span></div>))}
                  </div>
                </div>
                
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  {[
                    { label: "Total Executions", value: stats.total, icon: Activity, color: "text-primary" },
                    { label: "Successful Fills", value: stats.filled, icon: Shield, color: "text-neon-green" },
                    { label: "Total Buy Orders", value: stats.buys, icon: TrendingUp, color: "text-neon-green" },
                    { label: "Total Sell Orders", value: stats.sells, icon: TrendingDown, color: "text-destructive" },
                  ].map((s, i) => (
                    <div key={i} className="glass-panel rounded-xl p-6 border border-border/50 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">{s.label}</div>
                        <div className="text-2xl font-black text-foreground">{s.value}</div>
                      </div>
                      <s.icon className={`w-8 h-8 opacity-20 ${s.color}`} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <RightPanel />
      </div>

      <NewOrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} prefilledSymbol={prefilledSymbol} />
    </div>
  );
}


