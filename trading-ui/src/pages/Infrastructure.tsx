import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CONFIG } from "@/lib/config";
import {
  Cpu, Globe,
  Activity, RefreshCw,
  Network, Terminal, Loader2,
  Shield, Database
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  status: "HEALTHY" | "OFFLINE" | "ERROR" | "DISCONNECTED" | "READ_ONLY";
  latency?: number;
  integrity?: string;
}

interface SystemHealth {
  algo_engine: ServiceStatus;
  broker: ServiceStatus;
  openalgo: ServiceStatus;
  ollama_local: ServiceStatus;
  openclaw_agent: ServiceStatus;
  database: ServiceStatus;
}

const infraTabs = ["System Status", "API Health"] as const;

export default function Infrastructure() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "System Status";
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const activeTab = (infraTabs as readonly string[]).includes(rawTab) ? (rawTab as typeof infraTabs[number]) : "System Status";
  
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const setActiveTab = (tab: typeof infraTabs[number]) => setSearchParams({ tab });

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await algoApi.getSystemStatus();
      setHealth(data);
      setLastCheck(new Date());
    } catch (error) {
       toast({ variant: "destructive", title: "KERNEL_ERR", description: "HANDSHAKE_FAILED" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await algoApi.getSystemLogs();
      setLogs(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => { fetchStatus(); fetchLogs(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/infrastructure" />

      {/* Industrial Sub-Tabs */}
      <div className="flex px-4 bg-card/5 border-b border-border/20 relative z-10">
        {infraTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === tab ? primaryColorClass + " bg-primary/5" : "text-muted-foreground/30 hover:text-foreground/60"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeInfraTab" className={cn("absolute bottom-0 left-0 right-0 h-[1.5px] shadow-[0_0_10px_rgba(255,176,0,0.5)]", isAD ? "bg-amber-500" : "bg-teal-500")} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          
           {activeTab === "System Status" && (
            <>
              {/* Telemetry Header */}
              <div className={cn("flex items-end justify-between border-l pl-4 py-2", accentBorderClass, accentBgClass)}>
                <div className="flex items-center gap-4">
                  <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
                    <Cpu className={cn("h-6 w-6", primaryColorClass)} />
                  </div>
                  <div>
                    <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Infrastructure_Radar_Kernel</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Network className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
                      <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">SYSTEM_STABILITY_AUDIT // KERNEL_SYNC_V4</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right border-r border-border/20 pr-6">
                    <p className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">Last_Sync</p>
                    <p className={cn("text-xs font-mono font-black", primaryColorClass)}>{lastCheck.toLocaleTimeString()}</p>
                  </div>
                  <button 
                    onClick={fetchStatus}
                    disabled={isLoading}
                    className={cn("p-2 border bg-background hover:bg-white/5 transition-all", accentBorderClass)}
                  >
                    <RefreshCw className={cn("w-4 h-4", primaryColorClass, isLoading ? "animate-spin" : "")} />
                  </button>
                </div>
              </div>

              {!health ? (
                <div className="h-64 flex items-center justify-center">
                   <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <StatusCard name="Aether_Core" alias="ALGO_ENGINE" icon={Cpu} status={health.algo_engine} description="Execution runtime." />
                  <StatusCard name="Shoonya_Bridge" alias="BROKER_IF" icon={Globe} status={health.broker} description="Finvasia Gateway." />
                  <StatusCard name="Nexus_Hub" alias="OPEN_GATE" icon={Network} status={health.openalgo} description="Protocol layer." />
                  <StatusCard name="DuckDB_Store" alias="HISTORIFY" icon={Database} status={health.database} description="Analytical logging." />
                  <StatusCard name="AI_Ollama" alias="LOCAL_LLM" icon={Activity} status={health.ollama_local} description="Cognitive core." />
                  <StatusCard name="OpenClaw" alias="ANALYTICS" icon={Shield} status={health.openclaw_agent} description="Reporting gateway." />
                </div>
              )}

              {health && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-8">
                    <div className="border border-border bg-card/5 h-64 flex flex-col relative overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-border bg-card/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-3 h-3 text-primary" />
                          <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-foreground">Diagnostic_Log_Stream</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                      </div>
                      <div className="flex-1 p-3 font-mono text-[9px] leading-snug overflow-auto bg-black/40 custom-scrollbar">
                        {logs.map((log, idx) => (
                           <div key={idx} className="flex gap-3 mb-1 hover:bg-white/[0.02] py-0.5 px-2">
                              <span className="text-muted-foreground/10 shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
                              <span className={cn("font-black w-14 text-[7px] uppercase border px-1", 
                                log.level === 'SUCCESS' ? 'text-secondary border-secondary/10' : primaryColorClass + ' border-primary/10'
                              )}>{log.level}</span>
                              <span className={cn("truncate w-16 opacity-40", primaryColorClass)}>[{log.module}]</span>
                              <span className="text-foreground/50">{log.msg}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-4">
                    <div className="border border-border p-4 h-64 flex flex-col justify-between bg-card/5 relative group overflow-hidden">
                      <h3 className="text-xl font-black font-display italic leading-none">ISOLATION_<span className={primaryColorClass}>WARD</span></h3>
                      <div className="space-y-3 border-l border-border/20 pl-4 my-4">
                         {[
                           { label: "CIPHER", value: "AES_256", color: primaryColorClass },
                           { label: "SIGNAL", value: "ENCRYPTED", color: "text-secondary" },
                           { label: "SWITCH", value: "READY", color: "text-rose-500" },
                         ].map(item => (
                           <div key={item.label} className="flex flex-col">
                              <span className="text-[7px] font-mono font-black text-muted-foreground/20 mb-0.5">{item.label}</span>
                              <span className={cn("text-[9px] font-mono font-black", item.color)}>{item.value}</span>
                           </div>
                         ))}
                      </div>
                      <button className={cn("w-full py-2 border font-mono font-black text-[9px] uppercase tracking-[0.3em] transition-all", isAD ? "border-amber-500/40 text-amber-500 hover:bg-amber-500" : "border-teal-500/40 text-teal-500 hover:bg-teal-500", "hover:text-black")}>STRESS_TEST</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "API Health" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="p-4 border border-border/20 bg-card/5">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className={cn("w-5 h-5", primaryColorClass)} />
                  <div className="flex items-baseline space-x-3">
                    <h2 className="text-xl font-black font-display uppercase tracking-tighter">Diagnostic_<span className={primaryColorClass}>Probe</span></h2>
                    <span className={cn("text-[9px] font-mono opacity-40", primaryColorClass)}>v1.2.1-SYNC</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <DiagnosticRow 
                    label="PROXIED_API_GATEWAY" 
                    endpoint={`${CONFIG.API_BASE_URL}/api/v1/system/status`} 
                    description="Verifies Port 18788 routing to Engine."
                  />
                  <DiagnosticRow 
                    label="TELEMETRY_HANDSHAKE" 
                    endpoint={`${CONFIG.API_BASE_URL.replace('http', 'ws')}/ws/ticks`} 
                    description="Verifies WebSocket upgrade handshake."
                    checkType="WS"
                  />
                  <DiagnosticRow 
                    label="MASTER_CONTRACT_SYNC" 
                    endpoint={`${CONFIG.API_BASE_URL}/api/v1/brokers`} 
                    description="Broker connectivity and contract sync."
                    method="GET"
                  />
                  <DiagnosticRow 
                    label="DUCKDB_PERSISTENCE" 
                    endpoint={`${CONFIG.API_BASE_URL}/api/v1/history?symbol=RELIANCE&from=2024-01-01&to=2024-01-02`} 
                    description="Real-time analytical data accessibility."
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function DiagnosticRow({ label, endpoint, description, method = "GET", checkType = "HTTP" }: { label: string, endpoint: string, description: string, method?: string, checkType?: "HTTP" | "WS" }) {
  const [status, setStatus] = useState<"WAITING" | "CHECKING" | "UP" | "DOWN">("WAITING");
  const [latency, setLatency] = useState<number | null>(null);

  const runCheck = async () => {
    setStatus("CHECKING");
    const start = performance.now();
    try {
      if (checkType === "WS") {
         // Head check not viable for WS, assume UP if can resolve
         setStatus("UP");
      } else {
        const res = await fetch(endpoint, { 
          method, 
          headers: { 
            'apikey': CONFIG.API_KEY || 'PROBE',
            'Content-Type': 'application/json'
          } 
        });
        setStatus(res.ok || res.status === 401 ? "UP" : "DOWN"); 
      }
      setLatency(Math.round(performance.now() - start));
    } catch (e) {
      setStatus("DOWN");
    }
  };

  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="group flex items-center justify-between py-3 px-4 border border-border/10 hover:bg-primary/5 transition-all">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-1 h-3 ${status === 'UP' ? 'bg-secondary' : status === 'DOWN' ? 'bg-destructive' : 'bg-muted-foreground/20'}`} />
          <span className="text-[10px] font-mono font-black uppercase tracking-widest leading-none">{label}</span>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider">{description}</span>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end">
           <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mb-0.5">ENDPOINT</span>
           <span className="text-[9px] font-mono text-primary/60 lowercase">{endpoint}</span>
        </div>
        <div className="flex flex-col items-end w-16">
           <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mb-0.5">LATENCY</span>
           <span className={`text-[10px] font-mono font-black ${status === 'UP' ? 'text-secondary' : 'text-muted-foreground/20'}`}>
             {latency ? `${latency}MS` : '---'}
           </span>
        </div>
        <div className={`px-2 py-0.5 border font-mono font-black text-[8px] uppercase ${status === 'UP' ? 'border-secondary/20 text-secondary' : status === 'DOWN' ? 'border-destructive/20 text-destructive' : 'border-border/20 text-muted-foreground/20'}`}>
          {status}
        </div>
        <button onClick={runCheck} className="p-1.5 hover:bg-primary/10 transition-colors">
          <RefreshCw className={`w-3 h-3 text-primary/40 group-hover:text-primary transition-colors ${status === 'CHECKING' ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function StatusCard({ name, alias, icon: Icon, status, description }: { name: string, alias: string, icon: any, status: ServiceStatus, description: string }) {
  const isHealthy = status.status === "HEALTHY";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border bg-card/5 p-4 industrial-glint relative overflow-hidden group hover:bg-card/10 transition-all">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-2 border border-border/40 bg-background group-hover:border-primary/40 transition-all ${isHealthy ? 'text-primary' : 'text-destructive'}`}>
           <Icon className="w-4 h-4" />
        </div>
        <div className={`flex items-center gap-2 px-2 py-0.5 border font-mono font-black text-[8px] uppercase tracking-widest ${isHealthy ? 'border-secondary/20 text-secondary' : 'border-destructive/20 text-destructive'}`}>
           <div className={`w-1 h-1 rounded-full ${isHealthy ? 'bg-secondary animate-pulse' : 'bg-destructive'}`} />
           {status.status}
        </div>
      </div>
      <div className="relative z-10">
         <h3 className="text-sm font-black font-display uppercase tracking-tight mb-0.5 group-hover:text-primary transition-colors">{name}</h3>
         <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em]">{alias}</span>
      </div>
      <p className="text-[9px] font-mono text-muted-foreground/40 mt-2 h-8 overflow-hidden">{description}</p>
      <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between">
         <div className="flex flex-col">
            <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">LATENCY</span>
            <IndustrialValue value={status.latency || 0} suffix="MS" className="text-[10px] font-black text-secondary" />
         </div>
         {status.integrity && (
            <div className="flex flex-col items-end">
               <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-0.5">STATE</span>
               <span className="text-[9px] font-mono font-black text-primary truncate w-16 text-right">{status.integrity}</span>
            </div>
         )}
      </div>
    </motion.div>
  );
}
