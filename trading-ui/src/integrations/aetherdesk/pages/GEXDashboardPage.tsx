import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, RefreshCw, BarChart3, Database, Activity, Zap, TrendingUp, Shield, BarChart, Target, Clock } from 'lucide-react'
import Plotly from 'plotly.js-dist-min'
import _createPlotlyComponent from 'react-plotly.js/factory'
import type * as PlotlyTypes from 'plotly.js'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import { useThemeStore } from '@/stores/themeStore'
import { tradingService } from '@/services/tradingService'
import { useAppModeStore } from '@/stores/appModeStore'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { VirtualizedDataTable, type ColumnDefinition } from '../components/VirtualizedDataTable'
import { IndustrialValue } from '@/components/trading/IndustrialValue'

// Handle mixed CJS/ESM import patterns for Plotly factory
const createPlotlyComponent = (typeof _createPlotlyComponent === 'function')
  ? _createPlotlyComponent
  : (_createPlotlyComponent as any).default;

const Plot = createPlotlyComponent(Plotly)

const PageLoader = ({ message = "INITIALIZING_ALPHA_SCAN" }: { message?: string }) => (
  <div className="h-[600px] flex flex-col items-center justify-center p-20 text-center space-y-4">
    <div className="relative">
      <Activity className="h-12 w-12 text-rose-500 animate-pulse" />
      <div className="absolute inset-0 h-12 w-12 border-2 border-rose-500/20 rounded-full animate-ping" />
    </div>
    <div className="space-y-1">
      <div className="text-[11px] font-mono font-black text-rose-500 tracking-[0.4em] uppercase animate-pulse">{message}</div>
      <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-[0.2em]">Synchronizing_Gamma_Telemetry...</div>
    </div>
  </div>
)

const AUTO_REFRESH_INTERVAL = 30000

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

function formatNumber(num: number): string {
  const abs = Math.abs(num)
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(num / 100000).toFixed(2)}L`
  if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0)
}

export default function GEXDashboardPage() {
  const { toast } = useToast()
  const { appMode } = useThemeStore()
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()

  const [selectedExchange, setSelectedExchange] = useState<string>('')
  const [selectedUnderlying, setSelectedUnderlying] = useState<string>('')
  const [selectedExpiry, setSelectedExpiry] = useState<string>('')
  const [expiryOptions, setExpiryOptions] = useState<string[]>([])
  const [gexData, setGexData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const autoRefreshRef = useRef<boolean>(true)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (fnoExchanges.length > 0 && !selectedExchange) {
      setSelectedExchange(defaultFnoExchange)
    }
  }, [fnoExchanges, defaultFnoExchange, selectedExchange])

  const underlyings = useMemo(() => {
    if (!selectedExchange) return []
    return defaultUnderlyings[selectedExchange] || []
  }, [selectedExchange, defaultUnderlyings])

  useEffect(() => {
    if (underlyings.length > 0 && !selectedUnderlying) {
      setSelectedUnderlying(underlyings[0])
    }
  }, [underlyings, selectedUnderlying])

  const fetchExpiries = useCallback(async (exchange: string, symbol: string) => {
    if (!exchange || !symbol) return
    try {
      const response = await tradingService.getExpiries(exchange, symbol)
      // Backend returns { status, data: [...] } — unwrap the envelope
      const expiries = response.data || response.expiries || []
      setExpiryOptions(expiries)
      if (expiries.length > 0) {
        setSelectedExpiry(expiries[0])
      }
    } catch (error) {
      console.error('Failed to fetch expiries:', error)
    }
  }, [])

  useEffect(() => {
    if (selectedExchange && selectedUnderlying) {
      fetchExpiries(selectedExchange, selectedUnderlying)
    }
  }, [selectedExchange, selectedUnderlying, fetchExpiries])

  const fetchGEX = useCallback(async (force = false) => {
    if (!selectedExchange || !selectedUnderlying || !selectedExpiry) return

    if (force) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const apiExpiry = convertExpiryForAPI(selectedExpiry)
      const response = await tradingService.getGEXData({
        exchange: selectedExchange,
        underlying: selectedUnderlying,
        expiry_date: apiExpiry
      })

      if (response && response.status === 'success' && response.data) {
        // Normalize snake_case backend response to camelCase for the UI
        const normalizedData = response.data.map((d: any) => ({
          strike: d.strike,
          ceOi: d.ce_oi || 0,
          peOi: d.pe_oi || 0,
          ceGamma: d.ce_gamma || 0,
          peGamma: d.pe_gamma || 0,
          ceGex: d.ce_gex || 0,
          peGex: d.pe_gex || 0,
          netGex: d.net_gex || 0,
        }))

        // Build summary from top-level response keys
        const summary = {
          netGex: response.total_net_gex || 0,
          callGex: response.total_ce_gex || 0,
          putGex: response.total_pe_gex || 0,
          pcrOi: response.pcr_oi || 0,
        }

        // Find max OI strike
        const maxOiStrike = normalizedData.reduce((best: any, d: any) => {
          const totalOi = d.ceOi + d.peOi
          return totalOi > (best.totalOi || 0) ? { strike: d.strike, totalOi } : best
        }, { strike: 0, totalOi: 0 })?.strike || 0

        setGexData({
          ...response,
          data: normalizedData,
          summary,
          max_oi_strike: maxOiStrike || response.max_pain,
        })
        setLastUpdated(new Date())
      } else if (response?.message) {
        console.warn('GEX API returned error:', response.message)
      }
    } catch (error) {
      console.error('Failed to fetch GEX:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedExchange, selectedUnderlying, selectedExpiry])

  useEffect(() => {
    fetchGEX()
  }, [fetchGEX])

  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(() => {
      if (autoRefreshRef.current) fetchGEX(true)
    }, AUTO_REFRESH_INTERVAL)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [fetchGEX])

  const totals = useMemo(() => gexData?.summary || null, [gexData])

  const gexPlot = useMemo(() => {
    if (!gexData || !gexData.data) return { data: [], layout: {} }
    const levels = gexData.data.map((d: any) => d.strike)
    const netGex = gexData.data.map((d: any) => d.netGex)
    const spot = gexData.spot_price

    return {
      data: [
        {
          x: levels,
          y: netGex,
          type: 'bar',
          name: 'Net GEX',
          marker: {
            color: netGex.map((val: number) => val >= 0 ? '#10b981' : '#f43f5e'),
          },
        } as PlotlyTypes.Data
      ],
      layout: {
        template: 'plotly_dark' as any,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        barmode: 'group' as const,
        margin: { t: 30, r: 10, b: 40, l: 50 },
        height: undefined,
        width: undefined,
        autosize: true,
        showlegend: true,
        legend: { x: 0, y: 1.1, orientation: 'h' as const, font: { size: 10 } },
        xaxis: {
          gridcolor: 'rgba(255,255,255,0.05)',
          title: { text: "STRIKE_PRICE", font: { family: 'JetBrains Mono, monospace', size: 10 } },
          zerolinecolor: 'rgba(255,255,255,0.1)',
          tickfont: { size: 9 }
        },
        yaxis: {
          gridcolor: 'rgba(255,255,255,0.05)',
          title: { text: "GEX_INTENSITY", font: { family: 'JetBrains Mono, monospace', size: 10 } },
          zerolinecolor: 'rgba(255,255,255,0.1)',
          tickfont: { size: 9 }
        },
        shapes: spot ? [
          {
            type: 'line' as const,
            x0: spot,
            x1: spot,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: '#fbbf24', width: 2, dash: 'dash' }
          }
        ] as Partial<PlotlyTypes.Shape>[] : []
      } as Partial<PlotlyTypes.Layout>
    }
  }, [gexData])

  if (isLoading && !gexData) return <PageLoader message="MAPPING_GAMMA_LEVELS" />

  return (
    <div className="h-full flex flex-col space-y-4 font-mono overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/40 via-background to-background p-4 md:p-6">
      {/* Header Deck */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/60 p-5 border border-white/5 rounded-xl shadow-2xl backdrop-blur-md relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
        <div className="flex flex-col gap-1.5 relative z-10">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 group-hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all duration-500">
                <Activity className="h-6 w-6 text-rose-500 animate-pulse" />
             </div>
             <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">Gamma_Exposure_Kernel</h2>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase opacity-60 tracking-[0.2em] font-bold">Real-time Options Feedback // Liquidity Analysis Vector</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 border-white/10 font-bold tracking-tight bg-white/5 hover:bg-white/10 flex-1 lg:flex-none">
                <BarChart3 className="mr-2 h-4 w-4 text-rose-400" />
                {selectedUnderlying || "Select Asset"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0 border-white/10 bg-slate-950 shadow-2xl" align="end">
              <Command className="bg-transparent">
                <CommandInput placeholder="Filter assets..." className="h-10 border-none bg-transparent" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No assets found.</CommandEmpty>
                  <CommandGroup heading="Supported Underlyings">
                    {underlyings.map(u => (
                      <CommandItem key={u} onSelect={() => setSelectedUnderlying(u)} className="cursor-pointer hover:bg-white/5">
                        <Check className={cn("mr-2 h-4 w-4 text-rose-500", selectedUnderlying === u ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono text-xs font-bold uppercase">{u}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
            <SelectTrigger className="w-full lg:w-[160px] h-10 border-white/10 font-bold bg-white/5 hover:bg-white/10 flex-1 lg:flex-none">
              <Clock className="w-4 h-4 mr-2 text-blue-400" />
              <SelectValue placeholder="Expiry" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950">
              {expiryOptions.map(exp => (
                <SelectItem key={exp} value={exp} className="text-xs uppercase font-mono font-bold">{exp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/10 border border-white/5 rounded-lg" onClick={() => fetchGEX(true)} disabled={isLoading || isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 transition-all duration-700", isRefreshing && "animate-spin text-rose-500")} />
          </Button>
        </div>
      </div>

      {/* Main Content Deck */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sentiment Side Deck */}
        <div className="lg:col-span-1 space-y-6">
          <AetherPanel className="p-5 border-white/5 bg-slate-900/30 backdrop-blur-xl shadow-2xl relative overflow-hidden group h-full">
             <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000">
                <Target className="w-48 h-48 rotate-12" />
             </div>
             <h4 className="text-[10px] font-black text-rose-500/60 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <Shield className="w-3 h-3" /> Sentiment_Audit
             </h4>

             <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              {[
                { label: "NET_GAMMA", val: totals?.netGex || 0, icon: Activity, col: "text-amber-500", plus: true },
                { label: "CALL_STRENGTH", val: totals?.callGex || 0, icon: TrendingUp, col: "text-emerald-500", plus: false },
                { label: "PUT_DEFENSE", val: totals?.putGex || 0, icon: Shield, col: "text-rose-500", plus: false },
              ].map((item, idx) => (
                <AetherPanel key={idx} className="p-4 bg-white/5 border-white/5 hover:border-white/10 transition-all group/stat relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/[0.02]" />
                  <div className="flex items-center justify-between mb-2 relative z-10">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</span>
                    <item.icon className={cn("w-3.5 h-3.5 opacity-30 group-hover/stat:opacity-100 transition-all", item.col)} />
                  </div>
                  <IndustrialValue value={item.val} className={cn("text-2xl font-black relative z-10 tracking-tighter", item.col)} showPlus={item.plus} />
                  <div className="mt-3 h-[2px] bg-white/5 rounded-full overflow-hidden relative z-10 font-mono">
                    <div className={cn("absolute inset-y-0 left-0 bg-current opacity-20", item.col)} style={{ width: '45%' }} />
                  </div>
                </AetherPanel>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 hidden lg:block">
               <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="rounded-none bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] px-2 py-0">LIVE_TELEMETRY</Badge>
                  <span className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest italic">System_Logic</span>
               </div>
               <p className="text-[9px] leading-relaxed text-muted-foreground/60 italic font-medium">
                  Gamma exposure indicates the sensitivity of options prices to underlying movements. High GEX clusters often act as dynamic support/resistance zones.
               </p>
            </div>
          </AetherPanel>
        </div>

        {/* Visual Engine Deck */}
        <AetherPanel className="lg:col-span-3 flex flex-col p-0 overflow-hidden border-white/5 bg-slate-950/40 backdrop-blur-xl shadow-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[100px] pointer-events-none" />
          <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/40 backdrop-blur-md relative z-10">
             <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[9px] font-black px-2 py-1 flex items-center gap-1.5 uppercase shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   SPOT: {gexData?.spot_price ? formatNumber(gexData.spot_price) : "---"}
                </Badge>
                <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-500 text-[9px] font-black px-2 py-1 flex items-center gap-1.5 uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                   <Target className="w-2.5 h-2.5" />
                   MAX_OI: {gexData?.max_oi_strike || "---"}
                </Badge>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                <span className="text-[8px] font-black font-mono text-muted-foreground/40 uppercase tracking-widest">LAST_SYNC: {lastUpdated ? lastUpdated.toLocaleTimeString() : "PENDING"}</span>
             </div>
          </div>

          <div className="relative flex-1 w-full min-h-[350px] md:min-h-[500px]">
             {gexData ? (
                <div className="absolute inset-0 p-4 md:p-6 transition-all duration-500 ease-in-out">
                  <Plot
                    className="w-full h-full"
                    data={gexPlot.data}
                    layout={gexPlot.layout}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 font-black animate-pulse uppercase tracking-[0.8em]">
                 <Database className="w-16 h-16 mb-6 opacity-5 rotate-12" />
                 NO_TELEMETRY_STREAM
               </div>
             )}
          </div>

          <div className="p-3 border-t border-white/5 bg-foreground/5 flex justify-between items-center px-6">
             <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-sm bg-[#10b981]" />
                   <span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest italic">Positive_GEX</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-sm bg-[#f43f5e]" />
                   <span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest italic">Negative_GEX</span>
                </div>
             </div>
             <Badge variant="outline" className="text-[7px] border-white/5 opacity-20 font-mono tracking-[0.3em] font-black">KERNEL_V.4.2</Badge>
          </div>
        </AetherPanel>
      </div>
    </div>
  )
}
