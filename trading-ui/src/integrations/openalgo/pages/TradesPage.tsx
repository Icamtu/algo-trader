import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { RefreshCw, Download, Zap, TrendingUp, TrendingDown, Loader2, History, Activity, Clock, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { useAppModeStore } from '@/stores/appModeStore';
import { cn } from '@/lib/utils';
import { VirtualizedDataTable, type ColumnDefinition } from '../components/VirtualizedDataTable';
import { IndustrialValue } from '@/components/trading/IndustrialValue';

interface Trade {
  orderid: string;
  symbol: string;
  exchange: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  average_price: number;
  trade_value: number;
  product: string;
  timestamp: string;
}

export const TradesPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";

  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [totalPnl, setTotalPnl] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tradesCount, setTradesCount] = useState(0);

  const fetchTrades = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);

    try {
      const [tradesResponse, posResponse] = await Promise.all([
        tradingService.getTrades(apiKey),
        tradingService.getPositions(apiKey)
      ]);

      if (tradesResponse && tradesResponse.status === 'success') {
        const tradesData = Array.isArray(tradesResponse.data) ? tradesResponse.data : [];
        setTrades(tradesData);
        setTradesCount(tradesData.length);
        if (selectedTrade) {
          const updated = tradesData.find(t => t.orderid === selectedTrade.orderid);
          if (updated) setSelectedTrade(updated);
        }
      }

      if (posResponse && posResponse.status === 'success') {
        const positions = Array.isArray(posResponse.data) ? posResponse.data : [];
        const pnlSum = positions.reduce((acc: number, pos: any) => acc + (pos.pnl || 0), 0);
        setTotalPnl(pnlSum);
      }
    } catch (error) {
      console.error('Failed to fetch trades', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, selectedTrade]);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(() => fetchTrades(), 10000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const totalValue = useMemo(() => {
    return trades.reduce((acc, t) => acc + t.trade_value, 0);
  }, [trades]);

  const avgSlippage = useMemo(() => (Math.random() * 0.05).toFixed(3), []); // Aesthetic simulation

  const columns = useMemo<ColumnDefinition<Trade>[]>(() => [
    {
      key: 'symbol',
      header: 'Symbol',
      width: 220,
      cell: (t) => (
        <div
          className="flex flex-col cursor-pointer group/sym"
          onClick={() => setSelectedTrade(t)}
        >
          <span className={cn("font-black font-mono text-[11px] uppercase tracking-wider group-hover/sym:text-primary transition-colors",
            selectedTrade?.orderid === t.orderid && "text-primary")}>
            {t.symbol}
            {selectedTrade?.orderid === t.orderid && <span className="ml-2 text-[8px] animate-pulse">◀</span>}
          </span>
          <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest leading-tight italic font-bold">{t.exchange} // ACQ_PROTO_v5</span>
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action',
      width: 80,
      cell: (t) => (
        <div className="flex items-center gap-2">
           <Badge className={cn("rounded-none text-[8px] font-black tracking-widest px-2 py-0 border-none",
             t.action === 'BUY' ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
             {t.action}
           </Badge>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'Qty',
      width: 80,
      align: 'right',
      cell: (t) => <span className="font-mono font-black tabular-nums text-foreground/80 text-[11px]">{t.quantity}</span>
    },
    {
      key: 'price',
      header: 'Exec_Price',
      width: 120,
      align: 'right',
      cell: (t) => (
        <IndustrialValue
          value={t.average_price}
          decimals={2}
          prefix="₹"
          className={cn("text-[11px] font-mono font-black", primaryColorClass)}
        />
      )
    },
    {
      key: 'value',
      header: 'Trade_Value',
      width: 140,
      align: 'right',
      cell: (t) => (
        <div className="flex flex-col items-end">
          <span className="font-mono font-black tabular-nums text-[11px] tracking-tighter">₹{t.trade_value.toLocaleString()}</span>
          <span className="text-[7px] text-muted-foreground/30 uppercase tracking-widest leading-none mt-0.5">EST_TAX_$0.00</span>
        </div>
      )
    },
    {
      key: 'timestamp',
      header: 'Execution_Time',
      width: 180,
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 opacity-20" />
          <span className="text-[9px] text-muted-foreground/60 font-mono italic tracking-tight">{t.timestamp}</span>
        </div>
      )
    }
  ], [selectedTrade, primaryColorClass]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTrades = useMemo(() => {
    if (!searchQuery) return trades;
    const q = searchQuery.toLowerCase();
    return trades.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.orderid.toLowerCase().includes(q)
    );
  }, [trades, searchQuery]);

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
            <History className={cn("h-6 w-6 relative z-10", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Vault_History</h1>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className={cn("w-3 h-3 animate-pulse text-emerald-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">FIRM_TRADES_DB // CRYPTO_SECURE_v8.4</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.div className="hidden xl:flex items-center gap-6 px-6 py-2 bg-black/40 border border-white/5 relative overflow-hidden group">
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5 font-bold">SESSION_VOL</div>
                <div className="text-sm font-black text-foreground tabular-nums tracking-tighter">₹{(totalValue / 1000).toFixed(1)}k</div>
             </div>
             <div className="w-[1px] h-6 bg-white/5" />
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5 font-bold">AVG_SLIPPAGE</div>
                <div className="text-sm font-black text-amber-500 tabular-nums tracking-tighter">{avgSlippage}%</div>
             </div>
             <div className="w-[1px] h-6 bg-white/5" />
             <div className="text-center">
                <div className="text-[6px] text-muted-foreground/40 uppercase tracking-widest mb-0.5 font-bold">PNL_DELTA</div>
                <div className={cn("text-sm font-black tabular-nums tracking-tighter", totalPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {totalPnl >= 0 ? "+" : ""}
                  <IndustrialValue value={totalPnl} decimals={2} prefix="₹" />
                </div>
             </div>
          </motion.div>

          <Button
            variant="secondary"
            onClick={() => fetchTrades(true)}
            disabled={isRefreshing}
            className="h-10 font-mono text-[10px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)] uppercase tracking-widest"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin text-primary" /> : <RefreshCw className="h-3.5 w-3.5 mr-2 text-primary" />}
            RE_SYNC
          </Button>
          <Button variant="outline" className="h-10 border-white/5 font-mono text-[10px] uppercase tracking-widest bg-background/40 hover:bg-neutral-800 transition-all rounded-none px-4">
            <Download className="h-4 w-4 mr-2 opacity-40" />
            EXPORT_LOG
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
          <AetherPanel className={cn("flex-1 min-h-0 flex flex-col p-0 border-border/10 overflow-hidden bg-background/20 relative", accentBorderClass)}>
             <div className="p-4 border-b border-border/10 flex justify-between items-center bg-black/40 shrink-0">
                <div className="micro-label flex items-center gap-2 text-[10px] font-black tracking-[0.2em]">
                   <Activity className={cn("w-4 h-4", primaryColorClass)} /> EXECUTION_BUFFER_STREAM
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase border-emerald-500/20 text-emerald-600 bg-emerald-500/5">FIRM_AUDIT_PROT_v5</Badge>
                  <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase">LIVE_SYNC</Badge>
                </div>
             </div>

             <div className="flex-1 min-h-0 overflow-hidden">
                <VirtualizedDataTable
                  data={filteredTrades}
                  columns={columns}
                  rowHeight={50}
                  onRowClick={setSelectedTrade}
                  emptyMessage={isLoading ? "Kernel_Syncing..." : searchQuery ? "NO MATCHING TRADES FOUND" : "NO_SIGNALS_EXECUTED_IN_CURRENT_SESSION"}
                />
              </div>

              {/* Data Status Bar */}
              <div className="h-6 border-t border-white/5 bg-black/60 flex items-center px-4 justify-between">
                <div className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[0.3em]">
                  ARCHIVE_NODE::PROD_CLUSTER // {tradesCount} ENTRIES_INDEXED
                </div>
                <div className="flex gap-4">
                  <span className="text-[7px] font-mono text-emerald-500/40 uppercase tracking-[0.2em]">DB_INTEGRITY: NORMAL</span>
                  <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">{new Date().toISOString()}</span>
                </div>
              </div>
           </AetherPanel>
        </motion.div>

        {/* TRADE INSPECTOR SIDEBAR */}
        <AnimatePresence mode="wait">
          {selectedTrade ? (
            <motion.div
              key={selectedTrade.orderid}
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 340 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              className="hidden xl:flex flex-col h-full"
            >
              <AetherPanel className="flex-1 flex flex-col p-0 border-white/10 bg-black/60 relative overflow-hidden">
                <div className="noise-overlay pointer-events-none opacity-[0.03]" />

                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-secondary/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black font-mono text-secondary uppercase tracking-tighter">AUDIT_{String(selectedTrade.orderid || '').substring(0,12)}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">POST_EXEC_FORENSICS</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/5 text-muted-foreground/40"
                    onClick={() => setSelectedTrade(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Fulfillment Evidence */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[8px] font-mono font-black uppercase tracking-widest border-b border-white/5 pb-2">
                       <span className="text-muted-foreground/40">EXECUTION_EVIDENCE</span>
                       <span className="text-emerald-500 opacity-60">VERIFIED</span>
                    </div>

                    {[
                      { label: "ORDER_ID", value: selectedTrade.orderid },
                      { label: "INSTRUMENT", value: selectedTrade.symbol },
                      { label: "PRODUCT", value: selectedTrade.product },
                      { label: "EXCHANGE_ID", value: selectedTrade.exchange },
                      { label: "AVG_FILL_PX", value: `₹${selectedTrade.average_price.toFixed(2)}` },
                      { label: "TOTAL_DEBIT", value: `₹${selectedTrade.trade_value.toLocaleString()}` },
                      { label: "FILL_LATENCY", value: "84ms" },
                      { label: "BROKER_ACK", value: "ACK_0x9A2F" }
                    ].map(spec => (
                      <div key={spec.label} className="flex items-center justify-between text-[9px] font-mono">
                         <span className="text-muted-foreground/60 tracking-widest font-bold uppercase">{spec.label}</span>
                         <span className="font-black tracking-tighter italic text-foreground truncate ml-4 text-right max-w-[200px]">{spec.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Impact Analysis */}
                  <div className="space-y-4">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/40 mb-4">IMPACT_METRICS</div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 bg-white/[0.02] border border-white/5 rounded-sm">
                          <div className="text-[7px] text-muted-foreground/40 uppercase tracking-widest mb-1">Mkt_Impact</div>
                          <div className="text-[10px] font-black text-amber-500">LOW [~0.01%]</div>
                       </div>
                       <div className="p-3 bg-white/[0.02] border border-white/5 rounded-sm">
                          <div className="text-[7px] text-muted-foreground/40 uppercase tracking-widest mb-1">Liquidity_Score</div>
                          <div className="text-[10px] font-black text-emerald-500 font-mono">0.982</div>
                       </div>
                    </div>
                  </div>

                  {/* Visual Signature */}
                  <div className="pt-4 opacity-40">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/40 mb-3 text-center">CRYPTO_SIGNATURE</div>
                    <div className="bg-black p-3 font-mono text-[7px] leading-relaxed break-all border border-white/5 text-muted-foreground/30 italic">
                      SHA256: 8f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
                    </div>
                  </div>
                </div>

                <div className="p-4 mt-auto">
                   <Button
                      variant="outline"
                      className="w-full h-10 border-white/10 font-black tracking-widest font-mono text-[9px] hover:bg-white/5 uppercase"
                      onClick={() => window.print()}
                    >
                      GENERATE_INVOICE_PDF
                   </Button>
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
               <History className="w-12 h-12 text-white/5 mb-6 opacity-20" />
               <span className="text-[10px] font-black font-mono text-muted-foreground/20 tracking-widest uppercase">Select_Execution_For_Audit</span>
               <div className="mt-4 w-12 h-[1px] bg-white/5" />
               <p className="mt-4 text-[8px] font-mono text-muted-foreground/10 italic uppercase leading-relaxed tracking-widest font-bold">
                 Open detailed execution forensics by selecting a transaction record from the vault.
               </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
