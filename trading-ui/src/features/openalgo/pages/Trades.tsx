import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { useTradebook } from "../hooks/useTrading";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { 
  Zap, 
  Search, 
  Download, 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  History,
  FileText
} from "lucide-react";
import { format } from "date-fns";

export default function Trades() {
  const { data: tradesData, isLoading, refetch, isFetching } = useTradebook();
  const [filter, setFilter] = useState("");

  const trades = tradesData?.trades || [];
  const filteredTrades = trades.filter((trade: any) => 
    trade.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    (trade.strategy && trade.strategy.toLowerCase().includes(filter.toLowerCase()))
  );

  const stats = {
    total: filteredTrades.length,
    volume: filteredTrades.reduce((acc: number, t: any) => acc + (t.quantity * t.price), 0),
    buyCount: filteredTrades.filter((t: any) => t.side === "BUY").length,
    sellCount: filteredTrades.filter((t: any) => t.side === "SELL").length,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/trades" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border/20">
          {/* Header Section */}
          <div className="p-4 border-b border-border/20 bg-card/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 border border-secondary/20 rounded-sm">
                  <Zap className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h1 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-secondary">Trade_Registry_v4</h1>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Realtime_Execution_Audit_Log</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 border border-border/20 bg-background/50 hover:bg-secondary/5 transition-all group"
                >
                  <RefreshCw className={`w-3 h-3 text-muted-foreground group-hover:text-secondary transition-all ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                <div className="h-4 w-[1px] bg-border/20 mx-1" />
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border/20 bg-background/50 text-[9px] font-mono font-black uppercase tracking-widest hover:border-secondary/30 transition-all">
                  <Download className="w-3 h-3" />
                  Audit_Dump
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard label="Total_Trades" value={stats.total} color="text-foreground" />
              <StatCard label="Buy_Operations" value={stats.buyCount} color="text-secondary" />
              <StatCard label="Sell_Operations" value={stats.sellCount} color="text-destructive" />
              <StatCard label="Gross_Volume" value={stats.volume} prefix="₹" color="text-primary" isCurrency />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input 
                type="text"
                placeholder="FILTER_BY_SYMBOL_OR_STRATEGY..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-background/50 border border-border/20 pl-9 pr-4 py-2 text-[10px] font-mono uppercase tracking-widest focus:outline-none focus:border-secondary/40 focus:ring-1 focus:ring-secondary/20 transition-all placeholder:text-muted-foreground/20"
              />
            </div>
          </div>

          {/* Table Section */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/20">
                <tr className="text-left py-2">
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Timestamp</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Strategy</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Symbol</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Side</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Qty</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Exec_Price</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Value</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                <AnimatePresence mode="popLayout">
                  {filteredTrades.map((trade: any) => (
                    <motion.tr 
                      key={trade.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-secondary/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(trade.timestamp), "HH:mm:ss")}
                        </div>
                        <div className="text-[8px] font-mono text-muted-foreground/40">
                          {format(new Date(trade.timestamp), "yyyy-MM-dd")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 border border-secondary/10 bg-secondary/5 text-[9px] font-mono font-black text-secondary uppercase">
                          {trade.strategy || 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-black font-mono text-foreground uppercase tracking-wider">
                          {trade.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {trade.side === "BUY" ? <TrendingUp className="w-2.5 h-2.5 text-secondary" /> : <TrendingDown className="w-2.5 h-2.5 text-destructive" />}
                          <span className={`text-[10px] font-black font-mono uppercase ${trade.side === "BUY" ? "text-secondary" : "text-destructive"}`}>
                            {trade.side}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold">
                        {trade.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={trade.price} prefix="₹" className="text-[10px] font-mono font-black" />
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={trade.quantity * trade.price} prefix="₹" className="text-[10px] font-mono font-black text-muted-foreground" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest border border-border/10 px-1 py-0.5">
                          {trade.mode || 'SANDBOX'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {!isLoading && filteredTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <History className="w-8 h-8 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">NO_TRADE_HISTORY_FOUND</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
        <RightPanel />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, prefix = "", isCurrency = false }: { label: string; value: number; color: string; prefix?: string; isCurrency?: boolean }) {
  return (
    <div className="p-3 border border-border/10 bg-card/5 industrial-glint relative overflow-hidden group">
      <div className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-black font-mono ${color}`}>
        {isCurrency ? <IndustrialValue value={value} prefix={prefix} /> : value.toLocaleString()}
      </div>
      <div className="absolute right-0 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-white/5 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
    </div>
  );
}
