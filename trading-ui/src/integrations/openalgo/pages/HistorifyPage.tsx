import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { 
  Database, RefreshCw, Activity, Search, Trash2, Calendar, 
  DownloadCloud, ListPlus, Target, Globe, ShieldCheck, 
  CheckCircle, Play, Pause, XCircle, Clock
} from 'lucide-react'
import { tradingService } from '@/services/tradingService'
import { useAppModeStore } from '@/stores/appModeStore'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useWsStore } from '@/stores/wsStore'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface WatchlistItem {
  id: number
  symbol: string
  exchange: string
  added_at: string
}

interface CatalogItem {
  symbol: string
  exchange: string
  interval: string
  record_count: number
  first_date?: string
  last_date?: string
}

interface DownloadJob {
  id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  total_symbols: number
  completed_symbols: number
  interval: string
  start_date: string
  end_date: string
}

export default function HistorifyPage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { eventSocket } = useWsStore()
  
  const [activeTab, setActiveTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [newSymbol, setNewSymbol] = useState('')
  const [newExchange, setNewExchange] = useState('NSE')
  const [isAdding, setIsAdding] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [wl, cat, jb] = await Promise.all([
        tradingService.getHistorifyWatchlist(),
        tradingService.getHistorifyCatalog(),
        tradingService.getHistorifyJobs(20)
      ])
      
      if (wl.status === 'success') setWatchlist(wl.data || [])
      if (cat.status === 'success') setCatalog(cat.data || [])
      if (jb.status === 'success') setJobs(jb.data || [])
    } catch {
      toast({ title: "SYNC_ERROR", description: "Failed to sync historical data state.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
    
    if (eventSocket) {
      eventSocket.on('historify_progress', (data: any) => {
        setJobs(prev => prev.map(j => j.id === data.job_id ? { ...j, completed_symbols: data.current, status: 'running' } : j))
      })
      
      eventSocket.on('historify_job_complete', () => {
        loadData()
        toast({ title: "JOB_COMPLETE", description: "Historical data ingestion sequence finished." })
      })

      return () => {
        eventSocket.off('historify_progress')
        eventSocket.off('historify_job_complete')
      }
    }
  }, [loadData, toast, eventSocket])

  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => 
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.exchange.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [catalog, searchQuery])

  const handleAddSymbol = async () => {
    if (!newSymbol) return
    setIsAdding(true)
    try {
      const res = await tradingService.updateHistorifyWatchlist('add', newExchange, newSymbol)
      if (res.status === 'success') {
        toast({ title: "QUEUE_COMMIT", description: `Added ${newSymbol} to persistence queue.` })
        setNewSymbol('')
        loadData()
      }
    } catch {
      toast({ title: "COMMIT_FAULT", description: "Failed to update ingestion queue.", variant: "destructive" })
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteSymbol = async (exchange: string, symbol: string) => {
    try {
      const res = await tradingService.updateHistorifyWatchlist('remove', exchange, symbol)
      if (res.status === 'success') {
        toast({ title: "NODE_PURGED", description: `Removed ${symbol} from watchlist.` })
        loadData()
      }
    } catch {
      toast({ title: "PURGE_FAULT", description: "Failed to remove node.", variant: "destructive" })
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Database className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Historify_Data_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">DATA_PERSISTENCE // STATUS::SYNCED</span>
            </div>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={loadData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} RE_SYNC_ALL
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "CATALOG_SYMBOLS", val: catalog.length, icon: Database, col: primaryColorClass },
          { label: "WATCHLIST_NODES", val: watchlist.length, icon: ListPlus, col: primaryColorClass },
          { label: "ACTIVE_JOBS", val: jobs.filter(j => j.status === 'running').length, icon: Activity, col: "text-emerald-500" },
        ].map((item, i) => (
          <AetherPanel key={i} className="py-3 px-4 bg-background/20 border-border/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
              <item.icon className={cn("w-3 h-3 opacity-40", item.col)} />
            </div>
            <div className={cn("text-lg font-black tabular-nums", item.col)}>{item.val}</div>
          </AetherPanel>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <TabsList className="bg-background/20 border border-border/10 h-10 p-1 rounded-none">
              <TabsTrigger value="watchlist" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Watchlist</TabsTrigger>
              <TabsTrigger value="catalog" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Catalog</TabsTrigger>
              <TabsTrigger value="jobs" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Active_Jobs</TabsTrigger>
            </TabsList>

            {activeTab === 'catalog' && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input 
                  placeholder="FILTER_CATALOG..." 
                  className="h-8 pl-8 font-mono text-[10px] uppercase border-border/20 bg-background/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          <TabsContent value="watchlist" className="flex-1 mt-4 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              <AetherPanel className="bg-background/20 border-border/10 flex flex-col">
                <div className="p-4 border-b border-border/10 flex items-center justify-between">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", primaryColorClass)}>WATCHLIST_INDEX</span>
                  <Badge variant="outline" className="font-mono text-[9px] border-border/10 opacity-40">{watchlist.length}_ENTRIES</Badge>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {watchlist.map(item => (
                      <div key={item.id} className="p-3 bg-background/30 border border-border/10 flex items-center justify-between group hover:border-primary/50 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-tighter">{item.symbol}</span>
                          <span className="text-[8px] font-bold opacity-30 uppercase">{item.exchange}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteSymbol(item.exchange, item.symbol)}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10"
                        >
                           <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {watchlist.length === 0 && (
                      <div className="col-span-full py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.2em]">Awaiting_Nodes_To_Watch</div>
                    )}
                  </div>
                </div>
              </AetherPanel>

              <AetherPanel className="bg-background/10 border-border/10 p-6 flex flex-col justify-center space-y-6 lg:p-10">
                 <div>
                    <h3 className={cn("text-xs font-black uppercase mb-2 tracking-widest", primaryColorClass)}>Node_Insertion_Matrix</h3>
                    <p className="text-[10px] text-muted-foreground uppercase leading-relaxed font-bold opacity-60">Add new symbols to the persistence queue for historical backfill.</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-muted-foreground/40 uppercase">EXCHANGE</label>
                          <select 
                            value={newExchange}
                            onChange={(e) => setNewExchange(e.target.value)}
                            className="w-full h-10 bg-background/50 border border-border/20 rounded-none px-3 text-[10px] font-black focus:border-primary outline-none transition-all uppercase"
                          >
                             <option value="NSE">NSE</option>
                             <option value="NFO">NFO</option>
                             <option value="MCX">MCX</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-muted-foreground/40 uppercase">SYMBOL_PX</label>
                          <Input 
                            value={newSymbol}
                            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                            placeholder="RELIANCE" 
                            className="h-10 border-border/20 bg-background/50 rounded-none font-black text-[10px] uppercase placeholder:opacity-20" 
                          />
                       </div>
                    </div>
                    <Button 
                      onClick={handleAddSymbol}
                      disabled={isAdding || !newSymbol}
                      className={cn(
                        "w-full h-12 rounded-none font-black uppercase text-[10px] tracking-widest text-black transition-all",
                        isAD ? "bg-amber-500 hover:bg-amber-600" : "bg-teal-500 hover:bg-teal-400"
                      )}
                    >
                       {isAdding ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <ListPlus className="w-3 h-3 mr-2" />}
                       Commit_To_Queue
                    </Button>
                 </div>

                 <div className="pt-6 border-t border-border/10 flex gap-4 opacity-50">
                    <div className="flex items-center gap-2">
                       <Clock className="w-3 h-3 text-amber-500" />
                       <span className="text-[8px] font-black uppercase tracking-widest">AUTO_CLEANUP::DISABLED</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3 text-emerald-500" />
                       <span className="text-[8px] font-black uppercase tracking-widest">VALIDITY::CHECKS_OK</span>
                    </div>
                 </div>
              </AetherPanel>
            </div>
          </TabsContent>

          <TabsContent value="catalog" className="flex-1 mt-4 overflow-hidden">
            <AetherPanel className="h-full bg-black/20 border-white/5 flex flex-col">
               <div className="overflow-x-auto overflow-y-auto scrollbar-hide table-container">
                  <table className="w-full border-collapse">
                     <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-white/10 text-left text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">
                        <tr>
                           <th className="p-4">Exchange</th>
                           <th className="p-4">Symbol</th>
                           <th className="p-4">Interval</th>
                           <th className="p-4">Records</th>
                           <th className="p-4">Start_Date</th>
                           <th className="p-4">End_Date</th>
                           <th className="p-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="text-[9px] font-bold font-mono">
                        {filteredCatalog.map((item, i) => (
                           <tr key={i} className="border-b border-border/10 hover:bg-background/40 transition-colors">
                              <td className="p-4 opacity-40 uppercase">{item.exchange}</td>
                              <td className="p-4 font-black uppercase tracking-tight">{item.symbol}</td>
                              <td className="p-4"><Badge variant="outline" className="text-secondary border-secondary/20 rounded-none text-[8px] uppercase">{item.interval}</Badge></td>
                              <td className="p-4 tabular-nums text-emerald-500 font-black">{item.record_count.toLocaleString()}</td>
                              <td className="p-4 opacity-50">{item.first_date || 'N/A'}</td>
                              <td className="p-4 opacity-50">{item.last_date || 'N/A'}</td>
                              <td className="p-4 text-right">
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   onClick={() => handleDeleteSymbol(item.exchange, item.symbol)}
                                   className="h-6 w-6 hover:bg-red-500/10 hover:text-red-500"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                 </Button>
                              </td>
                           </tr>
                        ))}
                        {filteredCatalog.length === 0 && (
                          <tr><td colSpan={7} className="py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.2em]">Zero_Nodes_Catalogued</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </AetherPanel>
          </TabsContent>

          <TabsContent value="jobs" className="flex-1 mt-4 overflow-hidden">
             <AetherPanel className="h-full bg-black/20 border-white/5 p-4 overflow-y-auto scrollbar-hide">
                <div className="space-y-3">
                   {jobs.map(job => (
                      <div key={job.id} className="p-4 bg-white/[0.02] border border-white/5 flex flex-col space-y-3 relative overflow-hidden group">
                         {/* Progress bar background */}
                         <div 
                           className="absolute bottom-0 left-0 h-0.5 bg-primary/20 transition-all duration-1000" 
                           style={{ width: `${(job.completed_symbols / job.total_symbols) * 100}%` }}
                         />
                         
                         <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                               <div className={cn("p-1.5", 
                                 job.status === 'running' ? (isAD ? "bg-primary/10 text-primary animate-pulse" : "bg-teal-500/10 text-teal-500 animate-pulse") :
                                 job.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                                 "bg-background/20 text-muted-foreground"
                               )}>
                                  {job.status === 'running' ? <Activity className="w-3.5 h-3.5" /> : 
                                   job.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5" /> :
                                   <XCircle className="w-3.5 h-3.5" />}
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase tracking-widest">{job.id}</span>
                                  <span className="text-[8px] font-bold opacity-30 uppercase">{job.interval}_DATA // {job.start_date} {"->"} {job.end_date}</span>
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                               <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black tabular-nums">{job.completed_symbols} / {job.total_symbols}</span>
                                  <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter">NODES_COMPLETED</span>
                               </div>
                               <div className="flex gap-1.5">
                                  {['running', 'paused', 'pending'].includes(job.status) && (
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-background/50 hover:bg-red-500/20 hover:text-red-500">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                               </div>
                            </div>
                         </div>
                      </div>
                   ))}
                   {jobs.length === 0 && (
                      <div className="py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.2em]">Zero_Active_Ingestion_Jobs</div>
                   )}
                </div>
             </AetherPanel>
          </TabsContent>
        </Tabs>
      </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> STORAGE::OPTIMIZED
             </div>
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> CLUSTER_NODES::ONLINE
             </div>
          </div>
          <div className="text-[8px] font-black tracking-widest uppercase italic font-mono">
             AETHERDESK_HISTORIFY_ENGINE_v8.4
          </div>
      </div>
    </div>
  )
}
