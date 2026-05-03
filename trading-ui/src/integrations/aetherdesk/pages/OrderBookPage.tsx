import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { RefreshCw, X, Settings2, Loader2, Activity, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { toast } from 'sonner';
import { VirtualizedDataTable, type ColumnDefinition } from '../components/VirtualizedDataTable';
import { IndustrialValue } from '@/components/trading/IndustrialValue';

// Porting AetherDesk types and formatting
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | "all" | null>(null);
  const { mode } = useAppModeStore();

  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";

  const fetchOrders = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);

    try {
      const response = await tradingService.getOrders(apiKey);
      if (response && response.status === 'success') {
        const orderData = response.data.orders || [];
        setOrders(orderData);
        if (selectedOrder) {
          const updated = orderData.find(o => o.orderid === selectedOrder.orderid);
          if (updated) setSelectedOrder(updated);
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, selectedOrder]);

  const handleAbortAll = async () => {
    if (!apiKey) return;
    const pendingOrders = orders.filter(o => !['complete', 'cancelled', 'rejected'].includes(o.order_status.toLowerCase()));
    if (pendingOrders.length === 0) {
      toast.info("NO_PENDING_ORDERS_TO_ABORT");
      return;
    }

    setIsProcessing("all");
    try {
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
      toast.success(`ORDER_CANCELLED`);
      fetchOrders();
      if (selectedOrder?.orderid === orderId) setSelectedOrder(null);
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

  const orderStats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => !['complete', 'cancelled', 'rejected'].includes(o.order_status.toLowerCase())).length,
      completed: orders.filter(o => o.order_status.toLowerCase() === 'complete').length,
      failed: orders.filter(o => o.order_status.toLowerCase() === 'rejected').length,
    };
  }, [orders]);

  const columns = useMemo<ColumnDefinition<Order>[]>(() => [
    {
      key: 'symbol',
      header: 'Symbol',
      width: 180,
      cell: (order) => (
        <div
          className="flex flex-col cursor-pointer group/sym"
          onClick={() => setSelectedOrder(order)}
        >
          <span className={cn("font-black text-[11px] font-mono uppercase tracking-wider group-hover/sym:text-primary transition-colors",
            selectedOrder?.orderid === order.orderid && "text-primary")}>
            {order.symbol}
            {selectedOrder?.orderid === order.orderid && <span className="ml-2 text-[8px] animate-pulse">◀</span>}
          </span>
          <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest leading-none italic">{order.exchange} // {String(order.orderid || '').substring(0,8)}</span>
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action',
      width: 80,
      cell: (order) => (
        <Badge className={cn("rounded-none text-[8px] font-black tracking-widest px-2 py-0 border-none",
          order.action === 'BUY' ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
          {order.action}
        </Badge>
      )
    },
    {
      key: 'quantity',
      header: 'Qty',
      width: 80,
      align: 'right',
      cell: (order) => <span className="font-mono text-[11px] font-black tabular-nums">{order.quantity}</span>
    },
    {
      key: 'price',
      header: 'Price',
      width: 100,
      align: 'right',
      cell: (order) => (
        <IndustrialValue
          value={order.price}
          prefix="₹"
          className={cn("text-[11px] font-mono font-black tabular-nums", primaryColorClass)}
        />
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      cell: (order) => {
        const status = order.order_status.toLowerCase();
        const isPending = !['complete', 'cancelled', 'rejected'].includes(status);
        return (
          <div className="flex items-center gap-2">
            {isPending && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            <span className={cn("uppercase text-[9px] font-black tracking-widest",
              status === 'complete' ? "text-emerald-500" :
              status === 'rejected' ? "text-rose-500" :
              status === 'cancelled' ? "text-muted-foreground/40" :
              "text-primary")}>
              {order.order_status}
            </span>
          </div>
        );
      }
    }
  ], [selectedOrder, primaryColorClass]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      o.symbol.toLowerCase().includes(q) ||
      o.orderid.toLowerCase().includes(q) ||
      o.order_status.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { staggerChildren: 0.05 } }
      }}
      className="h-full flex flex-col p-4 md:p-6 space-y-4 md:space-y-6 overflow-hidden font-mono"
    >
       <motion.div
         variants={{
           initial: { opacity: 0, x: -10 },
           animate: { opacity: 1, x: 0 }
         }}
         className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
       >
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl relative overflow-hidden group", accentBorderClass)}>
            <div className="absolute inset-0 bg-primary/2 translate-y-[100%] group-hover:translate-y-[-100%] transition-transform duration-1000" />
            <Settings2 className={cn("h-6 w-6 relative z-10", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Queue_Station</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">TRANSACTION_QUEUE // LIVE_ORD_BUFFER_v1.2</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.div className="hidden xl:flex items-center gap-6 px-6 py-2 bg-black/40 border border-white/5 relative overflow-hidden">
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">PENDING</div>
                <div className="text-sm font-black text-primary tabular-nums">{orderStats.pending}</div>
             </div>
             <div className="w-[1px] h-6 bg-white/5" />
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">EXECUTED</div>
                <div className="text-sm font-black text-emerald-500 tabular-nums">{orderStats.completed}</div>
             </div>
             <div className="w-[1px] h-6 bg-white/5" />
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">FAILED</div>
                <div className="text-sm font-black text-rose-500 tabular-nums">{orderStats.failed}</div>
             </div>
          </motion.div>

          <Button
            variant="outline"
            onClick={handleAbortAll}
            disabled={isProcessing === 'all'}
            className="h-10 border-rose-500/20 text-rose-500 font-mono text-[10px] uppercase tracking-widest bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all shadow-lg"
          >
            {isProcessing === 'all' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
            ABORT_ALL_PENDING
          </Button>
          <Button
            variant="secondary"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="h-10 font-mono text-[10px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)] uppercase tracking-widest"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin text-primary" /> : <RefreshCw className="h-3.5 w-3.5 mr-2 text-primary" />}
            RE_SYNC
          </Button>
        </div>
      </motion.div>

      <div className="flex-1 min-h-0 flex gap-6">
        <motion.div
          variants={{
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 }
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <AetherPanel className={cn("flex-1 min-h-0 flex flex-col p-0 overflow-hidden bg-background/20 relative", accentBorderClass)}>
            <div className="p-4 border-b border-border/10 flex items-center justify-between bg-black/40 shrink-0">
              <div className="micro-label flex items-center gap-2 text-[10px] font-black tracking-[0.2em]">
                <Clock className={cn("w-4 h-4", primaryColorClass)} /> REALTIME_QUEUE_LOG
              </div>
              <div className="flex gap-4">
                <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase border-primary/20 bg-primary/5">V4_TRANSACTION_ENGINE</Badge>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <VirtualizedDataTable
                data={filteredOrders}
                columns={columns}
                rowHeight={50}
                onRowClick={setSelectedOrder}
                emptyMessage={isLoading ? "Kernel_Syncing..." : searchQuery ? "NO MATCHING ORDERS FOUND" : "NO ACTIVE ORDERS IN PROTOCOL"}
              />
            </div>

            {/* Matrix Footer overlay */}
            <div className="h-6 border-t border-white/5 bg-black/60 flex items-center px-4 justify-between">
              <div className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[0.3em]">
                QUEUE_CORE::0xA4B2 // STATUS_SYNCED
              </div>
              <div className="flex gap-4">
                <span className="text-[7px] font-mono text-primary/40 uppercase tracking-[0.2em]">PKT_LOSS: 0.00%</span>
                <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">SEQ_STABILITY: 100%</span>
              </div>
            </div>
          </AetherPanel>
        </motion.div>

        {/* ORDER LIFECYCLE SIDEBAR */}
        <AnimatePresence mode="wait">
          {selectedOrder ? (
            <motion.div
              key={selectedOrder.orderid}
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 340 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              className="hidden xl:flex flex-col h-full"
            >
              <AetherPanel className="flex-1 flex flex-col p-0 border-white/10 bg-black/60 relative overflow-hidden">
                <div className="noise-overlay pointer-events-none opacity-[0.03]" />

                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-primary/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black font-mono text-primary uppercase tracking-tighter">ORDER_{String(selectedOrder.orderid || '').substring(0,12)}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">LIFECYCLE_FORENSICS</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/5 text-muted-foreground/40"
                    onClick={() => setSelectedOrder(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Detailed Specs */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[8px] font-mono font-black uppercase tracking-widest border-b border-white/5 pb-2">
                       <span className="text-muted-foreground/40">SPECIFICATION_MATRIX</span>
                       <span className="text-secondary opacity-40">ENFORCED</span>
                    </div>

                    {[
                      { label: "INSTRUMENT", value: selectedOrder.symbol },
                      { label: "ORDER_TYPE", value: selectedOrder.pricetype },
                      { label: "PRODUCT", value: selectedOrder.product },
                      { label: "SIDE", value: selectedOrder.action, color: selectedOrder.action === 'BUY' ? "text-emerald-500" : "text-rose-500" },
                      { label: "LIMIT_PRICE", value: `₹${selectedOrder.price.toFixed(2)}` },
                      { label: "TRIGGER_PX", value: `₹${selectedOrder.trigger_price.toFixed(2)}` },
                      { label: "TIMESTAMP", value: new Date(selectedOrder.timestamp).toLocaleTimeString() }
                    ].map(spec => (
                      <div key={spec.label} className="flex items-center justify-between text-[9px] font-mono">
                         <span className="text-muted-foreground/60 tracking-widest">{spec.label}</span>
                         <span className={cn("font-black tracking-tighter italic", spec.color || "text-foreground")}>{spec.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Lifecycle Timeline */}
                  <div className="space-y-4">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/40 mb-4">LIFECYCLE_TIMELINE</div>
                    <div className="space-y-4 relative border-l border-white/5 ml-2 pl-4">
                       <div className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                          <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Order_Placed</div>
                          <div className="text-[7px] text-muted-foreground/40 font-mono mt-0.5">PROTOCOL_HANDSHAKE_INITIALIZED</div>
                       </div>
                       <div className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
                          <div className="text-[9px] font-black text-primary uppercase tracking-widest">Broker_Validation</div>
                          <div className="text-[7px] text-muted-foreground/40 font-mono mt-0.5">INTEGRITY_CHECK_PASSED [API_KEY_0x1]</div>
                       </div>
                       <div className="relative opacity-40">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white/10" />
                          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Execution_Handoff</div>
                          <div className="text-[7px] text-muted-foreground/20 font-mono mt-0.5">WAITING_FOR_EXCHANGE_ACK</div>
                       </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!['complete', 'cancelled', 'rejected'].includes(selectedOrder.order_status.toLowerCase()) && (
                    <div className="pt-6">
                       <Button
                          variant="destructive"
                          className="w-full h-12 bg-rose-500/10 border border-rose-500/40 text-rose-500 font-black tracking-[0.2em] font-mono text-[10px] group transition-all hover:bg-rose-500 hover:text-white"
                          onClick={() => handleCancelOrder(selectedOrder.orderid)}
                          disabled={isProcessing === selectedOrder.orderid}
                        >
                          {isProcessing === selectedOrder.orderid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                              ABORT_TRANSACTION
                            </>
                          )}
                       </Button>
                    </div>
                  )}
                </div>

                {/* Footer Depth Visualization (Aesthetic) */}
                <div className="h-12 bg-black/40 border-t border-white/5 p-2 flex items-center gap-1 overflow-hidden opacity-20 hover:opacity-100 transition-opacity">
                   {Array.from({length: 20}).map((_, i) => (
                     <div
                        key={i}
                        className="flex-1 bg-primary/20 rounded-[1px]"
                        style={{ height: `${Math.random() * 100}%` }}
                     />
                   ))}
                </div>
              </AetherPanel>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 340 }}
              exit={{ opacity: 0, width: 0 }}
              className="hidden xl:flex flex-col h-full border border-white/5 bg-black/20 justify-center items-center p-8 text-center"
            >
               <Settings2 className="w-12 h-12 text-white/5 mb-6 opacity-20" />
               <span className="text-[10px] font-black font-mono text-muted-foreground/20 tracking-widest uppercase">Select_Order_For_Forensics</span>
               <div className="mt-4 w-12 h-[1px] bg-white/5" />
               <p className="mt-4 text-[8px] font-mono text-muted-foreground/10 italic uppercase leading-relaxed tracking-widest font-bold">
                 Initialize diagnostic lifecycle monitor by selecting an active queue entry.
               </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
