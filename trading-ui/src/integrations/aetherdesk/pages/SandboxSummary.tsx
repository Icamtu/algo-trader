import React from "react";
import { motion } from "framer-motion";
import { Shield, RefreshCw, TrendingUp, DollarSign, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aetherClient } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

export default function SandboxSummary() {
  const { data: summaryData, isLoading, refetch } = useQuery({
    queryKey: ["sandbox-summary"],
    queryFn: async () => {
      try {
        const response = await aetherClient("/api/v1/sandbox/summary");
        return response?.data?.summary || response?.summary || null;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  const summary = (summaryData && typeof summaryData === 'object') ? summaryData : {
    total_trades: 0,
    filled_trades: 0,
    blocked_trades: 0,
    reconciled_trades: 0,
    open_positions: 0,
    database_file: "N/A",
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
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
            <div className="p-3 bg-destructive/20 border border-destructive/30 rounded-sm">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-destructive">
                Sandbox_Summary
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-1">
                Complete State Snapshot // Full System Overview
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
      </motion.div>

      {/* Main Stats Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          {
            label: "Total_Trades",
            value: summary.total_trades,
            icon: Zap,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
          },
          {
            label: "Filled_Trades",
            value: summary.filled_trades,
            icon: TrendingUp,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/30",
          },
          {
            label: "Blocked_Trades",
            value: summary.blocked_trades,
            icon: Shield,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
          },
          {
            label: "Reconciled_Trades",
            value: summary.reconciled_trades,
            icon: TrendingUp,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/30",
          },
          {
            label: "Open_Positions",
            value: summary.open_positions,
            icon: DollarSign,
            color: "text-secondary",
            bg: "bg-secondary/10",
            border: "border-secondary/30",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className={cn(
                "border rounded-sm p-6 transition-all hover:shadow-lg",
                stat.bg,
                stat.border
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={cn("p-2 rounded-sm bg-background/50", stat.bg)}>
                  <Icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <span className={cn("text-[9px] font-mono font-black uppercase tracking-widest", stat.color)}>
                  {stat.label}
                </span>
              </div>
              <p className="text-4xl font-black font-mono text-foreground mb-2">
                {typeof stat.value === "number" ? (stat.value ?? 0).toLocaleString() : (stat.value || "0")}
              </p>
              <div className={cn("h-1 rounded-full", stat.bg)} style={{ width: `${Math.min((stat.value / 1000) * 100, 100)}%` }} />
            </motion.div>
          );
        })}
      </motion.div>

      {/* System Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative z-10"
      >
        <div className="bg-card/5 border border-border/20 rounded-sm p-6 space-y-4">
          <h3 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
            System Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                label: "Database Location",
                value: summary.database_file || "N/A",
              },
              {
                label: "Simulation Capital",
                value: "₹10,00,000",
              },
              {
                label: "Paper Broker",
                value: "PaperBroker v1.0",
              },
              {
                label: "Mode",
                value: "SANDBOX (Isolated)",
              },
              {
                label: "Risk Isolation",
                value: "ENABLED ✓",
              },
              {
                label: "Real Trading",
                value: "DISABLED ✗",
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-background/50 border border-border/10 rounded-sm p-4"
              >
                <p className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">
                  {item.label}
                </p>
                <p className="text-sm font-black font-mono text-foreground break-all">{item.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Trade Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative z-10"
      >
        <div className="bg-card/5 border border-border/20 rounded-sm p-6 space-y-4">
          <h3 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
            Trade Distribution
          </h3>

          <div className="space-y-3">
            {[
              {
                label: "Total Trades",
                value: summary.total_trades,
                color: "bg-primary/50",
              },
              {
                label: "Filled Trades",
                value: summary.filled_trades,
                total: summary.total_trades,
                color: "bg-emerald-500/50",
              },
              {
                label: "Blocked Trades",
                value: summary.blocked_trades,
                total: summary.total_trades,
                color: "bg-amber-500/50",
              },
              {
                label: "Reconciled Trades",
                value: summary.reconciled_trades,
                total: summary.total_trades,
                color: "bg-blue-500/50",
              },
            ].map((stat) => {
              const val = Number(stat.value) || 0;
              const tot = Number(stat.total) || 0;
              const percentage = tot > 0 ? (val / tot) * 100 : 0;
              return (
                <div key={stat.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                      {stat.label}
                    </span>
                    <span className="text-[9px] font-mono font-black text-foreground">
                      {(stat.value ?? 0).toLocaleString()} {stat.total && `(${percentage.toFixed(1)}%)`}
                    </span>
                  </div>
                  <div className="h-2 bg-background/50 rounded-full overflow-hidden border border-border/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className={cn("h-full rounded-full transition-colors", stat.color)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative z-10"
      >
        <div className="bg-card/5 border border-border/20 rounded-sm p-6 space-y-4">
          <h3 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
            Sandbox Features
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "✓ Isolated from live trading",
              "✓ Paper capital (₹10,00,000)",
              "✓ PaperBroker execution",
              "✓ Real-time market prices",
              "✓ Complete trade logging",
              "✓ Position tracking",
              "✓ P&L calculations",
              "✓ Risk management testing",
              "✓ Strategy simulation",
              "✓ Order reconciliation",
              "✓ State snapshots",
              "✓ Full audit trail",
            ].map((feature) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/60"
              >
                <span className="text-emerald-500 font-black">✓</span>
                <span>{feature.replace("✓ ", "")}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 p-4 bg-amber-950/30 border border-amber-500/30 rounded-sm"
      >
        <p className="text-[9px] font-mono text-amber-500/80">
          🧪 All trading in this section is simulated with paper capital. No real capital at risk. Use this environment to test strategies and understand system behavior before live trading.
        </p>
      </motion.div>
    </div>
  );
}
