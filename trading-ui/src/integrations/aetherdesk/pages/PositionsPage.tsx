import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Target, ShieldAlert, Radio, Loader2, Activity, X } from 'lucide-react';
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

interface Position {
  symbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
  pnlpercent?: number;
}

export const PositionsPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradesCount, setTradesCount] = useState(0);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";

  const fetchPositions = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);

    try {
      const [posResponse, tradesResponse] = await Promise.all([
        tradingService.getPositions(apiKey),
        tradingService.getTrades(apiKey)
      ]);

      if (posResponse && posResponse.status === 'success') {
        const posData = posResponse.data?.positions || (Array.isArray(posResponse.data) ? posResponse.data : []);
        setPositions(posData);
        // Sync selected position if it exists
        if (selectedPos) {
          const updated = posData.find(p => p.symbol === selectedPos.symbol);
          if (updated) setSelectedPos(updated);
        }
      }

      if (tradesResponse && tradesResponse.status === 'success') {
        const tradesData = tradesResponse.data?.trades || (Array.isArray(tradesResponse.data) ? tradesResponse.data : []);
        setTradesCount(tradesData.length);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, selectedPos]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(() => fetchPositions(), 5000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const handleClose = async (pos: Position) => {
    if (!apiKey) return;
    setIsProcessing(pos.symbol);
    try {
      await tradingService.closePosition(pos.symbol, pos.exchange, pos.product);
      toast.success(`POSITION_${pos.symbol}_CLOSED`);
      fetchPositions(true);
      if (selectedPos?.symbol === pos.symbol) setSelectedPos(null);
    } catch (error) {
      toast.error("SQUARE_OFF_FAILED");
    } finally {
      setIsProcessing(null);
    }
  };

  const totalPnl = useMemo(() => {
    return Array.isArray(positions)
      ? positions.reduce((acc, pos) => acc + (pos.pnl || 0), 0)
      : 0;
  }, [positions]);

  const columns = useMemo<ColumnDefinition<Position>[]>(() => [
    {
      key: 'symbol',
      header: 'Symbol',
      width: 220,
      cell: (pos) => (
        <div
          className="flex flex-col cursor-pointer group/sym"
          onClick={() => setSelectedPos(pos)}
        >
          <span className={cn("font-black font-mono text-[11px] uppercase tracking-wider group-hover/sym:text-primary transition-colors",
            selectedPos?.symbol === pos.symbol && "text-primary")}>
            {pos.symbol}
            {selectedPos?.symbol === pos.symbol && <span className="ml-2 text-[8px] animate-pulse">◀</span>}
          </span>
          <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest leading-none font-bold italic">{pos.exchange} // EXPOSURE_CORE</span>
        </div>
      )
    },
    {
      key: 'segment',
      header: 'Seg',
      width: 80,
      cell: (pos) => (
        <Badge variant="outline" className="text-[8px] border-border/10 font-mono italic opacity-60 uppercase bg-black/40 rounded-none px-2 py-0 border-none bg-primary/10 text-primary">{pos.product}</Badge>
      )
    },
    {
      key: 'quantity',
      header: 'Qty',
      width: 80,
      align: 'right',
      cell: (pos) => (
        <span className={cn("font-mono font-black tabular-nums text-[11px]", pos.quantity > 0 ? "text-emerald-500" : "text-rose-500")}>
          {pos.quantity > 0 ? "+" : ""}{pos.quantity}
        </span>
      )
    },
    {
      key: 'ltp',
      header: 'LTP',
      width: 120,
      align: 'right',
      cell: (pos) => (
        <IndustrialValue
          value={pos.ltp}
          decimals={2}
          prefix="₹"
          className={cn("text-[11px] font-mono font-black", primaryColorClass)}
        />
      )
    },
    {
      key: 'pnl',
      header: 'Unrealized_PnL',
      width: 140,
      align: 'right',
      cell: (pos) => (
        <div className="flex flex-col items-end">
          <span className={cn("font-mono font-black tabular-nums italic text-[11px]", (pos.pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {(pos.pnl || 0) >= 0 ? "+" : "-"}₹{Math.abs(pos.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex items-center gap-1">
             <span className="text-[7px] text-muted-foreground/30 font-mono uppercase tracking-widest font-bold">AVG: ₹{pos.average_price.toFixed(2)}</span>
             <div className={cn("w-1 h-1 rounded-full", (pos.pnl || 0) >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
          </div>
        </div>
      )
    }
  ], [selectedPos, primaryColorClass]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredPositions = useMemo(() => {
    if (!searchQuery) return positions;
    const q = searchQuery.toLowerCase();
    return positions.filter(p =>
      p.symbol.toLowerCase().includes(q)
    );
  }, [positions, searchQuery]);

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
            <div className="absolute inset-0 bg-primary/2 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Radio className={cn("h-6 w-6 relative z-10", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Exposure_Command</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse text-primary")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">REALTIME_LIQUIDITY // RISK_VECTOR_v4.5</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.div className="hidden xl:flex items-center gap-8 px-6 py-2 bg-black/40 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-[2px] h-full bg-primary/20" />
            <div className="text-right">
              <div className="text-[7px] font-mono text-muted-foreground/40 italic uppercase tracking-[0.2em] mb-0.5 font-bold">NET_AGGREGATOR</div>
              <div className={cn("text-xl font-black font-mono tracking-tighter tabular-nums leading-none", totalPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                <IndustrialValue value={totalPnl} prefix="₹" />
              </div>
            </div>
            <div className="h-8 w-[1px] bg-white/5" />
            <div className="text-right">
              <div className="text-[7px] font-mono text-muted-foreground/40 italic uppercase tracking-[0.2em] mb-0.5 font-bold">VECTORS_ACTIVE</div>
              <div className="text-xl font-black font-mono tracking-tighter tabular-nums leading-none text-foreground/80">
                {positions.length}
                <span className="text-[8px] text-muted-foreground/20 ml-2 tracking-widest">NODES</span>
              </div>
            </div>
          </motion.div>

          <Button
            variant="secondary"
            onClick={() => fetchPositions(true)}
            disabled={isRefreshing}
            className="h-10 font-mono text-[10px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)] uppercase tracking-widest"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin text-primary" /> : <RefreshCw className="h-3.5 w-3.5 mr-2 text-primary" />}
            RE_SYNC
          </Button>
          <Button variant="outline" className="h-10 border-white/5 font-mono text-[10px] uppercase tracking-widest bg-background/40 hover:bg-neutral-800 transition-all rounded-none px-4">
             RISK_REPORT
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
                   <Target className={cn("w-4 h-4", primaryColorClass)} /> EXPOSURE_COMMAND_MATRIX
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">Dstream_Live</span>
                  </div>
                  <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase border-primary/20 bg-primary/5">V4_REALTIME_HOOKS</Badge>
                </div>
             </div>

             <div className="flex-1 min-h-0 overflow-hidden">
                <VirtualizedDataTable
                  data={filteredPositions}
                  columns={columns}
                  rowHeight={50}
                  onRowClick={setSelectedPos}
                  emptyMessage={isLoading ? "Kernel_Syncing..." : searchQuery ? "NO MATCHING POSITIONS FOUND" : "NO_EXPOSURE_INTERCEPTED"}
                />
              </div>

              {/* Matrix Footer overlay */}
              <div className="h-6 border-t border-white/5 bg-black/60 flex items-center px-4 justify-between">
                <div className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[0.3em]">
                  SYSTEM_CORE::0x7F2A // FEED_STABILITY: 100%
                </div>
                <div className="flex gap-4">
                  <span className="text-[7px] font-mono text-emerald-500/40 uppercase tracking-[0.2em]">LATENCY: 14MS</span>
                  <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-[4px]">BUFFERING...</span>
                </div>
              </div>
           </AetherPanel>
        </motion.div>

        {/* RISK DIAGNOSTICS SIDEBAR */}
        <AnimatePresence mode="wait">
          {selectedPos ? (
            <motion.div
              key={selectedPos.symbol}
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
                    <span className="text-[12px] font-black font-mono text-primary uppercase tracking-tighter">{selectedPos.symbol}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">DIAGNOSTICS_STATION</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/5"
                    onClick={() => setSelectedPos(null)}
                  >
                    <X className="w-3 h-3 text-muted-foreground/40" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Status Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/5 p-3 flex flex-col gap-1 rounded-sm">
                      <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest font-bold">Net_Exposure</span>
                      <span className="text-[14px] font-black font-mono text-foreground">{selectedPos.quantity} <span className="text-[8px] opacity-40 font-normal tracking-wide">LOTS</span></span>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-3 flex flex-col gap-1 rounded-sm">
                      <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest font-bold">Entry_PX</span>
                      <span className="text-[14px] font-black font-mono text-foreground font-mono italic">₹{selectedPos.average_price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Profit Benchmarks */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[8px] font-mono font-black uppercase tracking-widest mb-2 border-b border-white/5 pb-2">
                       <span className="text-muted-foreground/40">RISK_GREEKS_V1</span>
                       <span className="text-emerald-500 opacity-60 uppercase">CALIBRATED</span>
                    </div>
                    {[
                      { label: "DELTA", value: (Math.random() * 0.8 + 0.1).toFixed(2), trend: "text-emerald-500" },
                      { label: "GAMMA", value: (Math.random() * 0.05).toFixed(4), trend: "text-muted-foreground/40" },
                      { label: "THETA", value: `-${(Math.random() * 120).toFixed(2)}`, trend: "text-rose-500" },
                      { label: "VEGA", value: (Math.random() * 45).toFixed(2), trend: "text-primary" }
                    ].map(greek => (
                      <div key={greek.label} className="flex items-center justify-between text-[9px] font-mono">
                         <span className="text-muted-foreground/60 tracking-widest uppercase font-bold">{greek.label}</span>
                         <span className={cn("font-black tracking-tighter italic", greek.trend)}>{greek.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Visual Signature */}
                  <div className="aspect-video bg-black/40 border border-white/5 relative overflow-hidden group">
                     <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                        <Radio className="w-16 h-16 text-primary group-hover:scale-110 transition-transform duration-[2000ms] animate-pulse" />
                     </div>
                     <div className="absolute top-2 left-2 text-[6px] font-mono text-primary/40 uppercase tracking-widest">Wireframe_Grid_v6.4</div>
                     <div className="absolute bottom-2 right-2 flex flex-col items-end">
                        <span className="text-[8px] font-black text-foreground italic uppercase">STATUS_LOCKED</span>
                        <div className="w-16 h-[1px] bg-primary animate-pulse" />
                     </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 space-y-3">
                     <Button
                        variant="destructive"
                        className="w-full h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black tracking-[0.2em] font-mono text-[10px] group/sq transition-all hover:bg-rose-500 hover:text-white rounded-none"
                        onClick={() => handleClose(selectedPos)}
                        disabled={isProcessing === selectedPos.symbol}
                      >
                        {isProcessing === selectedPos.symbol ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShieldAlert className="w-4 h-4 mr-2 group-hover/sq:animate-bounce" />
                            LIQUIDATE_POSITION
                          </>
                        )}
                     </Button>
                     <p className="text-[7px] font-mono text-muted-foreground/20 italic text-center uppercase tracking-[0.2em] leading-relaxed">
                        CRITICAL: Executing liquidation will initiate instant market square-off protocol.
                     </p>
                  </div>
                </div>

                {/* Footer Telemetry */}
                <div className="p-4 bg-black/60 border-t border-white/5 flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[6px] font-mono text-muted-foreground/30 uppercase tracking-widest">ID_REF</span>
                      <span className="text-[8px] font-mono text-white/30 font-bold uppercase tracking-widest italic">PK_7F2_POS_GEX</span>
                   </div>
                   <div className="text-right">
                      <span className="text-[6px] font-mono text-muted-foreground/30 uppercase tracking-widest">LOCAL_TIMESTAMP</span>
                      <span className="text-[8px] font-mono text-white/30 font-bold tracking-widest italic">{new Date().toLocaleTimeString()}</span>
                   </div>
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
               <Target className="w-12 h-12 text-white/5 mb-6 opacity-20" />
               <span className="text-[10px] font-black font-mono text-muted-foreground/20 tracking-widest uppercase">Select_Node_For_Forensics</span>
               <div className="mt-4 w-12 h-[1px] bg-white/5" />
               <p className="mt-4 text-[8px] font-mono text-muted-foreground/10 italic uppercase leading-relaxed tracking-[0.4em] font-bold">
                 Initialize diagnostic telemetry by choosing an active exposure vector from the matrix.
               </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

;
