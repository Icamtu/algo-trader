import React, { useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, LogsIcon, Search, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aetherClient } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

interface Order {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  order_id?: string;
  status: string;
  timestamp: string;
  mode: string;
}

export default function SandboxOrderBook() {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: tradesData, isLoading, refetch } = useQuery({
    queryKey: ["sandbox-trades"],
    queryFn: async () => {
      const response = await aetherClient("/api/v1/sandbox/trades");
      // Backend returns { status: "success", trades: [...] }
      return (Array.isArray(response?.trades) ? response.trades : []) as Order[];
    },
    refetchInterval: 5000,
  });

  const orders = Array.isArray(tradesData) ? tradesData : [];

  const filtered = orders.filter((o) => {
    const matchSymbol = !searchSymbol || (o.symbol && o.symbol.toUpperCase().includes(searchSymbol.toUpperCase()));
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSymbol && matchStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    filled: orders.filter((o) => o.status === "filled").length,
    blocked: orders.filter((o) => o.status === "blocked").length,
    reconciled: orders.filter((o) => o.status === "reconciled").length,
  };

  const statuses = Array.from(new Set(orders.map((o) => o.status).filter(Boolean)));

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
              <LogsIcon className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-amber-500">
                Sandbox_Orders
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-1">
                Pending & Completed Orders // Paper Broker
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
            { label: "Total_Orders", value: stats.total, icon: "📋", color: "text-primary" },
            { label: "Pending", value: stats.pending, icon: "⏳", color: "text-yellow-500" },
            { label: "Filled", value: stats.filled, icon: "✓", color: "text-emerald-500" },
            { label: "Blocked", value: stats.blocked, icon: "🚫", color: "text-amber-500" },
            { label: "Reconciled", value: stats.reconciled, icon: "✓✓", color: "text-blue-500" },
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
              <p className={cn("text-lg font-black font-mono", stat.color)}>{stat.value}</p>
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

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-background/50 border border-border/30 rounded-sm px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Orders Table */}
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
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Symbol</th>
              <th className="text-center p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Side</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Qty</th>
              <th className="text-right p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Price</th>
              <th className="text-center p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Status</th>
              <th className="text-left p-3 text-muted-foreground/60 font-black uppercase tracking-wider">Order_ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground/40">
                  No orders found
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((order, i) => {
                const isCompleted = order.status === "filled" || order.status === "reconciled";
                return (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="border-b border-border/10 hover:bg-card/10 transition-colors"
                  >
                    <td className="p-3 text-muted-foreground/60">
                      {new Date(order.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-black text-foreground">{order.symbol}</td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "inline-block px-2 py-1 rounded-sm text-[9px] font-black uppercase",
                          order.side === "BUY"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-destructive/20 text-destructive"
                        )}
                      >
                        {order.side}
                      </span>
                    </td>
                    <td className="p-3 text-right">{order.quantity}</td>
                    <td className="p-3 text-right">₹{order.price.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[7px] font-black uppercase",
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-500"
                            : order.status === "blocked"
                              ? "bg-amber-500/20 text-amber-500"
                              : "bg-yellow-500/20 text-yellow-500"
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {order.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground/60 text-[9px]">{order.order_id || "-"}</td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="p-4 text-[9px] text-muted-foreground/40 text-center border-t border-border/10">
            Showing 100 of {filtered.length} orders
          </div>
        )}
      </motion.div>
    </div>
  );
}
