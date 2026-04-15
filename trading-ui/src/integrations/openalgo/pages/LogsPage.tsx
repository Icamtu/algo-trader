import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, FileText, Zap, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';

interface LogEntry {
  id: number;
  api_type: string;
  request_data: any;
  response_data: any;
  strategy: string;
  created_at: string;
}
export const LogsPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
 
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const response = await tradingService.getSystemLogs(1, searchQuery);
      if (response.logs) {
        setLogs(response.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(), 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const toggleExpand = (id: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <FileText className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>System_Telemetry_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Terminal className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">REALTIME_LOG_STREAM // KERNEL_AUDIT_V4</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72 group">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-all text-muted-foreground group-focus-within:text-foreground", primaryColorClass)} />
            <Input 
              placeholder="FILTER_EVENT_STREAM..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-10 h-10 bg-background/40 border-border/10 text-[10px] uppercase font-mono tracking-widest focus-visible:ring-1", isAD ? "focus-visible:ring-amber-500/20" : "focus-visible:ring-teal-500/20")}
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={() => fetchLogs(true)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_STREAM
          </Button>
        </div>
      </div>

       <div className="space-y-3 px-0 pb-8">
         {logs.length === 0 ? (
           <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
              <div className={cn("p-4 border rounded-full", accentBorderClass)}>
                 <Terminal className={cn("w-10 h-10", primaryColorClass)} />
              </div>
              <div className="text-[11px] font-mono font-black uppercase tracking-[0.4em]">NO_TELEMETRY_INTERCEPTED</div>
           </div>
         ) : (
           logs.map((log) => (
             <AetherPanel key={log.id} className={cn("border-border/10 bg-background/20 hover:bg-background/40 transition-all p-0 overflow-hidden group", expandedLogs.has(log.id) && accentBorderClass)}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
                   <div className="flex items-center gap-4">
                      <div className={cn("w-1 h-8 rounded-full opacity-20", primaryColorClass, "bg-current")} />
                      <div className="flex flex-col">
                         <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border-border/20", primaryColorClass)}>{log.api_type}</Badge>
                            <div className="text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-2">
                               <Zap className={cn("w-3 h-3 opacity-40", primaryColorClass)} />
                               {log.strategy || 'DEFAULT_CORE'}
                            </div>
                         </div>
                         <div className="text-[8px] font-mono text-muted-foreground/40 mt-1 italic">{log.created_at}</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                         {Object.entries(log.request_data).slice(0, 4).map(([key, val]) => (
                           <div key={key} className="flex gap-2 items-baseline">
                              <span className="text-[7px] text-muted-foreground/30 uppercase font-black">{key}:</span>
                              <span className="text-[9px] font-mono font-bold truncate max-w-[80px] opacity-70">{String(val)}</span>
                           </div>
                         ))}
                      </div>
                      <div className="p-1 border border-border/10">
                         {expandedLogs.has(log.id) ? <ChevronUp className="w-3.5 h-3.5 opacity-30" /> : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                      </div>
                   </div>
                </div>
 
               {expandedLogs.has(log.id) && (
                 <div className="grid grid-cols-1 md:grid-cols-2 border-t border-border/10 bg-foreground/5 animate-in slide-in-from-top-4 duration-300">
                   <div className="p-4 border-r border-border/10">
                     <div className="micro-label text-muted-foreground/40 italic flex items-center gap-2 mb-3">
                        <Terminal className="w-3 h-3" /> REQUEST_PAYLOAD
                     </div>
                     <pre className={cn("text-[9px] font-mono bg-background/40 p-3 border border-border/10 custom-scrollbar max-h-[300px] overflow-auto", isAD ? "text-primary/70" : "text-teal-500/70")}>
                        {JSON.stringify(log.request_data, null, 2)}
                     </pre>
                   </div>
                   <div className="p-4">
                     <div className="micro-label text-muted-foreground/40 italic flex items-center gap-2 mb-3">
                        <Zap className="w-3 h-3" /> KERNEL_RESPONSE
                     </div>
                     <pre className={cn("text-[9px] font-mono bg-background/40 p-3 border border-border/10 custom-scrollbar max-h-[300px] overflow-auto", isAD ? "text-amber-400/70" : "text-emerald-400/70")}>
                        {JSON.stringify(log.response_data, null, 2)}
                     </pre>
                   </div>
                 </div>
               )}
             </AetherPanel>
           ))
         )}
       </div>
    </div>
  );
};
