import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Search, RefreshCw, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aetherClient } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

interface Trade {
  id: number;
  timestamp: string;
  strategy: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  mode: string;
  pnl?: number;
  charges?: number;
  value?: number;
}

export default function SandboxTradebook() {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("all");

  const { data: sandboxData, isLoading, refetch } = useQuery({
    queryKey: ["sandbox-trades"],
    queryFn: async () => {
      const response = await aetherClient("/api/v1/sandbox/trades");
      // Backend returns { status: "success", trades: [...] }
      return (response.trades || []) as Trade[];
    },
    refetchInterval: 5000,
  });

  const trades = sandboxData || [];

  const filtered = trades.filter((t) => {
    const matchSymbol = !searchSymbol || t.symbol.toUpperCase().includes(searchSymbol.toUpperCase());
    const matchStrategy = filterStrategy === "all" || t.strategy === filterStrategy;
    return matchSymbol && matchStrategy;
  });

  const strategies = Array.from(new Set(trades.map((t) => t.strategy)));

  const stats = {
    totalTrades: trades.length,
    buyTrades: trades.filter((t) => t.side === "BUY").length,
    sellTrades: trades.filter((t) => t.side === "SELL").length,
    blockedTrades: trades.filter((t) => t.status === "blocked").length,
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
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-sm">
              <TrendingUp className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-amber-500">
                Sandbox_Tradebook
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-1">
                Execution Log // Paper Capital Trading
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total_Trades", value: stats.totalTrades, icon: "📊" },
            { label: "Buy_Trades", value: stats.buyTrades, icon: "📈" },
            { label: "Sell_Trades", value: stats.sellTrades, icon: "📉" },
            { label: "Blocked_Status", value: stats.blockedTrades, icon: "🚫" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card/5 border border-border/20 rounded-sm p-3"
            >
              <div className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
                {stat.icon} {stat.label}
              </div>
              <p className="text-lg font-black font-mono text-foreground">{stat.value}</p>
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

          {/* Strategy Filter */}
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="bg-background/50 border border-border/30 rounded-sm px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
          >
            <option value="all">All Strategies</option>
            {strategies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Trades Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 overflow-x-auto"
      >
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Time</th>
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Strategy</th>
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Symbol</th>
              <th className="text-center p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Side</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Qty</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Price</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Value</th>
              <th className="text-center p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground/40">
                  No trades found
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((trade, i) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-border/10 hover:bg-card/10 transition-colors"
                >
                  <td className="p-3 text-muted-foreground/60">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-3 text-primary">{trade.strategy}</td>
                  <td className="p-3 font-black text-foreground">{trade.symbol}</td>
                  <td className="p-3 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[9px] font-black uppercase",
                        trade.side === "BUY"
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {trade.side === "BUY" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                      {trade.side}
                    </span>
                  </td>
                  <td className="p-3 text-right">{trade.quantity}</td>
                  <td className="p-3 text-right">₹{trade.price.toFixed(2)}</td>
                  <td className="p-3 text-right text-secondary font-black">
                    ₹{(trade.quantity * trade.price).toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={cn(
                        "inline-block px-2 py-1 rounded-sm text-[7px] font-black uppercase",
                        trade.status === "blocked"
                          ? "bg-amber-500/20 text-amber-500"
                          : "bg-emerald-500/20 text-emerald-500"
                      )}
                    >
                      {trade.status}
                    </span>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="p-4 text-[9px] text-muted-foreground/40 text-center border-t border-border/10">
            Showing 100 of {filtered.length} trades (scroll for more)
          </div>
        )}
      </motion.div>
    </div>
  );
}
