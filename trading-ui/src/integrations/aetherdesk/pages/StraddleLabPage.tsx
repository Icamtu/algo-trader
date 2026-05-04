import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart2, RefreshCw, Activity, Target, ShieldCheck, Globe, Info, Gauge, Layers, TrendingUp } from 'lucide-react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import { useAppModeStore } from '@/stores/appModeStore'
import { tradingService } from '@/services/tradingService'
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

const CHART_HEIGHT = 450

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

export default function StraddleLabPage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()

  const [isLoading, setIsLoading] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [selectedInterval, setSelectedInterval] = useState('5m')
  const [selectedDays, setSelectedDays] = useState('1')
  const [chartData, setChartData] = useState<any>(null)

  // Visibility Toggles
  const [showStraddle, setShowStraddle] = useState(true)
  const [showSpot, setShowSpot] = useState(false)
  const [showSynthetic, setShowSynthetic] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const spotSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const straddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const syntheticSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
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
        const data = response?.data || response;
        const underlyingsList = Array.isArray(data?.underlyings) ? data.underlyings : [];
        if (underlyingsList.length > 0) {
          setUnderlyings(underlyingsList)
          if (!underlyingsList.includes(defaults[0])) {
            setSelectedUnderlying(underlyingsList[0])
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
        const data = response?.data || response;
        const expiriesList = Array.isArray(data?.expiries) ? data.expiries : [];
        if (expiriesList.length > 0) {
          setExpiries(expiriesList)
          setSelectedExpiry(expiriesList[0])
        }
      } catch {}
    }
    fetchExpiries()
    return () => { cancelled = true }
  }, [selectedUnderlying, selectedExchange])

  const colors = {
    text: '#888',
    grid: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    spot: isAD ? '#14b8a6' : '#ffffff',
    straddle: isAD ? '#ffb000' : '#2dd4bf',
    synthetic: '#ef4444',
  }

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const container = chartContainerRef.current
    container.innerHTML = ''

    const chart = createChart(container, {
      width: container.offsetWidth,
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: colors.text,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      leftPriceScale: {
        visible: true,
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      rightPriceScale: {
        visible: true,
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: isAD ? 'rgba(245,158,11,0.2)' : 'rgba(20,184,166,0.2)', width: 1 as any, style: 2, labelVisible: false },
        horzLine: { color: isAD ? 'rgba(245,158,11,0.2)' : 'rgba(20,184,166,0.2)', width: 1 as any, style: 2, labelBackgroundColor: '#111' },
      },
    })

    const spotSeries = chart.addSeries(LineSeries, {
      color: colors.spot,
      lineWidth: 1.5 as any,
      priceScaleId: 'left',
      title: 'SPOT',
      visible: showSpot,
    })

    const straddleSeries = chart.addSeries(LineSeries, {
      color: colors.straddle,
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'STRADDLE',
      visible: showStraddle,
    })

    const syntheticSeries = chart.addSeries(LineSeries, {
      color: colors.synthetic,
      lineWidth: 1,
      lineStyle: 2,
      priceScaleId: 'left',
      title: 'SYNTHETIC_FUT',
      visible: showSynthetic,
    })

    chartRef.current = chart
    spotSeriesRef.current = spotSeries
    straddleSeriesRef.current = straddleSeries
    syntheticSeriesRef.current = syntheticSeries

    if (chartDataRef.current) applyDataToChart(chartDataRef.current)

    const handleResize = () => chart.applyOptions({ width: container.offsetWidth })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [showSpot, showStraddle, showSynthetic])

  const applyDataToChart = useCallback((data: any) => {
    if (!data.series?.length) return
    const sorted = [...data.series].sort((a, b) => a.time - b.time)

    if (spotSeriesRef.current) {
      spotSeriesRef.current.setData(sorted.map(p => ({ time: p.time as any, value: p.spot })))
    }
    if (straddleSeriesRef.current) {
      straddleSeriesRef.current.setData(sorted.map(p => ({ time: p.time as any, value: p.straddle })))
    }
    if (syntheticSeriesRef.current) {
      syntheticSeriesRef.current.setData(sorted.map(p => ({ time: p.time as any, value: p.synthetic_future })))
    }

    chartRef.current?.timeScale().fitContent()
  }, [])

  useEffect(() => {
    initChart()
    return () => { chartRef.current?.remove() }
  }, [initChart])

  const loadData = useCallback(async () => {
    if (!selectedExpiry) return
    setIsLoading(true)
    try {
      const res = await tradingService.getStraddleChartData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
        interval: selectedInterval,
        days: parseInt(selectedDays),
      })
      const data = res?.data || res;
      if (data && (Array.isArray(data.series) || data.series)) {
        chartDataRef.current = data
        setChartData(data)
        applyDataToChart(data)
      } else {
        toast({ title: "SYNC_FAULT", description: res.message || "Invalid data format", variant: "destructive" })
      }
    } catch {
      toast({ title: "TRANS_ERROR", description: "Failed to fetch straddle telemetry.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [selectedExpiry, selectedInterval, selectedDays, selectedUnderlying, selectedExchange, applyDataToChart, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const latest = useMemo(() => {
    if (!chartData?.series?.length) return null
    return chartData.series[chartData.series.length - 1]
  }, [chartData])

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <TrendingUp className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Straddle_Lab_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">SYNTHETIC_FUTURES // NODE::{selectedUnderlying || 'COMPOSITE_SCAN'}</span>
            </div>
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
              <SelectTrigger className="w-20 h-9 text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] uppercase">
                {['1m', '5m', '15m', '1h'].map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
           </Select>

            <Button onClick={loadData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />} RE_SYNC_LAB
            </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-6">
        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
             {[
                { label: "ATM_STRIKE", val: latest.atm_strike, icon: Target, col: isAD ? "text-primary" : "text-teal-500 font-bold" },
                { label: "STRADDLE_PX", val: latest.straddle.toFixed(2), icon: Activity, col: isAD ? "text-amber-500" : "text-teal-500" },
                { label: "SPOT_PX", val: latest.spot.toFixed(2), icon: Target, col: isAD ? "text-teal-500" : "text-amber-500" },
                { label: "SYNTHETIC_FUT", val: latest.synthetic_future.toFixed(2), icon: TrendingUp, col: "text-red-400 font-black" },
                { label: "ATM_CE_PX", val: latest.ce_price.toFixed(2), icon: Layers, col: "text-muted-foreground/60" },
                { label: "ATM_PE_PX", val: latest.pe_price.toFixed(2), icon: Layers, col: "text-muted-foreground/60" },
              ].map((item, i) => (
                <AetherPanel key={i} className="py-2 px-3 bg-background/20 border-border/10">
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[7.5px] font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
                     <item.icon className={cn("w-2 h-2 opacity-40", item.col)} />
                  </div>
                  <div className={cn("text-[11px] font-black tabular-nums", item.col)}>{item.val || "---"}</div>
                </AetherPanel>
              ))}
          </div>
        )}

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
           <AetherPanel className="flex-1 bg-background/20 border-border/10 relative overflow-hidden flex flex-col">
              <div
                ref={chartContainerRef}
                className="flex-1 w-full"
              />
              {isLoading && !chartData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                   <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-20" />
                </div>
              )}
           </AetherPanel>

           <div className="flex items-center justify-center gap-4 py-2 bg-background/50 border border-border/10">
              {[
                { label: "Straddle", color: isAD ? '#eab308' : '#14b8a6', state: showStraddle, setter: setShowStraddle },
                { label: "Spot", color: colors.spot, state: showSpot, setter: setShowSpot },
                { label: "Synthetic", color: colors.synthetic, state: showSynthetic, setter: setShowSynthetic, dash: true },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => btn.setter(!btn.state)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 transition-all group",
                    btn.state ? "opacity-100" : "opacity-30 grayscale hover:grayscale-0 hover:opacity-60"
                  )}
                >
                   <div className={cn("h-0.5 w-6", btn.dash && "border-t border-dashed")} style={{ backgroundColor: btn.dash ? 'transparent' : btn.color, borderColor: btn.color }} />
                   <span className="text-[10px] font-black uppercase tracking-widest">{btn.label}</span>
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> QUANT::SYNCED
             </div>
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> P2P_SYNC::ACTIVE
             </div>
          </div>
          <div className="text-[8px] font-black tracking-widest uppercase italic font-mono">
             AETHERDESK_STRADDLE_QUANT_v4.2
          </div>
      </div>
    </div>
  )
}
