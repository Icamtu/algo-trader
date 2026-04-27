import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Bug,
  Settings2,
  ChevronDown,
  Calendar,
  DollarSign,
  BarChart3,
  Zap,
  Activity,
  History,
  Target,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RightPanelProps {
  onRun?: () => void;
  isRunning?: boolean;
}

export function RightPanel({ onRun, isRunning }: RightPanelProps) {
  const [symbol, setSymbol] = useState("ETH/USDT (Binance)");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2023-12-31");
  const [capital, setCapital] = useState("$100,000.00");
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (isCollapsed) {
    return (
      <div className="w-[48px] bg-[#020617] border-l border-white/5 flex flex-col shrink-0 items-center py-4 relative z-30 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] transition-all">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-white/10 rounded-sm text-muted-foreground/40 hover:text-primary transition-all"
          title="Expand Settings"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <div className="flex flex-col gap-2 p-2">
          <button
            onClick={onRun}
            disabled={isRunning}
            className={cn(
              "w-8 h-8 rounded-sm flex items-center justify-center transition-all",
              isRunning ? "bg-primary/50 text-black animate-pulse" : "bg-primary hover:bg-primary/90 text-black shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            )}
            title="Run Strategy"
          >
            {isRunning ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-[#020617] border-l border-white/5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar relative z-30 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] transition-all">
      {/* Primary Action Buttons */}
      <div className="p-4 flex gap-2 border-b border-white/[0.03] bg-white/[0.01]">
        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            "flex-1 bg-amber-500 hover:bg-amber-400 text-black h-9 rounded-sm flex items-center justify-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
            isRunning && "animate-pulse"
          )}
        >
          {isRunning ? (
            <Activity className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          {isRunning ? "PROCESSING..." : "RUN STRATEGY"}
        </button>
        <button className="w-10 bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground/60 h-9 rounded-sm flex items-center justify-center transition-all border border-white/5 active:scale-[0.95]">
          <Bug className="w-4 h-4" />
        </button>
        <button onClick={() => setIsCollapsed(true)} className="w-10 bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground/40 hover:text-muted-foreground h-9 rounded-sm flex items-center justify-center transition-all border border-white/5 active:scale-[0.95]">
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-8">
        {/* Backtest Configuration */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-foreground/80">
              Backtest_Config
            </h3>
          </div>

          <div className="space-y-4">
            {/* Symbol Selection */}
            <div className="space-y-2">
              <label className="text-[8px] font-mono font-black uppercase text-muted-foreground/20 tracking-widest">
                SYMBOL / PAIR
              </label>
              <div className="h-9 bg-black/40 border border-white/5 rounded-sm flex items-center px-3 text-foreground/70 justify-between group cursor-pointer hover:border-primary/20 transition-all">
                <span className="text-[10px] font-mono tracking-tight">{symbol}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-[8px] font-mono font-black uppercase text-muted-foreground/20 tracking-widest">
                DATE RANGE
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-9 bg-black/40 border border-white/5 rounded-sm flex items-center px-3 text-[10px] font-mono text-foreground/50 hover:border-primary/20 cursor-text transition-all">
                  {startDate}
                </div>
                <div className="h-9 bg-black/40 border border-white/5 rounded-sm flex items-center px-3 text-[10px] font-mono text-foreground/50 hover:border-primary/20 cursor-text transition-all">
                  {endDate}
                </div>
              </div>
            </div>

            {/* Capital */}
            <div className="space-y-2">
              <label className="text-[8px] font-mono font-black uppercase text-muted-foreground/20 tracking-widest">
                INITIAL CAPITAL
              </label>
              <div className="h-9 bg-black/40 border border-white/5 rounded-sm flex items-center px-3 text-[10px] font-mono text-foreground/70 hover:border-primary/20 transition-all">
                {capital}
              </div>
            </div>
          </div>
        </section>

        <div className="h-[1px] w-full bg-white/[0.03]" />

        {/* Performance Metrics */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-secondary" />
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-foreground/80">
                Metrics_Buffer
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-secondary/5 border border-secondary/10">
              <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
              <span className="text-[7px] font-mono font-black text-secondary uppercase tracking-widest">LIVE_FEED</span>
            </div>
          </div>

          {/* Sparkline Chart Simulation */}
          <div className="h-32 w-full bg-black/40 border border-white/5 rounded-sm mb-4 relative overflow-hidden group">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#2563eb 0.5px, transparent 0.5px)', backgroundSize: '8px 8px' }} />

            <svg className="w-full h-full p-2" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,10 T100,5"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              />
              <path
                d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,10 T100,5 L100,40 L0,40 Z"
                fill="url(#chartGradient)"
              />
              <circle cx="100" cy="5" r="1.5" fill="#10b981" className="animate-pulse" />
            </svg>

            <div className="absolute top-2 right-2 flex flex-col items-end">
              <span className="text-secondary font-mono text-[10px] font-black tracking-tight drop-shadow-md">+18.4%</span>
            </div>
          </div>

          {/* Grid Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "CAGR", value: "24.5%", color: "text-foreground/80" },
              { label: "MAX DD", value: "-4.2%", color: "text-rose-500" },
              { label: "SHARPE", value: "1.82", color: "text-foreground/80" },
              { label: "WIN RATE", value: "62%", color: "text-foreground/80" }
            ].map((m) => (
              <div key={m.label} className="p-3 bg-black/40 border border-white/5 rounded-sm hover:border-white/10 transition-all group cursor-crosshair">
                <span className="block text-[7px] text-muted-foreground/20 font-mono font-black uppercase tracking-[0.2em] mb-1 group-hover:text-primary/40 transition-colors">
                  {m.label}
                </span>
                <span className={cn("block text-sm font-mono font-black tabular-nums tracking-tighter", m.color)}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Tactical Feed */}
        <section className="space-y-4 pt-2">
            <div className="flex items-center gap-2 mb-1">
              <History className="w-3.5 h-3.5 text-muted-foreground/20" />
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                Recent_Audit
              </h3>
            </div>
            <div className="space-y-3">
                {[
                    { id: 1, type: "EXEC", msg: "Buy signal at 2341.2", time: "12s" },
                    { id: 2, type: "RISK", msg: "Margin buffer 12.4%", time: "1m" }
                ].map(item => (
                    <div key={item.id} className="flex items-center justify-between text-[9px] font-mono">
                        <div className="flex items-center gap-2">
                            <span className={item.type === 'RISK' ? 'text-amber-500' : 'text-primary'}>[{item.type}]</span>
                            <span className="text-muted-foreground/40">{item.msg}</span>
                        </div>
                        <span className="text-muted-foreground/10">{item.time}</span>
                    </div>
                ))}
            </div>
        </section>
      </div>
    </div>
  );
}
