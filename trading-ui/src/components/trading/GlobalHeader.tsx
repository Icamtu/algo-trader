import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Radio, Power, PowerOff, Brain, Cpu, ShieldAlert, Zap, Skull, Settings, Bell } from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { UnifiedSettings } from "./UnifiedSettings";
import { ScriptGroupPanel } from "./ScriptGroupPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode, useSystemHealth } from "@/features/openalgo/hooks/useTrading";
import { SlideToConfirm } from "../ui/SlideToConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useWebSocket } from "@/hooks/useWebSocket";
import { IndustrialValue } from "./IndustrialValue";
import { AnimatePresence, motion } from "framer-motion";
import { useAppModeStore } from "@/stores/appModeStore";
import { LatencyMonitor } from "./LatencyMonitor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const initialMarkets = [
  { name: "RELIANCE", value: 2984.50, change: 0.0, status: "live" },
  { name: "HDFCBANK", value: 1542.30, change: 0.0, status: "live" },
  { name: "INFY", value: 1478.20, change: 0.0, status: "live" },
  { name: "TCS", value: 3956.70, change: 0.0, status: "live" },
  { name: "NIFTY 50", value: 22456.80, change: 0.0, status: "live" },
  { name: "BANK NIFTY", value: 48123.40, change: 0.0, status: "live" },
];

export function GlobalHeader() {
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [brokerPanelOpen, setBrokerPanelOpen] = useState(false);
  const [scriptPanelOpen, setScriptPanelOpen] = useState(false);
  const [panicModalOpen, setPanicModalOpen] = useState(false);
  const [engineLive, setEngineLive] = useState(true);
  const [intelSettings, setIntelSettings] = useState<{decision_mode: "ai" | "program" | "human"; llm_model: string; provider: "ollama" | "openclaw"; agent_enabled: boolean; agent_error_reason: string}>({ decision_mode: 'ai', llm_model: 'mistral', provider: 'ollama', agent_enabled: true, agent_error_reason: "" });
  const intelRef = useRef<HTMLDivElement | null>(null);
  const [intelDropdownOpen, setIntelDropdownOpen] = useState(false);
  const [telemetry, setTelemetry] = useState({ 
    regime: "NEUTRAL", 
    active_trades_count: 0, 
    uptime: 0,
    equity: 0,
    pnl: 0
  });
  const tradingMode = useTradingMode();
  const { mode, setMode } = useAppModeStore();
  const [marketData, setMarketData] = useState(initialMarkets);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";
  
  const { data: systemHealth } = useSystemHealth();
  const { prices, latency, isConnected } = useWebSocket(initialMarkets.map(m => m.name));

  useEffect(() => {
    if (!engineLive || Object.keys(prices).length === 0) return;
    
    setMarketData(prev => prev.map(m => {
      const livePrice = prices[m.name];
      if (livePrice === undefined) return m;
      const change = ((livePrice - m.value) / m.value) * 100;
      return {
        ...m,
        value: livePrice,
        change: m.change + change,
        status: "live"
      };
    }));
  }, [prices, engineLive]);

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const settings = await algoApi.getSystemSettings();
        setIntelSettings(settings);
        
        const telRes = await algoApi.getTelemetry();
        if (telRes.status === "success") {
            setTelemetry(telRes.data);
        }

        // Fetch Market Breadth (Indices + Gainers + Losers)
        const breadthRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/market/breadth`, {
            headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || "" }
        });
        const breadthData = await breadthRes.json();
        if (breadthData.status === "success") {
            const { indices, gainers, losers } = breadthData.data;
            // Flatten or cycle through them
            setMarketData([...indices, ...gainers, ...losers]);
        }
        // Fetch Alerts
        const alertsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/alerts?limit=5`, {
            headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || "" }
        });
        const alertsData = await alertsRes.json();
        if (alertsData.status === "success") {
            setAlerts(alertsData.alerts || alertsData.data || []);
        }
      } catch (e) {
        console.error("TELEMETRY_FETCH_FAULT", e);
      }
    };
    fetchIntel();
    const interval = setInterval(fetchIntel, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (intelRef.current && !intelRef.current.contains(e.target as Node)) {
        setIntelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateIntelSetting = async (key: string, value: any) => {
    const updated = { ...intelSettings, [key]: value };
    setIntelSettings(updated);
    try {
      await algoApi.updateSystemSettings(updated);
      toast({ title: "INTEL_BUFFER_UP", description: `${key.toUpperCase()}::${value}` });
    } catch {
      toast({ variant: "destructive", title: "INTEL_WRITE_FAULT", description: "Storage sync failed." });
    }
  };

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
      {/* Sandbox Warning Banner */}
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

      <header className="h-10 bg-background border-b border-border flex items-center px-2 z-50 relative industrial-grid overflow-hidden">
        <div className="scanline opacity-10" />
        
        {/* Brand Unit */}
        <div 
          className="flex items-center gap-2 shrink-0 group cursor-pointer pr-4 border-r border-border h-full"
          onClick={() => window.location.href = '/'}
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 blur-md group-hover:bg-primary/40 transition-all" />
            <div className="relative bg-background border-2 border-primary/20 w-full h-full flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col leading-none mr-2">
            <span className="text-[12px] font-black tracking-widest text-foreground font-display uppercase">Aether</span>
            <span className="text-[7px] font-mono font-black text-primary animate-pulse tracking-[0.2em] mt-0.5">PRIME_v2.5</span>
          </div>

          {/* Regime Pulse */}
          <div className="flex items-center gap-1.5 px-2 border-l border-border/10">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px] ${
              telemetry.regime === "BULLISH" ? "bg-secondary shadow-secondary" :
              telemetry.regime === "BEARISH" ? "bg-destructive shadow-destructive" :
              "bg-muted-foreground/30 shadow-transparent"
            }`} />
            <span className={`text-[8px] font-mono font-black uppercase tracking-[0.2em] ${
              telemetry.regime === "BULLISH" ? "text-secondary" :
              telemetry.regime === "BEARISH" ? "text-destructive" :
              "text-muted-foreground/40"
            }`}>
              {telemetry.regime}
            </span>
          </div>
        </div>

        {/* Global Controls Grid */}
        <div className="flex items-center h-full px-2 gap-2 border-r border-border">
          <button 
            onClick={toggleEngine}
            className={`flex items-center gap-2 px-3 h-7 transition-all shrink-0 border uppercase font-mono tracking-[0.2em] text-[9px] font-black ${
              engineLive 
                ? "bg-secondary/10 border-secondary/40 text-secondary" 
                : "bg-destructive/10 border-destructive/40 text-destructive grayscale"
            }`}
          >
            {engineLive ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
            {engineLive ? "RUN" : "HLT"}
          </button>

          {/* Mode Selector */}
          <div className="flex bg-card/50 p-0.5 border border-border">
            <button 
              onClick={() => tradingMode.setMode('sandbox')}
              className={`px-2 h-6 text-[8px] font-mono font-black transition-all ${
                tradingMode.mode === 'sandbox' 
                  ? "bg-primary text-black" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SANDBOX
            </button>
            <Dialog>
              <DialogTrigger asChild>
                <button 
                  className={`px-2 h-6 text-[8px] font-mono font-black transition-all ${
                    tradingMode.mode === 'live' 
                      ? "bg-destructive text-destructive-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  LIVE_PROD
                </button>
              </DialogTrigger>
              <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 border-2 border-destructive p-8 w-[400px] z-[100] shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                <DialogHeader>
                  <DialogTitle className="text-destructive font-display text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8" />
                    LIVE_PROD_ELEVATION
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-6">
                  <div className="p-5 bg-destructive/10 border-2 border-destructive/30 font-mono text-[11px] leading-tight text-destructive-foreground relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 bg-destructive text-[8px] font-black text-white">LVL_4_WARN</div>
                    <p className="font-black mb-3 tracking-widest flex items-center gap-2">
                       <Radio className="w-3 h-3 animate-pulse" />
                       CRITICAL_PROTOCOL_ELEVATION:
                    </p>
                    <p className="opacity-80">You are transitioning to REAL-CAPITAL execution. Every byte transmitted will impact live equity. Ensure all signal parameters are verified.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border border-white/10 bg-white/5 flex flex-col gap-1">
                      <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50">Broker_Gate</span>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping" />
                        <span className="text-[10px] font-black font-mono">ARMED</span>
                      </div>
                    </div>
                    <div className="p-3 border border-white/10 bg-white/5 flex flex-col gap-1">
                      <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50">Risk_Engine</span>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping" />
                        <span className="text-[10px] font-black font-mono">LIVE_CAP</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <DialogTrigger asChild>
                      <button 
                        onClick={() => tradingMode.setMode('live')}
                        className="w-full h-14 bg-destructive hover:bg-destructive/80 text-white font-black font-mono tracking-[0.4em] transition-all uppercase flex items-center justify-center gap-4 group"
                      >
                        <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" />
                        ENGAGE_LIVE_TRADING
                        <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" />
                      </button>
                    </DialogTrigger>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Identity Selector Upgrade */}
          <div className="flex items-center gap-3 px-3 h-8 bg-card/20 border border-border ml-2 group">
            <span className={cn(
              "text-[7px] font-mono font-black transition-colors",
              mode === 'OA' ? "text-teal-500" : "text-muted-foreground/30"
            )}>OA</span>
            <Switch 
              checked={mode === 'AD'} 
              onCheckedChange={(checked) => setMode(checked ? 'AD' : 'OA')}
              className="scale-[0.6]"
            />
            <span className={cn(
              "text-[7px] font-mono font-black transition-colors",
              mode === 'AD' ? "text-amber-500" : "text-muted-foreground/30"
            )}>AD</span>
          </div>

          {/* Global Settings */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center w-8 h-7 border border-primary/20 bg-primary/5 text-primary hover:bg-primary/20 transition-all"
            title="Terminal Settings"
          >
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
          </button>
        </div>

        {/* System Intelligence Matrix */}
        <div className="relative px-2 border-r border-border h-full flex items-center" ref={intelRef}>
          <button 
            onClick={() => setIntelDropdownOpen(!intelDropdownOpen)}
            className={`flex items-center gap-2 px-3 h-7 border transition-all font-mono text-[9px] font-black tracking-widest uppercase ${
              !intelSettings.agent_enabled ? "opacity-30" : "bg-card hover:border-primary/40"
            }`}
          >
            {intelSettings.decision_mode === 'ai' ? <Brain className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
            {intelSettings.decision_mode}
            <ChevronDown className="w-2.5 h-2.5 opacity-30" />
          </button>

          <AnimatePresence>
            {intelDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full left-2 mt-1 w-56 bg-background border-2 border-border shadow-2xl z-50 p-3 font-mono industrial-grid"
              >
                <div className="scanline opacity-10" />
                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-4 border-b border-border pb-1">Neural_Parameters</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between group">
                    <span className="text-[9px] font-black uppercase text-muted-foreground group-hover:text-foreground transition-colors">AUTO_EXEC</span>
                    <Switch
                        checked={intelSettings.agent_enabled}
                        onCheckedChange={(checked) => updateIntelSetting('agent_enabled', checked)}
                        className="scale-75"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Market Telemetry Strip */}
        <div className="flex flex-1 items-center gap-0 overflow-hidden h-full relative group">
           <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent z-10" />
           <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent z-10" />
           <div className="flex items-center gap-8 px-4 whitespace-nowrap">
            {marketData.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] opacity-30">{m.name}</span>
                <IndustrialValue value={m.value} className="text-[10px] font-black tabular-nums" />
                <span className={`text-[8px] font-mono font-black ${m.change >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Registry */}
        <div className="flex items-center gap-4 shrink-0 px-4 border-l border-border h-full bg-card/5">
          <div className="text-right flex flex-col items-end">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5">EQY</span>
            <IndustrialValue value={telemetry.equity} prefix="₹" className="text-[10px] font-black text-foreground" />
          </div>
          <div className="text-right flex flex-col items-end pr-4 border-r border-border/10">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5">DLT</span>
            <IndustrialValue 
              value={telemetry.pnl} 
              prefix={telemetry.pnl >= 0 ? "+₹" : "-₹"} 
              className={cn("text-[10px] font-black tabular-nums", 
                telemetry.pnl > 0 ? "text-secondary" : telemetry.pnl < 0 ? "text-destructive" : "text-muted-foreground"
              )} 
            />
          </div>
          
          <div className="text-right flex flex-col items-end pr-4 border-r border-border/10">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5">UPTIME</span>
            <span className="text-[10px] font-black font-mono text-primary">
               {Math.floor((telemetry?.uptime || 0) / 3600)}H {Math.floor(((telemetry?.uptime || 0) % 3600) / 60)}M
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className={cn(
                  "w-7 h-7 flex items-center justify-center border border-border/40 bg-card/10 hover:bg-card/30 transition-all relative",
                  alerts.length > 0 && "text-primary border-primary/40"
                )}
              >
                 <Bell className="w-4 h-4" />
                 {alerts.length > 0 && (
                   <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,160,0,0.8)]" />
                 )}
              </button>

              <AnimatePresence>
                {isAlertsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-72 bg-background border-2 border-border shadow-2xl z-[150] p-1 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Active_Alerts</span>
                      <span className="text-[8px] font-mono text-muted-foreground">{alerts.length} Total</span>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {alerts.length === 0 ? (
                        <div className="py-8 text-center text-[9px] font-mono text-muted-foreground uppercase opacity-40">Zero_Threats_Detected</div>
                      ) : (
                        alerts.map((alert, i) => (
                          <div key={i} className="p-3 border border-transparent hover:border-border hover:bg-white/5 transition-all mb-1 last:mb-0 group/alert">
                            <div className="flex items-start justify-between mb-1">
                              <span className={cn("text-[8px] font-black uppercase tracking-tighter", 
                                alert.type === "CRITICAL" ? "text-destructive" : "text-primary"
                              )}>
                                {alert.tag || alert.type || "SIGNAL"}
                              </span>
                              <span className="text-[7px] font-mono text-muted-foreground opacity-50">{alert.timestamp?.split('T')[1]?.slice(0,5) || "NOW"}</span>
                            </div>
                            <p className="text-[10px] leading-tight text-foreground font-semibold line-clamp-2">{alert.message || alert.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <Link 
                      to="/alerts" 
                      onClick={() => setIsAlertsOpen(false)}
                      className="mt-1 block w-full py-2 bg-white/5 hover:bg-white/10 text-[8px] font-black text-center uppercase tracking-[0.2em] border-t border-border"
                    >
                      View_Command_Center
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Dialog open={panicModalOpen} onOpenChange={setPanicModalOpen}>
                <DialogTrigger asChild>
                    <button className="w-7 h-7 flex items-center justify-center border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all">
                       <Skull className="w-4 h-4" />
                    </button>
                </DialogTrigger>
                <DialogContent className="bg-background border-2 border-destructive p-6">
                    <DialogHeader>
                        <DialogTitle className="text-destructive font-display text-xl font-black uppercase tracking-tighter">TERMINATION_GATE</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="font-mono text-[11px] text-foreground font-black">IMMEDIATE LIQUIDATION INITIATED.</p>
                        <SlideToConfirm label="EXEC_KILL_PROTOCOL" onConfirm={async () => { /* panic */ }} />
                    </div>
                </DialogContent>
            </Dialog>

            <Link to="/infrastructure" className="flex items-center">
              <LatencyMonitor 
                latency={latency} 
                isConnected={isConnected} 
                className="h-8 border-none bg-transparent"
              />
            </Link>
            
            <div className="flex flex-col items-end gap-0.5 px-3 h-8 justify-center border-l border-border/10">
               <span className="text-[7px] font-mono font-black text-foreground/40 uppercase tracking-tighter">ENGINE_SYNC</span>
               <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px]", 
                    isConnected ? "bg-secondary shadow-secondary" : "bg-destructive shadow-destructive")} />
                  <span className="text-[7px] font-mono font-black text-foreground/40 uppercase tracking-tighter">
                    {systemHealth?.algo_engine?.status === "HEALTHY" ? "AUTH::PASS" : "AUTH::FAIL"}
                  </span>
               </div>
            </div>
            
            <div className="flex items-center gap-3 relative group/user">
               <div className="w-7 h-7 bg-primary flex items-center justify-center font-mono text-[10px] font-black text-black cursor-pointer group-hover:bg-primary/80">
                 {initials}
               </div>
               
               {/* User Dropdown Overlay */}
               <div className="absolute top-full right-0 mt-1 w-48 bg-background border-2 border-border hidden group-hover/user:flex flex-col p-1 z-[100] shadow-2xl overflow-hidden">
                 <div className="scanline opacity-10" />
                 <Link to="/profile" className="px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2">
                    <Brain className="w-3 h-3 text-primary" />
                    Supabase_Profile
                 </Link>
                 <Link to="/roles" className="px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3 text-amber-500" />
                    Role_Management
                 </Link>
                 <div className="h-[1px] bg-border my-1" />
                 <button onClick={signOut} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 flex items-center gap-2 text-left">
                    <LogOut className="w-3.5 h-3.5" />
                    Shutdown_Session
                 </button>
               </div>
            </div>
          </div>
        </div>
      </header>

      <UnifiedSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ScriptGroupPanel isOpen={scriptPanelOpen} onClose={() => setScriptPanelOpen(false)} />
    </>
  );
}
