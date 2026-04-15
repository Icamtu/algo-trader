import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, BarChart2, RefreshCw, Activity, Target, ShieldCheck, Globe, Info } from 'lucide-react'
import Plot from 'react-plotly.js'
import type * as PlotlyTypes from 'plotly.js'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
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
import { useAppModeStore } from '@/stores/appModeStore'

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

const AUTO_REFRESH_INTERVAL = 30000

export default function IVSmilePage() {
  const { toast } = useToast()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const accentHex = isAD ? '#f59e0b' : '#14b8a6' 
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
  const [ivData, setIvData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const requestIdRef = useRef(0)
  const intervalRef = useRef<any>(null)

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
    setIvData(null)

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

  const fetchIVSmileData = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const response = await tradingService.getIVSmileData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setIvData(response)
      } else {
        toast({ title: "COMPUTE_FAULT", description: response.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "TRANS_ERROR", description: "Failed to fetch smile data.", variant: "destructive" })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange, toast])

  useEffect(() => {
    if (selectedExpiry) fetchIVSmileData()
  }, [selectedExpiry, fetchIVSmileData])

  useEffect(() => {
    if (autoRefresh && selectedExpiry) {
      intervalRef.current = setInterval(fetchIVSmileData, AUTO_REFRESH_INTERVAL)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, fetchIVSmileData, selectedExpiry])

  const ivSmilePlot = useMemo(() => {
    if (!ivData?.chain) return { data: [], layout: {} }

    const chain = ivData.chain
    const spotPrice = ivData.spot_price
    const atmStrike = ivData.atm_strike
    const validChain = chain.filter((item: any) => item.ce_iv !== null || item.pe_iv !== null)

    const strikes = validChain.map((item: any) => item.strike)
    const ceIVs = validChain.map((item: any) => item.ce_iv)
    const peIVs = validChain.map((item: any) => item.pe_iv)

    const data: PlotlyTypes.Data[] = [
      {
        x: strikes,
        y: ceIVs,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'CALL_IV',
        line: { color: accentHex, width: 2 },
        marker: { size: 6, color: accentHex, line: { width: 1, color: isAD ? '#000' : 'transparent' } },
        hovertemplate: 'STRIKE: %{x}<br>CALL_IV: %{y:.2f}%<extra></extra>',
        connectgaps: true,
      },
      {
        x: strikes,
        y: peIVs,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'PUT_IV',
        line: { color: '#10b981', width: 2 },
        marker: { size: 6, color: '#10b981', line: { width: 1, color: isAD ? '#000' : 'transparent' } },
        hovertemplate: 'STRIKE: %{x}<br>PUT_IV: %{y:.2f}%<extra></extra>',
        connectgaps: true,
      },
    ] as any

    const layout: Partial<PlotlyTypes.Layout> = {
      template: {
        layout: {
          font: { family: 'JetBrains Mono, monospace', color: '#888' },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }
      } as any,
      margin: { l: 40, r: 10, t: 20, b: 40 },
      hovermode: 'x unified',
      xaxis: {
        title: { text: 'STRIKE_PX', font: { size: 10 } },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      yaxis: {
        title: { text: 'IMPLIED_VOL (%)', font: { size: 10 } },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.2,
        font: { size: 10 }
      },
      shapes: spotPrice ? [
        {
          type: 'line',
          x0: spotPrice, x1: spotPrice,
          y0: 0, y1: 1, yref: 'paper',
          line: { color: 'rgba(255,255,255,0.2)', width: 1, dash: 'dash' }
        }
      ] : []
    }

    return { data, layout }
  }, [ivData])

  const ivTable = useMemo(() => {
    if (!ivData?.chain || !ivData.atm_strike) return []
    const atm = ivData.atm_strike
    return ivData.chain
      .filter((item: any) => Math.abs(item.strike - atm) / atm <= 0.05 && (item.ce_iv !== null || item.pe_iv !== null))
      .map((item: any) => ({
        strike: item.strike,
        ce_iv: item.ce_iv,
        pe_iv: item.pe_iv,
        isATM: item.strike === atm,
      }))
  }, [ivData])

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Activity className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>IV_Smile_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">VOLATILITY_SKEW // NODE::{selectedUnderlying || 'SPECTRAL_SCAN'}</span>
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

           <Button 
             variant="outline" 
             onClick={() => setAutoRefresh(!autoRefresh)}
             className={cn(
               "h-9 text-[10px] border-border/20", 
               autoRefresh ? (isAD ? "bg-primary text-black" : "bg-teal-500 text-black") : "bg-background/50"
             )}
           >
              SYNC: {autoRefresh ? 'ACTIVE' : 'IDLE'}
           </Button>

            <Button onClick={fetchIVSmileData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />} RE_SYNC
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden">
         <div className="lg:col-span-3 flex flex-col space-y-4">
            {ivData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "SPOT_PX", val: ivData.spot_price?.toFixed(2), icon: Target, col: primaryColorClass },
                    { label: "ATM_STRIKE", val: ivData.atm_strike, icon: Target, col: isAD ? "text-amber-400" : "text-emerald-400" },
                    { label: "ATM_IV", val: ivData.atm_iv ? `${ivData.atm_iv}%` : "---", icon: BarChart2, col: "text-muted-foreground/60" },
                    { label: "SKEW_25D", val: ivData.skew ? `${ivData.skew > 0 ? '+' : ''}${ivData.skew}%` : "---", icon: Info, col: "text-muted-foreground/40" },
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

            <AetherPanel className="flex-1 bg-background/20 border-border/10 overflow-hidden">
               {isLoading && !ivData ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20">
                     <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                     <span className="text-[8px] font-bold opacity-30 uppercase">Compiling_Skew_Field...</span>
                  </div>
               ) : ivSmilePlot.data.length > 0 ? (
                  <Plot
                    data={ivSmilePlot.data}
                    layout={ivSmilePlot.layout}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                  />
               ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                     <Activity className="w-16 h-16 mb-4" />
                     <span className="text-[10px] font-black uppercase tracking-[0.4em]">Spectral_Feed_Null</span>
                  </div>
               )}
            </AetherPanel>
         </div>

         <div className="flex flex-col space-y-4 min-w-0">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">ATM_Zone_Matrix</h3>
            <AetherPanel className="flex-1 bg-background/20 border-border/10 overflow-y-auto scrollbar-hide">
               <div className="p-3">
                  <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/10 uppercase font-black text-[8px] text-muted-foreground/40 tracking-tighter">
                           <th className="py-2">Strike</th>
                           <th className="py-2 text-right text-rose-500">CALL_IV</th>
                           <th className="py-2 text-right text-emerald-500">PUT_IV</th>
                        </tr>
                      </thead>
                      <tbody className="text-[9px] font-bold tabular-nums">
                        {ivTable.map((row: any) => (
                           <tr key={row.strike} className={cn("border-b border-border/10 hover:bg-white/[0.02]", row.isATM && accentBgClass)}>
                              <td className={cn("py-2", row.isATM && primaryColorClass)}>{row.strike}</td>
                              <td className="py-2 text-right text-rose-500/80">{row.ce_iv ? `${row.ce_iv}%` : '-'}</td>
                              <td className="py-2 text-right text-emerald-500/80">{row.pe_iv ? `${row.pe_iv}%` : '-'}</td>
                           </tr>
                        ))}
                      </tbody>
                  </table>
                  {ivTable.length === 0 && (
                     <div className="py-20 text-center opacity-20 text-[8px] uppercase font-black">Waiting_For_Inputs</div>
                  )}
               </div>
            </AetherPanel>

            <AetherPanel className="p-4 bg-primary/5 border-primary/20">
               <div className="flex gap-3">
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <div className="space-y-1">
                     <p className="text-[9px] font-black uppercase text-primary">SKEW_INTERPRETATION</p>
                     <p className="text-[8px] leading-relaxed text-muted-foreground uppercase">
                        Positive Skew indicates higher Put IV relative to Calls, suggesting hedging demand or bearish sentiment bias.
                     </p>
                  </div>
               </div>
            </AetherPanel>
         </div>
      </div>

      <div className="h-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex gap-6">
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <ShieldCheck className="w-2.5 h-2.5" /> SKW::VALIDATED
             </div>
             <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
                <Globe className="w-2.5 h-2.5" /> P2P_SYNC::ACTIVE
             </div>
          </div>
          <div className="text-[8px] font-black tracking-widest uppercase italic font-mono">
             AETHERDESK_SKEW_CALIBRATOR_v1.0
          </div>
      </div>
    </div>
  )
}
