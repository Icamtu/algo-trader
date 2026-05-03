import React, { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Search, RefreshCw, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aetherClient } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

interface SystemLog {
  level: string;
  message: string;
  timestamp: string;
  component?: string;
  context?: Record<string, any>;
}

export default function SandboxLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      try {
        const response = await aetherClient("/api/v1/system/logs?limit=500");
        return response.logs || [];
      } catch {
        return [];
      }
    },
    refetchInterval: autoRefresh ? 3000 : false,
  });

  const logs = logsData || [];

  const filtered = logs
    .filter((log: any) => {
      const matchSearch = !searchTerm ||
        log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLevel = filterLevel === "all" || (log.level || "INFO").toLowerCase() === filterLevel.toLowerCase();
      return matchSearch && matchLevel;
    })
    .reverse();

  const logLevels = Array.from(new Set(logs.map((l: any) => l.level || "INFO")));

  const stats = {
    total: logs.length,
    errors: logs.filter((l: any) => (l.level || "").toUpperCase() === "ERROR").length,
    warnings: logs.filter((l: any) => (l.level || "").toUpperCase() === "WARNING").length,
    info: logs.filter((l: any) => (l.level || "").toUpperCase() === "INFO").length,
  };

  const getLevelColor = (level: string) => {
    const upperLevel = (level || "INFO").toUpperCase();
    if (upperLevel === "ERROR") return "text-destructive";
    if (upperLevel === "WARNING") return "text-amber-500";
    if (upperLevel === "INFO") return "text-blue-500";
    return "text-muted-foreground";
  };

  const getLevelBg = (level: string) => {
    const upperLevel = (level || "INFO").toUpperCase();
    if (upperLevel === "ERROR") return "bg-destructive/10";
    if (upperLevel === "WARNING") return "bg-amber-500/10";
    if (upperLevel === "INFO") return "bg-blue-500/10";
    return "bg-card/5";
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
            <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-sm">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-mono uppercase tracking-[0.2em] text-blue-500">
                Sandbox_Logs
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-1">
                Execution & System Logs // Real-time Monitoring
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total_Logs", value: stats.total, icon: "📋" },
            { label: "Errors", value: stats.errors, icon: "❌", color: "text-destructive" },
            { label: "Warnings", value: stats.warnings, icon: "⚠️", color: "text-amber-500" },
            { label: "Info", value: stats.info, icon: "ℹ️", color: "text-blue-500" },
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
              <p className={cn("text-lg font-black font-mono", stat.color || "text-foreground")}>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background/50 border border-border/30 rounded-sm pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-background/50 border border-border/30 rounded-sm px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
          >
            <option value="all">All Levels</option>
            {logLevels.map((level) => (
              <option key={level} value={level.toLowerCase()}>
                {level}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-refresh toggle */}
        <label className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-3 h-3 cursor-pointer"
          />
          Auto-refresh (3s interval)
        </label>
      </motion.div>

      {/* Logs Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 space-y-2 max-h-[600px] overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground/40 border border-border/20 rounded-sm">
            No logs found
          </div>
        ) : (
          filtered.slice(0, 200).map((log: any, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.01 }}
              className={cn(
                "border rounded-sm p-3 transition-colors hover:bg-card/10",
                getLevelBg(log.level)
              )}
            >
              <div className="flex items-start gap-3">
                {log.level?.toUpperCase() === "ERROR" && (
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[8px] font-black uppercase tracking-widest", getLevelColor(log.level))}>
                      {(log.level || "INFO").toUpperCase()}
                    </span>
                    {log.component && (
                      <span className="text-[8px] font-mono text-muted-foreground/60">
                        {log.component}
                      </span>
                    )}
                    <span className="text-[8px] font-mono text-muted-foreground/40 ml-auto shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "-"}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-foreground/80 break-words">
                    {log.message}
                  </p>
                  {log.context && Object.keys(log.context).length > 0 && (
                    <p className="text-[8px] font-mono text-muted-foreground/50 mt-1">
                      Context: {JSON.stringify(log.context).substring(0, 100)}...
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
        {filtered.length > 200 && (
          <div className="p-4 text-[9px] text-muted-foreground/40 text-center border-t border-border/10">
            Showing 200 of {filtered.length} logs
          </div>
        )}
      </motion.div>
    </div>
  );
}
