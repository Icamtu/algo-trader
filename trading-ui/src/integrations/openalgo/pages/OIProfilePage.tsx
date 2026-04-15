import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, RefreshCw, BarChart3, Database, Activity, Clock, Layers } from 'lucide-react'
import type * as PlotlyTypes from 'plotly.js'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import { useAuthStore } from '@/stores/authStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useThemeStore } from '@/stores/themeStore'
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
import Plot from 'react-plotly.js'
import { cn } from '@/lib/utils'

const INTERVAL_DAYS: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 7,
}

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

function formatCandleTime(time: any): string {
  if (!time) return ''
  let d: Date
  if (typeof time === 'number') {
    d = new Date(time > 1e12 ? time : time * 1000)
  } else {
    d = new Date(time)
  }
  if (isNaN(d.getTime())) return String(time)
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en', { month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd}-${mon} ${hh}:${mm}`
}

export default function OIProfilePage() {
  const { toast } = useToast()
  const { apiKey } = useAuthStore()
  const { mode } = useAppModeStore()
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()
  
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [intervals, setIntervals] = useState<string[]>(['5m'])
  const [selectedInterval, setSelectedInterval] = useState('5m')
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setSelectedExchange((prev) =>
      prev && fnoExchanges.some((ex) => ex.value === prev) ? prev : defaultFnoExchange
    )
  }, [defaultFnoExchange, fnoExchanges])

  useEffect(() => {
    tradingService.getOIIntervals().then((res) => {
      if (res.status === 'success' && res.data?.intervals.length) {
        setIntervals(res.data.intervals)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const defaults = defaultUnderlyings[selectedExchange] || []
    setUnderlyings(defaults)
    setSelectedUnderlying(defaults[0] || '')
    setExpiries([])
    setSelectedExpiry('')
    setProfileData(null)

    tradingService.getUnderlyings(selectedExchange).then((res) => {
      if (res.status === 'success' && res.underlyings.length > 0) {
        setUnderlyings(res.underlyings)
        if (!res.underlyings.includes(defaults[0])) {
          setSelectedUnderlying(res.underlyings[0])
        }
      }
    }).catch(() => {})
  }, [selectedExchange])

  useEffect(() => {
    if (!selectedUnderlying) return
    setExpiries([])
    setSelectedExpiry('')
    setProfileData(null)

    tradingService.getExpiries(selectedExchange, selectedUnderlying).then((res) => {
      if (res.status === 'success' && res.expiries.length > 0) {
        setExpiries(res.expiries)
        setSelectedExpiry(res.expiries[0])
      }
    }).catch(() => toast({ variant: 'destructive', title: 'FAULT::EXPIRY_LOAD', description: 'Failed to synchronize expiry dates.' }))
  }, [selectedUnderlying, selectedExchange])

  const fetchProfileData = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const response = await tradingService.getOIProfileData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
        interval: selectedInterval,
        days: INTERVAL_DAYS[selectedInterval] || 5,
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setProfileData(response)
      } else {
        toast({ variant: 'destructive', title: 'DATA_FAULT', description: response.message || 'Failed to fetch OI Profile telemetry.' })
      }
    } catch {
      if (requestIdRef.current !== requestId) return
      toast({ variant: 'destructive', title: 'WRITE_FAULT', description: 'Failed to connect to OI telemetry node.' })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange, selectedInterval])

  useEffect(() => {
    if (selectedExpiry) fetchProfileData()
  }, [selectedExpiry, selectedInterval, fetchProfileData])

  const themeColors = useMemo(() => ({
    bg: 'rgba(0,0,0,0)',
    paper: 'rgba(0,0,0,0)',
    text: '#ffffff',
    grid: 'rgba(255,255,255,0.05)',
    ceOI: '#10b981',
    peOI: '#f43f5e',
    ceChange: '#34d399',
    peChange: '#fb7185',
    atmLine: isAD ? '#f59e0b' : '#2dd4bf', 
    increasing: '#10b981',
    decreasing: '#f43f5e',
  }), [isAD])

  const plotConfig: Partial<PlotlyTypes.Config> = {
    displayModeBar: false,
    responsive: true,
  }

  const profilePlot = useMemo(() => {
    if (!profileData?.oi_chain || !profileData.candles?.length) return { data: [], layout: {} }

    const candles = profileData.candles
    const oiChain = profileData.oi_chain
    const candleTimes = candles.map((c: any) => formatCandleTime(c.timestamp || c.time))
    const strikes = oiChain.map((item: any) => item.strike)

    const data: PlotlyTypes.Data[] = [
      {
        x: candleTimes,
        open: candles.map((c: any) => c.open),
        high: candles.map((c: any) => c.high),
        low: candles.map((c: any) => c.low),
        close: candles.map((c: any) => c.close),
        type: 'candlestick',
        xaxis: 'x', yaxis: 'y',
        increasing: { line: { color: themeColors.increasing, width: 1.5 } },
        decreasing: { line: { color: themeColors.decreasing, width: 1.5 } },
        showlegend: false,
      },
      {
        y: strikes, x: oiChain.map((item: any) => item.ce_oi),
        type: 'bar', orientation: 'h', marker: { color: themeColors.ceOI },
        xaxis: 'x2', yaxis: 'y', name: 'CE_OI', showlegend: false,
      },
      {
        y: strikes, x: oiChain.map((item: any) => -item.pe_oi),
        type: 'bar', orientation: 'h', marker: { color: themeColors.peOI },
        xaxis: 'x2', yaxis: 'y', name: 'PE_OI', showlegend: false,
      },
      {
        y: strikes, x: oiChain.map((item: any) => item.ce_oi_change),
        type: 'bar', orientation: 'h', marker: { color: themeColors.ceChange },
        xaxis: 'x3', yaxis: 'y', name: 'CE_CHG', showlegend: false,
      },
      {
        y: strikes, x: oiChain.map((item: any) => -item.pe_oi_change),
        type: 'bar', orientation: 'h', marker: { color: themeColors.peChange },
        xaxis: 'x3', yaxis: 'y', name: 'PE_CHG', showlegend: false,
      }
    ]

    const layout: Partial<PlotlyTypes.Layout> = {
      paper_bgcolor: themeColors.paper,
      plot_bgcolor: themeColors.bg,
      font: { color: themeColors.text, family: 'JetBrains Mono, monospace', size: 10 },
      barmode: 'overlay',
      margin: { l: 60, r: 10, t: 30, b: 60 },
      xaxis: { domain: [0, 0.48], gridcolor: themeColors.grid, type: 'category', tickangle: -45, rangeslider: { visible: false } },
      xaxis2: { domain: [0.5, 0.74], anchor: 'y', gridcolor: themeColors.grid, zeroline: true, zerolinecolor: themeColors.text },
      xaxis3: { domain: [0.76, 1], anchor: 'y', gridcolor: themeColors.grid, zeroline: true, zerolinecolor: themeColors.text },
      yaxis: { gridcolor: themeColors.grid, title: { text: 'PRICE_LEVEL', font: { size: 10 } } },
      shapes: profileData.atm_strike ? [{
        type: 'line', x0: 0, x1: 1, xref: 'paper', y0: profileData.atm_strike, y1: profileData.atm_strike,
        line: { color: themeColors.atmLine, width: 2, dash: 'dash' }
      }] : []
    }
    return { data, layout }
  }, [profileData, themeColors])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Layers className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>OI_Profile_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", isAD ? "text-amber-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic">INTER-INTERVAL_EVOLUTION // NODE::{selectedUnderlying || 'ASSET_SCAN'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-card/20 p-2 border border-border/40 rounded-sm">
          <Select value={selectedExchange} onValueChange={setSelectedExchange}>
            <SelectTrigger className="w-24 font-mono text-[11px] font-black h-9 border-border/40 bg-background/50 uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fnoExchanges.map(ex => <SelectItem key={ex.value} value={ex.value} className="text-[11px] font-mono font-black">{ex.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover open={underlyingOpen} onOpenChange={setUnderlyingOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-36 justify-between h-9 font-mono text-[11px] font-black border-border/40 bg-background/50">
                {selectedUnderlying || 'ASSET_ID'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command className="bg-background">
                <CommandInput placeholder="Search ticker..." className="font-mono text-xs" />
                <CommandList>
                  <CommandEmpty className="p-4 text-[10px] font-mono uppercase text-muted-foreground/40">Not found</CommandEmpty>
                  <CommandGroup>
                    {underlyings.map((u) => (
                      <CommandItem key={u} value={u} onSelect={() => { setSelectedUnderlying(u); setUnderlyingOpen(false); }} className="font-mono text-[11px] font-black">
                        <Check className={cn('mr-2 h-3 w-3', selectedUnderlying === u ? 'opacity-100' : 'opacity-0')} /> {u}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
            <SelectTrigger className="w-36 font-mono text-[11px] font-black h-9 border-border/40 bg-background/50">
              <SelectValue placeholder="EXPIRY" />
            </SelectTrigger>
            <SelectContent>
              {expiries.map(exp => <SelectItem key={exp} value={exp} className="text-[11px] font-mono font-black">{exp}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedInterval} onValueChange={setSelectedInterval}>
            <SelectTrigger className="w-24 font-mono text-[11px] font-black h-9 border-border/40 bg-background/50">
              <SelectValue placeholder="TF" />
            </SelectTrigger>
            <SelectContent>
              {intervals.map(i => <SelectItem key={i} value={i} className="text-[11px] font-mono font-black">{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-border/40 mx-2" />

          <Button onClick={fetchProfileData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} /> RE_SYNC
          </Button>
        </div>
      </div>

      {profileData && (
        <div className="flex flex-wrap gap-3">
          <Badge className={cn("bg-card/40 border-primary/20 font-mono text-[10px] px-3 py-1", primaryColorClass)}>SPOT::{profileData.spot_price?.toFixed(1)}</Badge>
          <Badge className="bg-card/40 text-muted-foreground border-border/20 font-mono text-[10px] px-3 py-1 uppercase">LOT_SIZE::{profileData.lot_size}</Badge>
          <Badge className={cn("bg-card/40 border-primary/20 font-mono text-[10px] px-3 py-1 uppercase", primaryColorClass)}>ATM::{profileData.atm_strike}</Badge>
          <Badge className="bg-card/40 text-sky-400 border-sky-500/20 font-mono text-[10px] px-3 py-1 uppercase">FUT::{profileData.futures_symbol}</Badge>
          <Badge className="bg-background border-border/40 text-muted-foreground/40 font-mono text-[9px] px-2 py-0.5 tracking-[0.2em] italic uppercase">STREAM_NODES::{profileData.candles?.length}</Badge>
        </div>
      )}

      <AetherPanel className="p-0 border-2 border-border/40 bg-card/10 backdrop-blur-md relative overflow-hidden h-[700px]">
        <div className="scanline pointer-events-none opacity-5" />
        <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
          <div className="flex gap-8">
            <span className={cn("text-[10px] font-black font-mono uppercase tracking-[0.2em] italic", primaryColorClass)}>Futures_Price_Map</span>
            <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-emerald-500/60 italic">Call_Profile</span>
            <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-rose-500/60 italic">Put_Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-muted-foreground/30" />
            <span className="text-[9px] font-mono text-muted-foreground/30 italic uppercase">SYNC_LOCKED :: {selectedInterval}</span>
          </div>
        </div>
        <div className="p-4 h-[650px]">
           {isLoading && !profileData ? (
            <div className="h-full flex items-center justify-center text-[11px] font-mono font-black text-muted-foreground animate-pulse tracking-widest uppercase">Mapping_Inter-Interval_State...</div>
          ) : (
            <Plot data={profilePlot.data} layout={profilePlot.layout} config={plotConfig} useResizeHandler style={{ width: '100%', height: '620px' }} />
          )}
        </div>
      </AetherPanel>
      
      <div className="flex justify-between items-center px-2">
        <div className="flex gap-4">
          <span className="text-[9px] font-mono text-muted-foreground/30 font-black uppercase tracking-widest">LAYER::DERIVATIVES_EVOLUTION</span>
          <span className="text-[9px] font-mono text-muted-foreground/30 font-black uppercase tracking-widest">KERNEL::PLOTLY_ENGINE v3.5</span>
        </div>
        <div className="text-[9px] font-mono text-primary/40 font-black uppercase tracking-widest italic">
          TELEMETRY_STREAM_STABLE :: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
