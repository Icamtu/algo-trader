import React from "react";
import { Zap, Activity, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LatencyMonitorProps {
  latency: number;
  isConnected: boolean;
  className?: string;
}

export function LatencyMonitor({ latency, isConnected, className }: LatencyMonitorProps) {
  // Latency thresholds for institutional grading
  const isHealthy = latency < 100;
  const isWarning = latency >= 100 && latency < 350;
  const isCritical = latency >= 350;

  const statusColor = !isConnected
    ? "text-slate-500"
    : isHealthy
      ? "text-emerald-400"
      : isWarning
        ? "text-amber-400"
        : "text-rose-500";

  const glowColor = !isConnected
    ? "bg-slate-500"
    : isHealthy
      ? "bg-emerald-500"
      : isWarning
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-1.5 rounded-full",
      "bg-black/40 backdrop-blur-md border border-white/10",
      "transition-all duration-300 hover:border-white/20",
      className
    )}>
      <div className="relative flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isConnected ? (
            <motion.div
              key="connected"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Wifi size={14} className={statusColor} />
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <WifiOff size={14} className="text-rose-500" />
            </motion.div>
          )}
        </AnimatePresence>

        {isConnected && (
          <motion.div
            className={cn("absolute inset-0 rounded-full blur-[4px] opacity-30", glowColor)}
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </div>

      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-0.5">
          NET_RTT
        </span>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-xs font-mono font-bold tracking-tight transition-colors duration-500",
            statusColor
          )}>
            {isConnected ? `${latency.toFixed(0)}` : "OFFLINE"}
          </span>
          {isConnected && <span className="text-[9px] text-white/30 font-medium font-mono">ms</span>}
        </div>
      </div>

      {isConnected && (
        <div className="h-4 w-[1px] bg-white/10 mx-1" />
      )}

      {isConnected && (
         <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-white/20" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-tighter">
              {latency < 50 ? "Surgical" : latency < 150 ? "Stable" : "Lagging"}
            </span>
         </div>
      )}
    </div>
  );
}
