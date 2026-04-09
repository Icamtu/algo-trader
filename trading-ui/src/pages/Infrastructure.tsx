import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Cpu, Database, Globe, 
  Activity, RefreshCw, AlertTriangle, 
  HardDrive, Network, Terminal, Radio, 
  Shield, Zap, Loader2
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

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
              activeTab === tab ? "text-primary bg-primary/5" : "text-muted-foreground/30 hover:text-foreground/60"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeInfraTab" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 no-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {activeTab === "System Status" && (
            <>
              {/* Telemetry Header */}
              <div className="flex items-end justify-between border-l border-primary/40 pl-4 py-2 bg-primary/5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                     <Activity className="w-3 h-3 text-primary animate-pulse" />
                     <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-primary">Kernel_Telemetry_v4</span>
                  </div>
                  <h1 className="text-3xl font-black font-syne tracking-tighter uppercase leading-none">
                    KERNEL_<span className="text-primary">STATUS</span>
                  </h1>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right border-r border-border/20 pr-6">
                    <p className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">Last_Sync</p>
                    <p className="text-xs font-mono font-black text-primary">{lastCheck.toLocaleTimeString()}</p>
                  </div>
                  <button 
                    onClick={fetchStatus}
                    disabled={isLoading}
                    className="p-2 border border-primary/20 bg-background hover:bg-primary/5 transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 text-primary ${isLoading ? "animate-spin" : ""}`} />
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
                      <div className="flex-1 p-3 font-mono text-[9px] leading-snug overflow-auto bg-black/40 no-scrollbar">
                        {logs.map((log, idx) => (
                           <div key={idx} className="flex gap-3 mb-1 hover:bg-white/[0.02] py-0.5 px-2">
                              <span className="text-muted-foreground/10 shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
                              <span className={`font-black w-14 text-[7px] uppercase border px-1 ${
                                log.level === 'SUCCESS' ? 'text-secondary border-secondary/10' : 'text-primary border-primary/10'
                              }`}>{log.level}</span>
                              <span className="text-primary/40 truncate w-16">[{log.module}]</span>
                              <span className="text-foreground/50">{log.msg}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-4">
                    <div className="border border-border p-4 h-64 flex flex-col justify-between bg-card/5 relative group overflow-hidden">
                      <h3 className="text-xl font-black font-syne italic leading-none">ISOLATION_<span className="text-primary">WARD</span></h3>
                      <div className="space-y-3 border-l border-border/20 pl-4 my-4">
                         {[
                           { label: "CIPHER", value: "AES_256", color: "text-primary" },
                           { label: "SIGNAL", value: "ENCRYPTED", color: "text-secondary" },
                           { label: "SWITCH", value: "READY", color: "text-destructive" },
                         ].map(item => (
                           <div key={item.label} className="flex flex-col">
                              <span className="text-[7px] font-mono font-black text-muted-foreground/20 mb-0.5">{item.label}</span>
                              <span className={`text-[9px] font-mono font-black ${item.color}`}>{item.value}</span>
                           </div>
                         ))}
                      </div>
                      <button className="w-full py-2 border border-primary/40 text-primary font-mono font-black text-[9px] uppercase tracking-[0.3em] hover:bg-primary hover:text-black transition-all">STRESS_TEST</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ name, alias, icon: Icon, status, description }: { name: string, alias: string, icon: any, status: ServiceStatus, description: string }) {
  const isHealthy = status.status === "HEALTHY";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border bg-card/5 p-4 relative group hover:bg-card/10 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 border border-border/40 bg-background group-hover:border-primary/40 transition-all ${isHealthy ? 'text-primary' : 'text-destructive'}`}>
           <Icon className="w-4 h-4" />
        </div>
        <div className={`flex items-center gap-2 px-2 py-0.5 border font-mono font-black text-[8px] uppercase tracking-widest ${isHealthy ? 'border-secondary/20 text-secondary' : 'border-destructive/20 text-destructive'}`}>
           <div className={`w-1 h-1 rounded-full ${isHealthy ? 'bg-secondary animate-pulse' : 'bg-destructive'}`} />
           {status.status}
        </div>
      </div>
      <div>
         <h3 className="text-sm font-black font-syne uppercase tracking-tight mb-0.5 group-hover:text-primary transition-colors">{name}</h3>
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
