import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart3, RefreshCw, Activity, Layers, Target, Globe, ShieldCheck } from 'lucide-react'
import Plot from 'react-plotly.js'
import type * as PlotlyTypes from 'plotly.js'
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

const STRIKE_COUNTS = [
  { value: '10', label: '10_STRIKES' },
  { value: '20', label: '20_STRIKES' },
  { value: '30', label: '30_STRIKES' },
  { value: '40', label: '40_STRIKES' },
]

export default function VolSurfacePage() {
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { toast } = useToast()
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()
  const isDark = true // Industrial theme is dark

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiries, setSelectedExpiries] = useState<string[]>([])
  const [strikeCount, setStrikeCount] = useState('30')
  const [surfaceData, setSurfaceData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

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
    setSelectedExpiries([])
    setSurfaceData(null)

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
          setSelectedExpiries(response.expiries.slice(0, 4))
        }
      } catch {}
    }
    fetchExpiries()
    return () => { cancelled = true }
  }, [selectedUnderlying, selectedExchange])

  const toggleExpiry = (expiry: string) => {
    setSelectedExpiries(prev =>
      prev.includes(expiry) ? prev.filter(e => e !== expiry) : (prev.length >= 8 ? prev : [...prev, expiry])
    )
  }

  const loadData = useCallback(async () => {
    if (selectedExpiries.length === 0) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const res = await tradingService.getVolSurfaceData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_dates: selectedExpiries.map(convertExpiryForAPI),
        strike_count: parseInt(strikeCount),
      })
      if (requestIdRef.current !== requestId) return
      if (res.status === 'success') {
        setSurfaceData(res.data)
      } else {
        toast({ title: "COMPUTE_FAULT", description: res.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "TRANS_ERROR", description: "Failed to fetch surface data.", variant: "destructive" })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedExpiries, strikeCount, selectedUnderlying, selectedExchange, toast])

  useEffect(() => {
    if (selectedExpiries.length > 0) loadData()
  }, [loadData])

  const plotData = useMemo(() => {
    if (!surfaceData) return { data: [], layout: {} }

    const { strikes, expiries: expiryInfo, surface } = surfaceData
    const yIndices = expiryInfo.map((_: any, i: number) => i)
    const expiryLabels = expiryInfo.map((e: any) => e.date)

    const data: PlotlyTypes.Data[] = [
      {
        type: 'surface',
        x: strikes,
        y: yIndices,
        z: surface,
        colorscale: isAD ? 'YlOrRd' : 'Tealgrn',
        hovertemplate: 'STRIKE: %{x}<br>IV: %{z:.2f}%<extra></extra>',
        colorbar: {
          title: { text: 'IMPLIED_VOL', font: { size: 9, color: '#888' } },
          tickfont: { size: 8, color: '#666' },
          thickness: 12,
          x: 1.02
        }
      } as any
    ]

    const layout: Partial<PlotlyTypes.Layout> = {
      template: {
        layout: {
          font: { family: 'JetBrains Mono, monospace', color: '#888' },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }
      } as any,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        aspectmode: 'manual',
        aspectratio: { x: 2, y: 1.2, z: 0.8 },
        xaxis: {
          title: { text: 'STRIKE_PX', font: { size: 10 } },
          gridcolor: 'rgba(255,255,255,0.05)',
          backgroundcolor: 'rgba(0,0,0,0)',
          showbackground: false
        },
        yaxis: {
          title: { text: 'EXPIRY_NODE', font: { size: 10 } },
          tickvals: yIndices,
          ticktext: expiryLabels,
          gridcolor: 'rgba(255,255,255,0.05)',
          showbackground: false
        },
        zaxis: {
          title: { text: 'IMPLIED_VOL', font: { size: 10 } },
          gridcolor: 'rgba(255,255,255,0.05)',
          showbackground: false
        },
        camera: { eye: { x: 1.5, y: -1.5, z: 1 } }
      }
    }

    return { data, layout }
  }, [surfaceData, isAD])

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Globe className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Vol_Surface_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">VOLATILITY_FIELD // NODE::{selectedUnderlying || 'FIELD_SCAN'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <Select value={selectedExchange} onValueChange={setSelectedExchange}>
              <SelectTrigger className="w-24 h-9 font-mono text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] font-mono uppercase">
                {fnoExchanges.map((ex) => (
                  <SelectItem key={ex.value} value={ex.value}>{ex.label}</SelectItem>
                ))}
              </SelectContent>
           </Select>

           <Popover open={underlyingOpen} onOpenChange={setUnderlyingOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 h-9 justify-between font-mono text-[10px] uppercase font-bold border-border/20 bg-background/50">
                   {selectedUnderlying || 'SELECT_NODE'}
                   <ChevronsUpDown className="ml-2 h-3 w-3 opacity-30" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0 bg-background border-border/20" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="SEARCH_NODE..." className="h-8 font-mono text-[10px]" />
                  <CommandList className="scrollbar-hide">
                    <CommandEmpty className="p-4 font-mono text-[10px] opacity-40">NO_DATA</CommandEmpty>
                    <CommandGroup>
                      {underlyings.map((u) => (
                        <CommandItem
                          key={u}
                          value={u}
                          onSelect={() => { setSelectedUnderlying(u); setUnderlyingOpen(false); }}
                          className="font-mono text-[10px] uppercase cursor-pointer hover:bg-primary/10"
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

           <Select value={strikeCount} onValueChange={setStrikeCount}>
              <SelectTrigger className="w-32 h-9 font-mono text-[10px] uppercase font-bold border-border/20 bg-background/50">
                <SelectValue placeholder="STRIKES" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border/20 text-[10px] font-mono uppercase">
                {STRIKE_COUNTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
           </Select>

            <Button onClick={loadData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />} RE_SYNC_SURFACE
            </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 py-2 border-y border-white/5">
         <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest mr-2 self-center">Active_Expiries:</span>
         {expiries.map(exp => (
           <Badge
             key={exp}
             variant={selectedExpiries.includes(exp) ? "default" : "outline"}
             onClick={() => toggleExpiry(exp)}
             className={cn("cursor-pointer font-mono text-[9px] h-6 px-3 rounded-none uppercase transition-all",
               selectedExpiries.includes(exp)
                ? (isAD ? "bg-primary text-black" : "bg-teal-500 text-black")
                : "border-border/20 hover:border-primary/40"
             )}
           >
             {exp}
           </Badge>
         ))}
      </div>

      {surfaceData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
             { label: "SPOT_PX", val: surfaceData.underlying_ltp?.toFixed(2), icon: Target, col: isAD ? "text-primary" : "text-teal-500" },
             { label: "ATM_STRIKE", val: surfaceData.atm_strike, icon: Target, col: isAD ? "text-amber-400" : "text-emerald-400" },
             { label: "EXPIRY_COUNT", val: surfaceData.expiries.length, icon: Layers, col: "text-muted-foreground/60" },
             { label: "COMPUTE_NODE", val: "AETHER_GRID_01", icon: Globe, col: "text-muted-foreground/40" },
           ].map((item, i) => (
             <AetherPanel key={i} className="py-2 px-4 bg-background/20 border-border/10">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
                  <item.icon className={cn("w-2.5 h-2.5 opacity-40", item.col)} />
               </div>
               <div className={cn("text-xs font-black font-mono tabular-nums", item.col)}>{item.val || "---"}</div>
             </AetherPanel>
           ))}
        </div>
      )}

      <div className="flex-1 min-h-[350px] md:min-h-[500px] relative">
         <AetherPanel className="h-full bg-background/20 border-border/10 overflow-hidden">
            {isLoading && !surfaceData ? (
               <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20 scale-150">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <span className="text-[8px] font-black font-mono tracking-[0.4em] uppercase">Calculating_Field_Density...</span>
               </div>
            ) : surfaceData ? (
               <Plot
                 data={plotData.data}
                 layout={plotData.layout}
                 config={{ displayModeBar: false, responsive: true }}
                 style={{ width: '100%', height: '100%' }}
                 useResizeHandler
               />
            ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4">
                  <Activity className="w-16 h-16" />
                  <span className="text-[10px] font-black font-mono uppercase tracking-[0.4em]">Awaiting_Spectral_Data_Pulse</span>
               </div>
            )}
         </AetherPanel>

         {/* Corner Shims */}
          <div className="absolute top-0 right-0 w-24 h-24 border-r-2 border-t-2 opacity-20 pointer-events-none" style={{ borderColor: isAD ? '#f59e0b' : '#14b8a6' }} />
         <div className="absolute bottom-0 left-0 w-24 h-24 border-l-2 border-b-2 opacity-20 pointer-events-none" style={{ borderColor: isAD ? '#f59e0b' : '#14b8a6' }} />
      </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 font-mono text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> KERNEL::STABLE
             </div>
             <div className="flex items-center gap-1.5 font-mono text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> P2P_SYNC::ACTIVE
             </div>
          </div>
          <div className="font-mono text-[8px] font-black tracking-widest uppercase italic">
             AETHERDESK_VOL_FIELD_ENGINE_v4.2
          </div>
      </div>
    </div>
  )
}
