import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart3, RefreshCw, Activity, Layers, Target } from 'lucide-react'
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

function formatNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export default function OITrackerPage() {
  const { toast } = useToast()
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()
  const isDark = true // Industrial theme is dark

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [oiData, setOiData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5"

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
    setOiData(null)

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
      } catch {
        toast({ variant: 'destructive', title: 'FAULT::ASSET_LOAD', description: 'Failed to synchronize underlying assets.' })
      }
    }
    fetchUnderlyings()
    return () => { cancelled = true }
  }, [selectedExchange, defaultUnderlyings])

  useEffect(() => {
    if (!selectedUnderlying) return
    setExpiries([])
    setSelectedExpiry('')
    setOiData(null)

    let cancelled = false
    const fetchExpiries = async () => {
      try {
        const response = await tradingService.getExpiries(selectedExchange, selectedUnderlying)
        if (cancelled) return
        if (response.status === 'success' && response.expiries.length > 0) {
          setExpiries(response.expiries)
          setSelectedExpiry(response.expiries[0])
        }
      } catch {
        toast({ variant: 'destructive', title: 'FAULT::EXPIRY_LOAD', description: 'Failed to synchronize expiry dates.' })
      }
    }
    fetchExpiries()
    return () => { cancelled = true }
  }, [selectedUnderlying, selectedExchange])

  const fetchOIData = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const expiryForAPI = convertExpiryForAPI(selectedExpiry)
      const response = await tradingService.getOIData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: expiryForAPI,
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setOiData(response)
      } else {
        toast({ title: "FETCH_ERROR", description: response.message, variant: "destructive" })
      }
    } catch {
      if (requestIdRef.current !== requestId) return
      toast({ title: "COMM_FAULT", description: "Failed to fetch OI data.", variant: "destructive" })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange, toast])

  useEffect(() => {
    if (selectedExpiry) fetchOIData()
  }, [selectedExpiry, fetchOIData])

  const plotData = useMemo(() => {
    if (!oiData?.chain) return { data: [], layout: {} }

    const lotSize = oiData.lot_size || 1
    const atmStrike = oiData.atm_strike
    const chain = oiData.chain

    const xIndices = chain.map((_: any, i: number) => i)
    const tickLabels = chain.map((item: any) => item.strike.toString())
    const ceOILots = chain.map((item: any) => Math.round(item.ce_oi / lotSize))
    const peOILots = chain.map((item: any) => Math.round(item.pe_oi / lotSize))

    const tickStep = Math.max(1, Math.floor(chain.length / 15))
    const tickVals = xIndices.filter((_: any, i: number) => i % tickStep === 0)
    const tickText = tickLabels.filter((_: any, i: number) => i % tickStep === 0)

    const data: PlotlyTypes.Data[] = [
      {
        x: xIndices,
        y: ceOILots,
        type: 'bar',
        name: 'CE_OI_LOTS',
        marker: { color: '#f43f5e', line: { width: 0 } }, // rose-500
        hovertemplate: 'STRIKE: %{text}<br>CE_OI: %{y:,}<extra></extra>',
        text: tickLabels,
      },
      {
        x: xIndices,
        y: peOILots,
        type: 'bar',
        name: 'PE_OI_LOTS',
        marker: { color: '#10b981', line: { width: 0 } }, // emerald-500
        hovertemplate: 'STRIKE: %{text}<br>PE_OI: %{y:,}<extra></extra>',
        text: tickLabels,
      },
    ]

    const atmIndex = atmStrike ? chain.findIndex((item: any) => item.strike === atmStrike) : -1

    const layout: Partial<PlotlyTypes.Layout> = {
      template: {
        layout: {
          font: { family: 'JetBrains Mono, monospace', color: '#888' },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }
      } as any,
      barmode: 'group',
      bargap: 0.2,
      hovermode: 'x unified',
      showlegend: true,
      legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.2, font: { size: 10 } },
      margin: { l: 40, r: 20, t: 40, b: 60 },
      xaxis: {
        tickmode: 'array',
        tickvals: tickVals,
        ticktext: tickText,
        gridcolor: 'rgba(255,255,255,0.05)',
        tickangle: -45,
        tickfont: { size: 9 }
      },
      yaxis: {
        gridcolor: 'rgba(255,255,255,0.05)',
        tickfont: { size: 9 }
      },
      shapes: atmIndex >= 0 ? [{
        type: 'line', x0: atmIndex, x1: atmIndex, y0: 0, y1: 1, yref: 'paper',
        line: { color: isAD ? '#f59e0b' : '#2dd4bf', width: 2, dash: 'dash' }
      }] : []
    }

    return { data, layout }
  }, [oiData])

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Target className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>OI_Vector_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">OPEN_INTEREST // NODE::{selectedUnderlying || 'VECTOR_MAP'}</span>
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

          <Select value={selectedExpiry} onValueChange={setSelectedExpiry} disabled={expiries.length === 0}>
            <SelectTrigger className="w-40 h-9 font-mono text-[10px] uppercase font-bold border-border/20 bg-background/50">
              <SelectValue placeholder="EXPIRY" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/20 text-[10px] font-mono uppercase">
              {expiries.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={fetchOIData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} /> RE_SYNC
          </Button>
        </div>
      </div>

      {oiData?.status === 'success' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: "SPOT", val: oiData.spot_price?.toFixed(1), icon: Target, col: primaryColorClass },
            { label: "FUTS", val: oiData.futures_price?.toFixed(1), icon: Activity, col: "text-muted-foreground/60" },
            { label: "LOT", val: oiData.lot_size, icon: Layers, col: primaryColorClass },
            { label: "PCR_OI", val: oiData.pcr_oi?.toFixed(2), icon: BarChart3, col: "text-emerald-500" },
            { label: "PCR_VOL", val: oiData.pcr_volume?.toFixed(2), icon: BarChart3, col: "text-teal-500" },
            { label: "ATM", val: oiData.atm_strike, icon: Target, col: primaryColorClass },
            { label: "CE_TOTAL", val: formatNumber(oiData.total_ce_oi || 0), icon: Layers, col: "text-rose-500" },
            { label: "PE_TOTAL", val: formatNumber(oiData.total_pe_oi || 0), icon: Layers, col: "text-emerald-500" },
          ].map((item, i) => (
            <AetherPanel key={i} className="py-2.5 px-4 bg-background/20 border-border/10">
              <div className="flex items-center justify-between mb-1">
                 <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">{item.label}</span>
                 <item.icon className={cn("w-2.5 h-2.5 opacity-40", item.col)} />
              </div>
              <div className={cn("text-xs font-black font-mono tabular-nums", item.col)}>{item.val || "---"}</div>
            </AetherPanel>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-[400px]">
        <AetherPanel className="h-full bg-black/40 border-white/5 overflow-hidden">
           {isLoading && !oiData ? (
             <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-[10px] font-black font-mono tracking-[0.4em] uppercase">Loading_Data_Stream...</span>
             </div>
           ) : oiData?.chain ? (
             <Plot
               data={plotData.data}
               layout={plotData.layout}
               config={{ displayModeBar: false, responsive: true }}
               style={{ width: '100%', height: '100%' }}
               useResizeHandler
             />
           ) : (
             <div className="h-full flex flex-col items-center justify-center opacity-10 gap-2">
                <BarChart3 className="w-12 h-12" />
                <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em]">Select_Expiry_To_Track_OI</span>
             </div>
           )}
        </AetherPanel>
      </div>

      <div className="flex items-center justify-between py-2 border-t border-white/5">
         <div className="flex items-center gap-4 opacity-20">
            <div className="text-[8px] font-mono font-black uppercase tracking-widest">TRANSMISSION::SECURE</div>
            <div className="w-[1px] h-3 bg-white/20" />
            <div className="text-[8px] font-mono font-black uppercase tracking-widest">LATENCY::14ms</div>
         </div>
         <div className="text-[8px] font-mono font-black uppercase tracking-widest italic opacity-20">
            AETHERDESK_OI_ENGINE_v1
         </div>
      </div>
    </div>
  )
}
