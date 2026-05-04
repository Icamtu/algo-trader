import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Clock, ShieldAlert, ListChecks, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { IndustrialValue } from '@/components/trading/IndustrialValue';
import { Badge } from '@/components/ui/badge';

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

interface OrderBookBentoProps {
  orders: Order[];
  className?: string;
  onAbort?: (id: string) => void;
  onAbortAll?: () => void;
}

export const OrderBookBento: React.FC<OrderBookBentoProps> = ({ orders: rawOrders, className, onAbort, onAbortAll }) => {
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const pendingOrders = orders.filter(o =>
    !['complete', 'cancelled', 'rejected'].includes(o.order_status?.toLowerCase())
  );

  return (
    <AetherPanel className={cn("flex flex-col h-full bg-slate-900 border-slate-800 shadow-xl overflow-hidden", className)}>
      <div className="px-4 py-3 bg-slate-950/50 flex justify-between items-center border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-xs uppercase tracking-widest text-white">LIVE_ORDER_BOOK</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono font-medium text-slate-500 tracking-widest">PENDING: {pendingOrders.length}</span>
          {onAbortAll && pendingOrders.length > 0 && (
            <button
              onClick={onAbortAll}
              className="text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-tighter transition-colors"
            >
              ABORT_ALL
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 opacity-20">
            <Clock className="w-8 h-8 mb-2" />
            <span className="text-[10px] font-mono tracking-widest uppercase">No Active Orders</span>
          </div>
        ) : (
          <table className="w-full text-left text-[10px] border-collapse">
            <thead className="sticky top-0 bg-slate-900 z-10 text-slate-500 font-mono border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 font-medium tracking-widest">SYMBOL</th>
                <th className="px-3 py-2 font-medium tracking-widest">SIDE</th>
                <th className="px-3 py-2 text-right font-medium tracking-widest">PRICE</th>
                <th className="px-3 py-2 text-center font-medium tracking-widest">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {orders.slice(0, 50).map((order) => {
                const isPending = !['complete', 'cancelled', 'rejected'].includes(order.order_status?.toLowerCase());
                return (
                  <motion.tr
                    key={order.orderid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "group hover:bg-slate-800/30 transition-colors",
                      order.action === 'BUY' ? "hover:bg-emerald-500/5" : "hover:bg-rose-500/5"
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 uppercase tracking-tighter">{order.symbol}</span>
                        <span className="text-[8px] text-slate-500 font-mono italic">{String(order.orderid || '').substring(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {order.action === 'BUY' ? (
                          <ArrowUpRight className="w-2.5 h-2.5 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-2.5 h-2.5 text-rose-500" />
                        )}
                        <span className={cn(
                          "font-black tracking-widest text-[9px]",
                          order.action === 'BUY' ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {order.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <IndustrialValue
                        value={order.price}
                        className="text-[10px] font-bold tabular-nums text-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          "uppercase text-[8px] font-black tracking-widest",
                          order.order_status?.toLowerCase() === 'complete' ? "text-emerald-500" :
                          order.order_status?.toLowerCase() === 'rejected' ? "text-rose-500" :
                          order.order_status?.toLowerCase() === 'cancelled' ? "text-slate-600" :
                          "text-amber-500 animate-pulse"
                        )}>
                          {order.order_status}
                        </span>
                        {isPending && onAbort && (
                          <button
                            onClick={() => onAbort(order.orderid)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[7px] text-rose-500 underline uppercase font-black"
                          >
                            ABORT
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Decorative Matrix Footer */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent shrink-0" />
    </AetherPanel>
  );
};
