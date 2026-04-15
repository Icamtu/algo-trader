import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/features/openalgo/api/client";
import { useQuery } from "@tanstack/react-query";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { 
  Building2, 
  Search, 
  Download, 
  RefreshCw, 
  PieChart,
  Wallet,
  ShieldCheck
} from "lucide-react";

export default function Holdings() {
  const { data: holdingsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["holdings"],
    queryFn: algoApi.getHoldings,
    refetchInterval: 30000,
  });
  const [filter, setFilter] = useState("");

  const holdings = holdingsData?.holdings || [];
  const filteredHoldings = holdings.filter((h: any) => 
    h.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  const stats = {
    totalValue: holdings.reduce((acc: number, h: any) => acc + (h.quantity * h.last_price), 0),
    invested: holdings.reduce((acc: number, h: any) => acc + (h.quantity * h.average_price), 0),
    count: holdings.length,
  };

  const totalPnL = stats.totalValue - stats.invested;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/holdings" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border/20">
          {/* Header Section */}
          <div className="p-4 border-b border-border/20 bg-card/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 border border-secondary/20 rounded-sm">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h1 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-secondary">Asset_Vault_v4</h1>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Equity_Holding_Inventory_Audit</p>
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
                  <PieChart className="w-3 h-3" />
                  Portfolio_Map
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard label="Current_Valuation" value={stats.totalValue} prefix="₹" color="text-foreground" isCurrency />
              <StatCard label="Invested_Capital" value={stats.invested} prefix="₹" color="text-muted-foreground" isCurrency />
              <StatCard label="Aggregate_Gain" value={totalPnL} prefix="₹" color={totalPnL >= 0 ? "text-secondary" : "text-destructive"} isCurrency />
              <StatCard label="Asset_Count" value={stats.count} color="text-primary" />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input 
                type="text"
                placeholder="PROBE_ASSET_BY_SYMBOL..."
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
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Instrument</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Quantity</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Avg_Price</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Last_Price</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Cur_Value</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">PNL_Report</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">P&L_%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                <AnimatePresence mode="popLayout">
                  {filteredHoldings.map((h: any) => {
                    const pnl = (h.last_price - h.average_price) * h.quantity;
                    const pnlPct = ((h.last_price - h.average_price) / h.average_price) * 100;
                    return (
                    <motion.tr 
                      key={h.symbol}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-secondary/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-black font-mono text-foreground uppercase tracking-wider">
                          {h.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold">
                        {h.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={h.average_price} prefix="₹" className="text-[10px] font-mono font-black" />
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={h.last_price} prefix="₹" className="text-[10px] font-mono font-black text-primary" />
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] font-black">
                        <IndustrialValue value={h.quantity * h.last_price} prefix="₹" />
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={pnl} prefix="₹" className={`text-[10px] font-mono font-black ${pnl >= 0 ? "text-secondary" : "text-destructive"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-mono font-black ${pnlPct >= 0 ? "text-secondary" : "text-destructive"}`}>
                          {pnlPct.toFixed(2)}%
                        </span>
                      </td>
                    </motion.tr>
                  )})}
                </AnimatePresence>
                {!isLoading && filteredHoldings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <Building2 className="w-8 h-8 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">NO_HOLDING_RECORDS_REPORTED</span>
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
    </div>
  );
}
