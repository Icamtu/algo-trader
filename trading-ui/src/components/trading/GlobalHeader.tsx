import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Wifi, Users, Bell, Layers, LogOut, Radio, Power, PowerOff, Brain, Cpu, User, Fingerprint, Network, ShieldCheck, ShieldAlert, Zap, Skull } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { ScriptGroupPanel } from "./ScriptGroupPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode } from "@/hooks/useTrading";
import { ModeSafetyModal } from "./ModeSafetyModal";
import { SlideToConfirm } from "../ui/SlideToConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useWebSocket } from "@/hooks/useWebSocket";

const initialMarkets = [
  { name: "RELIANCE", value: 2984.50, change: 0.0, status: "live" },
  { name: "HDFCBANK", value: 1542.30, change: 0.0, status: "live" },
  { name: "INFY", value: 1478.20, change: 0.0, status: "live" },
  { name: "TCS", value: 3956.70, change: 0.0, status: "live" },
  { name: "NIFTY 50", value: 22456.80, change: 0.0, status: "live" },
  { name: "BANK NIFTY", value: 48123.40, change: 0.0, status: "live" },
];

const brokers = [
  { name: "Zerodha", status: "live" },
  { name: "IBKR", status: "live" },
  { name: "Alpaca", status: "warning" },
  { name: "Shoonya", status: "live" },
];

export function GlobalHeader() {
  const { toast } = useToast();
  const [brokerPanelOpen, setBrokerPanelOpen] = useState(false);
  const [scriptPanelOpen, setScriptPanelOpen] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [panicModalOpen, setPanicModalOpen] = useState(false);
  const [engineLive, setEngineLive] = useState(true);
  const [intelSettings, setIntelSettings] = useState<{decision_mode: "ai" | "program" | "human"; llm_model: string; provider: "ollama" | "openclaw"; agent_enabled: boolean; agent_error_reason: string}>({ decision_mode: 'ai', llm_model: 'mistral', provider: 'ollama', agent_enabled: true, agent_error_reason: "" });
  const [intelDropdownOpen, setIntelDropdownOpen] = useState(false);
  const intelRef = useRef<HTMLDivElement>(null);
  const tradingMode = useTradingMode();
  const [marketData, setMarketData] = useState(initialMarkets);
  const [flashingMarkets, setFlashingMarkets] = useState<Set<string>>(new Set());
  const { user, signOut } = useAuth();
  const heartbeat = useHeartbeat();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";

  // Real-time market data via WebSocket relay
  const { prices } = useWebSocket(initialMarkets.map(m => m.name));

  useEffect(() => {
    if (!engineLive || Object.keys(prices).length === 0) return;
    
    setMarketData(prev => prev.map(m => {
      const livePrice = prices[m.name];
      if (livePrice === undefined) return m;
      
      const change = ((livePrice - m.value) / m.value) * 100;
      
      // Trigger flash on change
      if (Math.abs(livePrice - m.value) > 0.01) {
        setFlashingMarkets(new Set([m.name]));
        setTimeout(() => setFlashingMarkets(new Set()), 300);
      }
      
      return {
        ...m,
        value: livePrice,
        change: m.change + change, // Cumulative for visual effect or recalculate if possible
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
        console.error("Intel fetch failed", e);
      }
    };
    fetchIntel();
    const interval = setInterval(fetchIntel, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close intel dropdown on outside click
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
      toast({ title: "Intelligence Updated", description: `${key} → ${value}` });
    } catch {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save intelligence settings." });
    }
  };


  const toggleEngine = () => {
    setEngineLive(!engineLive);
    toast({
      title: engineLive ? "Engine Stopped" : "Engine Live",
      description: engineLive ? "Trading engine has been halted" : "Trading engine is now live and processing signals",
      variant: engineLive ? "destructive" : "default",
    });
  };

  return (
    <>
      <header className="h-12 glass-panel-elevated border-b border-border flex items-center px-4 gap-6 z-50 relative">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">A</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight neon-text-indigo">AetherDesk</span>
            <span className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground">Prime</span>
          </div>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Engine Toggle */}
        <button 
          onClick={toggleEngine}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all shrink-0 ${
            engineLive 
              ? "bg-neon-green/20 border border-neon-green/30" 
              : "bg-destructive/20 border border-destructive/30"
          }`}
        >
          {engineLive ? <Power className="w-3.5 h-3.5 text-neon-green" /> : <PowerOff className="w-3.5 h-3.5 text-destructive" />}
          <span className={`text-[10px] font-semibold ${engineLive ? "text-neon-green" : "text-destructive"}`}>
            {engineLive ? "ENGINE LIVE" : "ENGINE OFF"}
          </span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Trading Mode Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => tradingMode.mode === 'live' ? tradingMode.setMode('sandbox') : setSafetyModalOpen(true)}
            disabled={tradingMode.isLoading || tradingMode.isPending}
            className={`flex items-center gap-2 px-3 py-1 rounded-md border transition-all duration-300 ${
              tradingMode.mode === 'live' 
                ? "bg-destructive/10 border-destructive/40 shadow-[0_0_10px_rgba(239,68,68,0.1)]" 
                : "bg-warning/10 border-warning/40"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-sm ${
              tradingMode.mode === 'live' ? "bg-destructive shadow-destructive/50" : "bg-warning shadow-warning/50"
            }`} />
            <span className={`text-[10px] font-bold tracking-wider ${
              tradingMode.mode === 'live' ? "text-destructive" : "text-warning"
            }`}>
              {tradingMode.mode?.toUpperCase() || "LOADING..."}
            </span>
          </button>
        </div>

        <ModeSafetyModal 
          isOpen={safetyModalOpen}
          onClose={() => setSafetyModalOpen(false)}
          onConfirm={() => tradingMode.setMode('live')}
          targetMode="live"
        />

        <div className="w-px h-6 bg-border" />

        {/* Global Panic Signal */}
        <Dialog open={panicModalOpen} onOpenChange={setPanicModalOpen}>
            <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-all group shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
                    <Skull className="w-3 h-3.5 text-destructive group-hover:scale-110 transition-transform relative z-10" />
                    <span className="text-[10px] font-black text-destructive tracking-widest relative z-10">PANIC</span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] bg-background/95 backdrop-blur-2xl border-destructive/20 select-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-destructive font-black tracking-tighter text-2xl uppercase italic">
                        <ShieldAlert className="w-8 h-8" />
                        Kill Switch Active
                    </DialogTitle>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
                        <p className="text-[10px] font-black text-destructive uppercase tracking-widest mb-1 text-center font-mono">Protocol: Liquidation</p>
                        <p className="text-xs text-muted-foreground font-medium text-center leading-relaxed">
                            Immediately cancel all pending orders and close every open position in the current workstation.
                        </p>
                    </div>
                    <SlideToConfirm 
                        label="SLIDE TO HALT ALL"
                        onConfirm={async () => {
                            try {
                                await algoApi.triggerPanic();
                                toast({ title: "CRY STATIONS: ALL CLEAR", description: "All instructions purged and positions squared.", variant: "destructive" });
                                setTimeout(() => setPanicModalOpen(false), 2000);
                            } catch (e) {
                                toast({ title: "Link Severed", description: String(e), variant: "destructive" });
                            }
                        }}
                    />
                    <p className="text-[8px] text-muted-foreground/40 font-black uppercase tracking-widest text-center">Protected by 256-bit isolation pulse</p>
                </div>
            </DialogContent>
        </Dialog>

        <div className="w-px h-6 bg-border" />

        {/* System Intelligence Mode — Interactive */}
        <div className="relative" ref={intelRef}>
          <button 
            onClick={() => setIntelDropdownOpen(!intelDropdownOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all cursor-pointer hover:opacity-80 ${
              !intelSettings.agent_enabled
                ? (intelSettings.agent_error_reason ? "bg-destructive/10 border-destructive/40 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.1)]" : "bg-muted border-border text-muted-foreground opacity-60")
                : intelSettings.decision_mode === 'ai' 
                  ? (intelSettings.provider === 'openclaw' ? "bg-secondary/10 border-secondary/30 text-secondary shadow-[0_0_10px_rgba(var(--secondary),0.1)]" : "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]")
                  : intelSettings.decision_mode === 'program'
                    ? "bg-warning/10 border-warning/30 text-warning"
                    : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {!intelSettings.agent_enabled ? (
              intelSettings.agent_error_reason ? <ShieldAlert className="w-3 h-3 animate-pulse" /> : <PowerOff className="w-3 h-3" />
            ) : intelSettings.decision_mode === 'ai' 
              ? (intelSettings.provider === 'openclaw' ? <Fingerprint className="w-3 h-3" /> : <Brain className="w-3 h-3" />)
              : intelSettings.decision_mode === 'program' ? <Cpu className="w-3 h-3" /> : <User className="w-3 h-3" />}
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
              {!intelSettings.agent_enabled ? (intelSettings.agent_error_reason ? 'SEVERED' : 'BYPASS') : (intelSettings.provider === 'openclaw' ? 'CLAW' : intelSettings.decision_mode)} CORE
            </span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {/* Intel Dropdown */}
          {intelDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 glass-panel-elevated rounded-xl border border-border/60 shadow-2xl z-[100] p-3 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Intelligence Control</h4>
              
              {/* Agent Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">Agent</span>
                <button
                  onClick={() => updateIntelSetting('agent_enabled', !intelSettings.agent_enabled)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    intelSettings.agent_enabled ? "bg-neon-green/40" : "bg-muted/40"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    intelSettings.agent_enabled ? "left-[18px] bg-neon-green shadow-[0_0_6px_rgba(0,255,100,0.5)]" : "left-0.5 bg-muted-foreground"
                  }`} />
                </button>
              </div>

              {/* Decision Mode */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Mode</span>
                <div className="flex gap-1">
                  {['ai', 'program', 'human'].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateIntelSetting('decision_mode', m)}
                      className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase rounded-md border transition-all ${
                        intelSettings.decision_mode === m
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Provider</span>
                <div className="flex gap-1">
                  {['ollama', 'openclaw'].map((p) => (
                    <button
                      key={p}
                      onClick={() => updateIntelSetting('provider', p)}
                      className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase rounded-md border transition-all ${
                        intelSettings.provider === p
                          ? "bg-secondary/20 border-secondary/30 text-secondary"
                          : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM Model */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Model</span>
                <input
                  type="text"
                  value={intelSettings.llm_model}
                  onChange={(e) => setIntelSettings(s => ({ ...s, llm_model: e.target.value }))}
                  onBlur={() => updateIntelSetting('llm_model', intelSettings.llm_model)}
                  className="w-full bg-muted/30 border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Quick Actions */}
              <div className="pt-2 border-t border-border/50 flex gap-1">
                <button
                  onClick={() => updateIntelSetting('agent_enabled', false)}
                  className="flex-1 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                >
                  Force Bypass
                </button>
                <button
                  onClick={() => {
                    setIntelSettings(s => ({ ...s, agent_enabled: true, agent_error_reason: '' }));
                    updateIntelSetting('agent_enabled', true);
                  }}
                  className="flex-1 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 transition-colors"
                >
                  Re-enable
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* System Pulse */}
        <Link 
          to="/infrastructure"
          className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md glass-panel hover:bg-muted/30 transition-colors group"
        >
          <Radio className={`w-3 h-3 ${engineLive ? "text-neon-green animate-pulse" : "text-muted-foreground"}`} />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Pulse</span>
          {engineLive ? (
            <>
              <span className="status-dot-live" />
              <span className="text-[9px] mono-text text-neon-emerald">SYNCED</span>
              {heartbeat.latencyMs && <span className="text-[8px] mono-text text-muted-foreground">{heartbeat.latencyMs}ms</span>}
            </>
          ) : (
            <>
              <span className="status-dot-error" />
              <span className="text-[9px] mono-text text-muted-foreground">PAUSED</span>
            </>
          )}
        </Link>

        <div className="w-px h-6 bg-border" />

        {/* Market Indicators */}
        <div className="flex items-center gap-4 overflow-x-auto">
          {marketData.map((m) => (
            <div 
              key={m.name} 
              className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded transition-all ${
                flashingMarkets.has(m.name) ? "bg-primary/20 animate-pulse" : ""
              }`}
            >
              <span className={`status-dot-${m.status}`} />
              <span className="text-[10px] text-muted-foreground uppercase">{m.name}</span>
              <span className="data-cell text-foreground">
                {m.value.toLocaleString(undefined, { minimumFractionDigits: m.name === "BTC" || m.name === "ETH" ? 2 : 0, maximumFractionDigits: m.name === "BTC" || m.name === "ETH" ? 2 : 0 })}
              </span>
              <span className={`data-cell ${m.change >= 0 ? "text-neon-emerald" : "text-neon-red"}`}>
                {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Strategy Switcher */}
        <button className="flex items-center gap-1.5 glass-panel px-2.5 py-1 rounded-md hover:bg-muted/50 transition-colors shrink-0">
          <span className="text-xs text-muted-foreground">Strategy:</span>
          <span className="text-xs font-medium text-foreground">Momentum Alpha</span>
          <span className="data-cell text-neon-emerald">+₹2.4L</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Script Groups */}
        <button
          onClick={() => setScriptPanelOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/30 transition-colors shrink-0"
        >
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Scripts</span>
        </button>

        {/* Broker Connectivity */}
        <button
          onClick={() => setBrokerPanelOpen(true)}
          className="flex items-center gap-3 shrink-0 px-2 py-1 rounded-md hover:bg-muted/30 transition-colors"
        >
          <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
          {brokers.filter((b) => b.status === "live" || b.status === "warning").map((b) => (
            <div key={b.name} className="flex items-center gap-1">
              <span className={`status-dot-${b.status}`} />
              <span className="text-[10px] text-muted-foreground">{b.name}</span>
            </div>
          ))}
        </button>

        <div className="flex-1" />

        {/* Metrics */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <div className="metric-label">Capital</div>
            <div className="metric-value text-foreground">₹4.2Cr</div>
          </div>
          <div className="text-right">
            <div className="metric-label">Day P&L</div>
            <div className="metric-value text-neon-emerald">+₹3.8L</div>
          </div>
          <div className="text-right">
            <div className="metric-label">Sharpe</div>
            <div className="metric-value text-primary">2.34</div>
          </div>
          <div className="text-right">
            <div className="metric-label">Sortino</div>
            <div className="metric-value text-primary">3.12</div>
          </div>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors relative">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-neon-red" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <Users className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">{initials}</span>
          </div>
          <button onClick={signOut} className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors" title="Sign out">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      <BrokerManagementPanel isOpen={brokerPanelOpen} onClose={() => setBrokerPanelOpen(false)} />
      <ScriptGroupPanel isOpen={scriptPanelOpen} onClose={() => setScriptPanelOpen(false)} />
    </>
  );
}
