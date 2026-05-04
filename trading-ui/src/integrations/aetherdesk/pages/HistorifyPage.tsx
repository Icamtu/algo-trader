import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Database, RefreshCw, Activity, Search, Trash2, Calendar,
  DownloadCloud, ListPlus, Target, Globe, ShieldCheck,
  CheckCircle, Play, Pause, XCircle, Clock, Eye, FileText,
  Layers, BarChart3, Settings2, CalendarDays, ChevronDown,
  Info, Zap, Server, HardDrive, Cpu, AlertCircle, Sparkles,
  ArrowUpRight, ListFilter, LayoutGrid, Timer, User
} from 'lucide-react'
import { format, subMonths, subYears, startOfDay, endOfDay } from 'date-fns'
import { useAuth } from "@/contexts/AuthContext"
import { motion, AnimatePresence } from 'framer-motion'
import { tradingService } from '@/services/tradingService'
import { useAppModeStore } from '@/stores/appModeStore'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useWsStore } from '@/stores/wsStore'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { VirtualizedDataTable, type ColumnDefinition } from '../components/VirtualizedDataTable'

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
  last_symbol?: string
  last_provider?: string
  operator?: string
  interval: string
  start_date: string
  end_date: string
}

interface HistorifyStats {
  total_candles: number
  unique_symbols: number
  db_size_mb: number
  uptime_seconds: number
  last_ingested_at: string | null
  average_ingestion_time: number
  storage_path: string
  first_date_unix?: number | null
  last_date_unix?: number | null
}

const MOTION_VARIANTS = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }
}

export default function HistorifyPage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const { user } = useAuth()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { eventSocket } = useWsStore()

  const [activeTab, setActiveTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [stats, setStats] = useState<HistorifyStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing')
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [newSymbol, setNewSymbol] = useState('')
  const [newExchange, setNewExchange] = useState('NSE')
  const [selectedInterval, setSelectedInterval] = useState('D')
  const [isAdding, setIsAdding] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkInput, setBulkInput] = useState('')
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  // Download Settings State — smart defaults based on broker limits
  const getOptimalStartDate = (interval: string): string => {
    if (interval === '1m' || interval === '2m' || interval === '3m') return '2025-10-01'   // ~130 days broker max
    if (interval === '5m' || interval === '10m' || interval === '15m') return '2024-01-01' // ~2 years
    if (interval === '30m' || interval === '1h') return '2022-01-01'                        // ~4 years
    return '2010-01-01'                                                                     // Daily/Weekly: 15y
  }
  const [startDate, setStartDate] = useState<string>('2010-01-01')
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [downloadInterval, setDownloadInterval] = useState('D')
  const [isIncremental, setIsIncremental] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<number>>(new Set())

  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [isRecordsOpen, setIsRecordsOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<CatalogItem | null>(null)
  const [isDeletingCatalog, setIsDeletingCatalog] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setSyncStatus('syncing')
    setError(null)
    try {
      const apiInterval = selectedInterval;

      const [wl, cat, jb, br, sched, st] = await Promise.all([
        tradingService.getHistorifyWatchlist(),
        tradingService.getHistorifyCatalog(apiInterval),
        tradingService.getHistorifyJobs(20),
        tradingService.getHistorifyBreadth(apiInterval),
        tradingService.getHistorifySchedules(),
        tradingService.getHistorifyStats()
      ])

      if (wl?.status === 'success') setWatchlist(wl.data || [])
      if (cat?.status === 'success') setCatalog(cat.data || [])
      if (jb?.status === 'success' || Array.isArray(jb)) {
        setJobs(Array.isArray(jb) ? jb : (jb.data || []))
      }
      if (sched?.status === 'success') setSchedules(sched.data || [])
      if (st?.status === 'success') setStats(st.data || null)

      setSyncStatus('synced')
    } catch (err: any) {
      console.error("[Historify] Data load error:", err)
      setSyncStatus('error')
      setError("Historify service offline or misconfigured.")
    } finally {
      setIsLoading(false)
    }
  }, [selectedInterval])

  useEffect(() => {
    loadData()

    // Auto-refresh stats and jobs every 30s
    const refreshInterval = setInterval(() => {
      loadData()
    }, 30000)

    // Native WebSocket message handler for Historify job events
    if (eventSocket) {
      const handleWsMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'historify_progress') {
            setJobs(prev => prev.map(j => j.id === data.job_id ? {
              ...j,
              completed_symbols: data.completed,
              last_symbol: data.last_symbol,
              last_provider: data.last_provider,
              operator: data.operator,
              status: 'running'
            } : j))
          } else if (data.type === 'historify_status_update') {
            setJobs(prev => prev.map(j => j.id === data.job_id ? { ...j, status: data.status } : j))
          } else if (data.type === 'historify_job_complete') {
            loadData()
            toast({ title: "JOB_COMPLETE", description: "Storage sync successful." })
          }
        } catch (_) {}
      }

      eventSocket.addEventListener('message', handleWsMessage)

      return () => {
        clearInterval(refreshInterval)
        eventSocket.removeEventListener('message', handleWsMessage)
      }
    }

    return () => clearInterval(refreshInterval)
  }, [loadData, eventSocket])

  const handleAddSymbol = async () => {
    if (!newSymbol) return
    setIsAdding(true)
    try {
      const res = await tradingService.updateHistorifyWatchlist('add', newExchange, newSymbol)
      if (res.status === 'success') {
        toast({ title: "NODE_REGISTERED", description: `${newSymbol} added to kernel.` })
        setNewSymbol('')
        loadData()
      } else {
        toast({
          title: "NODE_REJECTED",
          description: res.message || `Unable to add ${newSymbol}.`,
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "FAULT",
        description: err?.response?.data?.message || "Persistence queue error.",
        variant: "destructive"
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleSeed = async () => {
    setIsSeeding(true)
    try {
      const res = await tradingService.seedHistorify()
      if (res.status === 'success') {
        toast({ title: "KERNEL_SEEDED", description: "Default symbol matrix injected." })
        loadData()
      }
    } catch {
      toast({ title: "SEED_FAULT", description: "Failed to seed default matrix.", variant: "destructive" })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkInput) return
    setIsBulkAdding(true)
    try {
      const symbols = bulkInput.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
      if (symbols.length === 0) return

      const res = await tradingService.updateHistorifyWatchlist('add', newExchange, undefined, symbols)
      if (res.status === 'success') {
        toast({ title: "NODES_REGISTERED", description: `${symbols.length} nodes added to kernel.` })
        setBulkInput('')
        setIsBulkOpen(false)
        loadData()
      } else {
        toast({
          title: "PARTIAL_REJECTION",
          description: res.message || "Some nodes failed validation.",
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "FAULT",
        description: "Persistence queue error.",
        variant: "destructive"
      })
    } finally {
      setIsBulkAdding(false)
    }
  }

  const handle15YCoreBackfill = async () => {
    setIsDownloading(true)
    try {
      const symbolsToInject = ['NSE_INDEX:NIFTY', 'NSE_INDEX:BANKNIFTY', 'BSE_INDEX:SENSEX']

      // Inject to watchlist first so UI shows it
      await tradingService.updateHistorifyWatchlist('add', 'NSE', undefined, symbolsToInject)

      // Update local state to reflect what is happening
      setStartDate('2010-01-01')
      setEndDate('2026-12-31')
      setDownloadInterval('Daily')

      // Trigger download for just these core symbols
      const res = await tradingService.runHistorify({
        symbols: symbolsToInject,
        exchange: 'NSE', // fallback, will be overridden by the : notation in algo-trader
        from_date: '2010-01-01',
        to_date: '2026-12-31',
        interval: 'D',
        is_incremental: false
      })
      if (res.status === 'success') {
        toast({ title: "CORE_INJECT", description: "15-Year historical backfill for Core Benchmarks initialized." })
        loadData()
        setActiveTab('jobs')
      } else {
        toast({ title: "CORE_FAULT", description: res.message || "Failed to initialize 15-year backfill.", variant: "destructive" })
      }
    } catch (err: any) {
       toast({ title: "CORE_FAULT", description: err?.response?.data?.message || "Failed to inject 15-year core backfill.", variant: "destructive" })
    } finally {
       setIsDownloading(false)
    }
  }

  const handleDeleteAll = async () => {
    if (watchlist.length === 0) return
    try {
      const symbols = watchlist.map(i => i.symbol)
      const res = await tradingService.updateHistorifyWatchlist('remove', undefined as any, undefined, symbols)
      if (res.status === 'success') {
        toast({ title: "WATCHLIST_PURGED", description: "All symbols removed from kernel." })
        loadData()
      }
    } catch {
      toast({ title: "PURGE_FAULT", description: "Failed to purge watchlist.", variant: "destructive" })
    }
  }

  const handleDeleteSymbol = async (exchange: string, symbol: string) => {
    try {
      const res = await tradingService.updateHistorifyWatchlist('remove', exchange, symbol)
      if (res.status === 'success') {
        toast({ title: "NODE_PURGED", description: `${symbol} removed from watchlist.` })
        loadData()
      }
    } catch {
      toast({ title: "PURGE_FAULT", description: "Failed to remove node.", variant: "destructive" })
    }
  }

  const handleDeleteCatalog = async () => {
    if (!deleteConfirm) return
    setIsDeletingCatalog(true)
    try {
      const interval = deleteConfirm.interval;

      const res = await tradingService.deleteCatalogEntry(
        deleteConfirm.symbol,
        deleteConfirm.exchange,
        interval
      )

      if (res.status === 'success') {
        toast({ title: "DATABASE_PURGED", description: `${deleteConfirm.symbol} data removed from DuckDB.` })
        setDeleteConfirm(null)
        loadData()
      }
    } catch (err: any) {
      toast({ title: "FAULT", description: "Failed to purge sequence.", variant: "destructive" })
    } finally {
      setIsDeletingCatalog(false)
    }
  }

  const handleViewRecords = async (item: CatalogItem) => {
    setSelectedCatalog(item)
    setIsRecordsOpen(true)
    setIsLoadingRecords(true)
    setRecords([])

    try {
      const interval = item.interval;

      const res = await tradingService.getHistorifyRecords(item.symbol, item.exchange, interval, 1000)
      if (res.status === 'success') {
        setRecords(res.data || [])
      }
    } catch (err) {
      toast({ title: "DATA_FAULT", description: "Unable to retrieve storage nodes.", variant: "destructive" })
    } finally {
      setIsLoadingRecords(false)
    }
  }

  const triggerBulkDownload = async (items: WatchlistItem[]) => {
    setIsDownloading(true)
    const apiInterval = downloadInterval
    const symbolsForPayload = items.map(i => `${i.exchange}:${i.symbol}`)

    try {
      const res = await tradingService.runHistorify({
        symbols: symbolsForPayload,
        exchange: 'NSE',
        from_date: startDate,
        to_date: endDate,
        interval: apiInterval,
        is_incremental: isIncremental,
        operator: user?.email || 'System'
      })

      if (res.status === 'success') {
        toast({ title: "STREAM_INITIALIZED", description: `Hydrating ${items.length} data nodes.` })
        loadData()
        setActiveTab('jobs')
      }
    } catch {
      toast({ title: "FAULT", description: "Ingestion sequence interrupted.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  const catalogColumns: ColumnDefinition<CatalogItem>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      width: 140,
      cell: (item) => <span className="font-black text-[11px] tracking-tight">{item.symbol}</span>
    },
    {
      key: 'exchange',
      header: 'Exch',
      width: 80,
      cell: (item) => <span className="opacity-40 text-[9px]">{item.exchange}</span>
    },
    {
      key: 'record_count',
      header: 'C_Count',
      width: 100,
      align: 'right',
      cell: (item) => <span className="tabular-nums text-emerald-500 font-bold">{item.record_count.toLocaleString()}</span>
    },
    {
      key: 'range',
      header: 'Range (Start - End)',
      width: 300,
      cell: (item) => (
        <div className="flex items-center gap-2 text-[9px] opacity-60">
          <span className="font-mono">{item.first_date?.split(' ')[0]}</span>
          <div className="h-px w-4 bg-border/20" />
          <span className="font-mono">{item.last_date?.split(' ')[0]}</span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 120,
      align: 'right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-2 pr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover/row:opacity-100 hover:text-primary transition-all rounded-none"
            onClick={() => handleViewRecords(item)}
          >
            <Eye className="w-3.5 h-3.5 text-primary/60 group-hover/row:text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover/row:opacity-100 hover:text-red-500 transition-all rounded-none"
            onClick={() => setDeleteConfirm(item)}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500/60 group-hover/row:text-red-500" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="flex-1 flex flex-col p-8 space-y-8 bg-background/95 overflow-y-auto font-mono selection:bg-primary selection:text-black">
      {/* Dynamic Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 border bg-card/10 rounded-sm shadow-2xl", accentBorderClass)}>
              <Database className={cn("h-7 w-7", primaryColorClass)} />
            </div>
            <div>
              <h1 className={cn("text-3xl font-black tracking-tighter uppercase leading-none", primaryColorClass)}>
                Historify<span className="opacity-30">.Database</span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5 p-1 px-2 bg-white/[0.03] border border-white/5 rounded-full w-fit">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", syncStatus === 'synced' ? "bg-emerald-500" : "bg-red-500")} />
                <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                  Kernel Status // {syncStatus === 'synced' ? 'Live_Persist' : 'Sync_Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">Storage_Path</span>
            <span className="text-[10px] font-bold opacity-60 max-w-[200px] truncate italic">{stats?.storage_path || '/app/storage/historify.duckdb'}</span>
          </div>
          <Button
            onClick={loadData}
            disabled={isLoading}
            variant="outline"
            className="h-10 px-6 border-white/10 hover:bg-white/5 rounded-none font-black text-[10px]"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} /> RE_SYNC
          </Button>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSeed}
                  disabled={isSeeding}
                  className={cn("h-10 px-6 rounded-none font-black text-[10px] shadow-lg", isAD ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10" : "bg-teal-500 hover:bg-teal-600 shadow-teal-500/10")}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> SEED_KERNEL
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="bg-[#0A0A0A] border border-white/10 text-[9px] font-black uppercase p-3 z-[100] shadow-2xl">
                <div className="flex flex-col gap-1.5 max-w-[240px]">
                  <span className="text-primary tracking-widest border-b border-white/10 pb-1.5">Auto-Population Module</span>
                  <span className="text-white/50 leading-relaxed tracking-wider">Instantly populates the active watchlist with all 50 Nifty Index components. Use this to quickly prepare bulk Historical Ingestion requests.</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* Persistence Stats Engine */}
      <motion.div
        variants={MOTION_VARIANTS.container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        {[
          { label: "Total_Candles", val: stats?.total_candles || 0, icon: Layers, color: "text-emerald-500" },
          { label: "Unique_Symbols", val: stats?.unique_symbols || 0, icon: ListPlus, color: primaryColorClass },
          { label: "Date_Span", val: stats?.first_date_unix ? `${format(new Date(stats.first_date_unix * 1000), 'MMM yyyy')} - ${format(new Date(stats.last_date_unix! * 1000), 'MMM yyyy')}` : 'N/A', icon: CalendarDays, color: "text-blue-500" },
          { label: "Uptime_Sec", val: stats?.uptime_seconds || 0, icon: Timer, color: "text-purple-500" },
          { label: "Last_Ingest", val: stats?.last_ingested_at?.includes(' ') ? stats.last_ingested_at.split(' ')[1] : stats?.last_ingested_at || 'N/A', icon: Clock, color: "text-orange-500" },
        ].map((item, i) => (
          <motion.div variants={MOTION_VARIANTS.item} key={i}>
            <AetherPanel className="p-4 bg-white/[0.02] border transition-all hover:bg-white/[0.05] group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">{item.label}</span>
                <item.icon className={cn("w-3.5 h-3.5 opacity-20 group-hover:opacity-100 transition-opacity", item.color)} />
              </div>
              <div className={cn("text-xl font-black tabular-nums tracking-tighter", item.color)}>
                {typeof item.val === 'number' ? item.val.toLocaleString() : item.val}
              </div>
            </AetherPanel>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Control Deck */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0">

        {/* Navigation & Controls */}
        <div className="xl:col-span-3 space-y-6">
          <AetherPanel className="p-6 bg-card/30 border-white/5 space-y-6 sticky top-0">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Zap className={cn("w-4 h-4", primaryColorClass)} />
              <h3 className="text-xs font-black uppercase tracking-widest">Command Center</h3>
            </div>

            <div className="space-y-1">
              {[
                { id: 'watchlist', label: 'Watchlist', icon: ListFilter, count: watchlist.length },
                { id: 'catalog', label: 'Catalog', icon: LayoutGrid, count: catalog.length },
                { id: 'jobs', label: 'Active Jobs', icon: Activity, count: jobs.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-none transition-all group",
                    activeTab === tab.id ? "bg-white/5 border-l-2 border-primary" : "hover:bg-white/[0.02] opacity-40 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? primaryColorClass : "text-white")} />
                    <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums opacity-40">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-4 border-t border-white/5">
              <div className="space-y-4">
                <label htmlFor="new-symbol-exchange" className="text-[8px] font-black opacity-20 uppercase tracking-widest">Register New Symbol</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Select value={newExchange} onValueChange={setNewExchange}>
                      <SelectTrigger id="new-symbol-exchange" name="exchange" className="h-9 bg-background/50 border-white/10 rounded-none text-[10px] font-black uppercase">
                        <SelectValue placeholder="Exchange" />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10 z-[999] shadow-2xl">
                        {['NSE', 'BSE', 'NFO', 'BFO', 'MCX', 'CDS', 'BCD', 'NSE_INDEX', 'BSE_INDEX', 'CRYPTO'].map(ex => (
                          <SelectItem key={ex} value={ex} className="text-[10px] uppercase font-black">{ex}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsAdding(!isAdding)}
                      className={cn("flex-1 h-9 rounded-none font-black text-[10px] bg-indigo-500/80 hover:bg-indigo-600 text-white")}
                    >
                      {isAdding ? 'Close_Input' : '+ Register'}
                    </Button>
                    <Button
                      onClick={() => setIsBulkOpen(true)}
                      variant="outline"
                      className="h-9 rounded-none font-black text-[10px] border-white/10 hover:bg-white/5"
                    >
                      Bulk
                    </Button>
                  </div>
                </div>

                {isAdding && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label htmlFor="new-symbol-input" className="sr-only">Symbol Name</label>
                    <Input
                      id="new-symbol-input"
                      name="symbol"
                      placeholder="SYMBOL (e.g. BTCUSDT)"
                      className="h-9 bg-background/50 border-white/10 rounded-none text-[10px] font-black placeholder:opacity-20"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                      autoFocus
                    />
                    <Button
                      onClick={handleAddSymbol}
                      disabled={!newSymbol}
                      className={cn("w-full h-8 rounded-none font-black text-[9px] uppercase tracking-[0.2em]", isAD ? "bg-amber-500/20 text-amber-500" : "bg-teal-500/20 text-teal-500")}
                    >
                      Confirm_Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AetherPanel>
        </div>

        {/* Data Views */}
        <div className="xl:col-span-9 flex flex-col min-h-[600px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">

            <TabsContent value="watchlist" className="m-0 h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full"
                >
                  <div className="lg:col-span-8">
                    <AetherPanel className="h-full bg-card/20 border-white/5 flex flex-col">
                      <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ListFilter className="w-3.5 h-3.5 opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Watchlist Queue</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteAll}
                            className="h-7 text-[9px] font-black uppercase tracking-wider text-red-500/60 hover:text-red-500 hover:bg-red-500/5 rounded-none"
                          >
                            Deselect All
                          </Button>
                          <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-mono">{watchlist.length} Nodes</Badge>
                        </div>
                      </div>
                      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {watchlist.map(item => (
                            <motion.div
                              layout
                              key={item.id}
                              className="group p-4 bg-white/[0.01] border border-white/5 hover:border-primary/40 hover:bg-white/[0.03] transition-all flex items-center justify-between"
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded-sm bg-white/5 flex items-center justify-center text-[10px] font-black opacity-40 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                  {item.exchange[0]}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black uppercase">{item.symbol}</span>
                                  <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{item.exchange}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-none"
                                onClick={() => handleDeleteSymbol(item.exchange, item.symbol)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </AetherPanel>
                  </div>

                  <div className="lg:col-span-4">
                    <AetherPanel className="p-6 bg-primary/5 border-primary/20 space-y-8 flex flex-col sticky top-0 shadow-2xl">
                       <div className="space-y-1">
                          <h3 className={cn("text-sm font-black uppercase italic", primaryColorClass)}>Ingestion Matrix</h3>
                          <p className="text-[9px] opacity-40 font-bold leading-relaxed">CONFIGURE PERSISTENCE ENGINE PARAMETERS FOR CROSS-EXCHANGE HISTORICAL HYDRATION.</p>
                          <div className="bg-black/40 border border-white/5 p-3 mt-4 space-y-1.5 rounded-[2px]">
                            <p className="text-[8px] font-mono font-black text-primary/80 uppercase tracking-widest">Data Routing & Fallback Architecture:</p>
                            <p className="text-[7.5px] font-bold text-white/50 leading-relaxed uppercase tracking-wider">
                              • Intraday requests (1m/5m/15m) are routed to AetherDesk via <span className="text-white/90">Shoonya REST API</span> (Limit: ~130 days for 1m).<br/>
                              • Deep Daily requests trigger an internal <span className="text-secondary">yfinance (Yahoo Finance)</span> fallback within AetherDesk, enabling 15+ years of un-capped historical hydration.
                            </p>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="space-y-3">
                             <label htmlFor="download-interval" className="text-[8px] font-black text-white/30 uppercase tracking-widest">Symbol Resolution</label>
                             <Select value={downloadInterval} onValueChange={(v) => { setDownloadInterval(v); setStartDate(getOptimalStartDate(v)); }}>
                                <SelectTrigger id="download-interval" name="downloadInterval" className="h-10 bg-black/40 border-white/10 rounded-none text-[10px] font-black">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-black border-white/10 z-[999] shadow-2xl">
                                   {[
                                     { v: '1m',  label: '1m — Max ~130 days (broker limit)' },
                                     { v: '5m',  label: '5m — Max ~2 years' },
                                     { v: '15m', label: '15m — Max ~2 years' },
                                     { v: '1h',  label: '1h — Max ~4 years' },
                                     { v: 'D',   label: 'Daily — 15+ years (Yahoo fallback)' },
                                   ].map(({v, label}) => (
                                      <SelectItem key={v} value={v} className="text-[10px] font-black">{label}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                             <p className="text-[8px] font-bold uppercase tracking-wide mt-1 px-1" style={{color: (downloadInterval === '1m' || downloadInterval === '2m' || downloadInterval === '3m') ? '#fbbf24' : '#4ade80'}}>
                               {(downloadInterval === '1m' || downloadInterval === '2m' || downloadInterval === '3m')
                                 ? '⚠ Shoonya: ~130 trading days max for 1m data'
                                 : downloadInterval === 'D'
                                 ? '✓ Daily: Yahoo fallback → 15+ year downloads'
                                 : '↑ Start date auto-set for optimal broker coverage'}
                             </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">Start_Date</label>
                                 <div className="relative group cursor-pointer">
                                   <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                   <Input
                                     id="ingest-start-date"
                                     name="startDate"
                                     type="date"
                                     value={startDate}
                                     onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                                     onChange={e => setStartDate(e.target.value)}
                                     className="h-10 pl-10 bg-black/40 border-white/10 rounded-none text-[10px] font-black cursor-pointer hover:bg-white/[0.03] transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                                   />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">End_Date</label>
                                 <div className="relative group cursor-pointer">
                                   <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                   <Input
                                     id="ingest-end-date"
                                     name="endDate"
                                     type="date"
                                     value={endDate}
                                     onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                                     onChange={e => setEndDate(e.target.value)}
                                     className="h-10 pl-10 bg-black/40 border-white/10 rounded-none text-[10px] font-black cursor-pointer hover:bg-white/[0.03] transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                                   />
                                 </div>
                              </div>
                           </div>

                          <div className="p-4 bg-black/40 border border-white/5 flex items-center justify-between">
                             <div className="flex flex-col gap-0.5">
                                <label htmlFor="incremental-mode-switch" className="text-[9px] font-black uppercase cursor-pointer">Incremental Mode</label>
                                <span className="text-[7px] text-white/20 font-bold uppercase">Resume from last checkpoint</span>
                             </div>
                             <Switch id="incremental-mode-switch" name="isIncremental" checked={isIncremental} onCheckedChange={setIsIncremental} />
                          </div>

                          <div className="flex gap-3">
                             <Button
                               className={cn("w-1/2 h-14 rounded-none font-black text-[9px] uppercase tracking-widest transition-all border border-amber-500/50", isAD ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black" : "bg-teal-500/10 text-teal-500 hover:bg-teal-500 hover:text-black")}
                               disabled={isDownloading}
                               onClick={handle15YCoreBackfill}
                             >
                                15Y Backfill
                             </Button>
                             <Button
                               className={cn("w-1/2 h-14 rounded-none font-black text-[9px] uppercase tracking-widest transition-all", isAD ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-teal-500 text-black hover:bg-teal-400")}
                               disabled={isDownloading || watchlist.length === 0}
                               onClick={() => triggerBulkDownload(watchlist)}
                             >
                                {isDownloading ? <RefreshCw className="animate-spin w-4 h-4 mr-3" /> : <DownloadCloud className="w-4 h-4 mr-3" />}
                                Start Ingestion
                             </Button>
                          </div>
                       </div>
                    </AetherPanel>
                  </div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="catalog" className="m-0">
               <AetherPanel className="bg-white/[0.02] border-white/5 flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <LayoutGrid className="w-4 h-4 opacity-30" />
                        <span className="text-[10px] font-black uppercase tracking-widest">DuckDB Database Catalog</span>
                        <div className="h-4 w-px bg-white/10" />
                         <div className="relative w-64">
                            <label htmlFor="catalog-search" className="sr-only">Search records</label>
                            <Input
                              id="catalog-search"
                              name="searchQuery"
                              placeholder="Search records..."
                              className="h-8 pl-8 font-mono text-[9px] uppercase border-white/10 bg-black/40 rounded-none"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground opacity-30" />
                         </div>
                         <div className="h-4 w-px bg-white/10" />
                         <div className="flex items-center gap-2">
                           <label htmlFor="catalog-interval-select" className="text-[8px] font-black opacity-30 uppercase">TF</label>
                           <Select value={selectedInterval} onValueChange={setSelectedInterval}>
                             <SelectTrigger id="catalog-interval-select" name="selectedInterval" className="h-8 w-24 bg-black/40 border-white/10 rounded-none text-[9px] font-black uppercase">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-black border-white/10 rounded-none">
                               {['1m', '5m', '15m', '1h', 'D'].map(tf => (
                                 <SelectItem key={tf} value={tf} className="text-[9px] font-black uppercase focus:bg-primary focus:text-black transition-colors">
                                   {tf === 'D' ? 'Daily' : tf}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                      </div>
                     <span className="text-[9px] font-mono opacity-30">{catalog.length} entries</span>
                  </div>
                  {/* Plain scrollable table — no virtualization needed for catalog size */}
                  <div className="overflow-auto min-h-[400px] max-h-[600px] custom-scrollbar">
                    {catalog.filter(i => i.symbol.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 opacity-20 italic uppercase tracking-[0.4em] font-mono text-[10px]">
                        {isLoading ? 'Syncing_Storage_Nodes...' : 'Zero_Records_Found_In_Storage'}
                      </div>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                          <tr className="border-b border-white/10">
                            {['Symbol', 'Exchange', 'Interval', 'Candle Count', 'First Date', 'Last Date', 'Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/30">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {catalog.filter(i => i.symbol.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
                            <tr key={`${item.symbol}-${item.exchange}-${item.interval}-${idx}`} className="group/row border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                              <td className="px-4 py-3"><span className="font-black text-[11px] tracking-tight">{item.symbol}</span></td>
                              <td className="px-4 py-3"><span className="opacity-40 text-[9px]">{item.exchange}</span></td>
                              <td className="px-4 py-3"><span className="font-mono text-[9px] text-primary/70">{item.interval}</span></td>
                              <td className="px-4 py-3 text-right"><span className="tabular-nums text-emerald-500 font-bold text-[11px]">{item.record_count.toLocaleString()}</span></td>
                              <td className="px-4 py-3"><span className="text-[9px] opacity-60 font-mono">{item.first_date?.split(' ')[0]}</span></td>
                              <td className="px-4 py-3"><span className="text-[9px] opacity-60 font-mono">{item.last_date?.split(' ')[0]}</span></td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover/row:opacity-100 hover:text-primary transition-all rounded-none"
                                    onClick={() => handleViewRecords(item)}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-primary/60 group-hover/row:text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover/row:opacity-100 hover:text-red-500 transition-all rounded-none"
                                    onClick={() => setDeleteConfirm(item)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500/60 group-hover/row:text-red-500" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
               </AetherPanel>
            </TabsContent>

            <TabsContent value="jobs" className="m-0 h-full overflow-y-auto p-2 space-y-4 custom-scrollbar">
               <AnimatePresence>
                  {jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-20 space-y-4">
                       <Activity className="w-12 h-12" />
                       <span className="text-xs font-black uppercase tracking-widest italic">Idle // Awaiting Ingestion Jobs</span>
                    </div>
                  ) : (
                    jobs.map(job => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        key={job.id}
                        className="group overflow-hidden bg-card/10 border border-white/10 p-6 flex flex-col space-y-4 relative"
                      >
                         <div className="absolute top-0 right-0 p-1 px-3 bg-white/[0.03] text-[8px] font-black opacity-20 uppercase">Job_ID: {job.id}</div>
                         <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                               <div className={cn("p-2 border", job.status === 'running' ? "border-primary/20 bg-primary/5 text-primary animate-pulse" : "border-white/10 bg-white/5 opacity-40")}>
                                  {job.status === 'running' ? <Activity className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                               </div>
                               <div className="flex flex-col justify-center">
                                  <span className="text-[12px] font-black uppercase">{job.interval} Hydration // {job.start_date?.split(' ')[0] || 'N/A'} to {job.end_date?.split(' ')[0] || 'N/A'}</span>
                                  <div className="flex items-center gap-3 mt-0.5">
                                     <span className="text-[9px] font-bold opacity-30 uppercase tracking-tighter">Status: {job.status.toUpperCase()}</span>
                                     {job.operator && (
                                        <>
                                           <span className="text-[9px] opacity-10">/</span>
                                           <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter flex items-center">
                                              <User className="w-2.5 h-2.5 mr-1 opacity-50" /> {job.operator}
                                           </span>
                                        </>
                                     )}
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-8">
                               {job.status === 'running' && job.last_symbol && (
                                  <div className="flex flex-col items-end mr-4 animate-in fade-in slide-in-from-right-2 duration-500">
                                     <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-black opacity-20 uppercase tracking-widest italic">Hydrating</span>
                                        <span className={cn("text-[10px] font-black px-1.5 py-0.5 bg-white/5 border border-white/10", primaryColorClass)}>{job.last_symbol}</span>
                                     </div>
                                     <span className="text-[7px] font-bold opacity-30 uppercase mt-1 tracking-[0.2em]">Source: {job.last_provider || 'Determining...'}</span>
                                  </div>
                               )}
                               <div className="flex flex-col items-end">
                                  <span className="text-lg font-black tabular-nums">{Math.round((job.completed_symbols / (job.total_symbols || 1)) * 100)}%</span>
                                  <span className="text-[8px] font-black opacity-20 uppercase italic">Ingestion Progress</span>
                               </div>
                               <Badge variant="outline" className={cn("rounded-none border-white/20 h-7 px-4", job.status === 'running' ? primaryColorClass : "opacity-40")}>
                                  {job.completed_symbols} / {job.total_symbols} Nodes
                               </Badge>
                            </div>
                         </div>

                         <div className="h-1.5 w-full bg-white/5 rounded-none overflow-hidden flex relative">
                            {job.status === 'running' && (
                               <motion.div
                                  initial={{ left: "-100%" }}
                                  animate={{ left: "100%" }}
                                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                  className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent z-10"
                               />
                            )}
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(job.completed_symbols / (job.total_symbols || 1)) * 100}%` }}
                              className={cn("h-full transition-all duration-1000 relative z-0", isAD ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]")}
                            />
                         </div>
                      </motion.div>
                    ))
                  )}
               </AnimatePresence>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Records Preview Modal */}
      <Dialog open={isRecordsOpen} onOpenChange={setIsRecordsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-background/95 border-primary/20 p-0 overflow-hidden font-mono selection:bg-primary selection:text-black">
          <DialogHeader className="p-6 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-sm">
                <BarChart3 className={cn("w-6 h-6", primaryColorClass)} />
              </div>
              <div>
                <DialogTitle className={cn("text-xl font-black uppercase tracking-tighter", primaryColorClass)}>
                  Storage_Inspect // {selectedCatalog?.symbol}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">
                  Interval: {selectedCatalog?.interval} | Total Records: {selectedCatalog?.record_count.toLocaleString()} | Showing Last 1000
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-black/20">
            {isLoadingRecords ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4 opacity-40">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Hydrating_Records...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center opacity-20 italic">
                <Info className="w-8 h-8 mb-4" />
                <span className="text-xs uppercase font-black">Zero_Records_Found_In_Node</span>
              </div>
            ) : (
              <div className="border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      {['Timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'].map(h => (
                        <th key={h} className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors text-[10px] tabular-nums font-bold">
                        <td className="p-3 opacity-60 text-primary">{r.timestamp}</td>
                        <td className="p-3">{r.open?.toFixed(2)}</td>
                        <td className="p-3 text-emerald-500">{r.high?.toFixed(2)}</td>
                        <td className="p-3 text-red-400">{r.low?.toFixed(2)}</td>
                        <td className="p-3 font-black text-white">{r.close?.toFixed(2)}</td>
                        <td className="p-3 opacity-40">{r.volume?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-white/5 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRecordsOpen(false)}
              className="rounded-none font-black text-[10px] uppercase border-white/10 hover:bg-white/5"
            >
              Close_Inspect
            </Button>
            <Button
              className={cn("rounded-none font-black text-[10px] uppercase", isAD ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-teal-500 text-black hover:bg-teal-400")}
              onClick={() => {
                // Potential future: export functionality
                toast({ title: "EXPORT_READY", description: "CSV format prepared for transmission." })
              }}
            >
              <DownloadCloud className="w-3.5 h-3.5 mr-2" /> Export_CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md bg-background border-red-500/20 p-0 overflow-hidden font-mono">
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-500/10 rounded-full">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase text-red-500 tracking-tighter">Confirm Persistence Purge</h3>
                <p className="text-xs font-bold opacity-60 uppercase leading-relaxed">
                  You are about to permanently delete <span className="text-white font-black">{deleteConfirm?.record_count.toLocaleString()}</span> records
                  for <span className="text-white font-black">{deleteConfirm?.symbol}</span> ({deleteConfirm?.interval}). This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="h-12 rounded-none font-black text-[10px] uppercase tracking-widest border-white/10 hover:bg-white/5"
              >
                Abort_Action
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCatalog}
                disabled={isDeletingCatalog}
                className="h-12 rounded-none font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/10"
              >
                {isDeletingCatalog ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Execute_Purge
              </Button>
            </div>
          </div>
          <div className="h-1 bg-red-500 animate-pulse" />
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden font-mono">
          <div className="p-8 space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-tighter">Bulk Register Nodes</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase">Enter symbols separated by commas or new lines.</p>
            </div>

            <label htmlFor="bulk-symbols-textarea" className="sr-only">Bulk Symbol Registration</label>
            <textarea
              id="bulk-symbols-textarea"
              name="bulkInput"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="PASTE_COMMA_OR_NEWLINE_SEPARATED_SYMBOLS_HERE..."
              className="w-full h-32 bg-black/40 border border-white/5 p-4 text-[10px] font-black text-primary uppercase placeholder:text-white/10 focus:outline-none focus:border-primary/40 transition-colors custom-scrollbar resize-none"
            />

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => setIsBulkOpen(false)}
                className="h-12 rounded-none font-black text-[10px] uppercase tracking-widest border-white/10 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAdd}
                disabled={isBulkAdding || !bulkInput}
                className={cn("h-12 rounded-none font-black text-[10px] uppercase tracking-widest shadow-lg", isAD ? "bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/10" : "bg-teal-500 text-black hover:bg-teal-400 shadow-teal-500/10")}
              >
                {isBulkAdding ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ListPlus className="w-4 h-4 mr-2" />}
                Execute_Bulk_Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary), 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary), 0.5);
        }
        /* Style fixes for standard table in black/95 backdrop */
        tbody tr:nth-child(even) {
          background-color: rgba(255,255,255,0.01);
        }
      `}</style>
    </div>
  )
}
