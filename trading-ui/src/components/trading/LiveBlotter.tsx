import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { usePositions } from "@/hooks/useTrading";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Position as ApiPosition } from "@/types/api";

interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry_price: number;
  ltp: number;
  strategy: string;
}

interface LiveBlotterProps {
  onTradeClick?: (symbol: string) => void;
}

export function LiveBlotter({ onTradeClick }: LiveBlotterProps) {
  const { data: positionsData, isLoading: loading } = usePositions();
  const symbols = useMemo(() => positionsData?.positions?.map((p: ApiPosition) => p.symbol) || [], [positionsData]);
  const { prices } = useWebSocket(symbols);

  const positions = useMemo(() => {
    if (!positionsData?.positions) return [];
    return positionsData.positions.map((p: ApiPosition & { strategy?: string }) => ({
      ...p,
      qty: p.quantity,
      side: p.quantity > 0 ? "LONG" : "SHORT",
      entry_price: p.average_price,
      ltp: prices[p.symbol] || p.average_price, // Use WS price or fallback to avg
      strategy: p.strategy || "Algo-Trader"
    })) as Position[];
  }, [positionsData, prices]);

  const calculatePnL = (p: Position) => {
    const diff = p.ltp - p.entry_price;
    const value = p.side === "LONG" ? diff * p.qty : -diff * p.qty;
    const entryValue = Math.abs(p.entry_price * p.qty);
    const pct = entryValue !== 0 ? (value / entryValue) * 100 : 0;
    return {
      value: value >= 0 ? `+₹${value.toLocaleString()}` : `-₹${Math.abs(value).toLocaleString()}`,
      pct: `${value >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      isPositive: value >= 0
    };
  };

  const netPnL = positions.reduce((acc, p) => {
    const diff = p.ltp - p.entry_price;
    return acc + (p.side === "LONG" ? diff * p.qty : -diff * p.qty);
  }, 0);

  if (loading) {
    return (
      <div className="glass-panel border-t border-border p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-panel border-t border-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Live Positions</h3>
          <span className={`status-dot-${symbols.length > 0 ? "live" : "idle"}`} />
          <span className="data-cell text-muted-foreground">{positions.length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Net P&L:</span>
          <span className={`metric-value ${netPnL >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {netPnL >= 0 ? `+₹${netPnL.toLocaleString()}` : `-₹${Math.abs(netPnL).toLocaleString()}`}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              {["Symbol", "Side", "Qty", "Entry", "LTP", "P&L", "P&L %", "Strategy", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const pnl = calculatePnL(p);
              return (
                <tr key={p.symbol} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2 text-xs font-semibold text-foreground">{p.symbol}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${p.side === "LONG" ? "text-neon-green" : "text-neon-red"}`}>
                      {p.side === "LONG" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {p.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 data-cell text-foreground">{Math.abs(p.qty)}</td>
                  <td className="px-3 py-2 data-cell text-muted-foreground">{p.entry_price.toFixed(2)}</td>
                  <td className="px-3 py-2 data-cell text-foreground">{p.ltp.toFixed(2)}</td>
                  <td className={`px-3 py-2 data-cell font-semibold ${pnl.isPositive ? "text-neon-green" : "text-neon-red"}`}>{pnl.value}</td>
                  <td className={`px-3 py-2 data-cell ${pnl.isPositive ? "text-neon-green" : "text-neon-red"}`}>{pnl.pct}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{p.strategy}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {onTradeClick && (
                        <button 
                          onClick={() => onTradeClick(p.symbol)}
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[10px] font-medium"
                        >
                          Trade
                        </button>
                      )}
                      <button className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground italic">
                  No active positions in current engine cycle
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
