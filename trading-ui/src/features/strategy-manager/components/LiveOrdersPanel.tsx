import React from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
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
import { List, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveOrdersPanelProps {
  strategyId?: string;
}

export const LiveOrdersPanel: React.FC<LiveOrdersPanelProps> = ({ strategyId }) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", strategyId],
    queryFn: () => algoApi.getOrders({ strategy: strategyId || "all" }),
    refetchInterval: 3000,
  });

  return (
    <div className="flex flex-col h-full bg-slate-950/40 border-t border-white/5 overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <List className="w-3.5 h-3.5 text-secondary" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Live_Execution_Blotter</span>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 opacity-40">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-mono">STREAMING_TICK_FEED</span>
            </div>
            <button className="p-1 hover:bg-white/10 rounded transition-colors group">
                <RefreshCw className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="bg-black/20 sticky top-0 z-10">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 pl-4">Time</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Symbol</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Type</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Qty</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Price</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Status</TableHead>
              <TableHead className="h-8 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                [1,2,3].map(i => (
                    <TableRow key={i} className="border-white/5 animate-pulse">
                        <TableCell colSpan={7} className="h-8" />
                    </TableRow>
                ))
            ) : orders?.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground/20 italic text-[10px]">
                        No active orders detected for this session
                    </TableCell>
                </TableRow>
            ) : (
                orders?.map((order: any) => (
                    <TableRow key={order.orderid} className="border-white/5 hover:bg-white/5 group transition-colors">
                        <TableCell className="py-2 text-[9px] font-mono text-muted-foreground/80 pl-4">
                            {order.order_time?.split(' ')?.[1] || "00:00:00"}
                        </TableCell>
                        <TableCell className="py-2 text-[9px] font-black tracking-tight">{order.symbol}</TableCell>
                        <TableCell className="py-2">
                            <Badge className={cn(
                                "text-[8px] h-4 font-black uppercase tracking-tighter",
                                order.transaction_type === 'BUY' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                                {order.transaction_type}
                            </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-[9px] font-mono">{order.quantity}</TableCell>
                        <TableCell className="py-2 text-[9px] font-mono tabular-nums">₹{order.price}</TableCell>
                        <TableCell className="py-2">
                             <Badge variant="outline" className={cn(
                                "text-[8px] h-4 border-white/10 font-mono uppercase tracking-tighter",
                                order.status === 'COMPLETE' ? "text-green-500 bg-green-500/5" : "text-amber-500 bg-amber-500/5"
                             )}>
                                {order.status}
                             </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right pr-4">
                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/20 hover:text-primary transition-all rounded">
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
