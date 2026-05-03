import React from "react";
import { motion } from "framer-motion";
import { History, ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";
import { useTradebook } from "@/features/aetherdesk/hooks/useTrading";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function RecentTrades() {
  const { data: tradebook, isLoading } = useTradebook({ limit: "15" });

  // Handle various API response formats
  let trades: any[] = [];
  if (Array.isArray(tradebook)) {
    trades = tradebook;
  } else if (tradebook && typeof tradebook === 'object') {
    const potentialData = (tradebook as any).data || (tradebook as any).trades;
    if (Array.isArray(potentialData)) {
      trades = potentialData;
    }
  }

  return (
    <div className="flex flex-col h-full bg-card/5 border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/20 bg-card/2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Recent_Trades</h3>
        </div>
        <div className="flex items-center gap-4">
           <Filter className="w-3.5 h-3.5 text-muted-foreground/20 hover:text-primary cursor-pointer transition-colors" />
           <div className="h-4 w-[1px] bg-border/20" />
           <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase">Live_Feed_Alpha</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-30">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[8px] font-mono uppercase tracking-widest">Accessing_Trade_Ledger...</span>
          </div>
        ) : trades.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 opacity-20">
            <span className="text-[9px] font-mono uppercase tracking-[0.3em]">No_Trade_Activity_Detected</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#050505] z-10">
              <tr className="border-b border-border/10">
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Execution_Time</th>
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Asset_Symbol</th>
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Side</th>
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Qty</th>
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Price</th>
                <th className="px-4 py-3 text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {trades.map((trade: any, i: number) => {
                const isBuy = trade.side?.toLowerCase() === "buy";
                return (
                  <motion.tr
                    key={trade.fill_id || i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/[0.02] transition-colors group cursor-default"
                  >
                    <td className="px-4 py-2.5 text-[9px] font-mono text-muted-foreground/40 tabular-nums">
                      {trade.fill_time || trade.time || i}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {trade.symbol}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className={cn(
                        "flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest",
                        isBuy ? "text-secondary" : "text-destructive"
                      )}>
                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.side}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[9px] font-mono font-bold text-foreground/70">
                      {trade.filled_qty || trade.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-[9px] font-mono font-bold text-foreground/70 tabular-nums">
                       {parseFloat(trade.fill_price || trade.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                       <span className="px-2 py-0.5 border border-secondary/20 text-secondary text-[7px] font-black uppercase tracking-widest bg-secondary/5">
                          Filled
                       </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 bg-black/40 border-t border-border/10 flex justify-between items-center shrink-0">
         <span className="text-[7px] font-mono text-muted-foreground/20 uppercase">Auth_Node::TRD_LEDGER_01</span>
         <button className="text-[8px] font-black text-primary uppercase tracking-[0.2em] hover:underline px-2 py-1">View_Full_Journal</button>
      </div>
    </div>
  );
}
