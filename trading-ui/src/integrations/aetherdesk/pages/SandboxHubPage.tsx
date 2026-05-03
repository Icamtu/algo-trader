import React from "react";
import { motion } from "framer-motion";
import { Zap, TrendingUp, Shield, LogsIcon, BarChart3, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

/**
 * Sandbox Hub - Central dashboard for all sandbox/simulation data
 */
export default function SandboxHubPage() {
  const navigate = useNavigate();
  const { mode: appMode } = useAppModeStore();
  const isAD = appMode === "AD";

  const sandboxModules = [
    {
      path: "/aetherdesk/sandbox/trades",
      icon: Zap,
      label: "Sandbox_Trades",
      desc: "Simulation execution log",
      color: isAD ? "text-amber-500" : "text-teal-500",
      bg: isAD ? "bg-amber-500/10" : "bg-teal-500/10",
    },
    {
      path: "/aetherdesk/sandbox/orderbook",
      icon: LogsIcon,
      label: "Sandbox_Orders",
      desc: "Pending & completed orders",
      color: isAD ? "text-amber-500" : "text-teal-500",
      bg: isAD ? "bg-amber-500/10" : "bg-teal-500/10",
    },
    {
      path: "/aetherdesk/sandbox/positions",
      icon: BarChart3,
      label: "Sandbox_Positions",
      desc: "Open positions in simulation",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      path: "/aetherdesk/sandbox/pnl",
      icon: TrendingUp,
      label: "Sandbox_PnL",
      desc: "Profit & loss tracking",
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      path: "/aetherdesk/sandbox/logs",
      icon: Activity,
      label: "Sandbox_Logs",
      desc: "Execution & system logs",
      color: isAD ? "text-primary" : "text-teal-500",
      bg: isAD ? "bg-primary/10" : "bg-teal-500/10",
    },
    {
      path: "/aetherdesk/sandbox/summary",
      icon: Shield,
      label: "Sandbox_Summary",
      desc: "Complete state snapshot",
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-sm">
            <Shield className="w-6 h-6 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-amber-500">
              Sandbox_Hub
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-2">
              Isolated Simulation Environment // NO_REAL_CAPITAL
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-950/30 border border-amber-500/30 rounded-sm p-4 mb-8 flex items-start gap-3"
        >
          <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest mb-1">
              🧪 SANDBOX MODE ACTIVE
            </p>
            <p className="text-[9px] font-mono text-muted-foreground">
              All trading in this section is simulated with paper capital (₹10,00,000 initial).
              Orders execute immediately against PaperBroker. No real capital at risk.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {sandboxModules.map((module, i) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={module.label}
              onClick={() => navigate(module.path)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "p-6 border border-border/30 rounded-sm transition-all hover:border-border/50 hover:bg-card/10 group cursor-pointer",
                module.bg
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2 bg-background/50 border border-border/20 rounded-sm", module.bg)}>
                  <Icon className={cn("w-5 h-5", module.color)} />
                </div>
                <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">
                  SIMULATION
                </span>
              </div>

              <div>
                <h3 className={cn("text-sm font-black font-mono uppercase tracking-wider mb-1", module.color)}>
                  {module.label}
                </h3>
                <p className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                  {module.desc}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border/10 flex items-center justify-between">
                <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase">
                  Paper_Broker
                </span>
                <span className="text-[7px] font-mono font-black text-secondary uppercase group-hover:translate-x-1 transition-transform">
                  ENTER →
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
        {[
          { label: "Simulation_Capital", value: "₹10,00,000", icon: TrendingUp },
          { label: "Paper_Broker", value: "Active", icon: Shield },
          { label: "Risk_Isolation", value: "ENABLED", icon: Activity },
          { label: "Real_Trading", value: "DISABLED", icon: LogsIcon },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card/5 border border-border/20 rounded-sm p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-amber-500" />
                <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">
                  {stat.label}
                </span>
              </div>
              <p className="text-lg font-black font-mono text-foreground">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Info Section */}
      <div className="relative z-10 bg-card/5 border border-border/20 rounded-sm p-6 space-y-4">
        <h3 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
          Sandbox Environment Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "✓ Isolated from live trading",
            "✓ Paper capital (₹10,00,000)",
            "✓ PaperBroker execution",
            "✓ Real-time market prices",
            "✓ Complete trade logging",
            "✓ Position tracking",
            "✓ P&L calculations",
            "✓ Risk management testing",
          ].map((feature) => (
            <p key={feature} className="text-[9px] font-mono text-muted-foreground/60">
              {feature}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
