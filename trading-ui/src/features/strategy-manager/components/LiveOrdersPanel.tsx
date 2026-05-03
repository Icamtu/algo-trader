import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { algoApi } from "@/features/aetherdesk/api/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { List, Download, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveOrdersPanelProps {
  strategyId?: string;
}

export const LiveOrdersPanel: React.FC<LiveOrdersPanelProps> = ({ strategyId }) => {
  const [activeTab, setActiveTab] = React.useState<"all" | "open" | "filled">("all");
  const queryClient = useQueryClient();

  const cancelAllMutation = useMutation({
    mutationFn: () => algoApi.cancelAllOrders(),
    onSuccess: () => {
      toast.success("All open orders cancelled");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => toast.error(`Cancel failed: ${err.message}`),
  });

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["orders", strategyId],
    queryFn: () => strategyId
      ? algoApi.getStrategyOrders(strategyId)
      : algoApi.getOrders(),
    refetchInterval: 3000,
  });

  // Normalize broker + DB trade fields to a unified schema
  const trades = React.useMemo(() => {
    const raw = Array.isArray(rawOrders?.trades) ? rawOrders.trades : (Array.isArray(rawOrders?.data) ? rawOrders.data : []);
    return raw.map((t: any) => ({
      ...t,
      orderid: t.orderid || t.order_id || t.id || "",
      order_time: t.order_time || t.timestamp || "",
      transaction_type: (t.transaction_type || t.side || "BUY").toUpperCase(),
      order_type: t.order_type || t.pricetype || "MKT",
      status: (t.status || t.order_status || "UNKNOWN").toUpperCase(),
      pnl: t.pnl ?? null,
    }));
  }, [rawOrders]);

  const filteredTrades = React.useMemo(() => {
    if (activeTab === "all") return trades;
    if (activeTab === "open") return trades.filter((t: any) => t.status === "OPEN" || t.status === "PENDING");
    if (activeTab === "filled") return trades.filter((t: any) => t.status === "COMPLETE" || t.status === "FILLED" || t.status === "FILLED");
    return trades;
  }, [trades, activeTab]);

  const counts = React.useMemo(() => ({
    all: trades.length,
    open: trades.filter((t: any) => t.status === "OPEN" || t.status === "PENDING").length,
    filled: trades.filter((t: any) => t.status === "COMPLETE" || t.status === "FILLED").length,
  }), [trades]);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-slate-800 overflow-hidden">
      <div className="px-4 py-2 bg-slate-900 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-4">
          <h2 className="font-h2 text-[13px] text-cyan-400">Live Order Table</h2>
          {strategyId && (
            <span className="text-[9px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
              {strategyId}
            </span>
          )}
          <div className="flex gap-4">
            {[
              { id: "all", label: "ALL ORDERS", count: counts.all },
              { id: "open", label: "OPEN", count: counts.open },
              { id: "filled", label: "FILLED", count: counts.filled }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "text-[10px] font-mono font-bold uppercase tracking-widest transition-all pb-1 border-b-2",
                  activeTab === tab.id
                    ? "text-cyan-400 border-cyan-400"
                    : "text-slate-500 border-transparent hover:text-slate-300"
                )}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-[10px] text-error hover:underline uppercase font-mono font-bold disabled:opacity-40"
            onClick={() => {
              if (counts.open === 0) return;
              if (confirm(`Cancel all ${counts.open} open orders?`)) cancelAllMutation.mutate();
            }}
            disabled={cancelAllMutation.isPending || counts.open === 0}
          >
            {cancelAllMutation.isPending ? "Cancelling..." : "Cancel All Open"}
          </button>
          <Download className="w-[18px] h-[18px] text-slate-500 cursor-pointer hover:text-cyan-400 transition-colors" />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase tracking-tighter border-b border-slate-800 z-10">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Order ID</th>
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Side</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium text-right">Avg Fill</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              <>
                <tr>
                  <td colSpan={9} className="px-4 pt-4 pb-1 text-center text-[9px] font-mono text-slate-600 uppercase tracking-widest animate-pulse">
                    Loading orders...
                  </td>
                </tr>
                {[1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-4 py-3 h-8 bg-slate-900/20"></td>
                  </tr>
                ))}
              </>
            ) : filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-600 uppercase tracking-widest italic">
                  No {activeTab === 'all' ? '' : activeTab} orders in buffer
                </td>
              </tr>
            ) : (
              filteredTrades.map((order: any) => (
                <tr key={order.orderid} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-2 text-slate-500">
                    {order.order_time
                      ? new Date(order.order_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      : "--:--:--"}
                  </td>
                  <td className="px-4 py-2 text-cyan-500/80 font-bold group-hover:text-cyan-400">{String(order.orderid ?? '').substring(0, 8)}</td>
                  <td className="px-4 py-2 font-black text-slate-200 tracking-tight">{order.symbol}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-sm font-black text-[9px] uppercase",
                      order.transaction_type === 'BUY' ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                    )}>
                      {order.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-slate-400">{order.quantity}</td>
                  <td className="px-4 py-2 text-[10px] text-slate-600 font-bold uppercase">{order.order_type || "MKT"}</td>
                  <td className="px-4 py-2 text-right font-black text-slate-300 tabular-nums">{order.price}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      "flex items-center gap-2 font-black text-[10px] uppercase tracking-wider",
                      order.status === 'COMPLETE' || order.status === 'FILLED' ? "text-emerald-500" :
                      order.status === 'OPEN' || order.status === 'PENDING' ? "text-amber-500" : "text-slate-500"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                        order.status === 'COMPLETE' || order.status === 'FILLED' ? "bg-emerald-500 shadow-emerald-500/40" :
                        order.status === 'OPEN' || order.status === 'PENDING' ? "bg-amber-500 animate-pulse shadow-amber-500/40" : "bg-slate-500")}
                      />
                      {order.status === 'COMPLETE' ? 'FILLED' : order.status}
                    </span>
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-black tabular-nums",
                    (order.pnl || 0) > 0 ? "text-emerald-500" : (order.pnl || 0) < 0 ? "text-rose-500" : "text-slate-600"
                  )}>
                    {order.pnl ? `${order.pnl > 0 ? '+' : ''}₹${order.pnl}` : "--"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
