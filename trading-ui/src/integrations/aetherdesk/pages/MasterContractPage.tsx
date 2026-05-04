import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Download, Server, Clock, CheckCircle2, AlertCircle, FileStack, BarChart3, Activity } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';

interface MasterContractStatus {
  broker: string;
  status: 'pending' | 'downloading' | 'success' | 'error' | 'unknown';
  message: string;
  last_updated: string | null;
  total_symbols: string;
  is_ready: boolean;
  exchange_stats: Record<string, number> | null;
}

interface CacheHealth {
  health_score: number;
  status: string;
  total_symbols?: number;
  memory_usage_mb?: string;
}

export const MasterContractPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBgClass = isAD ? "bg-amber-500" : "bg-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";

  const [status, setStatus] = useState<MasterContractStatus | null>(null);
  const [cacheHealth, setCacheHealth] = useState<CacheHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusData, healthData] = await Promise.all([
        tradingService.getMasterContractStatus(),
        tradingService.getCacheHealth()
      ]);
      setStatus(statusData);
      setCacheHealth(healthData);
    } catch (error) {
      console.error('Failed to fetch Master Contract data', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (status?.status === 'downloading') fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData, status?.status]);

  const handleDownload = async (force: boolean) => {
    setIsSyncing(true);
    try {
      await tradingService.downloadMasterContract(force);
      fetchData();
    } catch (error) {
      console.error('Download failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReload = async () => {
    setIsSyncing(true);
    try {
      await tradingService.reloadCache();
      fetchData();
    } catch (error) {
      console.error('Reload failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <Database className={cn("w-10 h-10 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Database className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Contract_Forge_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">SYMBOL_REPLICATION // CACHE_INTEGRITY_V2</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => handleDownload(true)}
            disabled={isSyncing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isSyncing && "animate-spin")} />
            RE_SYNC_CONTRACTS
          </Button>
          <Button
            variant="outline"
            onClick={handleReload}
            disabled={isSyncing}
            className={cn("bg-background border-white/[0.05] text-[9px] font-mono uppercase tracking-widest h-10 rounded-none transition-all", isAD ? "hover:border-primary/50" : "hover:border-teal-500/50")}
          >
            <RefreshCw className={cn("w-3 h-3 mr-2", isSyncing && "animate-spin", primaryColorClass)} />
            Reload_Memory_Buffer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(true)}
            disabled={isSyncing}
            className={cn("border-border/20 text-[9px] font-mono uppercase tracking-widest h-10 rounded-none shadow-lg transition-all", isAD ? "bg-primary text-black hover:bg-white shadow-primary/10" : "bg-teal-500 text-black hover:bg-white shadow-teal-500/10")}
          >
            <Download className={cn("w-3 h-3 mr-2", isSyncing && "animate-spin")} />
            Force_Broker_Sync
          </Button>
        </div>

        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-full industrial-grid opacity-10 pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Status Cluster */}
        <div className="md:col-span-4 space-y-6">
          <AetherPanel className={cn("bg-background h-[340px]", accentBorderClass)}>
             <div className={cn("micro-label mb-10 flex items-center gap-2", primaryColorClass)}>
                <Server className="w-3 h-3" /> Ingestion_State_Monitor
             </div>

             <div className="space-y-8">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-20 h-20 border flex items-center justify-center mb-4 transition-all duration-1000",
                      status?.is_ready
                        ? (isAD ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(255,176,0,0.05)]" : "border-teal-500 bg-teal-500/5 shadow-[0_0_30px_rgba(20,184,166,0.05)]")
                        : "border-rose-500/20 bg-rose-500/5 shadow-[0_0_30px_rgba(244,63,94,0.05)]"
                    )}>
                       {status?.status === 'downloading' ? (
                         <RefreshCw className={cn("w-8 h-8 animate-spin", primaryColorClass)} />
                       ) : status?.is_ready ? (
                         <CheckCircle2 className={cn("w-8 h-8", primaryColorClass)} />
                       ) : (
                         <AlertCircle className="w-8 h-8 text-rose-500" />
                       )}
                    </div>
                   <div className="text-xl font-black font-mono uppercase text-foreground mb-1">
                      {status?.status || 'UNKNOWN'}
                   </div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.4em] opacity-40 italic">Current_Kernel_State</div>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/[0.03]">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                       <span className="text-muted-foreground/40 italic">Node_Origin</span>
                       <span className={cn("font-black", primaryColorClass)}>{status?.broker || 'NONE'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                       <span className="text-muted-foreground/40 italic">Ingested_Count</span>
                       <span className="text-foreground/80 font-black">{status?.total_symbols?.toLocaleString() || '0'}</span>
                    </div>
                </div>

                {status?.status === 'downloading' && (
                  <div className="pt-2">
                     <Progress value={undefined} className="h-1 bg-background/50" />
                  </div>
                )}
             </div>
          </AetherPanel>

           <AetherPanel className={cn("bg-background", isAD ? "border-primary/10" : "border-teal-500/10")}>
              <div className={cn("micro-label mb-4 flex items-center gap-2", isAD ? "text-primary/40" : "text-teal-500/40")}>
                 <Activity className="w-3 h-3" /> Memory_Cache_Health_v4
              </div>

             <div className="flex items-end justify-between">
                <div>
                   <div className={cn("text-3xl font-black font-mono mb-1", primaryColorClass)}>{cacheHealth?.health_score || 0}%</div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest opacity-40 italic">Aggregate_Stability_Score</div>
                 </div>
                 <div className="text-right">
                    <div className="text-sm font-black font-mono text-foreground/80">{cacheHealth?.memory_usage_mb || '0'} MB</div>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest opacity-40 italic">Heap_Allocation</div>
                 </div>
              </div>
              <Progress value={cacheHealth?.health_score} className={cn("h-1.5 mt-4 bg-background border border-white/[0.03]", isAD ? "primary-progress" : "teal-progress")} />
           </AetherPanel>
        </div>

         {/* Exchange Grid */}
         <div className="md:col-span-8">
           <AetherPanel className="h-full border-white/[0.03] bg-background min-h-[400px] md:min-h-[500px]">
             <div className="flex items-center justify-between mb-10">
                <div className="micro-label flex items-center gap-2 opacity-40">
                   <BarChart3 className={cn("w-3 h-3", primaryColorClass)} /> Exchange_Distribution_Matrix
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-[0.2em] italic">V4_Realtime_Audit</div>
             </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {status?.exchange_stats ? (
                   Object.entries(status.exchange_stats).sort((a,b) => b[1] - a[1]).map(([ex, count]) => (
                     <div key={ex} className="p-4 border border-white/[0.05] bg-foreground/[0.01] relative group overflow-hidden transition-all hover:border-white/[0.1]">
                        <div className="flex items-center justify-between relative z-10">
                           <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors opacity-40 group-hover:opacity-100")}>{ex}</div>
                           <div className={cn("text-xs font-black font-mono group-hover:scale-110 transition-transform", primaryColorClass)}>{count.toLocaleString()}</div>
                        </div>
                        <div className="mt-2 text-[7px] font-mono text-muted-foreground/20 uppercase tracking-[0.2em] relative z-10 italic">Contract_Objects_Indexed</div>

                       {/* Industrial Background Bar */}
                       <div className={cn("absolute inset-0 origin-left transition-transform duration-1000 opacity-5", accentBgClass)} style={{ transform: `scaleX(${Math.min(count / 10000, 1)})` }} />
                    </div>
                  ))
               ) : (
                  <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-white/[0.05] opacity-10">
                     <FileStack className="w-10 h-10 mb-4" />
                     <div className="text-[10px] font-mono uppercase tracking-[0.4em]">NO_DATA_INGESTED_TERMINAL</div>
                  </div>
               )}
            </div>

             <div className="mt-auto pt-12 border-t border-white/[0.03] flex items-center gap-6 text-[9px] font-mono text-muted-foreground/20 uppercase tracking-widest italic">
                <div className="flex items-center gap-2">
                   <Clock className="w-3 h-3 opacity-40" /> Last_Refreshed: {status?.last_updated ? new Date(status.last_updated).toLocaleTimeString() : 'NEVER'}
                </div>
                <div className="flex items-center gap-2">
                   <Activity className="w-3 h-3 opacity-40" /> Polling_Mode: ACTIVE_INT_3000MS
                </div>
             </div>
          </AetherPanel>
        </div>
      </div>
    </div>
  );
};
