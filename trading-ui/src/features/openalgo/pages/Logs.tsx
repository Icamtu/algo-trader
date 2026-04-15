import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { useSystemLogs } from "../hooks/useTrading";
import { 
  Terminal, 
  Search, 
  Download, 
  RefreshCw, 
  Trash2,
  AlertTriangle,
  Info,
  ChevronDown,
  Hash
} from "lucide-react";

export default function Logs() {
  const { data: logsData, isLoading, refetch, isFetching } = useSystemLogs();
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = logsData?.logs || [];
  const filteredLogs = logs.filter((log: any) => {
    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
    const matchesSearch = log.message.toLowerCase().includes(filter.toLowerCase()) || 
                          log.module.toLowerCase().includes(filter.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/logs" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border/20">
          {/* Header Section */}
          <div className="p-4 border-b border-border/20 bg-card/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-sm">
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-primary">System_Telemetry_v4</h1>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Low_Level_Kernel_Audit_Stream</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex border border-border/20 bg-background/50 rounded-sm overflow-hidden">
                  {["ALL", "INFO", "WARNING", "ERROR"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLevelFilter(lvl)}
                      className={`px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest transition-all ${
                        levelFilter === lvl ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <div className="h-4 w-[1px] bg-border/20 mx-1" />
                <button 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 border border-border/20 bg-background/50 hover:bg-primary/5 transition-all group"
                >
                  <RefreshCw className={`w-3 h-3 text-muted-foreground group-hover:text-primary transition-all ${isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input 
                type="text"
                placeholder="PROBE_LOG_STREAM_BY_MODULE_OR_MESSAGE..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-background/50 border border-border/20 pl-9 pr-4 py-2 text-[10px] font-mono uppercase tracking-widest focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/20"
              />
            </div>
          </div>

          {/* Log Stream Section */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-auto p-4 custom-scrollbar bg-black/40 font-mono text-[10px] space-y-1"
          >
            {filteredLogs.map((log: any, i: number) => (
              <div key={i} className="flex gap-4 group hover:bg-white/5 transition-colors px-2 py-0.5 border-l border-transparent hover:border-primary/20">
                <span className="text-muted-foreground/30 whitespace-nowrap">{log.timestamp}</span>
                <span className={`w-12 font-black text-center ${
                  log.level === "ERROR" ? "text-destructive" : 
                  log.level === "WARNING" ? "text-primary" : 
                  "text-secondary"
                }`}>
                  [{log.level}]
                </span>
                <span className="text-primary/60 w-24 truncate">[{log.module}]</span>
                <span className="text-foreground/80 flex-1">{log.message}</span>
              </div>
            ))}
            {!isLoading && filteredLogs.length === 0 && (
              <div className="h-full flex items-center justify-center opacity-10">
                <div className="text-center space-y-2">
                   <Terminal className="w-12 h-12 mx-auto" />
                   <div className="text-[10px] font-black uppercase tracking-[0.5em]">SYSTEM_BUS_IDLE</div>
                </div>
              </div>
            )}
            {isLoading && (
              <div className="h-full flex items-center justify-center text-primary/40">
                 <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-border/10 bg-card/5 backdrop-blur-sm flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                   <Hash className="w-3 h-3 text-muted-foreground/40" />
                   <span className="text-[9px] font-mono text-muted-foreground/60 uppercase racking-widest">Stream_Buffer: {filteredLogs.length}</span>
                </div>
                <div className="h-3 w-[1px] bg-border/10" />
                <div className="flex items-center gap-1.5">
                   <Info className="w-3 h-3 text-muted-foreground/40" />
                   <span className="text-[9px] font-mono text-muted-foreground/60 uppercase racking-widest">Status: Synchronized</span>
                </div>
             </div>
             <button className="flex items-center gap-2 px-3 py-1 border border-border/20 bg-background/20 text-[8px] font-mono font-black uppercase tracking-widest hover:border-primary/30 transition-all">
                <Download className="w-2.5 h-2.5" />
                DUMP_LOGS
             </button>
          </div>
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
