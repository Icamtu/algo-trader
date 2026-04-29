import { useState, useEffect } from "react";
import { algoApi } from "@/features/openalgo/api/client";

export default function Risk() {
  const [riskData, setRiskData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const data = await algoApi.getRiskStatus();
        setRiskData(data);
      } catch {
        setRiskData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRisk();
    const interval = setInterval(fetchRisk, 10000);
    return () => clearInterval(interval);
  }, []);

  const dailyLossUsed = riskData?.daily_realised_loss ?? 0;
  const dailyLossLimit = riskData?.max_daily_loss ?? 1;
  const lossUsedPct = Math.min(100, (dailyLossUsed / dailyLossLimit) * 100);

  const lossBarColor =
    lossUsedPct > 90
      ? "bg-red-500"
      : lossUsedPct > 70
      ? "bg-amber-500"
      : "bg-emerald-500";

  const dailyPnl = riskData?.daily_realised_loss != null
    ? -(riskData.daily_realised_loss)
    : null;

  const formatInr = (value: number) =>
    `₹${Math.abs(value).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-3xl font-black uppercase tracking-[0.1em] text-foreground">
            Risk_Shield
          </h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.3em]">
          Kernel_Guardrails // System_Enforcement_Active
        </p>
      </div>

      {/* Global Halt Banner */}
      {riskData?.global_halt && (
        <div className="w-full p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 font-mono text-sm text-center">
          GLOBAL HALT ACTIVE - ALL TRADING SUSPENDED
        </div>
      )}

      {/* Engine Offline */}
      {!isLoading && riskData === null && (
        <div className="w-full p-6 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-mono text-sm text-center">
          Engine Offline - Risk data unavailable
        </div>
      )}

      {/* Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card: Trading Mode */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Trading Mode
          </p>
          {isLoading ? (
            <div className="animate-pulse bg-white/5 rounded h-7 w-24" />
          ) : (
            <span
              className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-widest font-mono ${
                riskData?.mode === "live"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {riskData?.mode?.toUpperCase() ?? "-"}
            </span>
          )}
        </div>

        {/* Card: Daily P&L */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Daily P&L
          </p>
          {isLoading ? (
            <div className="animate-pulse bg-white/5 rounded h-7 w-32" />
          ) : dailyPnl === null ? (
            <span className="text-lg font-black font-mono text-muted-foreground/40">-</span>
          ) : (
            <span
              className={`text-2xl font-black font-mono tabular-nums ${
                dailyPnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {dailyPnl < 0 ? "-" : "+"}{formatInr(dailyPnl)}
            </span>
          )}
        </div>

        {/* Card: Daily Loss Used */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Daily Loss Used
          </p>
          {isLoading ? (
            <>
              <div className="animate-pulse bg-white/5 rounded h-5 w-40" />
              <div className="animate-pulse bg-white/5 rounded h-2 w-full" />
            </>
          ) : (
            <>
              <p className="text-sm font-mono font-black text-foreground tabular-nums">
                {formatInr(dailyLossUsed)}{" "}
                <span className="text-muted-foreground/40 text-xs">
                  / {formatInr(dailyLossLimit)}
                </span>
              </p>
              <div className="h-2 rounded bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-500 ${lossBarColor}`}
                  style={{ width: `${lossUsedPct}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/30 tabular-nums">
                {lossUsedPct.toFixed(1)}% consumed
              </p>
            </>
          )}
        </div>

        {/* Card: Open Positions */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Open Positions
          </p>
          {isLoading ? (
            <div className="animate-pulse bg-white/5 rounded h-7 w-20" />
          ) : (
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {riskData?.open_positions ?? "-"}
              <span className="text-muted-foreground/30 text-base font-mono">
                {" "}/ {riskData?.max_open_positions ?? "-"}
              </span>
            </span>
          )}
        </div>

        {/* Card: Max Drawdown */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Max Drawdown
          </p>
          {isLoading ? (
            <div className="animate-pulse bg-white/5 rounded h-7 w-28" />
          ) : (
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {riskData?.daily_loss_pct != null
                ? `${riskData.daily_loss_pct.toFixed(1)}%`
                : "-"}
              <span className="text-muted-foreground/30 text-base font-mono">
                {" "}/ 100%
              </span>
            </span>
          )}
        </div>

        {/* Card: Orders Today */}
        <div className="bg-black/40 border border-white/5 backdrop-blur-xl rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
            Orders Today
          </p>
          {isLoading ? (
            <div className="animate-pulse bg-white/5 rounded h-7 w-20" />
          ) : (
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {riskData?.daily_trades ?? "-"}
              <span className="text-muted-foreground/30 text-base font-mono">
                {" "}/ {riskData?.max_daily_trades ?? "-"}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
