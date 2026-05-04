import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Database,
  Download,
  HardDrive,
  Loader2,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  WifiOff,
  XCircle,
  ShieldCheck,
  Cpu,
  Terminal,
} from 'lucide-react'
import { tradingService } from '@/services/tradingService'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/lib/utils'

const AUTO_REFRESH_INTERVAL = 10000

interface MetricCardProps {
  title: string
  icon: React.ElementType
  value: string | number
  subtitle?: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  loading?: boolean
}

function MetricCard({ title, icon: Icon, value, subtitle, status, loading }: MetricCardProps) {
  const { mode: appMode } = useAppModeStore();
  const isAD = appMode === 'AD';

  const statusColors = {
    pass: isAD ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
    warn: 'text-amber-500 border-amber-500/20 bg-amber-500/5',
    fail: 'text-rose-500 border-rose-500/20 bg-rose-500/5',
    unknown: 'text-muted-foreground border-border/20 bg-muted/5',
  }

  const iconColors = {
    pass: isAD ? 'text-amber-500/20' : 'text-emerald-500/20',
    warn: 'text-amber-500/20',
    fail: 'text-rose-500/20',
    unknown: 'text-muted-foreground/10',
  }

  return (
    <AetherPanel className={cn('p-4 border', statusColors[status])}>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black font-mono uppercase tracking-widest opacity-60 mb-1">{title}</p>
            <p className="text-xl font-black font-mono tracking-tighter">{value}</p>
            {subtitle && <p className="text-[9px] font-mono opacity-40 uppercase tracking-wider mt-1">{subtitle}</p>}
          </div>
          <Icon className={cn('h-10 w-10 shrink-0', iconColors[status])} />
        </div>
      )}
    </AetherPanel>
  )
}

export default function HealthMonitorPage() {
  const { mode: appMode } = useAppModeStore();
  const { toast } = useToast()
  const isAD = appMode === 'AD';

  const [currentMetrics, setCurrentMetrics] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(async (isManual = false) => {
    try {
      setRefreshing(true)
      const [metrics, healthStats, activeAlerts] = await Promise.all([
        tradingService.getCurrentHealthMetrics(),
        tradingService.getHealthStats(24),
        tradingService.getHealthAlerts()
      ])

      if (metrics.status === 'success') setCurrentMetrics(metrics)
      if (healthStats.status === 'success') setStats(healthStats)
      if (Array.isArray(activeAlerts)) setAlerts(activeAlerts)
      else if (activeAlerts?.status === 'success' && Array.isArray(activeAlerts.alerts)) setAlerts(activeAlerts.alerts)

      if (isManual) {
        toast({ title: 'SYNC_COMPLETE', description: 'System health telemetry synchronized.' })
      }
    } catch (error) {
      console.error("FAULT::INFRA_HEALTH", error);
      toast({ variant: 'destructive', title: 'SYNC_FAULT', description: 'Failed to reach infrastructure telemetry node.' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchData(), AUTO_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await tradingService.acknowledgeHealthAlert(alertId)
      toast({ title: 'ALERT_ACK', description: `Alert ${alertId} acknowledged.` })
      fetchData()
    } catch {
      toast({ variant: 'destructive', title: 'WRITE_FAULT', description: 'Failed to acknowledge alert.' })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-[11px] font-black font-mono tracking-[0.3em] uppercase animate-pulse">Initializing_Diagnostics...</span>
      </div>
    )
  }

  const overallStatus = currentMetrics?.overall_status || 'unknown'
  const statusLabels = { pass: 'OPERATIONAL', warn: 'DEGRADED', fail: 'CRITICAL', unknown: 'UNKNOWN' }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", isAD ? "border-amber-500/20" : "border-teal-500/20")}>
            <Activity className={cn("h-6 w-6", isAD ? "text-amber-500" : "text-teal-500")} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", isAD ? "text-amber-500" : "text-teal-500")}>Health_Radar_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Network className={cn("w-3 h-3 animate-pulse", isAD ? "text-amber-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">KERNEL_UPTIME // SYSTEM_STABILITY_AUDIT</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", autoRefresh ? (isAD ? "bg-amber-500" : "bg-teal-500") : "bg-muted-foreground/30")} />
            Auto_Refresh: {autoRefresh ? "Active" : "Paused"}
          </div>
          <Button
            variant="secondary"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {refreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            RE_SYNC_RADAR
          </Button>
        </div>
      </div>

      {/* Grid Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="File Descriptors"
          icon={HardDrive}
          value={currentMetrics ? `${currentMetrics.fd.count}/${currentMetrics.fd.limit}` : '---'}
          subtitle={currentMetrics ? `${currentMetrics.fd.usage_percent.toFixed(1)}% usage` : undefined}
          status={currentMetrics?.fd.status || 'unknown'}
        />
        <MetricCard
          title="Memory (RSS)"
          icon={Cpu}
          value={currentMetrics ? `${currentMetrics.memory.rss_mb.toFixed(0)}MB` : '---'}
          subtitle={currentMetrics ? `${currentMetrics.memory.percent.toFixed(1)}% of sys` : undefined}
          status={currentMetrics?.memory.status || 'unknown'}
        />
        <MetricCard
          title="DB Connections"
          icon={Database}
          value={currentMetrics?.database.total ?? 0}
          subtitle="Active pool"
          status={currentMetrics?.database.status || 'unknown'}
        />
        <MetricCard
          title="WS Telemetry"
          icon={Network}
          value={currentMetrics?.websocket.total ?? 0}
          subtitle={currentMetrics ? `${currentMetrics.websocket.total_symbols} feeds` : undefined}
          status={currentMetrics?.websocket.status || 'unknown'}
        />
        <MetricCard
          title="Threads"
          icon={Server}
          value={currentMetrics?.threads.count ?? 0}
          subtitle={currentMetrics && currentMetrics.threads.stuck > 0 ? `${currentMetrics.threads.stuck} stuck` : 'None stuck'}
          status={currentMetrics?.threads.status || 'unknown'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alerts Section */}
        <AetherPanel className="lg:col-span-1 p-0 flex flex-col h-[500px]">
          <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
             <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-primary/60 italic">Critical_Alerts</span>
             <Badge variant="outline" className="text-[9px] font-mono border-border/40">{alerts.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {alerts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20">
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                  <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em]">All_Systems_Stable</span>
               </div>
             ) : (
               alerts.map((alert) => (
                 <div key={alert.id} className={cn('p-3 rounded-sm border-l-4 space-y-2',
                   alert.severity === 'fail' ? 'bg-rose-500/5 border-rose-500' : 'bg-amber-500/5 border-amber-500'
                 )}>
                   <div className="flex justify-between items-start">
                     <span className="text-[10px] font-black font-mono uppercase tracking-widest">{alert.alert_type}</span>
                     {!alert.acknowledged && (
                       <Button variant="ghost" size="sm" onClick={() => handleAcknowledgeAlert(alert.id)} className="h-6 px-2 text-[9px] font-black hover:bg-white/5">ACK</Button>
                     )}
                   </div>
                   <p className="text-[11px] font-mono leading-relaxed opacity-80 italic">"{alert.message}"</p>
                   <div className="text-[9px] font-mono opacity-40 uppercase tracking-widest">
                     {new Date(alert.timestamp).toLocaleTimeString()}
                   </div>
                 </div>
               ))
             )}
          </div>
        </AetherPanel>

        {/* Process Tables Section */}
        <AetherPanel className="lg:col-span-2 p-0 flex flex-col h-[500px]">
           <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
             <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-primary/60 italic">Process_Telemetry :: Top_Memory</span>
             <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 text-muted-foreground/30" />
                <span className="text-[9px] font-mono text-muted-foreground/30 italic uppercase italic">REF::HOST_RSS</span>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto">
             <Table className="font-mono text-[11px]">
               <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/60">
                 <TableRow className="border-border/40 hover:bg-transparent">
                   <TableHead className="py-3 px-4 uppercase tracking-widest text-primary/40 font-black">Process_Name</TableHead>
                   <TableHead className="py-3 px-4 text-right uppercase tracking-widest text-primary/40 font-black">PID</TableHead>
                   <TableHead className="py-3 px-4 text-right uppercase tracking-widest text-primary/40 font-black">RSS_MB</TableHead>
                   <TableHead className="py-3 px-4 text-right uppercase tracking-widest text-primary/40 font-black">CPU_%</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                  {currentMetrics?.processes?.map((proc: any, i: number) => (
                    <TableRow key={i} className="border-border/20 hover:bg-white/5 transition-colors group">
                      <TableCell className="py-2 px-4 group-hover:text-primary">{proc.name}</TableCell>
                      <TableCell className="py-2 px-4 text-right opacity-40">{proc.pid}</TableCell>
                      <TableCell className="py-2 px-4 text-right font-black">{proc.rss_mb.toFixed(1)}</TableCell>
                      <TableCell className={cn("py-2 px-4 text-right font-black", isAD ? "text-primary" : "text-emerald-500")}>{proc.memory_percent.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
               </TableBody>
             </Table>
          </div>
        </AetherPanel>
      </div>

      {stats && (
        <AetherPanel className="p-0 border-primary/20 bg-primary/5">
          <div className="bg-primary/10 px-4 py-1.5 border-b border-primary/20 flex justify-between items-center">
             <span className="text-[9px] font-black font-mono uppercase tracking-[0.3em] text-primary italic">Operational_Statistics_24H_Window</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-primary/20">
             <div className="p-4 space-y-1">
               <span className="text-[9px] font-mono uppercase opacity-40">Avg_FD_Usage</span>
               <div className="text-sm font-black font-mono">{stats.fd.avg.toFixed(1)}</div>
             </div>
             <div className="p-4 space-y-1">
               <span className="text-[9px] font-mono uppercase opacity-40">Max_RSS_Peak</span>
               <div className="text-sm font-black font-mono">{stats.memory.max_mb.toFixed(0)}MB</div>
             </div>
             <div className="p-4 space-y-1">
               <span className="text-[9px] font-mono uppercase opacity-40">Alert_Incidents</span>
               <div className={cn('text-sm font-black font-mono', stats.fd.warn_count + stats.memory.warn_count > 0 ? 'text-rose-400' : '')}>
                 {stats.fd.warn_count + stats.memory.warn_count}
               </div>
             </div>
             <div className="p-4 space-y-1">
               <span className="text-[9px] font-mono uppercase opacity-40">Sync_Lock_Ratio</span>
               <div className="text-sm font-black font-mono">100.0%</div>
             </div>
          </div>
        </AetherPanel>
      )}
    </div>
  )
}
