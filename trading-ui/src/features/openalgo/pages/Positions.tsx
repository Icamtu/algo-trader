import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { usePositions } from "../hooks/useTrading";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { 
  BarChart, 
  Search, 
  Download, 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  Maximize2,
  XCircle
} from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { toast } from "sonner";

export default function Positions() {
  const { data: posData, isLoading, refetch, isFetching } = usePositions();
  const [filter, setFilter] = useState("");

  const positions = posData?.positions || [];
  const filteredPositions = positions.filter((p: any) => 
    p.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  const stats = {
    total: filteredPositions.length,
    active: filteredPositions.filter((p: any) => p.quantity !== 0).length,
    netValue: posData?.total_value || 0,
  };

  const handleExit = async (symbol: string) => {
    try {
      await algoApi.exitPosition(symbol);
      toast.success(`Exiting position: ${symbol}`);
      refetch();
    } catch (e: any) {
      toast.error(`Exit failed: ${e.message}`);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/positions" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border/20">
          {/* Header Section */}
          <div className="p-4 border-b border-border/20 bg-card/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-sm">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-primary">Position_Matrix_v4</h1>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Active_Exposure_Vector_Monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 border border-border/20 bg-background/50 hover:bg-primary/5 transition-all group"
                >
                  <RefreshCw className={`w-3 h-3 text-muted-foreground group-hover:text-primary transition-all ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                <div className="h-4 w-[1px] bg-border/20 mx-1" />
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border/20 bg-destructive/10 text-[9px] font-mono font-black text-destructive uppercase tracking-widest hover:bg-destructive/20 transition-all">
                  <XCircle className="w-3 h-3" />
                  PANIC_EXIT_ALL
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatCard label="Live_Positions" value={stats.active} color="text-foreground" />
              <StatCard label="Asset_Concentration" value={stats.total} color="text-primary" />
              <StatCard label="Portfolio_Valuation" value={stats.netValue} prefix="₹" color="text-secondary" isCurrency />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input 
                type="text"
                placeholder="SCAN_BY_SYMBOL..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-background/50 border border-border/20 pl-9 pr-4 py-2 text-[10px] font-mono uppercase tracking-widest focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/20"
              />
            </div>
          </div>

          {/* Table Section */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/20">
                <tr className="text-left py-2">
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Symbol_Asset</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Net_Quantity</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Avg_Cost</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">LTP</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Current_Value</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Unrealised_PNL</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                <AnimatePresence mode="popLayout">
                  {filteredPositions.map((p: any) => {
                    const unrealised = (p.current_value - (p.average_price * p.quantity));
                    return (
                    <motion.tr 
                      key={p.symbol}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-primary/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-black font-mono text-foreground uppercase tracking-wider">
                          {p.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black font-mono ${p.quantity > 0 ? "text-secondary" : p.quantity < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {p.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={p.average_price} prefix="₹" className="text-[10px] font-mono font-black" />
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={p.current_value / (p.quantity || 1)} prefix="₹" className="text-[10px] font-mono font-black text-primary" />
                      </td>
                      <td className="px-4 py-3">
                         <IndustrialValue value={p.current_value} prefix="₹" className="text-[10px] font-mono font-black" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                           <IndustrialValue value={unrealised} prefix="₹" className={`text-[10px] font-mono font-black ${unrealised >= 0 ? "text-secondary" : "text-destructive"}`} />
                           <span className="text-[8px] font-mono opacity-40">
                             {((unrealised / (p.average_price * (p.quantity || 1))) * 100).toFixed(2)}%
                           </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                           <button 
                             onClick={() => handleExit(p.symbol)}
                             className="p-1.5 hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                             title="EXIT_POSITION"
                           >
                             <XCircle className="w-3 h-3" />
                           </button>
                           <button className="p-1.5 hover:bg-primary/10 hover:text-primary transition-all">
                             <Maximize2 className="w-3 h-3" />
                           </button>
                        </div>
                      </td>
                    </motion.tr>
                  )})}
                </AnimatePresence>
                {!isLoading && filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <BarChart className="w-8 h-8 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">NO_ACTIVE_POSITIONS_REPORTED</span>
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
