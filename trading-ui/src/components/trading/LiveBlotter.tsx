import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Loader2, Activity, XOctagon } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePositions } from "@/features/aetherdesk/hooks/useTrading";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Position as ApiPosition } from "@/types/api";
import { IndustrialValue } from "./IndustrialValue";
import { algoApi } from "@/features/aetherdesk/api/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

import { useAudioNotifications } from "@/hooks/useAudioNotifications";

interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry_price: number;
  ltp: number;
  strategy: string;
  lot_size?: number;
  est_charges?: number;
  metadata?: {
    scaled?: boolean;
    scaling_stage?: string;
  };
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
  const pnlValue = (p.ltp - p.entry_price) * p.qty * lotSize;
  const isPositive = pnlValue >= 0;
  const entryValue = Math.abs(p.entry_price * p.qty * lotSize);
  const pnlPct = entryValue !== 0 ? (pnlValue / entryValue) * 100 : 0;

  const prevLtp = useRef(p.ltp);
  const [flashClass, setFlashClass] = useState<string>("");

  useEffect(() => {
    if (p.ltp > prevLtp.current) {
      setFlashClass("pnl-flash-up");
      const t = setTimeout(() => setFlashClass(""), 600);
      return () => clearTimeout(t);
    } else if (p.ltp < prevLtp.current) {
      setFlashClass("pnl-flash-down");
      const t = setTimeout(() => setFlashClass(""), 600);
      return () => clearTimeout(t);
    }
    prevLtp.current = p.ltp;
  }, [p.ltp]);

  return (
    <tr
      className={`group/row cursor-crosshair relative border-b border-border/5 last:border-b-0 transition-colors duration-500 ${flashClass}`}
    >
      <td className="px-4 py-1.5 text-[10px] font-black font-display text-foreground tracking-widest uppercase border-r border-border/5">
        <div className="flex flex-col gap-0.5">
          {p.symbol}
          {p.metadata?.scaled && (
            <span className="text-[7px] font-mono text-secondary animate-pulse px-1 border border-secondary/30 w-fit bg-secondary/5">
              SCALED_50%
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-1.5 border-r border-border/5">
        <span className={`text-[8px] font-mono font-black uppercase tracking-widest ${p.side === "LONG" ? "text-secondary" : "text-destructive"}`}>
          {p.side}
        </span>
      </td>
      <td className="px-4 py-1.5 text-[10px] font-mono font-black text-foreground/70 tabular-nums border-r border-border/5">{Math.abs(p.qty)}</td>
      <td className="px-4 py-1.5 text-[9px] font-mono font-black text-muted-foreground/30 tabular-nums border-r border-border/5">{(p.entry_price || 0).toFixed(2)}</td>
      <td className="px-4 py-1.5 border-r border-border/5">
        <IndustrialValue value={p.ltp} className="text-[10px] font-black text-foreground tabular-nums" />
      </td>
      <td className="px-4 py-1.5 border-r border-border/5">
        <IndustrialValue
          value={pnlValue}
          prefix="₹"
          className={`text-[10px] font-black tabular-nums ${isPositive ? "text-secondary" : "text-destructive"}`}
        />
      </td>
      <td className={`px-4 py-1.5 text-[9px] font-mono font-black tabular-nums border-r border-border/5 ${isPositive ? "text-secondary" : "text-destructive"}`}>
        {isPositive ? "+" : ""}{(pnlPct || 0).toFixed(2)}%
      </td>
      <td className="px-4 py-1.5 text-[9px] font-mono font-black text-muted-foreground/40 tabular-nums border-r border-border/5 tracking-tighter">
        ₹{p.est_charges?.toFixed(2) || "0.00"}
      </td>
      <td className="px-4 py-1.5 text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.1em] border-r border-border/5">{p.strategy}</td>
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
    </tr>
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
  const { playSnap, playWarning } = useAudioNotifications();
  const queryClient = useQueryClient();
  const [isKilling, setIsKilling] = useState<string | "ALL" | null>(null);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';

  const accentColor = isAD ? "text-primary" : "text-teal";
  const accentShadow = isAD ? "shadow-[0_0_8px_rgba(255,176,0,0.4)]" : "shadow-[0_0_8px_rgba(0,212,212,0.4)]";
  const accentBgSecondary = isAD ? "bg-secondary" : "bg-primary";

  const handleKill = async (symbol: string) => {
    setIsKilling(symbol);
    try {
      await algoApi.exitPosition(symbol);
      playSnap();
      toast({ title: "POSITION_LIQUIDATED", description: `SQUARE-OFF_SENT::${symbol}` });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch (e: any) {
      playWarning();
      toast({ variant: "destructive", title: "KILL_FAILED", description: e?.message || "KERNEL_REJECTION" });
    } finally {
      setIsKilling(null);
    }
  };

  const handleKillAll = async () => {
    setIsKilling("ALL");
    try {
      await algoApi.closePosition();
      playSnap();
      toast({ title: "ALL_POSITIONS_LIQUIDATED", description: "GLOBAL_SQUARE-OFF_INITIATED" });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch (e: any) {
      playWarning();
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
      lot_size: p.lot_size || 1,
      est_charges: p.est_charges || 0,
      metadata: p.metadata || {}
    })) as Position[];
  }, [positionsData, prices]);

  const netPnLValue = positions.reduce((acc, p) => {
    const lotSize = p.lot_size || 1;
    const gross = (p.ltp - p.entry_price) * p.qty * lotSize;
    return acc + gross - (p.est_charges || 0);
  }, 0);

  if (loading) {
    return (
      <div className="bg-background border-t border-border h-[300px] flex flex-col items-center justify-center industrial-grid relative">
        <div className="noise-overlay" />
        <div className="scanline" />
        <Loader2 className={cn("w-5 h-5 animate-spin", accentColor)} />
        <span className={cn("text-[8px] font-mono font-black animate-pulse mt-4 tracking-[0.5em]", accentColor)}>BUFFERING...</span>
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
          <h3 className={cn("text-[10px] font-mono font-black uppercase tracking-[0.3em]", accentColor)}>Matrix_Buffer</h3>
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 animate-pulse", symbols.length > 0 ? cn(accentBgSecondary, accentShadow) : "bg-muted-foreground/20")} />
            <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">{positions.length} ACTV_NODES</span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-background px-2 py-0.5 border border-border">
          <span className="text-[8px] font-mono font-black uppercase text-muted-foreground/20 tracking-[0.2em]">AGG_NET</span>
          <IndustrialValue
            value={netPnLValue}
            prefix="₹"
            className={`text-[11px] font-black tabular-nums tracking-tighter ${netPnLValue >= 0 ? "text-secondary" : "text-destructive"}`}
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
      <div className="flex-1 overflow-auto custom-scrollbar relative z-10 bg-background/50">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-card/5 sticky top-0 z-20">
              {["TAG", "DIR", "QTY", "ENTRY", "LTP", "DELTA", "RATIO", "FEES", "KERNEL", "COMMAND"].map((h) => (
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
                <td colSpan={10} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Activity className={cn("w-5 h-5 opacity-20", accentColor)} />
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
