import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Loader2, Activity, XOctagon } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePositions } from "@/hooks/useTrading";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Position as ApiPosition } from "@/types/api";
import { IndustrialValue } from "./IndustrialValue";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry_price: number;
  ltp: number;
  strategy: string;
  lot_size?: number;
}

function BlotterRow({
  p,
  onTradeClick,
  handleKill,
  isKilling
}: {
  p: Position;
  onTradeClick?: (symbol: string) => void;
  handleKill: (symbol: string) => void;
  isKilling: string | "ALL" | null;
}) {
  const lotSize = p.lot_size || 1;
  const pnlValue = p.side === "LONG" ? (p.ltp - p.entry_price) * p.qty * lotSize : -(p.ltp - p.entry_price) * p.qty * lotSize;
  const isPositive = pnlValue >= 0;
  const entryValue = Math.abs(p.entry_price * p.qty * lotSize);
  const pnlPct = entryValue !== 0 ? (pnlValue / entryValue) * 100 : 0;

  const prevLtp = useRef(p.ltp);
  const isUp = p.ltp > prevLtp.current;
  const isDown = p.ltp < prevLtp.current;
  
  useEffect(() => {
    prevLtp.current = p.ltp;
  }, [p.ltp]);

  const flashColor = isUp ? "rgba(0, 245, 255, 0.2)" : isDown ? "rgba(239, 68, 68, 0.2)" : "transparent";

  return (
    <motion.tr 
      animate={{ backgroundColor: [flashColor, "transparent"] }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="group/row cursor-crosshair relative border-b border-border/5 last:border-b-0"
    >
      <td className="px-3 py-1.5 text-[10px] font-black font-syne text-foreground tracking-widest uppercase border-r border-border/5">
        {p.symbol}
      </td>
      <td className="px-3 py-1.5 border-r border-border/5">
        <span className={`text-[8px] font-mono font-black uppercase tracking-widest ${p.side === "LONG" ? "text-secondary" : "text-destructive"}`}>
          {p.side}
        </span>
      </td>
      <td className="px-3 py-1.5 text-[10px] font-mono font-black text-foreground/70 tabular-nums border-r border-border/5">{Math.abs(p.qty)}</td>
      <td className="px-3 py-1.5 text-[9px] font-mono font-black text-muted-foreground/30 tabular-nums border-r border-border/5">{p.entry_price.toFixed(2)}</td>
      <td className="px-3 py-1.5 border-r border-border/5">
        <IndustrialValue value={p.ltp} className="text-[10px] font-black text-foreground tabular-nums" />
      </td>
      <td className="px-3 py-1.5 border-r border-border/5">
        <IndustrialValue 
          value={pnlValue} 
          prefix="₹" 
          className={`text-[10px] font-black tabular-nums ${isPositive ? "text-secondary" : "text-destructive"}`} 
        />
      </td>
      <td className={`px-3 py-1.5 text-[9px] font-mono font-black tabular-nums border-r border-border/5 ${isPositive ? "text-secondary" : "text-destructive"}`}>
        {isPositive ? "+" : ""}{pnlPct.toFixed(2)}%
      </td>
      <td className="px-3 py-1.5 text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.1em] border-r border-border/5">{p.strategy}</td>
      <td className="px-3 py-1.5 text-right flex gap-1 justify-end">
        <button 
          onClick={() => handleKill(p.symbol)}
          disabled={isKilling === p.symbol}
          className="opacity-0 group-hover/row:opacity-100 px-2 py-0.5 bg-destructive text-destructive-foreground text-[8px] font-mono font-black uppercase tracking-[0.2em] transition-all hover:bg-destructive/80 active:scale-95 disabled:opacity-50"
        >
          {isKilling === p.symbol ? <Loader2 className="w-2 h-2 animate-spin inline mr-1" /> : null}KILL
        </button>
        <button 
          onClick={() => onTradeClick?.(p.symbol)}
          className="opacity-0 group-hover/row:opacity-100 px-2 py-0.5 bg-primary/20 text-primary hover:bg-primary hover:text-black text-[8px] font-mono font-black uppercase tracking-[0.2em] transition-all active:scale-95"
        >
          MOD
        </button>
      </td>
    </motion.tr>
  );
}

interface LiveBlotterProps {
  onTradeClick?: (symbol: string) => void;
}

export function LiveBlotter({ onTradeClick }: LiveBlotterProps) {
  const { data: positionsData, isLoading: loading } = usePositions();
  const symbols = useMemo(() => positionsData?.positions?.map((p: ApiPosition) => p.symbol) || [], [positionsData]);
  const { prices } = useWebSocket(symbols);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isKilling, setIsKilling] = useState<string | "ALL" | null>(null);

  const handleKill = async (symbol: string) => {
    setIsKilling(symbol);
    try {
      await algoApi.exitPosition(symbol);
      toast({ title: "POSITION_LIQUIDATED", description: `SQUARE-OFF_SENT::${symbol}` });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "KILL_FAILED", description: e?.message || "KERNEL_REJECTION" });
    } finally {
      setIsKilling(null);
    }
  };

  const handleKillAll = async () => {
    setIsKilling("ALL");
    try {
      await algoApi.closePosition();
      toast({ title: "ALL_POSITIONS_LIQUIDATED", description: "GLOBAL_SQUARE-OFF_INITIATED" });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "KILL_FAILED", description: e?.message || "KERNEL_REJECTION" });
    } finally {
      setIsKilling(null);
    }
  };

  const positions = useMemo(() => {
    if (!positionsData?.positions) return [];
    return positionsData.positions.map((p: any) => ({
      ...p,
      qty: p.quantity,
      side: p.quantity > 0 ? "LONG" : "SHORT",
      entry_price: p.average_price,
      ltp: prices[p.symbol] || p.average_price,
      strategy: p.strategy || "CORE_BUFFER",
      lot_size: p.lot_size || 1
    })) as Position[];
  }, [positionsData, prices]);

  const netPnL = positions.reduce((acc, p) => {
    const diff = p.ltp - p.entry_price;
    const lotSize = p.lot_size || 1;
    return acc + (p.side === "LONG" ? diff * p.qty * lotSize : -diff * p.qty * lotSize);
  }, 0);

  if (loading) {
    return (
      <div className="bg-background border-t border-border h-[300px] flex flex-col items-center justify-center industrial-grid relative">
        <div className="noise-overlay" />
        <div className="scanline" />
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-[8px] font-mono font-black text-primary animate-pulse mt-4 tracking-[0.5em]">BUFFERING...</span>
      </div>
    );
  }

  return (
    <div className="bg-background border-t border-border flex flex-col h-[300px] industrial-grid relative overflow-hidden group/blotter">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      
      {/* Blotter Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/10 relative z-10">
        <div className="flex items-center gap-4">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-primary">Matrix_Buffer</h3>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 ${symbols.length > 0 ? "bg-secondary shadow-[0_0_8px_#00d4d4]" : "bg-muted-foreground/20"} animate-pulse`} />
            <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">{positions.length} ACTV_NODES</span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-background px-2 py-0.5 border border-border">
          <span className="text-[8px] font-mono font-black uppercase text-muted-foreground/20 tracking-[0.2em]">AGG_DLT</span>
          <IndustrialValue 
            value={netPnL} 
            prefix="₹" 
            className={`text-[11px] font-black tabular-nums tracking-tighter ${netPnL >= 0 ? "text-secondary" : "text-destructive"}`} 
          />
          {positions.length > 0 && (
            <button 
              onClick={handleKillAll}
              disabled={isKilling === "ALL"}
              className="ml-2 px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 text-[8px] font-mono font-black uppercase tracking-[0.2em] transition-all hover:bg-destructive hover:text-destructive-foreground flex items-center gap-1 active:scale-95"
            >
              {isKilling === "ALL" ? <Loader2 className="w-2 h-2 animate-spin" /> : <XOctagon className="w-2 h-2" />}
              KILL_ALL
            </button>
          )}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto no-scrollbar relative z-10 bg-background/50">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-card/5 sticky top-0 z-20">
              {["TAG", "DIR", "QTY", "ENTRY", "LTP", "DELTA", "RATIO", "KERNEL", "COMMAND"].map((h) => (
                <th key={h} className="px-3 py-1.5 text-left text-[8px] uppercase tracking-[0.3em] text-muted-foreground/30 font-mono font-black border-r border-border/10 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {positions.map((p) => (
              <BlotterRow 
                key={p.symbol} 
                p={p} 
                onTradeClick={onTradeClick} 
                handleKill={handleKill} 
                isKilling={isKilling} 
              />
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Activity className="w-5 h-5 text-primary opacity-20" />
                    <span className="text-[8px] text-muted-foreground/20 font-mono font-black uppercase tracking-[0.5em] italic">ZERO_SIGNALS_DETECTED</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
