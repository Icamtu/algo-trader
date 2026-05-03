import React, { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Search, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aetherClient } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

interface Position {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  mode: string;
}

export default function SandboxPositions() {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [sortBy, setSortBy] = useState<"symbol" | "quantity" | "pnl">("symbol");

  const { data: positionsData, isLoading, refetch } = useQuery({
    queryKey: ["sandbox-positions"],
    queryFn: async () => {
      const response = await aetherClient("/api/v1/sandbox/positions");
      return Array.isArray(response?.positions) ? response.positions : [];
    },
    refetchInterval: 5000,
  });

  const positions = Array.isArray(positionsData) ? positionsData : [];
  const filtered = positions
    .filter((p) => !searchSymbol || (p.symbol && p.symbol.toUpperCase().includes(searchSymbol.toUpperCase())))
    .sort((a, b) => {
      if (sortBy === "symbol") return (a.symbol || '').localeCompare(b.symbol || '');
      if (sortBy === "quantity") return (b.quantity || 0) - (a.quantity || 0);
      if (sortBy === "pnl") return (b.pnl || 0) - (a.pnl || 0);
      return 0;
    });

  const stats = {
    openPositions: filtered.length,
    totalQuantity: filtered.reduce((sum, p) => sum + p.quantity, 0),
    totalPnL: filtered.reduce((sum, p) => sum + p.pnl, 0),
    longPositions: filtered.filter((p) => p.quantity > 0).length,
    shortPositions: filtered.filter((p) => p.quantity < 0).length,
  };

  const netGainersLosers = {
    gainers: filtered.filter((p) => p.pnl > 0).length,
    losers: filtered.filter((p) => p.pnl < 0).length,
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-sm">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-emerald-500">
                Sandbox_Positions
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-1">
                Open Positions in Simulation // Real-time Tracking
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-2 bg-primary/10 border border-primary/30 rounded-sm hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className={cn("w-5 h-5 text-primary", isLoading && "animate-spin")} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Open_Positions", value: stats.openPositions, icon: "📂" },
            { label: "Total_Quantity", value: stats.totalQuantity, icon: "📦" },
            { label: "Net_PnL", value: `₹${stats.totalPnL.toFixed(2)}`, icon: "💰", highlight: stats.totalPnL > 0 },
            { label: "Long_Positions", value: stats.longPositions, icon: "📈" },
            { label: "Short_Positions", value: stats.shortPositions, icon: "📉" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "bg-card/5 border rounded-sm p-3 transition-colors",
                stat.highlight
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-border/20"
              )}
            >
              <div className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
                {stat.icon} {stat.label}
              </div>
              <p className={cn("text-lg font-black font-mono", stat.highlight && "text-emerald-500")}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className="w-full bg-background/50 border border-border/30 rounded-sm pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background/50 border border-border/30 rounded-sm px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
          >
            <option value="symbol">Sort by Symbol</option>
            <option value="quantity">Sort by Quantity</option>
            <option value="pnl">Sort by P&L</option>
          </select>
        </div>
      </motion.div>

      {/* Positions Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 overflow-x-auto"
      >
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Symbol</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Quantity</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Avg_Price</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Current_Price</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Value</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">P&L</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground/40">
                  No open positions
                </td>
              </tr>
            ) : (
              filtered.map((position, i) => {
                const isLong = position.quantity > 0;
                const isProfitable = position.pnl > 0;
                return (
                  <motion.tr
                    key={position.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="border-b border-border/10 hover:bg-card/10 transition-colors"
                  >
                    <td className="p-3 font-black text-foreground">{position.symbol}</td>
                    <td className="p-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          isLong ? "text-emerald-500" : "text-destructive"
                        )}
                      >
                        {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(position.quantity)}
                      </span>
                    </td>
                    <td className="p-3 text-right">₹{position.avg_price.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{position.current_price.toFixed(2)}</td>
                    <td className="p-3 text-right text-secondary font-black">
                      ₹{(position.quantity * position.current_price).toFixed(2)}
                    </td>
                    <td className={cn("p-3 text-right font-black", isProfitable ? "text-emerald-500" : "text-destructive")}>
                      ₹{position.pnl.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-black",
                        isProfitable ? "text-emerald-500" : "text-destructive"
                      )}
                    >
                      {isProfitable ? "+" : ""}
                      {position.pnl_percent.toFixed(2)}%
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Summary Stats */}
      {filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="bg-card/5 border border-emerald-500/30 rounded-sm p-4">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-500 mb-2">
              📈 Gainers ({netGainersLosers.gainers})
            </h3>
            <p className="text-sm font-black font-mono text-emerald-500">
              ₹{filtered
                .filter((p) => p.pnl > 0)
                .reduce((sum, p) => sum + p.pnl, 0)
                .toFixed(2)}
            </p>
          </div>
          <div className="bg-card/5 border border-destructive/30 rounded-sm p-4">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-destructive mb-2">
              📉 Losers ({netGainersLosers.losers})
            </h3>
            <p className="text-sm font-black font-mono text-destructive">
              ₹{filtered
                .filter((p) => p.pnl < 0)
                .reduce((sum, p) => sum + p.pnl, 0)
                .toFixed(2)}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
