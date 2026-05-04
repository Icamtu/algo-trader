import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trash2,
  ChevronRight,
  Terminal as TerminalIcon,
  AlertCircle,
  Activity,
  Bug,
  LayoutGrid,
  ListChecks
} from 'lucide-react';
import { useTerminalStore, LogLevel } from '@/features/explorer/stores/terminalStore';
import { cn } from '@/lib/utils';
import { OrderBookBento } from '@/components/trading/OrderBookBento';
import { tradingService } from '@/services/tradingService';

const getLevelColor = (level: LogLevel) => {
  switch (level) {
    case 'SYSTEM': return 'text-blue-500';
    case 'EXEC': return 'text-teal-400';
    case 'WARN': return 'text-amber-500';
    case 'ERROR': return 'text-rose-500';
    default: return 'text-slate-400';
  }
};

export const AetherTerminal: React.FC = () => {
  const { logs, activeTab, setActiveTab, clearLogs } = useTerminalStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = React.useState<any[]>([]);

  const tabs = [
    { name: 'Terminal', icon: TerminalIcon },
    { name: 'Orders', icon: ListChecks },
    { name: 'Problems', icon: AlertCircle },
    { name: 'Output', icon: Activity },
    { name: 'Debug Console', icon: Bug }
  ];

  const fetchOrders = async () => {
    try {
      const apiKey = await tradingService.getApiKey();
      if (apiKey) {
        const res = await tradingService.getOrders(apiKey);
        const data = res?.data || res;
        const ordersList = Array.isArray(data?.orders) ? data.orders : (Array.isArray(data) ? data : []);
        setOrders(ordersList);
      }
    } catch (err) {
      console.error("[AetherTerminal] Fetch error:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'Orders') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (scrollRef.current && activeTab !== 'Orders') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

    const [inputValue, setInputValue] = React.useState('');
    const { executeCommand } = useTerminalStore();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            executeCommand(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <div className="h-64 border-t border-white/5 bg-[#020617] flex flex-col relative z-20 overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
            {/* Header Tabs */}
            <div className="h-9 px-4 flex items-center justify-between border-b border-white/[0.03] bg-black/40 backdrop-blur-md">
                <div className="flex gap-6 items-center h-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={cn(
                                "h-full flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.15em] transition-all relative group",
                                activeTab === tab.name
                                    ? "text-primary border-b border-primary shadow-[inset_0_-8px_12px_-8px_rgba(37,99,235,0.3)]"
                                    : "text-muted-foreground/30 hover:text-muted-foreground/60"
                            )}
                        >
                            <tab.icon className={cn("w-3 h-3", activeTab === tab.name ? "text-primary" : "text-muted-foreground/20")} />
                            {tab.name}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={clearLogs}
                        className="p-1 hover:bg-white/5 rounded-sm transition-all group"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-rose-500/60" />
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded-sm transition-all group">
                        <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary/60" />
                    </button>
                    <div className="w-[1px] h-3 bg-white/10 mx-1" />
                    <button className="p-1 hover:bg-white/5 rounded-sm transition-all">
                        <X className="w-3.5 h-3.5 text-muted-foreground/20" />
                    </button>
                </div>
            </div>

            {/* Log Content / Orders View */}
            <div
                ref={scrollRef}
                className="flex-1 font-mono text-[11px] overflow-hidden custom-scrollbar bg-black/20"
            >
                {activeTab === 'Orders' ? (
                  <OrderBookBento
                    orders={orders}
                    className="h-full border-none shadow-none bg-transparent rounded-none"
                    onAbort={(id) => tradingService.cancelOrder(id).then(() => fetchOrders())}
                    onAbortAll={() => {
                        const pending = orders.filter(o => !['complete', 'cancelled', 'rejected'].includes(o.order_status?.toLowerCase()));
                        Promise.all(pending.map(o => tradingService.cancelOrder(o.orderid))).then(() => fetchOrders());
                    }}
                  />
                ) : (
                  <div className="p-4 space-y-1.5 h-full overflow-y-auto">
                    <AnimatePresence initial={false}>
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-4 group/log py-0.5"
                            >
                                <span className={cn("shrink-0 font-bold tracking-wider w-16", getLevelColor(log.level))}>
                                    [{log.level}]
                                </span>
                                <span className="text-slate-300 leading-relaxed group-hover:text-white transition-colors">
                                    {log.message}
                                </span>
                                <span className="ml-auto opacity-0 group-hover:opacity-100 text-[9px] text-muted-foreground/20 transition-opacity">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>
                )}
            </div>

            {/* Input Line */}
            {activeTab !== 'Orders' && (
              <div className="h-8 border-t border-white/[0.02] bg-black/40 px-4 flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-3 h-3 text-primary animate-pulse" />
                  <input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="EXECUTE_KERNEL_COMMAND..."
                      className="bg-transparent border-none outline-none text-[10px] font-mono text-primary placeholder:text-muted-foreground/10 w-full focus:ring-0"
                  />
              </div>
            )}
        </div>
    );
};
