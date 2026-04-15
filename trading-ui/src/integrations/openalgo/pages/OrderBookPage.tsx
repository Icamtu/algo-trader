import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { RefreshCw, Download, X, Settings2, Pencil, Loader2 } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { useWsStore } from '@/stores/wsStore';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { toast } from 'sonner';

// Porting OpenAlgo types and formatting
interface Order {
  orderid: string;
  symbol: string;
  exchange: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  trigger_price: number;
  pricetype: string;
  product: string;
  order_status: string;
  timestamp: string;
}

export const OrderBookPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | "all" | null>(null);
  const { mode } = useAppModeStore();
  
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const fetchOrders = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const response = await tradingService.getOrders(apiKey);
      if (response && response.status === 'success') {
        setOrders(response.data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey]);

  const handleAbortAll = async () => {
    if (!apiKey) return;
    const pendingOrders = orders.filter(o => o.order_status !== 'complete' && o.order_status !== 'cancelled' && o.order_status !== 'rejected');
    if (pendingOrders.length === 0) {
      toast.info("NO_PENDING_ORDERS_TO_ABORT");
      return;
    }

    if (!window.confirm(`FATAL_STOP: ABORT_${pendingOrders.length}_ORDERS?`)) return;
    
    setIsProcessing("all");
    try {
      // Since there is no bulk cancel, we loop or call cancel on each
      // Performance optimization: we could do it in parallel
      await Promise.all(pendingOrders.map(o => tradingService.cancelOrder(o.orderid)));
      toast.success("PROTOCOL_ABORT_SUCCESS: ALL_ORDERS_CANCELLED");
      fetchOrders();
    } catch (err) {
      toast.error("PROTOCOL_ABORT_PARTIAL_FAILURE");
      fetchOrders();
    } finally {
      setIsProcessing(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!apiKey) return;
    setIsProcessing(orderId);
    try {
      await tradingService.cancelOrder(orderId);
      toast.success(`ORDER_${orderId.substring(0,8)}_CANCELLED`);
      fetchOrders();
    } catch (err) {
      toast.error("CANCEL_FAILED");
    } finally {
      setIsProcessing(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(), 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Settings2 className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Order_Book_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <RefreshCw className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">TRANSACTION_QUEUE // LIVE_ORD_BUFFER</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleAbortAll}
            disabled={isProcessing === 'all'}
            className="h-10 border-rose-500/20 text-rose-500 font-mono text-[10px] uppercase tracking-widest bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all"
          >
            {isProcessing === 'all' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
            PROTOCOL_STOP_ALL
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => fetchOrders(true)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_SIGNALS
          </Button>
        </div>
      </div>

      <AetherPanel className={accentBorderClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="micro-label flex items-center gap-2">
            <span className={cn("w-1.5 h-1.5 animate-pulse rounded-full", isAD ? "bg-amber-500" : "bg-teal-500")} />
            SYSTEM_ORD_TELEMETRY
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">LTP_Telemetry</span>
              <div className="w-1 h-1 bg-teal rounded-full" />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="micro-label py-2">Symbol</TableHead>
              <TableHead className="micro-label py-2">Action</TableHead>
              <TableHead className="micro-label py-2 text-right">Qty</TableHead>
              <TableHead className="micro-label py-2 text-right">Price</TableHead>
              <TableHead className="micro-label py-2">ID</TableHead>
              <TableHead className="micro-label py-2">Status</TableHead>
              <TableHead className="micro-label py-2 text-right">Ops</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-mono italic uppercase tracking-widest text-[10px] opacity-30">
                  {isLoading ? "Kernel_Syncing..." : "NO ACTIVE ORDERS IN PROTOCOL"}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.orderid} className="border-white/5 hover:bg-white/2 group transition-colors">
                  <TableCell className="font-black text-[11px] font-mono uppercase tracking-wider">{order.symbol}</TableCell>
                  <TableCell>
                    <Badge className={cn("rounded-none text-[8px] font-black tracking-widest px-1 py-0", order.action === 'BUY' ? "bg-teal text-black" : "bg-red-500 text-white")}>
                      {order.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">{order.quantity}</TableCell>
                  <TableCell className={cn("text-right font-mono text-[11px]", primaryColorClass)}>{order.price}</TableCell>
                  <TableCell className="font-mono text-[8px] text-muted-foreground/40 uppercase tracking-tighter truncate max-w-[80px]">#{order.orderid.substring(0,8)}</TableCell>
                  <TableCell>
                    <span className={cn("uppercase text-[9px] font-black tracking-widest", 
                      order.order_status === 'complete' ? "text-teal" : isAD ? "text-amber" : "text-primary")}>
                      {order.order_status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleCancelOrder(order.orderid)}
                      disabled={isProcessing === order.orderid || order.order_status === 'complete' || order.order_status === 'cancelled' || order.order_status === 'rejected'}
                      className="h-6 w-6 p-0 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                    >
                      {isProcessing === order.orderid ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AetherPanel>
    </div>
  );
};
