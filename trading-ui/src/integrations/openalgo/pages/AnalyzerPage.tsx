import React, { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Filter, Download, Activity, AlertTriangle, BarChart3, Users, Eye, Terminal, Search, Calendar, RefreshCw } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { VirtualizedDataTable, type ColumnDefinition } from '../components/VirtualizedDataTable';

export const AnalyzerPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchData = async (start?: string, end?: string) => {
    setIsLoading(true);
    try {
      const res = await tradingService.getAnalyzerData(start, end);
      if (res.status === 'success') {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load analyzer data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(startDate, endDate);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <ShieldCheck className={cn("w-10 h-10 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  const stats = data?.stats || { total_requests: 0, issues: { total: 0 }, symbols: [], sources: [] };
  const requests = data?.requests || [];

  const columns = useMemo<ColumnDefinition<any>[]>(() => [
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: 180,
      cell: (req) => <span className="text-muted-foreground/40 italic">{req.timestamp}</span>
    },
    {
      key: 'type',
      header: 'Type',
      width: 120,
      cell: (req) => (
        <Badge variant="outline" className={cn("text-[8px] uppercase", isAD ? "border-primary/20 text-primary" : "border-teal-500/20 text-teal-500")}>
          {req.api_type}
        </Badge>
      )
    },
    {
      key: 'source',
      header: 'Source',
      width: 150,
      cell: (req) => <span className="opacity-70 italic">{req.source}</span>
    },
    {
      key: 'symbol',
      header: 'Symbol',
      width: 150,
      cell: (req) => <span className="font-black">{req.symbol || 'N/A'}</span>
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      cell: (req) => (
        req.analysis?.issues ? (
          <div className="flex items-center gap-2 text-rose-500 font-black italic">
             <AlertTriangle className="w-3 h-3" /> ANOMALY
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-500 font-black italic">
             <ShieldCheck className="w-3 h-3" /> VALID
          </div>
        )
      )
    },
    {
      key: 'actions',
      header: '',
      width: 120,
      align: 'right',
      cell: (req) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelectedRequest(req); setShowDetails(true); }}
          className={cn("h-8 border border-border/10 text-[9px] uppercase tracking-widest transition-all", isAD ? "hover:border-primary/50" : "hover:border-teal-500/50")}
        >
           <Eye className="w-3.5 h-3.5 mr-2" /> Inspect
        </Button>
      )
    }
  ], [isAD]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <ShieldCheck className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Validator_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Terminal className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">API_PAYLOAD_AUDIT // SIGNAL_INTEGRITY</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => fetchData(startDate, endDate)}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            RE_SCAN_VECTORS
          </Button>
        </div>
      </div>

       {/* Control Deck */}
       <AetherPanel className="border-border/10 bg-background/40">
          <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6">
             <div className="space-y-2">
                <div className="micro-label flex items-center gap-2"><Calendar className={cn("w-3 h-3", primaryColorClass)}/> START_VECTOR</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn("w-full bg-background/60 border border-border/10 p-3 font-mono text-[10px] uppercase focus:outline-none h-12 transition-all", isAD ? "text-amber-500 focus:border-amber-500/40" : "text-teal-500 focus:border-teal-500/40")}
                />
             </div>
             <div className="space-y-2">
                <div className="micro-label flex items-center gap-2"><Calendar className={cn("w-3 h-3", primaryColorClass)}/> END_VECTOR</div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={cn("w-full bg-background/60 border border-border/10 p-3 font-mono text-[10px] uppercase focus:outline-none h-12 transition-all", isAD ? "text-amber-500 focus:border-amber-500/40" : "text-teal-500 focus:border-teal-500/40")}
                />
             </div>
             <div className="flex gap-3">
                <Button type="submit" className={cn("h-12 px-8 font-mono font-black text-[10px] uppercase tracking-widest transition-all text-black hover:bg-white shadow-xl", isAD ? "bg-amber-500" : "bg-teal-500")}>
                   <Search className="w-4 h-4 mr-2" /> Filter_Stream
                </Button>
                <Button variant="outline" className="h-12 border-border/10 font-mono text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100">
                   <Download className="w-4 h-4 mr-2" /> Export_Audit
                </Button>
             </div>
          </form>
       </AetherPanel>

       {/* Telemetry Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { label: "Total_Intercepts", value: stats.total_requests, icon: Activity, color: primaryColorClass },
             { label: "Anomaly_Detected", value: stats.issues.total, icon: AlertTriangle, color: "text-rose-500" },
             { label: "Unique_Symbols", value: stats.symbols?.length || 0, icon: BarChart3, color: primaryColorClass },
             { label: "Active_Sources", value: stats.sources?.length || 0, icon: Users, color: primaryColorClass },
           ].map((stat, i) => (
             <AetherPanel key={i} className="border-border/10 bg-background/20 group">
               <div className="flex justify-between items-start mb-4">
                  <div className="micro-label text-muted-foreground/40">{stat.label}</div>
                  <stat.icon className={cn("w-3.5 h-3.5 opacity-30", stat.color)} />
               </div>
                <div className={cn("text-3xl font-black font-mono tracking-tighter", stat.color)}>{stat.value}</div>
                <div className="mt-2 h-[1px] bg-border/10 overflow-hidden relative">
                   <div className={cn("absolute inset-y-0 left-0 bg-current opacity-20 transition-all duration-1000", stat.color)} style={{ width: '60%' }} />
                </div>
            </AetherPanel>
          ))}
       </div>

       {/* Request Stream */}
        <AetherPanel className="p-0 border-border/10 overflow-hidden min-h-[400px] md:min-h-[600px] flex-1 flex flex-col bg-background/20">
           <div className="p-6 border-b border-border/10 flex justify-between items-center bg-foreground/5">
              <div className="micro-label flex items-center gap-2">
                 <Terminal className={cn("w-3.5 h-3.5", primaryColorClass)} /> Payload_Buffer_Listen
              </div>
              <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase">V4_REALTIME_HOOKS</Badge>
           </div>

           <div className="flex-1 min-h-0 overflow-hidden">
              <VirtualizedDataTable
                data={requests}
                columns={columns}
                emptyMessage="NO_PAYLOADS_INTERCEPTED"
              />
           </div>
        </AetherPanel>

       {/* Detailed Inspection Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
           <DialogContent className={cn("max-w-5xl bg-background/95 border p-0 overflow-hidden outline-none", isAD ? "border-primary/20 shadow-[0_0_50px_rgba(255,176,0,0.1)]" : "border-teal-500/20 shadow-[0_0_50px_rgba(20,184,166,0.1)]")}>
              <DialogHeader className="p-6 border-b border-border/10 bg-foreground/5">
                 <DialogTitle className="text-xs font-black font-mono uppercase tracking-[0.3em] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Terminal className={cn("w-4 h-4", primaryColorClass)} /> Payload_Inspection_Audit
                    </div>
                 </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 h-[600px]">
                 <div className="border-r border-border/10 flex flex-col">
                    <div className="p-4 micro-label text-muted-foreground bg-foreground/5 border-b border-border/10 flex items-center gap-2 italic">
                       <Download className="w-3 h-3 rotate-180" /> Inbound_Request
                    </div>
                    <div className="flex-1 overflow-auto p-4 bg-background/60 font-mono text-[10px] leading-relaxed custom-scrollbar text-blue-400">
                       <pre>{JSON.stringify(selectedRequest?.request_data, null, 2)}</pre>
                    </div>
                 </div>

                 <div className="flex flex-col">
                    <div className="p-4 micro-label text-muted-foreground bg-foreground/5 border-b border-border/10 flex items-center gap-2 italic">
                       <ShieldCheck className="w-3 h-3" /> Kernel_Response
                    </div>
                    <div className={cn("flex-1 overflow-auto p-4 bg-background/60 font-mono text-[10px] leading-relaxed custom-scrollbar", isAD ? "text-primary/70" : "text-teal-500/70")}>
                       <pre>{JSON.stringify(selectedRequest?.response_data || selectedRequest?.analysis, null, 2)}</pre>
                    </div>
                 </div>
              </div>
                           <div className="p-4 border-t border-border/10 bg-background/60 flex justify-end">
                 <Button onClick={() => setShowDetails(false)} className={cn("font-mono font-black text-[9px] uppercase tracking-widest h-10 px-6 text-black transition-all", isAD ? "bg-primary shadow-[0_0_20px_rgba(255,176,0,0.1)] hover:bg-white" : "bg-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.1)] hover:bg-white")}>
                    Close_Buffer
                 </Button>
              </div>
          </DialogContent>
       </Dialog>
    </div>
  );
};
