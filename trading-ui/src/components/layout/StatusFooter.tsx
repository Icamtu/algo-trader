import { useAether } from "@/contexts/AetherContext";
import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMetrics {
  buildHash: string;
  environment: string;
  wsHealth: "connected" | "reconnecting" | "down";
  tickRate: number;
  kernelLoad: number;
  activeStrategies: number;
  lastActivity: number;
}

const getMetrics = async (): Promise<Partial<SystemMetrics>> => {
  try {
    const response = await fetch("/api/system/metrics", {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Gracefully degrade if metrics endpoint not available
  }
  return {};
};

export function StatusFooter() {
  const { connectionStatus, latency, telemetry } = useAether();
  const [metrics, setMetrics] = useState<Partial<SystemMetrics>>({
    buildHash: "dev",
    environment: "SANDBOX",
    tickRate: 0,
    kernelLoad: 0,
    activeStrategies: telemetry.active_trades_count,
  });
  const [showDetails, setShowDetails] = useState(false);

  // Fetch metrics on mount and every 5s
  useEffect(() => {
    const fetchMetrics = async () => {
      const data = await getMetrics();
      setMetrics((prev) => ({
        ...prev,
        ...data,
        activeStrategies: telemetry.active_trades_count,
      }));
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [telemetry.active_trades_count]);

  const wsColor =
    connectionStatus === "connected"
      ? "text-primary"
      : connectionStatus === "connecting"
        ? "text-yellow-500"
        : "text-red-500";

  const wsLabel = {
    connected: "Connected",
    connecting: "Reconnecting",
    disconnected: "Offline",
    error: "Error",
  }[connectionStatus];

  const wsIcon =
    connectionStatus === "connected" || connectionStatus === "connecting" ? (
      <Wifi className="w-3 h-3" />
    ) : (
      <WifiOff className="w-3 h-3" />
    );

  return (
    <footer
      className="h-7 bg-[#0a0a0a] border-t border-white/[0.02] text-[10px] font-mono text-white/70 flex items-center justify-between px-3 select-none"
      role="contentinfo"
    >
      {/* Left: Build hash, environment, latency (always visible) */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="truncate text-white/50">{metrics.buildHash}</span>
        <span className="text-white/40">·</span>
        <span className={cn("font-semibold", metrics.environment === "LIVE" ? "text-red-500" : "text-yellow-600")}>
          {metrics.environment}
        </span>
        <span className="text-white/40">·</span>
        <span className="text-white/60">{latency}ms</span>
      </div>

      {/* Center: WS health + tick rate (always visible) */}
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded", wsColor)}>
          {wsIcon}
          <span className="text-white/80">{wsLabel}</span>
        </div>
        {connectionStatus === "connected" && (
          <>
            <span className="text-white/40">·</span>
            <span className="text-white/60 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {metrics.tickRate || 0} hz
            </span>
          </>
        )}
      </div>

      {/* Right: Kernel load, active strategies (click to expand on mobile) */}
      <div
        className="flex items-center gap-2 ml-3 cursor-pointer hover:text-white/90 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
        role="button"
        tabIndex={0}
        aria-pressed={showDetails}
        aria-label="Toggle system details"
      >
        {!showDetails ? (
          <>
            <Activity className="w-3 h-3" />
            <span className="text-white/60">{metrics.activeStrategies || 0} active</span>
          </>
        ) : (
          <>
            <span className="text-white/60">Load: {(metrics.kernelLoad || 0).toFixed(1)}%</span>
            <span className="text-white/40">|</span>
            <span className="text-white/60">{metrics.activeStrategies || 0} active</span>
          </>
        )}
      </div>
    </footer>
  );
}
