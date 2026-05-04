import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart2, RefreshCw, Activity, Target, ShieldCheck, Globe, Info, Layers } from 'lucide-react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const METRICS = ['iv', 'delta', 'theta', 'vega', 'gamma'] as const
type MetricKey = (typeof METRICS)[number]

const METRIC_CONFIG: Record<MetricKey, { label: string; ceTitle: string; peTitle: string; formatter: (v: number) => string }> = {
  iv: { label: 'IV', ceTitle: 'CE_IV', peTitle: 'PE_IV', formatter: (v) => `${v.toFixed(2)}%` },
  delta: { label: 'Delta', ceTitle: 'CE_Delta', peTitle: 'PE_Delta', formatter: (v) => v.toFixed(4) },
  theta: { label: 'Theta', ceTitle: 'CE_Theta', peTitle: 'PE_Theta', formatter: (v) => v.toFixed(4) },
  vega: { label: 'Vega', ceTitle: 'CE_Vega', peTitle: 'PE_Vega', formatter: (v) => v.toFixed(4) },
  gamma: { label: 'Gamma', ceTitle: 'CE_Gamma', peTitle: 'PE_Gamma', formatter: (v) => v.toFixed(6) },
}

const CHART_HEIGHT = 400

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

interface ChartInstance {
  chart: IChartApi
  series: ISeriesApi<'Line'>
}

export default function IVChartPage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()
  const isDark = true

  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<MetricKey>('iv')
  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [intervals, setIntervals] = useState<string[]>(['1m', '3m', '5m', '10m', '15m', '30m', '1h'])
  const [selectedInterval, setSelectedInterval] = useState('5m')
  const [selectedDays, setSelectedDays] = useState('1')
  const [chartData, setChartData] = useState<any>(null)

  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const chartsRef = useRef<Map<string, ChartInstance>>(new Map())
  const chartDataRef = useRef<any>(null)

  useEffect(() => {
    setSelectedExchange((prev) =>
      prev && fnoExchanges.some((ex) => ex.value === prev) ? prev : defaultFnoExchange
    )
  }, [defaultFnoExchange, fnoExchanges])

  useEffect(() => {
    const defaults = defaultUnderlyings[selectedExchange] || []
    setUnderlyings(defaults)
    setSelectedUnderlying(defaults[0] || '')
    setExpiries([])
    setSelectedExpiry('')
    setChartData(null)
    chartDataRef.current = null

    let cancelled = false
    const fetchUnderlyings = async () => {
      try {
        const response = await tradingService.getUnderlyings(selectedExchange)
        if (cancelled) return
        if (response.status === 'success' && response.underlyings.length > 0) {
          setUnderlyings(response.underlyings)
          if (!response.underlyings.includes(defaults[0])) {
            setSelectedUnderlying(response.underlyings[0])
          }
        }
      } catch {}
    }
    fetchUnderlyings()
    return () => { cancelled = true }
  }, [selectedExchange, defaultUnderlyings])

  useEffect(() => {
    if (!selectedUnderlying) return
    let cancelled = false
    const fetchExpiries = async () => {
      try {
        const response = await tradingService.getExpiries(selectedExchange, selectedUnderlying)
        if (cancelled) return
        if (response.status === 'success' && response.expiries.length > 0) {
          setExpiries(response.expiries)
          setSelectedExpiry(response.expiries[0])
        }
      } catch {}
    }
    fetchExpiries()
    return () => { cancelled = true }
  }, [selectedUnderlying, selectedExchange])

  const makeChartOptions = useCallback((width: number) => ({
    width,
    height: CHART_HEIGHT,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#888',
      fontFamily: 'JetBrains Mono, monospace',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.03)' },
      horzLines: { color: 'rgba(255,255,255,0.03)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      scaleMargins: { top: 0.2, bottom: 0.2 },
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: isAD ? 'rgba(245,158,11,0.2)' : 'rgba(20,184,166,0.2)', width: 1 as any, style: 2, labelVisible: false },
      horzLine: { color: isAD ? 'rgba(245,158,11,0.2)' : 'rgba(20,184,166,0.2)', width: 1 as any, style: 2, labelBackgroundColor: '#111' },
    },
  }), [isAD])

  const updateAllCharts = useCallback((data: any) => {
    for (const metric of METRICS) {
      for (const optType of ['CE', 'PE'] as const) {
        const key = `${metric}-${optType.toLowerCase()}`
        const inst = chartsRef.current.get(key)
        if (!inst) continue

        const seriesData = data.series.find((s: any) => s.option_type === optType)
        if (!seriesData) continue

        const points = seriesData.iv_data
          .filter((p: any) => p[metric] !== null)
          .map((p: any) => ({
            time: p.time as any,
            value: p[metric] as number,
          }))
          .sort((a: any, b: any) => a.time - b.time)

        inst.series.setData(points)
        inst.chart.timeScale().fitContent()
      }
    }
  }, [])

  useEffect(() => {
    for (const [, inst] of chartsRef.current) inst.chart.remove()
    chartsRef.current.clear()

    for (const metric of METRICS) {
      for (const type of ['ce', 'pe'] as const) {
        const key = `${metric}-${type}`
        const container = containerRefs.current.get(key)
        if (!container) continue

        const w = container.offsetWidth || 500
        const color = type === 'ce' ? (isAD ? '#f59e0b' : '#14b8a6') : '#10b981'
        const cfg = METRIC_CONFIG[metric]
        const title = type === 'ce' ? cfg.ceTitle : cfg.peTitle

        const chart = createChart(container, makeChartOptions(w))
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: cfg.formatter },
          title: title.toUpperCase()
        })

        chartsRef.current.set(key, { chart, series })
      }
    }

    if (chartDataRef.current) updateAllCharts(chartDataRef.current)

    return () => {
      for (const [, inst] of chartsRef.current) inst.chart.remove()
      chartsRef.current.clear()
    }
  }, [makeChartOptions, updateAllCharts])

  const loadData = useCallback(async () => {
    if (!selectedExpiry) return
    setIsLoading(true)
    try {
      const res = await tradingService.getIVChartData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
        interval: selectedInterval,
        days: parseInt(selectedDays),
      })
      if ((res as any).status === 'success' && res.data) {
        chartDataRef.current = res.data
        setChartData(res.data)
        updateAllCharts(res.data)
      } else {
        toast({ title: "SYNC_FAULT", description: res.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "TRANS_ERROR", description: "Failed to fetch chart data.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [selectedExpiry, selectedInterval, selectedDays, selectedUnderlying, selectedExchange, updateAllCharts, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getLatestValue = (type: 'CE' | 'PE', metric: MetricKey): string => {
    if (!chartData) return '--'
    const s = chartData.series.find((x: any) => x.option_type === type)
    if (!s) return '--'
    const valid = s.iv_data.filter((p: any) => p[metric] !== null)
    if (valid.length === 0) return '--'
    const v = valid[valid.length - 1][metric]
    return v !== null ? METRIC_CONFIG[metric].formatter(v) : '--'
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <BarChart2 className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>IV_History_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">GREEK_TIME_SERIES // NODE::{selectedUnderlying || 'VECTOR_NODE'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <Select value={selectedExchange} onValueChange={setSelectedExchange}>
              <SelectTrigger className="w-24 h-9 text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] uppercase">
                {fnoExchanges.map((ex) => (
                  <SelectItem key={ex.value} value={ex.value}>{ex.label}</SelectItem>
                ))}
              </SelectContent>
           </Select>

           <Popover open={underlyingOpen} onOpenChange={setUnderlyingOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 h-9 justify-between text-[10px] uppercase font-bold border-border/20 bg-background/50">
                   {selectedUnderlying || 'SELECT_NODE'}
                   <ChevronsUpDown className="ml-2 h-3 w-3 opacity-30" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0 bg-background border-border/20" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="SEARCH_NODE..." className="h-8 text-[10px]" />
                  <CommandList className="scrollbar-hide">
                    <CommandEmpty className="p-4 text-[10px] opacity-40">NO_DATA</CommandEmpty>
                    <CommandGroup>
                      {underlyings.map((u) => (
                        <CommandItem
                          key={u}
                          value={u}
                          onSelect={() => { setSelectedUnderlying(u); setUnderlyingOpen(false); }}
                          className="text-[10px] uppercase cursor-pointer hover:bg-primary/10"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedUnderlying === u ? "opacity-100" : "opacity-0")} />
                          {u}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
           </Popover>

           <Select value={selectedExpiry} onValueChange={setSelectedExpiry} disabled={expiries.length === 0}>
              <SelectTrigger className="w-40 h-9 text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue placeholder="EXPIRY" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] uppercase">
                {expiries.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
           </Select>

           <Select value={selectedInterval} onValueChange={setSelectedInterval}>
              <SelectTrigger className="w-24 h-9 text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] uppercase">
                {intervals.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
           </Select>

           <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-24 h-9 text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] uppercase">
                {['1', '5', '10', '30'].map((d) => (
                  <SelectItem key={d} value={d}>{d}D</SelectItem>
                ))}
              </SelectContent>
           </Select>

            <Button onClick={loadData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />} RE_SYNC_GREEKS
            </Button>
        </div>
      </div>

      <div className="flex flex-col space-y-4 flex-1 min-h-0">
        {chartData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1">
              {[
                { label: "ATM_STRIKE", val: chartData.atm_strike, icon: Target, col: isAD ? "text-primary" : "text-teal-500" },
                { label: "SPOT_LTP", val: chartData.underlying_ltp?.toFixed(2), icon: Target, col: isAD ? "text-amber-400" : "text-emerald-400" },
                { label: "CE_LATEST", val: getLatestValue('CE', 'iv'), icon: Activity, col: isAD ? "text-primary" : "text-teal-500" },
                { label: "PE_LATEST", val: getLatestValue('PE', 'iv'), icon: Activity, col: "text-emerald-500" },
              ].map((item, i) => (
                <AetherPanel key={i} className="py-2 px-4 bg-background/20 border-border/10">
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
                     <item.icon className={cn("w-2.5 h-2.5 opacity-40", item.col)} />
                  </div>
                  <div className={cn("text-xs font-black tabular-nums", item.col)}>{item.val || "---"}</div>
                </AetherPanel>
              ))}
          </div>
        )}

        <div className="flex flex-col flex-1 space-y-4">
           <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MetricKey)} className="w-full">
              <TabsList className="bg-white/5 border border-white/10 h-10 p-1 rounded-none w-full max-w-2xl">
                 {METRICS.map((m) => (
                    <TabsTrigger key={m} value={m} className="flex-1 rounded-none text-[10px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-black">
                       {METRIC_CONFIG[m].label}
                    </TabsTrigger>
                 ))}
              </TabsList>
           </Tabs>

            <div className="flex-1 relative">
               {METRICS.map((metric) => (
                  <div key={metric} className={cn("h-full grid grid-cols-1 md:grid-cols-2 gap-4", activeTab !== metric && "hidden")}>
                     <AetherPanel className="bg-background/20 border-border/10 relative overflow-hidden flex flex-col">
                        <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
                           <span className={cn("w-1.5 h-1.5 rounded-full", isAD ? "bg-primary" : "bg-teal-500")} />
                           <span className={cn("text-[8px] font-black uppercase tracking-widest", isAD ? "text-primary" : "text-teal-500")}>CALL_{METRIC_CONFIG[metric].label}</span>
                        </div>
                        <div
                          ref={(el) => { if (el) containerRefs.current.set(`${metric}-ce`, el) }}
                          className="flex-1 w-full"
                        />
                     </AetherPanel>
                     <AetherPanel className="bg-background/20 border-border/10 relative overflow-hidden flex flex-col">
                        <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">PUT_{METRIC_CONFIG[metric].label}</span>
                        </div>
                        <div
                          ref={(el) => { if (el) containerRefs.current.set(`${metric}-pe`, el) }}
                          className="flex-1 w-full"
                        />
                     </AetherPanel>
                  </div>
               ))}
            </div>

              {isLoading && !chartData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                   <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-20" />
                </div>
              )}
           </div>
        </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> DATA::STREAMING
             </div>
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> P2P_SYNC::ACTIVE
             </div>
          </div>
          <div className="text-[8px] font-black tracking-widest uppercase italic font-mono">
             AETHERDESK_HISTORICAL_GREEK_v1.0
          </div>
      </div>
    </div>
  )
}
