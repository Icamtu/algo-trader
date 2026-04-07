import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Server, Shield, Zap, Cpu, Database, Globe, 
  Activity, RefreshCw, AlertTriangle, CheckCircle2, 
  HardDrive, Network, Terminal, Radio, 
  ArrowRight, Cloud, Layers, BarChart3,
  Bot, Sparkles, Fingerprint, Loader2, Wifi, WifiOff
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { ApiErrorBoundary } from "@/components/ui/ApiErrorBoundary";

interface ServiceStatus {
  status: "HEALTHY" | "OFFLINE" | "ERROR" | "DISCONNECTED" | "READ_ONLY";
  latency?: number;
  details?: string;
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

interface ApiHealthEntry {
  name: string;
  url: string;
  status: "HEALTHY" | "SLOW" | "UNREACHABLE";
  latency: number;
  lastChecked: Date;
}

const API_HEALTH_TARGETS = [
  { name: "algo-engine", url: "/health" },
  { name: "OpenAlgo Gateway", url: "http://localhost:5000/" },
  { name: "OpenClaw AI", url: "http://localhost:18789/v1/models" },
  { name: "Ollama Local", url: "http://localhost:11434/api/tags" },
  { name: "Supabase Studio", url: "http://localhost:54321/" },
  { name: "Supabase API", url: "http://localhost:8000/rest/v1/" },
];

const LOAD_TIMEOUT_MS = 5000;
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActiveTab = (tab: typeof infraTabs[number]) => {
    setSearchParams({ tab });
  };
  
  // API Health tab state
  const [apiHealth, setApiHealth] = useState<ApiHealthEntry[]>([]);
  const [isCheckingApi, setIsCheckingApi] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    
    timeoutRef.current = setTimeout(() => {
      if (!health) {
        setApiError("Backend API did not respond within 5 seconds. The algo-engine may be offline.");
      }
    }, LOAD_TIMEOUT_MS);
    
    let statusInterval: ReturnType<typeof setInterval> | undefined;
    let logsInterval: ReturnType<typeof setInterval> | undefined;
    
    if (autoRefresh) {
      statusInterval = setInterval(fetchStatus, 10000);
      logsInterval = setInterval(fetchLogs, 5000);
    }
    
    return () => {
      if (statusInterval) clearInterval(statusInterval);
      if (logsInterval) clearInterval(logsInterval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      const data = await algoApi.getSystemLogs();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    }
  };

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await algoApi.getSystemStatus();
      setHealth(data);
      setLastCheck(new Date());
      setApiError(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } catch (error) {
      console.error("Failed to fetch system status", error);
      if (!health) {
        setApiError("Cannot connect to the System Status endpoint. Ensure the backend (algo-engine :5001) is running.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setApiError(null);
    timeoutRef.current = setTimeout(() => {
      if (!health) setApiError("Backend API still unreachable.");
    }, LOAD_TIMEOUT_MS);
    fetchStatus();
  };

  const checkApiHealth = async () => {
    setIsCheckingApi(true);
    const results: ApiHealthEntry[] = [];
    
    for (const target of API_HEALTH_TARGETS) {
      const start = performance.now();
      try {
        // Use the algo-engine proxy for external checks
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const url = target.url.startsWith("http") 
          ? target.url 
          : `http://localhost:5001${target.url}`;
        
        await fetch(url, { 
          method: "HEAD", 
          signal: controller.signal,
          mode: "no-cors",
        });
        clearTimeout(timeout);
        
        const latency = Math.round(performance.now() - start);
        results.push({
          name: target.name,
          url: target.url,
          status: latency < 200 ? "HEALTHY" : latency < 800 ? "SLOW" : "UNREACHABLE",
          latency,
          lastChecked: new Date(),
        });
      } catch {
        results.push({
          name: target.name,
          url: target.url,
          status: "UNREACHABLE",
          latency: Math.round(performance.now() - start),
          lastChecked: new Date(),
        });
      }
    }
    
    setApiHealth(results);
    setIsCheckingApi(false);
  };

  useEffect(() => {
    if (activeTab === "API Health" && apiHealth.length === 0) {
      checkApiHealth();
    }
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HEALTHY": return "text-neon-green bg-neon-green/10 border-neon-green/30";
      case "OFFLINE": return "text-destructive bg-destructive/10 border-destructive/30";
      case "ERROR": return "text-warning bg-warning/10 border-warning/30";
      default: return "text-muted-foreground bg-muted/10 border-border";
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground selection:bg-primary/30">
      <GlobalHeader />
      <MarketNavbar activeTab="/infrastructure" />

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 px-8 pt-2 pb-0 bg-background/50">
        {infraTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-dots-grid relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
        
        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          
          {activeTab === "System Status" && (
            <>
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live Dependency Registry</span>
                    </div>
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
                    SYSTEM <span className="text-primary italic">INFRASTRUCTURE</span>
                  </h1>
                  <p className="text-muted-foreground text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Control Center & Diagnostic Radar</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Last Synchronization</p>
                    <p className="text-xs font-mono font-bold text-foreground">{lastCheck.toLocaleTimeString()}</p>
                  </div>
                  <button 
                    onClick={() => fetchStatus()}
                    disabled={isLoading}
                    className="w-12 h-12 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all group active:scale-95"
                  >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`} />
                  </button>
                </div>
              </div>

              {apiError && !health ? (
                <ApiErrorBoundary error={apiError} onRetry={handleRetry} label="System Infrastructure" />
              ) : !health ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Establishing Signal Link...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  <StatusCard 
                    name="AetherDesk Core" 
                    alias="Algo Engine"
                    icon={Cpu} 
                    status={health.algo_engine} 
                    description="Primary execution runtime & async strategy scheduler."
                  />
                  
                  <StatusCard 
                    name="Shoonya Gateway" 
                    alias="Broker Interface"
                    icon={Globe} 
                    status={health.broker} 
                    description="Live market execution bridge via Finvasia Shoonya."
                  />
                  
                  <StatusCard 
                    name="OpenAlgo Cluster" 
                    alias="Execution Hub"
                    icon={Network} 
                    status={health.openalgo} 
                    description="Distributed execution and webhooks management layer."
                  />
                  
                  <StatusCard 
                    name="Ollama Local AI" 
                    alias="Neural Core"
                    icon={Sparkles} 
                    status={health.ollama_local} 
                    description="Local private inference engine for neural picking."
                  />
                  
                  <StatusCard 
                    name="OpenClaw Autonomous" 
                    alias="Agent Layer"
                    icon={Fingerprint} 
                    status={health.openclaw_agent} 
                    description="Strategic autonomous agent layer for deep market scans."
                  />
                  
                  <StatusCard 
                    name="Primary Database" 
                    alias="Persistent Memory"
                    icon={Database} 
                    status={health.database} 
                    description="SQLite high-concurrency WAL persistence layer."
                  />

                </div>
              )}

              {/* System Logs / Registry Map */}
              {health && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8">
                    <div className="glass-panel-elevated rounded-3xl border border-border/40 overflow-hidden h-[300px] flex flex-col">
                      <div className="px-6 py-4 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Terminal className="w-4 h-4 text-primary" />
                          <span className="text-xs font-black uppercase tracking-widest">Diagnostic Logs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                          <span className="text-[10px] font-black text-neon-green uppercase tracking-tighter">Real-time Log Channel Active</span>
                        </div>
                      </div>
                      <div className="flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto bg-black/40 custom-scrollbar text-muted-foreground select-all">
                        {logs.length === 0 ? (
                          <div className="h-full flex items-center justify-center opacity-40 italic">
                            No logs archived in current session buffer...
                          </div>
                        ) : (
                          logs.map((log, idx) => (
                            <LogLine 
                              key={idx} 
                              time={new Date(log.time)} 
                              level={log.level} 
                              module={log.module} 
                              msg={log.msg} 
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-4">
                    <div className="glass-panel-elevated rounded-3xl border border-border/40 p-8 h-[300px] flex flex-col justify-between bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/2 -translate-y-1/2">
                        <Shield className="w-64 h-64 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black tracking-tighter mb-2">ISOLATION WARD</h3>
                        <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase opacity-60">Security & Circuit Health</p>
                      </div>
                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground">Neural Bypass</span>
                          <span className="text-[10px] font-mono font-bold text-neon-green bg-neon-green/10 px-2 py-0.5 rounded">INACTIVE</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground">Encryption Bridge</span>
                          <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">AES-256 ACTIVE</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground">Global Kill Switch</span>
                          <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/20 px-2 py-0.5 rounded italic">STANDBY</span>
                        </div>
                      </div>
                      <button className="glow-button w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Perform Stress Test</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "API Health" && (
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
                    API <span className="text-primary italic">HEALTH</span>
                  </h1>
                  <p className="text-muted-foreground text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Direct endpoint connectivity monitor</p>
                </div>
                <button 
                  onClick={checkApiHealth}
                  disabled={isCheckingApi}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-primary ${isCheckingApi ? "animate-spin" : ""}`} />
                  <span className="text-xs font-black text-primary uppercase tracking-widest">
                    {isCheckingApi ? "Checking..." : "Check All"}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apiHealth.length === 0 && !isCheckingApi ? (
                  <div className="col-span-full h-[300px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <Wifi className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground">Click "Check All" to probe all service endpoints</p>
                    </div>
                  </div>
                ) : isCheckingApi && apiHealth.length === 0 ? (
                  <div className="col-span-full h-[300px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Probing endpoints...</span>
                    </div>
                  </div>
                ) : (
                  apiHealth.map((entry) => (
                    <motion.div
                      key={entry.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-panel-elevated rounded-2xl border border-border/40 p-5 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {entry.status === "HEALTHY" ? (
                            <Wifi className="w-4 h-4 text-neon-green" />
                          ) : entry.status === "SLOW" ? (
                            <Wifi className="w-4 h-4 text-warning" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-destructive" />
                          )}
                          <span className="text-sm font-black">{entry.name}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          entry.status === "HEALTHY" ? "text-neon-green bg-neon-green/10 border-neon-green/30" :
                          entry.status === "SLOW" ? "text-warning bg-warning/10 border-warning/30" :
                          "text-destructive bg-destructive/10 border-destructive/30"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Latency</span>
                          <span className={`text-xs font-mono font-bold ${
                            entry.latency < 200 ? "text-neon-green" : entry.latency < 800 ? "text-warning" : "text-destructive"
                          }`}>
                            {entry.latency}ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Endpoint</span>
                          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">{entry.url}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Checked</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{entry.lastChecked.toLocaleTimeString()}</span>
                        </div>
                      </div>
                      {/* Latency bar */}
                      <div className="mt-3 h-1 rounded-full bg-muted/30 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            entry.latency < 200 ? "bg-neon-green" : entry.latency < 800 ? "bg-warning" : "bg-destructive"
                          }`}
                          style={{ width: `${Math.min(entry.latency / 10, 100)}%` }}
                        />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function StatusCard({ name, alias, icon: Icon, status, description }: { name: string, alias: string, icon: any, status: ServiceStatus, description: string }) {
  const isHealthy = status.status === "HEALTHY";
  const isError = status.status === "OFFLINE" || status.status === "ERROR";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass-panel-elevated p-6 rounded-3xl border border-border/40 hover:border-primary/40 transition-all group cursor-default"
    >
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-2xl bg-muted/30 border border-border/50 group-hover:scale-110 transition-transform duration-500 ${isHealthy ? "group-hover:bg-neon-green/10 group-hover:border-neon-green/30 text-primary group-hover:text-neon-green" : isError ? "group-hover:bg-destructive/10 group-hover:border-destructive/30 text-destructive" : ""}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
          status.status === "HEALTHY" ? "text-neon-green bg-neon-green/10 border-neon-green/30" : 
          isError ? "text-destructive bg-destructive/10 border-destructive/30 animate-pulse" : 
          "text-muted-foreground bg-muted/10 border-border/50"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${status.status === "HEALTHY" ? "bg-neon-green shadow-[0_0_8px_rgba(0,255,100,0.8)]" : isError ? "bg-destructive shadow-[0_0_8px_rgba(255,0,0,0.8)]" : "bg-muted"}`} />
          {status.status}
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-tight leading-none mb-1">{name}</h3>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 italic">{alias}</p>
        </div>
        
        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed min-h-[40px]">{description}</p>
        
        <div className="pt-4 mt-4 border-t border-border/40 flex items-center justify-between">
          {status.latency !== undefined && (
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Pulse Latency</span>
              <span className={`text-xs font-mono font-bold ${status.latency < 100 ? "text-neon-green" : status.latency < 500 ? "text-warning" : "text-destructive"}`}>
                {status.latency} ms
              </span>
            </div>
          )}
          {status.details && (
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Diagnostics</span>
              <span className="text-xs font-bold text-foreground max-w-[120px] truncate" title={status.details}>{status.details}</span>
            </div>
          )}
          {status.integrity && (
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">State</span>
              <span className="text-xs font-bold text-primary">{status.integrity}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LogLine({ time, level, module, msg }: { time: Date, level: string, module: string, msg: string }) {
  const levelColor = level === "SUCCESS" ? "text-neon-green" : level === "WARN" ? "text-warning" : level === "ERROR" ? "text-destructive" : "text-primary";
  return (
    <div className="flex items-start gap-4 mb-1 hover:bg-white/5 px-2 py-1 rounded transition-colors group">
      <span className="text-muted-foreground/40 shrink-0 select-none">[{time.toISOString().split('T')[1].split('.')[0]}]</span>
      <span className={`font-black uppercase w-16 text-center text-[9px] px-1.5 py-0.5 rounded border border-current/20 ${levelColor} bg-current/5`}>{level}</span>
      <span className="text-muted-foreground/60 w-16 shrink-0 tracking-widest text-[10px]">[{module}]</span>
      <span className="text-foreground/80 group-hover:text-foreground transition-colors">{msg}</span>
    </div>
  );
}
