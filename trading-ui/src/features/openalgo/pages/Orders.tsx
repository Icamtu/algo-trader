import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { useOrders, useCancelOrder } from "../hooks/useTrading";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { 
  ClipboardList, 
  Search, 
  Download, 
  RefreshCw, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  X
} from "lucide-react";
import { format } from "date-fns";

export default function Orders() {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const { data: ordersData, isLoading, refetch, isFetching } = useOrders();
  const cancelOrder = useCancelOrder();
  const [filter, setFilter] = useState("");

  const filteredOrders = ordersData?.trades?.filter((order: any) => 
    order.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    (order.strategy && order.strategy.toLowerCase().includes(filter.toLowerCase())) ||
    (order.order_id && order.order_id.toLowerCase().includes(filter.toLowerCase()))
  ) || [];

  const stats = {
    total: filteredOrders.length,
    filled: filteredOrders.filter((o: any) => o.status === "filled").length,
    pending: filteredOrders.filter((o: any) => o.status === "pending").length,
    rejected: filteredOrders.filter((o: any) => o.status === "rejected").length,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/orders" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border/20">
          {/* Header Section */}
          <div className="p-4 border-b border-border/20 bg-card/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-sm">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-primary">Order_Protocol_v4</h1>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Centralized_Order_Management_System</p>
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
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border/20 bg-background/50 text-[9px] font-mono font-black uppercase tracking-widest hover:border-primary/30 transition-all">
                  <Download className="w-3 h-3" />
                  Export_CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard label="Total_Execution" value={stats.total} color="text-foreground" />
              <StatCard label="Filled_Success" value={stats.filled} color="text-secondary" />
              <StatCard label="Active_Pending" value={stats.pending} color="text-primary" />
              <StatCard label="Fault_Rejected" value={stats.rejected} color="text-destructive" />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input 
                type="text"
                placeholder="SEARCH_BY_SYMBOL_OR_STRATEGY_OR_ID..."
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
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Timestamp</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Strategy</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Symbol</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Side</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Qty</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Price</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Status</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Execution_ID</th>
                  <th className="px-4 py-3 text-[8px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                <AnimatePresence mode="popLayout">
                  {filteredOrders.map((order: any) => (
                    <motion.tr 
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-primary/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.timestamp), "HH:mm:ss")}
                        </div>
                        <div className="text-[8px] font-mono text-muted-foreground/40">
                          {format(new Date(order.timestamp), "yyyy-MM-dd")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 border border-primary/10 bg-primary/5 text-[9px] font-mono font-black text-primary uppercase">
                          {order.strategy || 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-black font-mono text-foreground uppercase tracking-wider">
                          {order.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black font-mono uppercase ${order.side === "BUY" ? "text-secondary" : "text-destructive"}`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold">
                        {order.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <IndustrialValue value={order.price} prefix="₹" className="text-[10px] font-mono font-black" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[8px] text-muted-foreground/40 uppercase tracking-tighter">
                        {order.order_id || '---'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                           {order.status === "pending" && (
                             <button 
                               onClick={() => cancelOrder.mutate(order.order_id)}
                               className="p-1.5 hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                               title="CANCEL_ORDER"
                             >
                               <X className="w-3 h-3" />
                             </button>
                           )}
                           <button className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all border border-transparent hover:border-primary/20">
                             <MoreVertical className="w-3 h-3" />
                           </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-[10px] font-mono font-black text-primary uppercase tracking-[0.2em]">SYNCING_DATA_RECORDS...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <ClipboardList className="w-8 h-8 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-[0.2em]">NO_ORDER_RECORDS_FOUND</span>
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

      <NewOrderModal 
        isOpen={orderModalOpen} 
        onClose={() => setOrderModalOpen(false)} 
        prefilledSymbol={prefilledSymbol} 
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 border border-border/10 bg-card/5 industrial-glint relative overflow-hidden group">
      <div className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-black font-mono ${color}`}>{value.toLocaleString()}</div>
      <div className="absolute right-2 bottom-2 w-1 h-1 rounded-full bg-primary/20 group-hover:bg-primary group-hover:animate-ping transition-all" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    filled: { color: "text-secondary border-secondary/20 bg-secondary/5", icon: CheckCircle2, label: "COMPLETED" },
    pending: { color: "text-primary border-primary/20 bg-primary/5", icon: Clock, label: "ACTIVE" },
    rejected: { color: "text-destructive border-destructive/20 bg-destructive/5", icon: XCircle, label: "REJECTED" },
    blocked: { color: "text-muted-foreground border-border/20 bg-muted/5", icon: AlertCircle, label: "BLOCKED" },
  };

  const config = configs[status] || configs.blocked;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${config.color} rounded-sm`}>
      <Icon className="w-2.5 h-2.5" />
      <span className="text-[8px] font-mono font-black uppercase tracking-widest">
        {config.label}
      </span>
    </div>
  );
}
