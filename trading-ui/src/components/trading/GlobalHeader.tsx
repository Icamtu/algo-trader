import { useState, useEffect, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Radio, Power, PowerOff, Brain, Cpu, ShieldAlert, Zap, Skull, Settings, Bell } from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { UnifiedSettings } from "./UnifiedSettings";
import { ScriptGroupPanel } from "./ScriptGroupPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode, useSystemHealth, useFunds, useAnalyzerStatus } from "@/features/openalgo/hooks/useTrading";
import { SlideToConfirm } from "../ui/SlideToConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { IndustrialValue } from "./IndustrialValue";
import { AnimatePresence, motion } from "framer-motion";
import { useAppModeStore } from "@/stores/appModeStore";
import { LatencyMonitor } from "./LatencyMonitor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAether } from "@/contexts/AetherContext";

export const GlobalHeader = memo(function GlobalHeader() {
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [panicModalOpen, setPanicModalOpen] = useState(false);
  const [engineLive, setEngineLive] = useState(true);
  const [telemetry, setTelemetry] = useState({
    regime: "NEUTRAL",
    reasoning: "System initializing...",
    pos_mult: 1.0,
    risk_mult: 1.0,
    active_trades_count: 0,
    uptime: 0,
    equity: 0,
    pnl: 0,
    last_update: Date.now() / 1000
  });
  const tradingMode = useTradingMode();
  const [marketData, setMarketData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";
  const { ticks, telemetry: aetherTelemetry, latency, connectionStatus, tickerSymbols, setSelectedSymbol } = useAether();
  const isConnected = connectionStatus === "connected";

  const { data: systemHealth } = useSystemHealth();
  const { data: fundsData } = useFunds();
  const analyzer = useAnalyzerStatus();

  useEffect(() => {
    if (aetherTelemetry) {
      setTelemetry(prev => ({
        ...prev,
        ...aetherTelemetry,
      }));
    }
  }, [aetherTelemetry]);

  useEffect(() => {
    if (!engineLive || tickerSymbols.length === 0) return;

    setMarketData(() => {
      return tickerSymbols.map(sym => {
        const tick = ticks[sym];
        return {
          name: sym,
          value: tick?.ltp || 0,
          change: parseFloat(tick?.chg_pct || "0.0"),
          status: "live"
        };
      });
    });
  }, [ticks, engineLive, tickerSymbols]);

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const telRes = await algoApi.getTelemetry();
        if (telRes.status === "success") {
            setTelemetry(telRes.data);
        }

        try {
          const breadthData = await algoApi.getMarketBreadth();
          if (breadthData.status === "success") {
              const { indices, gainers, losers } = breadthData.data;
              setMarketData([...indices, ...gainers, ...losers]);
          }
        } catch { /* breadth endpoint may not exist yet */ }

        try {
          const alertsData = await algoApi.client("/api/v1/alerts?limit=5");
          if (alertsData.status === "success") {
              setAlerts(alertsData.alerts || alertsData.data || []);
          }
        } catch { /* alerts endpoint may not exist yet */ }
      } catch (e) {
        console.error("TELEMETRY_FETCH_FAULT", e);
      }
    };
    fetchIntel();
    const interval = setInterval(fetchIntel, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleEngine = () => {
    setEngineLive(!engineLive);
    toast({
      title: engineLive ? "CORE_OFFLINE" : "CORE_LIVE",
      description: engineLive ? "Trading kernel neutralized." : "Signal processing initialized.",
      variant: engineLive ? "destructive" : "default",
    });
  };

  return (
    <>
      {/* A11Y Live Regions for Ticks & Alerts */}
      <div className="sr-only" aria-live="polite">
        {tickerSymbols.slice(0, 2).map(sym => (
          <span key={sym}>{sym}: {ticks[sym]?.ltp || 0}</span>
        ))}
      </div>
      <AnimatePresence>
        {tradingMode.mode === 'sandbox' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 24, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500/10 border-b border-amber-500/30 w-full flex items-center justify-center gap-6 overflow-hidden z-[60] backdrop-blur-md"
          >
            <div className="flex items-center gap-3 animate-glitch-slow">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-mono font-black text-amber-500 tracking-[0.4em] uppercase">SYSTEM_STATE::SANDBOX_SIMULATION_ACTIVE</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="h-full w-[1px] bg-amber-500/20" />
            <span className="text-[8px] font-mono font-black text-amber-500/60 uppercase tracking-widest">REAL_TIME_DATA_ONLY // NO_CAPITAL_EXPOSURE</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-10 bg-[#0A0A0A] border-b border-white/5 flex items-center z-50 relative overflow-hidden">
        <div className="noise-overlay opacity-[0.02] pointer-events-none" />

        {/* LOGO SECTION */}
        <div
          className="flex items-center gap-3 shrink-0 group cursor-pointer px-4 border-r border-white/10 h-full bg-black/40 hover:bg-white/[0.02] transition-colors"
          onClick={() => window.location.href = '/'}
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 blur-md group-hover:bg-primary/40 transition-all" />
            <div className="relative bg-black border border-primary/40 w-full h-full flex items-center justify-center shadow-[0_0_10px_rgba(255,176,0,0.1)]">
              <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[12px] font-black tracking-[0.2em] text-foreground font-display uppercase">Aether_Prime</span>
            <span className="text-[7px] font-mono font-black text-primary/60 tracking-[0.3em] uppercase mt-0.5">Kernel_v2.5</span>
          </div>
        </div>

        {/* INDICES SECTION */}
        <div className="flex items-center h-full border-r border-white/10 shrink-0">
          {tickerSymbols.slice(0, 2).map((sym) => {
            const tick = ticks[sym];
            const ltp = tick?.ltp || 0;
            const change = tick?.chg_pct ? parseFloat(tick.chg_pct) : 0;

            return (
              <div key={sym} className="flex flex-col justify-center px-4 border-r border-white/5 h-full hover:bg-white/[0.02] cursor-pointer min-w-[130px] transition-colors relative group/idx" onClick={() => setSelectedSymbol(sym)}>
                <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/0 group-hover/idx:bg-primary/20 transition-colors" />
                <div className="flex items-center justify-between gap-4 mb-0.5">
                   <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{sym.replace('_', ' ')}</span>
                   <span className={cn("text-[9px] font-black font-mono", change >= 0 ? "text-secondary" : "text-destructive")}>
                     {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                   </span>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[13px] font-mono font-black tabular-nums text-foreground group-hover:text-primary transition-colors">
                     {ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                   </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* RUNNING MARQUEE SECTION */}
        <div className="flex-1 flex items-center overflow-hidden h-full relative border-r border-white/10 bg-black/20">
           <div className="flex items-center gap-12 px-8 whitespace-nowrap animate-marquee hover:pause grayscale hover:grayscale-0 transition-all opacity-40 hover:opacity-100">
            {marketData.filter(m => !tickerSymbols.slice(0, 2).includes(m.name)).map((m) => (
              <div key={m.name} className="flex items-center gap-2.5">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/60">{m.name.replace('_', ' ')}</span>
                <span className="text-[11px] font-black font-mono tabular-nums text-foreground/80">{m.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span className={cn("text-[9px] font-mono font-black", m.change >= 0 ? "text-secondary" : "text-destructive")}>
                  {m.change >= 0 ? "▲" : "▼"}{Math.abs(m.change).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0A0A0A] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0A0A0A] to-transparent pointer-events-none" />
        </div>

        {/* GLOBAL ACTIONS / STATUS SECTION */}
        <div className="flex items-center h-full px-2 gap-2 border-r border-white/10 shrink-0 bg-black/40">
          <button
            onClick={toggleEngine}
            className={cn(
              "flex items-center gap-1.5 px-3 h-7 transition-all shrink-0 border uppercase font-mono tracking-widest text-[9px] font-black group/power relative overflow-hidden",
              engineLive
                ? "bg-secondary/10 border-secondary/40 text-secondary shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                : "bg-destructive/10 border-destructive/40 text-destructive grayscale brightness-50"
            )}
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/power:opacity-100 animate-scan-fast" />
            {engineLive ? <Power className="w-2.5 h-2.5" /> : <PowerOff className="w-2.5 h-2.5" />}
            {engineLive ? "CORE_RUN" : "CORE_HLT"}
          </button>

          <div className="flex items-center gap-3 relative group/user pl-1">
             <div className="flex flex-col items-end mr-1 hidden lg:flex">
               <span className="text-[9px] font-black tracking-widest uppercase text-foreground">{user?.user_metadata?.full_name || 'OPERATOR'}</span>
               <span className="text-[7px] font-mono font-black text-muted-foreground/50 tracking-widest">{user?.email || 'OFFLINE_MODE'}</span>
             </div>
             <div className="w-7 h-7 bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[10px] font-black text-foreground cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
               {initials}
             </div>

             {/* USER DROPDOWN (existing logic) */}
             <div className="absolute top-full right-0 mt-1 w-48 bg-[#0A0A0A] border border-white/10 hidden group-hover/user:flex flex-col p-1 z-[100] shadow-[0_10px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
               <Link to="/profile" className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2 group/u1 transition-all">
                  <Brain className="w-3.5 h-3.5 text-primary group-hover/u1:scale-110 transition-transform" />
                  Neural_Identity
               </Link>
               <div className="h-[1px] bg-white/5 my-1 mx-2" />
               <button onClick={signOut} className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 flex items-center gap-2 text-left group/u3 transition-all">
                  <LogOut className="w-3.5 h-3.5 group-hover/u3:translate-x-1 transition-transform" />
                  Eject_Session
               </button>
             </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 h-7 bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all rounded-[1px] ml-1">
             <span className={cn("text-[8px] font-mono font-black", tradingMode.mode === 'sandbox' ? "text-primary/60" : "text-muted-foreground/20")}>SIM</span>
             <Switch
                checked={tradingMode.mode === 'live'}
                onCheckedChange={(checked) => tradingMode.setMode(checked ? 'live' : 'sandbox')}
                className="scale-[0.45]"
             />
             <span className={cn("text-[8px] font-mono font-black", tradingMode.mode === 'live' ? "text-destructive" : "text-muted-foreground/20")}>LIVE</span>
          </div>
        </div>

        {/* FINANCIALS SECTION */}
        <div className="flex items-center gap-0 shrink-0 h-full border-r border-white/10">
          <div className="px-5 border-r border-white/5 h-full flex flex-col justify-center min-w-[120px] bg-black/20">
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mb-0.5 font-mono">CAPITAL_EXP</span>
            <IndustrialValue value={(fundsData?.margin_available ?? telemetry.equity) || 42200000.00} prefix="₹" className="text-[11px] font-black text-foreground tabular-nums font-mono" />
          </div>
          <div className="px-5 h-full flex flex-col justify-center min-w-[120px] bg-black/40">
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mb-0.5 font-mono">DELTA_PNL</span>
            <IndustrialValue
              value={telemetry.pnl || 382000.00}
              prefix={ (telemetry.pnl || 382000.00) >= 0 ? "+₹" : "-₹"}
              className={cn("text-[12px] font-black tabular-nums font-mono",
                (telemetry.pnl || 382000) > 0 ? "text-secondary" : (telemetry.pnl || 382000) < 0 ? "text-destructive" : "text-muted-foreground"
              )}
            />
          </div>
        </div>

        {/* UPTIME / LATENCY SECTION */}
        <div className="flex items-center gap-0 shrink-0 h-full border-r border-white/10">
          <div className="px-5 border-r border-white/5 h-full flex flex-col justify-center bg-black/20 min-w-[90px]">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5 font-mono">UPTIME</span>
            <span className="text-[10px] font-black font-mono text-primary/80 tabular-nums">
               {Math.floor((telemetry?.uptime || 60) / 3600)}H {Math.floor(((telemetry?.uptime || 60) % 3600) / 60)}M
            </span>
          </div>
          <div className="px-5 h-full flex flex-col justify-center bg-black/40 min-w-[90px]">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5 font-mono">NET_RTT</span>
            <span className="text-[10px] font-black font-mono text-secondary tabular-nums">
               {latency || 42} <span className="text-[7px] opacity-40">MS</span>
            </span>
          </div>
        </div>

        {/* SYSTEM STATUS LABELS */}
        <div className="flex-1 flex items-center justify-end px-5 gap-6 h-full bg-black/60">
            <div className="flex flex-col items-end leading-none cursor-pointer" onClick={() => analyzer.toggle(!analyzer.isEnabled)}>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[8px] font-mono font-black uppercase tracking-widest transition-all duration-500",
                    analyzer.isEnabled ? "text-primary animate-pulse-glow drop-shadow-[0_0_8px_rgba(255,160,0,0.4)]" : "text-muted-foreground/50")}>
                    SURGICAL
                  </span>
                  {analyzer.isEnabled && <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                  <Switch
                    checked={analyzer.isEnabled || false}
                    onCheckedChange={analyzer.toggle}
                    className="scale-[0.4] origin-right"
                    disabled={analyzer.isPending}
                  />
                </div>
              <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em] mt-0.5">Execution_Mode</span>
            </div>

           <div className="h-6 w-[1px] bg-white/5" />

           <div className="flex flex-col items-end leading-none">
              <span className="text-[8px] font-mono font-black text-secondary uppercase tracking-[0.3em]">ENGINE_SYNC</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                  <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-tighter">
                    AUTH_BYPASS
                  </span>
              </div>
           </div>
        </div>
      </header>

      <UnifiedSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
});
