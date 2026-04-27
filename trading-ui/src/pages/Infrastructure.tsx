import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CONFIG } from "@/lib/config";
import {
  Cpu, Globe, Activity, RefreshCw,
  Network, Terminal, Loader2, Shield, Database,
  Cpu as CpuIcon, Server, HardDrive, Link, Unlock, Lock
} from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
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

const infraTabs = ["System_Status", "API_Probes"] as const;

export default function Infrastructure() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "System_Status";
  const activeTab = infraTabs.includes(rawTab as any) ? (rawTab as typeof infraTabs[number]) : "System_Status";

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const setActiveTab = (tab: typeof infraTabs[number]) => setSearchParams({ tab });

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await algoApi.getSystemStatus();
      // Safely unwrap data if it follows the { status, data } pattern
      const healthData = response?.data || response;
      setHealth(healthData);
      setLastCheck(new Date());
    } catch (error) {
       toast({ variant: "destructive", title: "KERNEL_ERR", description: "HANDSHAKE_FAILED" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await algoApi.getSystemLogs();
      const logsData = response?.logs || response?.data?.logs || [];
      setLogs(logsData);
    } catch (error) {}
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => { fetchStatus(); fetchLogs(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-3xl font-black uppercase tracking-[0.1em] text-foreground">Hardware_Infrastructure</h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.3em]">
          Kernel_Telemetry // Distributed_Computing_Matrix_Active
        </p>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="flex items-center justify-between border-b border-border/20 bg-card/2 p-1">
         <div className="flex items-center gap-1">
            {infraTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === tab ? "bg-primary text-black" : "text-muted-foreground/40 hover:text-foreground/60"
                )}
              >
                {tab}
              </button>
            ))}
         </div>
         <div className="flex items-center gap-6 px-4">
            <div className="flex flex-col items-end">
               <span className="text-[7px] font-black text-muted-foreground/20 uppercase tracking-[0.2em]">Sync_Cycle</span>
               <span className="text-[9px] font-mono font-black text-primary">{lastCheck.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="p-2 border border-border/30 hover:bg-primary/10 transition-all disabled:opacity-30"
            >
               <RefreshCw className={cn("w-4 h-4 text-primary", isLoading && "animate-spin")} />
            </button>
         </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "System_Status" && (
           <motion.div
             key="status"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="space-y-6"
           >
              {!health ? (
                <div className="py-20 flex flex-col items-center gap-4">
                   <Loader2 className="w-6 h-6 text-primary animate-spin" />
                   <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase animate-pulse">Polling_Cluster_Frequencies...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <StatusNode name="Aether_Core" id="ENGINE_01" icon={CpuIcon} status={health.algo_engine} description="Trading execution & strategy runtime." />
                    <StatusNode name="Shoonya_IF" id="BROKER_01" icon={Globe} status={health.broker} description="Finvasia WebSocket & REST gateway." />
                    <StatusNode name="Nexus_Bridge" id="PROTOCOL_01" icon={Network} status={health.openalgo} description="OpenAlgo kernel interface layer." />
                    <StatusNode name="Historify_DB" id="DUCKDB_01" icon={Database} status={health.database} description="Local analytical data storage engine." />
                    <StatusNode name="Neural_Alpha" id="OLLAMA_01" icon={Activity} status={health.ollama_local} description="Cognitive core for strategy optimization." />
                    <StatusNode name="Analytics_CX" id="OPENCLAW" icon={Shield} status={health.openclaw_agent} description="Reporting and auditing security layer." />
                  </div>

                  <div className="grid grid-cols-12 gap-6">
                     {/* Diagnostic Logs */}
                     <div className="col-span-8 p-6 bg-card/5 border border-border/50 h-80 flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 mb-6 shrink-0 border-b border-border/20 pb-4">
                           <Terminal className="w-4 h-4 text-primary" />
                           <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Kernel_Diagnostic_Stream</h3>
                        </div>
                        <div className="flex-1 overflow-auto space-y-1 pr-2 custom-scrollbar">
                           {logs.map((log, i) => (
                             <div key={i} className="flex gap-4 font-mono text-[9px] hover:bg-muted/5 p-1 transition-all group">
                                <span className="text-muted-foreground/20 group-hover:text-primary/40 shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
                                <span className={cn("w-16 font-black shrink-0 px-1 border tracking-tighter text-[7px] uppercase", log.level === 'ERROR' ? 'border-destructive/20 text-destructive' : 'border-primary/20 text-primary')}>
                                   {log.level}
                                </span>
                                <span className="text-muted-foreground/40 w-24 shrink-0 font-black uppercase tracking-widest">[{log.module}]</span>
                                <span className="text-foreground/60 uppercase truncate">{log.msg}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Security & Access */}
                     <div className="col-span-4 space-y-6">
                        <div className="p-6 bg-card/5 border border-border/50 h-36">
                           <div className="flex items-center gap-3 mb-6">
                              <Lock className="w-4 h-4 text-primary" />
                              <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Security_Isolation</h3>
                           </div>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                 <span className="text-muted-foreground/40 uppercase">Cipher_Protocol</span>
                                 <span className="font-black text-secondary">AES_256_GCM</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                 <span className="text-muted-foreground/40 uppercase">Encryption_State</span>
                                 <span className="font-black text-secondary">ACTIVE</span>
                              </div>
                           </div>
                        </div>

                        <div className="p-6 bg-primary/5 border border-primary/20 relative overflow-hidden h-36">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 -mr-8 -mt-8 rotate-45" />
                           <p className="text-[9px] font-mono text-muted-foreground/60 uppercase leading-snug">
                              Standard hardware Stress tests are scheduled for every UTC 00:00. Manual probe can be initiated during maintenance cycles.
                           </p>
                           <button className="mt-4 px-4 py-1.5 border border-primary/40 text-primary text-[8px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all">
                              Initiate_Probe
                           </button>
                        </div>
                     </div>
                  </div>
                </>
              )}
           </motion.div>
        )}

        {activeTab === "API_Probes" && (
           <motion.div
             key="probes"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="p-6 bg-card/5 border border-border/50"
           >
              <div className="flex items-center gap-3 mb-8 border-b border-border/20 pb-6">
                 <Link className="w-4 h-4 text-primary" />
                 <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Active_Endpoint_Probes</h3>
              </div>

              <div className="space-y-2">
                 <ProbeRow label="Auth_Gateway" endpoint="/supabase/auth/v1/health" info="Internal Supabase Bridge" />
                 <ProbeRow label="REST_Core" endpoint="/algo-api/api/v1/health" info="Primary REST Proxy (/algo-api)" />
                 <ProbeRow label="Tick_H-Bridge" endpoint={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/algo-ws`} info="WebSocket Port 5002" />
                 <ProbeRow label="Broker_Sync" endpoint="/algo-api/api/v1/brokers" info="Direct Exchange Link" />
                 <ProbeRow label="DuckDB_I/O" endpoint="/algo-api/api/v1/historify/catalog" info="SSD Persistent Layer" />
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusNode({ name, id, icon: Icon, status, description }: { name: string, id: string, icon: any, status?: ServiceStatus, description: string }) {
  const isHealthy = status?.status === "HEALTHY";
  const displayStatus = status?.status || "UNKNOWN";

  return (
    <div className="p-6 bg-card/5 border border-border/50 group hover:border-primary/40 transition-all relative">
      <div className="flex justify-between items-start mb-6">
         <div className="p-3 bg-background border border-border/30 group-hover:border-primary/20 transition-all">
            <Icon className={cn("w-5 h-5", isHealthy ? "text-primary" : "text-destructive")} />
         </div>
         <div className={cn("flex items-center gap-2 px-3 py-1 border font-mono font-black text-[9px] uppercase tracking-widest", isHealthy ? "border-secondary/20 text-secondary" : "border-destructive/20 text-destructive")}>
            <div className={cn("w-1.5 h-1.5 rounded-full", isHealthy ? "bg-secondary animate-pulse" : "bg-destructive")} />
            {displayStatus}
         </div>
      </div>
      <div>
         <h4 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors leading-none mb-1">{name}</h4>
         <span className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.3em]">{id}</span>
      </div>
      <p className="mt-4 text-[10px] font-mono text-muted-foreground/40 uppercase leading-snug h-8 overflow-hidden">
         {description}
      </p>
      <div className="mt-6 pt-4 border-t border-border/10 flex justify-between items-end">
         <div className="flex flex-col">
            <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-1">Latency_P99</span>
            <span className="text-xs font-black text-secondary font-mono">{status?.latency || '--'}ms</span>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase mb-1">State_Hash</span>
            <span className="text-[9px] font-mono font-black text-foreground truncate w-24 text-right uppercase">{status?.integrity || 'ACTIVE'}</span>
         </div>
      </div>
    </div>
  );
}

function ProbeRow({ label, endpoint, info }: { label: string, endpoint: string, info: string }) {
  const [status, setStatus] = useState<"WAIT" | "RUN" | "UP" | "DOWN">("WAIT");
  const [latency, setLatency] = useState<number | null>(null);

  const runProbe = async () => {
    setStatus("RUN");
    const start = performance.now();
    try {
      if (endpoint.startsWith('ws')) {
        setStatus("UP");
      } else {
        const res = await fetch(endpoint, { method: 'HEAD', headers: { 'apikey': 'PROBE' } });
        setStatus(res.ok || res.status === 401 ? "UP" : "DOWN");
      }
      setLatency(Math.round(performance.now() - start));
    } catch {
      setStatus("DOWN");
    }
  };

  useEffect(() => {
    runProbe();
    const interval = setInterval(runProbe, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between py-4 px-6 border border-border/10 hover:bg-muted/5 transition-all group">
       <div className="flex items-center gap-6">
          <div className={cn("w-1 h-6 shrink-0", status === 'UP' ? "bg-secondary" : status === 'DOWN' ? "bg-destructive" : "bg-muted-foreground/20")} />
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{label}</span>
             <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">{info}</span>
          </div>
       </div>

       <div className="flex items-center gap-12">
          <span className="text-[8px] font-mono text-muted-foreground/20 truncate max-w-[240px] lowercase">{endpoint}</span>
          <div className="w-16 flex flex-col items-end">
             <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase mb-0.5">Latency</span>
             <span className="text-[10px] font-mono font-black text-secondary">{latency ? `${latency}ms` : '--'}</span>
          </div>
          <div className={cn("px-3 py-0.5 border font-mono font-black text-[9px] uppercase tracking-widest", status === 'UP' ? "border-secondary/20 text-secondary" : status === 'DOWN' ? "border-destructive/20 text-destructive" : "border-border/20 text-muted-foreground/20")}>
             {status}
          </div>
          <button onClick={runProbe} className="p-2 hover:bg-primary/10 transition-colors">
             <RefreshCw className={cn("w-3.5 h-3.5 text-primary/40 group-hover:text-primary", status === 'RUN' && "animate-spin")} />
          </button>
       </div>
    </div>
  );
}
