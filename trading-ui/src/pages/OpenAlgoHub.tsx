import React from "react";
import { Link } from "react-router-dom";
import { 
  ClipboardList, 
  Zap, 
  LayoutGrid, 
  ShieldCheck, 
  History,
  Cpu,
  Activity,
  Shield,
  Layers,
  Terminal as TerminalIcon,
  Key,
  Network,
  Database,
  Box,
  Fingerprint,
  Radio,
  Wifi,
  BarChart3,
  PlayCircle,
  ShieldAlert,
  Target,
  Brain
} from "lucide-react";
import { useSystemHealth, useOrders, usePositions } from "../features/openalgo/hooks/useTrading";
import { AetherPanel } from "@/components/ui/AetherPanel";
import { cn } from "@/lib/utils";

import { useAppModeStore } from "@/stores/appModeStore";

export default function OpenAlgoHub() {
  const { mode } = useAppModeStore();
  const { data: health } = useSystemHealth();
  const { data: orders } = useOrders();
  const { data: positions } = usePositions();

  const isAD = mode === 'AD';
  const primaryColor = isAD ? "text-primary" : "text-teal-500";
  const primaryBg = isAD ? "bg-primary/5" : "bg-teal-500/5";
  const secondaryColor = isAD ? "text-amber-500" : "text-emerald-500";
  const secondaryBg = isAD ? "bg-amber-500/5" : "bg-emerald-500/5";

  const coreModules = [
    { to: "/openalgo/orders", icon: ClipboardList, label: "Order_Registry", desc: "Trade execution & status map.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/trades", icon: Zap, label: "Execution_Log", desc: "Verified operation history.", color: secondaryColor, bg: secondaryBg },
    { to: "/openalgo/positions", icon: LayoutGrid, label: "Position_Matrix", desc: "Live exposure & MTM vectors.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/holdings", icon: ShieldCheck, label: "Asset_Vault", desc: "Long-term inventory audit.", color: secondaryColor, bg: secondaryBg },
  ];
  
  const analysisModules = [
    { to: "/openalgo/option-chain", icon: Layers, label: "Option_Chain", desc: "Multi-strike derivatives grid.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/gex", icon: BarChart3, label: "GEX_Dashboard", desc: "Gamma exposure visualization.", color: secondaryColor, bg: secondaryBg },
    { to: "/openalgo/oi-profile", icon: LayoutGrid, label: "OI_Profile", desc: "Open Interest evolution map.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/oi-tracker", icon: Target, label: "OI_Tracker", desc: "Comparative OI distribution.", color: secondaryColor, bg: secondaryBg },
    { to: "/openalgo/vol-surface", icon: Activity, label: "Vol_Surface", desc: "Implied volatility surface map.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/iv-smile", icon: Activity, label: "IV_Smile_Lab", desc: "Cross-strike volatility skew.", color: secondaryColor, bg: secondaryBg },
    { to: "/openalgo/iv-chart", icon: BarChart3, label: "IV_History", desc: "Time-series Greek evolution.", color: primaryColor, bg: primaryBg },
  ];

  const strategyLabs = [
    { to: "/openalgo/max-pain", icon: Target, label: "Max_Pain_Lab", desc: "Strike-wise pain index audit.", color: primaryColor, bg: primaryBg },
    { to: "/openalgo/straddle-lab", icon: Layers, label: "Straddle_Lab", desc: "Synthetic future & premium tracking.", color: secondaryColor, bg: secondaryBg },
    { to: "/openalgo/historify", icon: Database, label: "Historify", desc: "Distributed data persistence.", color: primaryColor, bg: primaryBg },
  ];

  const systemModules = [
    { to: "/openalgo/action-center", icon: PlayCircle, label: "Action_Center", desc: "Semi-auto order approval gate.", color: isAD ? "text-primary" : "text-teal-500" },
    { to: "/openalgo/connectivity", icon: Key, label: "Access_Kernel", desc: "API key & Protocol manage.", color: primaryColor },
    { to: "/openalgo/broker", icon: Network, label: "Broker_Bridge", desc: "Secure gateway handshake.", color: secondaryColor },
    { to: "/openalgo/master-contract", icon: Database, label: "Symbol_Base", desc: "Broker contract database sync.", color: primaryColor },
    { to: "/openalgo/sandbox", icon: Box, label: "Simulation", desc: "Isolated environment hypervisor.", color: secondaryColor },
    { to: "/openalgo/analyzer", icon: Activity, label: "Protocol_Analyzer", desc: "API payload & protocol audit.", color: primaryColor },
    { to: "/openalgo/logs", icon: History, label: "Telemetry", desc: "Kernel-level audit stream.", color: secondaryColor },
    { to: "/openalgo/health", icon: ShieldCheck, label: "Sanity_Audit", desc: "Host diagnostics & health.", color: primaryColor },
    { to: "/openalgo/playground", icon: TerminalIcon, label: "Playground", desc: "API terminal & protocol test.", color: secondaryColor },
  ];

  const stats = [
    { label: "Module_Status", value: health?.status === "success" ? "HEALTHY" : "SYNCING", icon: Cpu, color: secondaryColor },
    { label: "Active_Orders", value: orders?.trades?.length || 0, icon: Activity, color: primaryColor },
    { label: "Live_Positions", value: positions?.length || 0, icon: Layers, color: secondaryColor },
    { label: "Security_Auth", value: "VERIFIED", icon: Fingerprint, color: isAD ? "text-primary" : "text-teal-500" },
  ];

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-700 pb-24 max-w-[1400px] mx-auto">
      {/* Header & Stats Bundle */}
      <div className="flex flex-col xl:flex-row gap-12 items-start justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn("p-4 border rounded-none", isAD ? "bg-primary/10 border-primary/20 shadow-[0_0_20px_rgba(255,176,0,0.1)]" : "bg-teal-500/10 border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.1)]")}>
              <Radio className={cn("w-8 h-8 animate-pulse", isAD ? "text-primary" : "text-teal-500")} />
            </div>
            <div>
              <h1 className={cn("text-4xl font-black font-mono uppercase tracking-[0.4em]", isAD ? "text-primary" : "text-teal-500")}>OpenAlgo_Mission_Control</h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-2 opacity-60">Unified_Operational_Agent_Array // Protocol_V43_Stable</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 mt-8 pl-1">
             <div className="flex items-center gap-2">
                <Wifi className={cn("w-3 h-3", secondaryColor)} />
                <span className={cn("text-[9px] font-mono font-black tracking-widest uppercase", secondaryColor)}>Stream: ENCRYPTED [SIM]</span>
             </div>
             <div className="w-[1px] h-3 bg-white/10" />
             <div className="flex items-center gap-2">
                <Activity className={cn("w-3 h-3", primaryColor)} />
                <span className={cn("text-[9px] font-mono font-black tracking-widest uppercase", primaryColor)}>Latency: 12ms [SIM]</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto">
          {stats.map((stat, i) => (
            <AetherPanel key={i} className="py-4 px-6 border-border/10 bg-background/20 min-w-[200px]">
              <div className="flex items-start justify-between mb-2">
                 <div className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{stat.label}</div>
                 <stat.icon className={cn("w-3.5 h-3.5 opacity-50", stat.color)} />
              </div>
              <div className={cn("text-lg font-black font-mono uppercase", stat.color)}>{stat.value}</div>
            </AetherPanel>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-white/5">
        {/* Core Trading Ops */}
        <div className="lg:col-span-8 space-y-6">
           <div className="micro-label mb-2 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-primary" /> TRADING_OPERATIONS_KERNEL
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coreModules.map((card, i) => (
                <Link 
                  key={i} 
                  to={card.to}
                  className={cn(
                    "group p-6 border border-border/10 bg-background/40 hover:bg-background/60 transition-all relative overflow-hidden",
                    isAD ? "hover:border-primary/40" : "hover:border-teal-500/40"
                  )}
                >
                   <div className="flex items-start justify-between mb-4">
                      <div className={cn("p-3 border border-border/10 transition-all", card.bg, isAD ? "group-hover:border-primary/40" : "group-hover:border-teal-500/40")}>
                         <card.icon className={cn("w-6 h-6", card.color)} />
                      </div>
                      <div className="p-1 px-2 border border-border/10 text-[7px] font-mono opacity-20 group-hover:opacity-100 transition-opacity">MOD_{card.label.substring(0,3)}</div>
                   </div>
                   <h3 className={cn("text-xs font-black font-mono uppercase tracking-[0.2em] mb-2", card.color)}>{card.label}</h3>
                   <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-relaxed">{card.desc}</p>
                   
                   <div className={cn("mt-8 flex items-center gap-2 text-[8px] font-mono font-black opacity-20 group-hover:opacity-100 transition-all", isAD ? "text-primary" : "text-teal-500")}>
                      ACCESS_KERNEL_STREAM <span className="translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
                   </div>
                   
                   <div className="scanline opacity-0 group-hover:opacity-10 transition-opacity" />
                </Link>
              ))}
           </div>
           
           <div className="micro-label mt-8 mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-secondary" /> DERIVATIVES_ANALYSIS_KERNELS
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysisModules.map((card, i) => (
                <Link 
                  key={i} 
                  to={card.to}
                  className={cn(
                    "group p-6 border border-border/10 bg-background/40 hover:bg-background/60 transition-all relative overflow-hidden",
                    isAD ? "hover:border-amber-500/40" : "hover:border-emerald-500/40"
                  )}
                >
                   <div className="flex items-start justify-between mb-4">
                      <div className={cn("p-3 border border-border/10 transition-all", card.bg, isAD ? "group-hover:border-amber-500/40" : "group-hover:border-emerald-500/40")}>
                         <card.icon className={cn("w-6 h-6", card.color)} />
                      </div>
                      <div className="p-1 px-2 border border-border/10 text-[7px] font-mono opacity-20 group-hover:opacity-100 transition-opacity">MOD_{card.label.substring(0,3)}</div>
                   </div>
                   <h3 className={cn("text-xs font-black font-mono uppercase tracking-[0.2em] mb-2", card.color)}>{card.label}</h3>
                   <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-relaxed">{card.desc}</p>
                   <div className="scanline opacity-0 group-hover:opacity-10 transition-opacity" />
                </Link>
              ))}
           </div>

           <div className="micro-label mt-8 mb-2 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-blue-400" /> STRATEGY_LAB_SEQUENCES
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategyLabs.map((card, i) => (
                <Link 
                  key={i} 
                  to={card.to}
                  className={cn(
                    "group p-6 border border-border/10 bg-background/40 hover:bg-background/60 transition-all relative overflow-hidden",
                    isAD ? "hover:border-primary/40" : "hover:border-teal-500/40"
                  )}
                >
                   <div className="flex items-start justify-between mb-4">
                      <div className={cn("p-3 border border-border/10 transition-all", card.bg, isAD ? "group-hover:border-primary/40" : "group-hover:border-teal-500/40")}>
                         <card.icon className={cn("w-6 h-6", card.color)} />
                      </div>
                      <div className="p-1 px-2 border border-border/10 text-[7px] font-mono opacity-20 group-hover:opacity-100 transition-opacity">MOD_{card.label.substring(0,3)}</div>
                   </div>
                   <h3 className={cn("text-xs font-black font-mono uppercase tracking-[0.2em] mb-2", card.color)}>{card.label}</h3>
                   <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-relaxed">{card.desc}</p>
                   <div className="scanline opacity-0 group-hover:opacity-10 transition-opacity" />
                </Link>
              ))}
           </div>
        </div>

        {/* System & Config Side Tray */}
        <div className="lg:col-span-4 space-y-6">
           <div className="micro-label mb-2 flex items-center gap-2 text-muted-foreground">
              <Shield className="w-3.5 h-3.5" /> SYSTEM_CONFIGURATION
           </div>
           <div className="flex flex-col gap-3">
              {systemModules.map((item, i) => (
                <Link
                  key={i}
                  to={item.to}
                  className="flex items-center justify-between p-4 border border-border/10 bg-background/40 hover:bg-background/80 hover:border-border/20 transition-all group"
                >
                   <div className="flex items-center gap-4">
                      <div className={cn("p-2 border border-border/10 transition-all", isAD ? "group-hover:border-primary/40" : "group-hover:border-teal-500/40")}>
                         <item.icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <div>
                         <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest text-foreground transition-colors", isAD ? "group-hover:text-primary" : "group-hover:text-teal-500")}>{item.label}</div>
                         <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">{item.desc}</div>
                      </div>
                   </div>
                   <TerminalIcon className={cn("w-3 h-3 text-muted-foreground/10 transition-all", isAD ? "group-hover:text-primary" : "group-hover:text-teal-500")} />
                </Link>
              ))}
           </div>
           
           <AetherPanel className="mt-8 border-rose-500/20 bg-rose-500/5">
              <div className="flex items-start gap-4">
                 <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                 <div className="space-y-2">
                    <h3 className="text-[10px] font-black font-mono uppercase tracking-widest text-rose-500">Ingestion_Alert</h3>
                    <p className="text-[8px] font-mono text-rose-500/60 uppercase leading-relaxed tracking-wider">
                       Master contract data has not been synchronized in last 24h. System accuracy may be degraded. 
                    </p>
                    <Link to="/openalgo/master-contract" className="inline-block text-[8px] font-mono font-black text-rose-500 hover:text-white underline uppercase tracking-widest mt-2">
                       RESOLVE_NOW →
                    </Link>
                 </div>
              </div>
           </AetherPanel>
        </div>
      </div>
    </div>
  );
}
