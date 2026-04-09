import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Radio, Power, PowerOff, Brain, Cpu, ShieldAlert, Zap, Skull, Settings } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { UnifiedSettings } from "./UnifiedSettings";
import { ScriptGroupPanel } from "./ScriptGroupPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode, useSystemHealth } from "@/hooks/useTrading";
import { SlideToConfirm } from "../ui/SlideToConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useWebSocket } from "@/hooks/useWebSocket";
import { IndustrialValue } from "./IndustrialValue";
import { AnimatePresence, motion } from "framer-motion";

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
  const [intelDropdownOpen, setIntelDropdownOpen] = useState(false);
  const intelRef = useRef<HTMLDivElement>(null);
  const tradingMode = useTradingMode();
  const [marketData, setMarketData] = useState(initialMarkets);
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";
  
  const { data: systemHealth } = useSystemHealth();
  const latency = systemHealth?.algo_engine?.latency || systemHealth?.broker?.latency || 0;

  const { prices } = useWebSocket(initialMarkets.map(m => m.name));

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
      } catch (e) {
        console.error("INTEL_FETCH_FAULT", e);
      }
    };
    fetchIntel();
    const interval = setInterval(fetchIntel, 10000);
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
          <div className="flex flex-col leading-none">
            <span className="text-[12px] font-black tracking-widest text-foreground font-syne uppercase">Aether</span>
            <span className="text-[7px] font-mono font-black text-primary animate-pulse tracking-[0.2em] mt-0.5">PRIME_v2.4</span>
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
            <button 
              onClick={() => tradingMode.setMode('live')}
              className={`px-2 h-6 text-[8px] font-mono font-black transition-all ${
                tradingMode.mode === 'live' 
                  ? "bg-destructive text-destructive-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              LIVE_PROD
            </button>
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
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase">AUTO_EXEC</span>
                    <button
                      onClick={() => updateIntelSetting('agent_enabled', !intelSettings.agent_enabled)}
                      className={`w-8 h-4 border ${intelSettings.agent_enabled ? "bg-primary border-primary" : "bg-card border-border"}`}
                    >
                      <div className={`w-1.5 h-full transition-all ${intelSettings.agent_enabled ? "translate-x-5 bg-black" : "translate-x-0 bg-muted-foreground/30"}`} />
                    </button>
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
            <IndustrialValue value={42200000} prefix="₹" className="text-[10px] font-black text-foreground" />
          </div>
          <div className="text-right flex flex-col items-end pr-4 border-r border-border/10">
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-0.5">DLT</span>
            <IndustrialValue value={382000} prefix="+₹" className="text-[10px] font-black text-secondary" />
          </div>
          
          <div className="flex items-center gap-4">
            <Dialog open={panicModalOpen} onOpenChange={setPanicModalOpen}>
                <DialogTrigger asChild>
                    <button className="w-7 h-7 flex items-center justify-center border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all">
                       <Skull className="w-4 h-4" />
                    </button>
                </DialogTrigger>
                <DialogContent className="bg-background border-2 border-destructive p-6">
                    <DialogHeader>
                        <DialogTitle className="text-destructive font-syne text-xl font-black uppercase tracking-tighter">TERMINATION_GATE</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="font-mono text-[11px] text-foreground font-black">IMMEDIATE LIQUIDATION INITIATED.</p>
                        <SlideToConfirm label="EXEC_KILL_PROTOCOL" onConfirm={async () => { /* panic */ }} />
                    </div>
                </DialogContent>
            </Dialog>

            <Link to="/infrastructure" className="flex flex-col items-end gap-0.5 px-3 h-7 border border-border bg-card justify-center">
              <span className="text-[7px] font-mono font-black text-foreground/40 uppercase">LTNCY::{latency}ms</span>
              <div className="flex items-center gap-1">
                 <Radio className={`w-2 h-2 ${latency < 50 ? 'text-secondary' : 'text-primary'} animate-pulse`} />
                 <span className="text-[7px] font-mono font-black text-foreground/40 uppercase">{systemHealth?.algo_engine?.status === "HEALTHY" ? "AUTH::PASS" : "AUTH::FAIL"}</span>
              </div>
            </Link>
            
            <div className="flex items-center gap-3">
               <div className="w-7 h-7 bg-primary flex items-center justify-center font-mono text-[10px] font-black text-black">
                 {initials}
               </div>
               <button onClick={signOut} className="text-muted-foreground/30 hover:text-destructive">
                 <LogOut className="w-3.5 h-3.5" />
               </button>
            </div>
          </div>
        </div>
      </header>

      <UnifiedSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ScriptGroupPanel isOpen={scriptPanelOpen} onClose={() => setScriptPanelOpen(false)} />
    </>
  );
}
