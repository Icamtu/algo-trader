import { useState, useEffect, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { Activity, Bot, ChevronDown, Command, Gauge, Landmark, LogOut, Radio, Power, PowerOff, Brain, Cpu, ShieldAlert, Zap, Skull, Settings, Bell, Wifi, WifiOff, Palette, Clock, Search, UserRound, Wallet } from "lucide-react";
import { algoApi } from "@/features/aetherdesk/api/client";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { UnifiedSettings } from "./UnifiedSettings";
import { ScriptGroupPanel } from "./ScriptGroupPanel";
import { ModeIndicator } from "./ModeIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode, useSystemHealth, useFunds, useAnalyzerStatus } from "@/features/aetherdesk/hooks/useTrading";
import { SlideToConfirm } from "../ui/SlideToConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { IndustrialValue } from "./IndustrialValue";
import { AnimatePresence, motion } from "framer-motion";
import { useAppModeStore } from "@/stores/appModeStore";
import { LatencyMonitor } from "./LatencyMonitor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAether } from "@/contexts/AetherContext";

interface HeaderMarket {
  name: string;
  value: number;
  change: number;
  status?: string;
}

interface HeaderAlert {
  id?: string | number;
  title?: string;
  type?: string;
  message?: string;
  description?: string;
}

interface ServiceHealth {
  status?: string;
}

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
  const [marketData, setMarketData] = useState<HeaderMarket[]>([]);
  const [alerts, setAlerts] = useState<HeaderAlert[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";
  const { ticks, telemetry: aetherTelemetry, latency, connectionStatus, tickerSymbols, setSelectedSymbol } = useAether();
  const isConnected = connectionStatus === "connected";

  const { data: systemHealth } = useSystemHealth();
  const { data: fundsData } = useFunds();
  const analyzer = useAnalyzerStatus();

  // Market clock (NSE session state)
  const getMarketSessionState = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // NSE: 09:15–15:30 (555–930 minutes)
    if (timeInMinutes >= 555 && timeInMinutes < 930) {
      return { state: "OPEN", color: "text-secondary" };
    } else if (timeInMinutes >= 900 && timeInMinutes < 930) {
      return { state: "CLOSING", color: "text-amber-500" };
    }
    return { state: "CLOSED", color: "text-muted-foreground/50" };
  };
  const marketSession = getMarketSessionState();

  // Environment mode color-coding
  const environmentColors = {
    LIVE: "bg-destructive/10 border-destructive/40 text-destructive",
    SANDBOX: "bg-amber-500/10 border-amber-500/40 text-amber-500",
    BACKTEST: "bg-blue-500/10 border-blue-500/40 text-blue-500"
  };
  const currentEnv = tradingMode.mode === 'live' ? 'LIVE' : (tradingMode.mode === 'sandbox' ? 'SANDBOX' : 'BACKTEST');
  const envColor = environmentColors[currentEnv as keyof typeof environmentColors] || environmentColors.SANDBOX;

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

  const healthyServices = systemHealth
    ? Object.values(systemHealth).filter((service: ServiceHealth) => service?.status === "HEALTHY").length
    : 0;
  const serviceTotal = systemHealth ? Object.keys(systemHealth).length : 0;
  const healthLabel = serviceTotal > 0 ? `${healthyServices}/${serviceTotal}` : isConnected ? "LIVE" : "OFFLINE";
  const headerMarkets =
    tickerSymbols.length > 0
      ? tickerSymbols.slice(0, 3).map((sym) => {
          const tick = ticks[sym];
          return {
            name: sym,
            value: tick?.ltp || 0,
            change: tick?.chg_pct ? parseFloat(tick.chg_pct) : 0,
          };
        })
      : marketData.slice(0, 3);
  const iconButtonClass =
    "size-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70";

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

      <header className="h-10 bg-[#0A0A0A] border-b border-white/5 flex items-center z-50 relative overflow-hidden" role="banner">
        <div className="noise-overlay opacity-[0.02] pointer-events-none" />

        {/* LOGO + ENVIRONMENT CHIP (LEFT) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo */}
          <div
            className="flex items-center gap-3 group cursor-pointer px-4 border-r border-white/10 h-full bg-black/40 hover:bg-white/[0.02] transition-colors"
            onClick={() => window.location.href = '/'}
          >
            <div className="relative w-6 h-6 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-md group-hover:bg-primary/40 transition-all" />
              <div className="relative bg-black border border-primary/40 w-full h-full flex items-center justify-center shadow-[0_0_10px_rgba(255,176,0,0.1)]">
                <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col leading-none hidden md:flex">
              <span className="text-[14px] font-black tracking-[-0.05em] text-cyan-400 font-display uppercase">AetherDesk</span>
              <span className="text-[7px] font-mono font-black text-slate-500 tracking-[0.3em] uppercase mt-0.5">STRAT_OS // v6.0.4</span>
            </div>
          </div>

          {/* Environment Chip */}
          <div className={cn("px-3 h-7 border rounded-[2px] flex items-center gap-2 shrink-0 font-mono text-[8px] font-black uppercase tracking-widest", envColor)}>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {currentEnv}
          </div>
        </div>

        {/* CENTER: MARKET CLOCK + INDICES (hidden on mobile) */}
        <div className="hidden md:flex items-center h-full border-r border-white/10 shrink-0">
          {/* Market Clock */}
          <div className="flex flex-col justify-center px-4 border-r border-white/5 h-full bg-black/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/40">SESSION</span>
            </div>
            <span className={cn("text-[10px] font-black font-mono tracking-widest", marketSession.color)}>{marketSession.state}</span>
          </div>

          {/* Ticker symbols */}
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

        {/* RUNNING MARQUEE SECTION (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 items-center overflow-hidden h-full relative border-r border-white/10 bg-black/20">
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

        {/* CENTER-RIGHT: COMMAND PALETTE + NOTIFICATIONS + BROKER STATUS */}
        <div className="flex items-center h-full gap-1.5 px-2 border-r border-white/10 shrink-0 bg-black/20">
          {/* Command Palette Trigger (⌘K) */}
          <button
            aria-label="Open command palette (⌘K)"
            className="hidden sm:flex items-center gap-2 px-3 h-7 bg-white/[0.03] border border-white/10 hover:border-primary/40 hover:bg-primary/[0.05] transition-all rounded-[2px] text-[8px] font-mono text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          >
            <Palette className="w-3 h-3" />
            <span>⌘K</span>
          </button>

          {/* Notifications Bell */}
          <button
            aria-label="Notifications"
            aria-haspopup="menu"
            className="relative w-7 h-7 flex items-center justify-center border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all rounded-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 group"
          >
            <Bell className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[7px] font-black text-white flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>

          {/* Broker Connectivity Dot (Shoonya status) */}
          <button
            aria-label={isConnected ? "Broker connected (Shoonya)" : "Broker disconnected"}
            className={cn(
              "w-7 h-7 flex items-center justify-center border rounded-[2px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-black",
              isConnected
                ? "bg-secondary/10 border-secondary/40 hover:bg-secondary/20"
                : "bg-destructive/10 border-destructive/40 hover:bg-destructive/20"
            )}
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-secondary animate-pulse" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-destructive" />
            )}
          </button>
        </div>

        {/* RIGHT: ENGINE CONTROL + USER MENU + MODE TOGGLE */}
        <div className="flex items-center h-full px-2 gap-2 border-r border-white/10 shrink-0 bg-black/40">
          <button
            onClick={toggleEngine}
            aria-label={engineLive ? "Stop trading engine" : "Start trading engine"}
            aria-pressed={engineLive}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 min-w-[80px] transition-all shrink-0 border uppercase font-mono tracking-widest text-[9px] font-black group/power relative overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-black hidden sm:flex",
              engineLive
                ? "bg-secondary/10 border-secondary/40 text-secondary shadow-[0_0_15px_rgba(34,197,94,0.1)] focus-visible:ring-secondary/60"
                : "bg-destructive/10 border-destructive/40 text-destructive grayscale brightness-50 focus-visible:ring-destructive/60"
            )}
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/power:opacity-100 animate-scan-fast" />
            {engineLive ? <Power className="w-2.5 h-2.5" /> : <PowerOff className="w-2.5 h-2.5" />}
            {engineLive ? "CORE_RUN" : "CORE_HLT"}
          </button>

          <div className="flex items-center gap-2 relative group/user pl-1">
             <div className="flex flex-col items-end mr-1 hidden lg:flex">
               <span className="text-[9px] font-black tracking-widest uppercase text-foreground">{user?.user_metadata?.full_name || 'OPERATOR'}</span>
               <span className="text-[7px] font-mono font-black text-muted-foreground/50 tracking-widest">{user?.email || 'OFFLINE_MODE'}</span>
             </div>
             <button
               aria-label={`User menu for ${user?.user_metadata?.full_name || user?.email || 'Operator'}`}
               aria-haspopup="menu"
               className="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[10px] font-black text-foreground cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
             >
               {initials}
             </button>

             {/* USER DROPDOWN — keyboard accessible via focus-within */}
             <div
               role="menu"
               className="absolute top-full right-0 mt-1 w-48 bg-[#0A0A0A] border border-white/10 hidden group-hover/user:flex group-focus-within/user:flex flex-col p-1 z-[100] shadow-[0_10px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
             >
               <Link
                 to="/profile"
                 role="menuitem"
                 className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2 group/u1 transition-all focus-visible:outline-none focus-visible:bg-white/5"
               >
                  <Brain className="w-3.5 h-3.5 text-primary group-hover/u1:scale-110 transition-transform" />
                  Neural_Identity
               </Link>
               <div className="h-[1px] bg-white/5 my-1 mx-2" />
               <button
                 role="menuitem"
                 onClick={signOut}
                 className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 flex items-center gap-2 text-left group/u3 transition-all focus-visible:outline-none focus-visible:bg-destructive/10"
               >
                  <LogOut className="w-3.5 h-3.5 group-hover/u3:translate-x-1 transition-transform" />
                  Eject_Session
               </button>
             </div>
          </div>

          {/* Mode Toggle (hidden on mobile for space) */}
          {/* Mode Indicator Button */}
          <ModeIndicator />
        </div>

        {/* FINANCIALS SECTION (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-0 shrink-0 h-full border-r border-white/10">
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

        {/* UPTIME / LATENCY SECTION (hidden on mobile) */}
        <div className="hidden lg:flex items-center gap-0 shrink-0 h-full border-r border-white/10">
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

        {/* SYSTEM STATUS LABELS (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 items-center justify-end px-5 gap-6 h-full bg-black/60">
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
