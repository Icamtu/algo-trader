import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart2, RefreshCw, Activity, Target, ShieldCheck, Globe, Info, Gauge, Layers } from 'lucide-react'
import Plot from 'react-plotly.js'
import type * as PlotlyTypes from 'plotly.js'
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

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

export default function MaxPainPage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [maxPainData, setMaxPainData] = useState<any>(null)
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
    setSelectedExpiry('')
    setMaxPainData(null)

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

  const fetchMaxPain = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const response = await tradingService.getMaxPainData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setMaxPainData(response)
      } else {
        toast({ title: "COMPUTE_FAULT", description: response.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "TRANS_ERROR", description: "Failed to calculate pain index.", variant: "destructive" })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange, toast])

  useEffect(() => {
    if (selectedExpiry) fetchMaxPain()
  }, [selectedExpiry, fetchMaxPain])

  const plotData = useMemo(() => {
    if (!maxPainData?.pain_data) return { data: [], layout: {} }

    const maxPainStrike = maxPainData.max_pain_strike
    const painData = maxPainData.pain_data
    const xIndices = painData.map((_: any, i: number) => i)
    const tickLabels = painData.map((item: any) => item.strike.toString())
    const totalPainCr = painData.map((item: any) => item.total_pain_cr)

    const barColors = painData.map((item: any) => 
      item.strike === maxPainStrike ? (isAD ? '#f59e0b' : '#14b8a6') : 'rgba(255,255,255,0.05)'
    )

    const data: PlotlyTypes.Data[] = [
      {
        x: xIndices,
        y: totalPainCr,
        type: 'bar',
        marker: { color: barColors, line: { width: 0 } },
        hovertemplate: 'STRIKE: %{text}<br>PAIN: %{y:.2f}Cr<extra></extra>',
        text: tickLabels,
      } as any
    ]

    const maxPainIndex = painData.findIndex((item: any) => item.strike === maxPainStrike)

    const layout: Partial<PlotlyTypes.Layout> = {
      template: {
        layout: {
          font: { family: 'JetBrains Mono, monospace', color: '#888' },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }
      } as any,
      margin: { l: 40, r: 10, t: 30, b: 40 },
      xaxis: {
        tickmode: 'array',
        tickvals: xIndices.filter((_: any, i: number) => i % Math.max(1, Math.floor(painData.length / 12)) === 0),
        ticktext: tickLabels.filter((_: any, i: number) => i % Math.max(1, Math.floor(painData.length / 12)) === 0),
        title: { text: 'STRIKE_PX', font: { size: 10 } },
        gridcolor: 'rgba(255,255,255,0.05)',
      },
      yaxis: {
        title: { text: 'PAIN_VALUE (CR)', font: { size: 10 } },
        gridcolor: 'rgba(255,255,255,0.05)',
      },
      shapes: maxPainIndex >= 0 ? [
        {
          type: 'line',
          x0: maxPainIndex, x1: maxPainIndex,
          y0: 0, y1: 1, yref: 'paper',
          line: { color: isAD ? '#f59e0b' : '#14b8a6', width: 2, dash: 'dash' }
        }
      ] : []
    }

    return { data, layout }
  }, [maxPainData, isAD])

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Gauge className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Max_Pain_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">SELLER_EQUILIBRIUM // NODE::{selectedUnderlying || 'ENTROPY_CENTER'}</span>
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

            <Button onClick={fetchMaxPain} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />} RE_CALC_PAIN
            </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-6">
        {maxPainData && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "SPOT_PX", val: maxPainData.spot_price?.toFixed(2), icon: Target, col: isAD ? "text-amber-400" : "text-emerald-400" },
                { label: "MAX_PAIN", val: maxPainData.max_pain_strike, icon: Target, col: isAD ? "text-amber-500" : "text-teal-500 font-black scale-110" },
                { label: "ATM_STRIKE", val: maxPainData.atm_strike, icon: Layers, col: isAD ? "text-amber-500/70" : "text-teal-500/70" },
                { label: "PCR_OI", val: maxPainData.pcr_oi?.toFixed(2), icon: Gauge, col: isAD ? "text-amber-500" : "text-teal-500" },
                { label: "PCR_VOL", val: maxPainData.pcr_volume?.toFixed(2), icon: Activity, col: isAD ? "text-amber-600" : "text-teal-600" },
                { label: "FUT_PX", val: maxPainData.futures_price?.toFixed(1) || "---", icon: BarChart2, col: "text-muted-foreground/60" },
                { label: "LOT_SZ", val: maxPainData.lot_size, icon: Info, col: "text-muted-foreground/60" },
              ].map((item, i) => (
                <AetherPanel key={i} className={cn("py-2 px-3 border-border/10", item.label === 'MAX_PAIN' ? "bg-background/40" : "bg-background/20")}>
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[7.5px] font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
                     <item.icon className={cn("w-2 h-2 opacity-40", item.col)} />
                  </div>
                  <div className={cn("text-[11px] font-black tabular-nums", item.col)}>{item.val || "---"}</div>
                </AetherPanel>
              ))}
          </div>
        )}

        <div className="flex-1 flex flex-col space-y-4">
           <AetherPanel className="flex-1 bg-background/20 border-border/10 relative overflow-hidden">
              <div className="absolute top-4 left-4 z-10">
                 <div className="flex items-center gap-2 mb-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full", isAD ? "bg-primary" : "bg-teal-500")} />
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", isAD ? "text-primary" : "text-teal-500")}>Pain_Index_Distribution</span>
                 </div>
                 <p className="text-[8px] text-muted-foreground/40 uppercase">Total theoretical loss for option buyers per strike.</p>
              </div>

              {isLoading && !maxPainData ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-20">
                    <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                    <span className="text-[8px] font-black uppercase tracking-[0.4em]">Simulating_Seller_Loss_Field...</span>
                 </div>
              ) : plotData.data.length > 0 ? (
                 <Plot
                   data={plotData.data}
                   layout={plotData.layout}
                   config={{ displayModeBar: false, responsive: true }}
                   style={{ width: '100%', height: '100%' }}
                   useResizeHandler
                 />
              ) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <Activity className="w-16 h-16 mb-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Spectral_Data_Null</span>
                 </div>
              )}
           </AetherPanel>

           <AetherPanel className={cn("p-4 border-l-2 max-w-2xl", isAD ? "bg-primary/5 border-primary" : "bg-teal-500/5 border-teal-500")}>
               <div className="flex gap-4">
                  <div className={cn("p-2 rounded-full h-fit", isAD ? "bg-primary/10" : "bg-teal-500/10")}>
                     <Info className={cn("w-4 h-4", isAD ? "text-primary" : "text-teal-500")} />
                  </div>
                  <div className="space-y-1">
                     <p className={cn("text-[9px] font-black uppercase", isAD ? "text-primary" : "text-teal-500")}>KERNEL_INSIGHT::MAX_PAIN_HYPOTHESIS</p>
                     <p className="text-[8px] leading-relaxed text-muted-foreground uppercase opacity-80 font-bold">
                        Max Pain theory suggests asset prices tend to gravitate towards the strike price where the most options (in value) expire worthless, causing the maximum financial "pain" to option buyers and maximum profit to sellers.
                     </p>
                  </div>
               </div>
           </AetherPanel>
        </div>
      </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> AGENT::ONLINE
             </div>
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> P2P_SYNC::ACTIVE
             </div>
          </div>
          <div className="text-[8px] font-black tracking-widest uppercase italic font-mono">
             AETHERDESK_PAIN_CALIBRATOR_v1.0
          </div>
      </div>
    </div>
  )
}
