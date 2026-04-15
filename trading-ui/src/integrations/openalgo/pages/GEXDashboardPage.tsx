import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, RefreshCw, BarChart3, Database, Activity } from 'lucide-react'
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
import Plot from 'react-plotly.js'
import { cn } from '@/lib/utils'

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
  const isDark = true // AetherDesk is primarily dark themed

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(defaultUnderlyings[defaultFnoExchange]?.[0] || '')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [gexData, setGexData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const requestIdRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-primary text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-primary/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-primary/5" : "bg-teal-500/5"

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
    setGexData(null)

    tradingService.getUnderlyings(selectedExchange).then((res) => {
      if (res.status === 'success' && res.underlyings.length > 0) {
        setUnderlyings(res.underlyings)
        if (!res.underlyings.includes(defaults[0])) {
          setSelectedUnderlying(res.underlyings[0])
        }
      }
    }).catch(() => toast({ variant: 'destructive', title: 'FAULT::ASSET_LOAD', description: 'Failed to synchronize underlying assets.' }))
  }, [selectedExchange])

  useEffect(() => {
    if (!selectedUnderlying) return
    setExpiries([])
    setSelectedExpiry('')
    setGexData(null)

    tradingService.getExpiries(selectedExchange, selectedUnderlying).then((res) => {
      if (res.status === 'success' && res.expiries.length > 0) {
        setExpiries(res.expiries)
        setSelectedExpiry(res.expiries[0])
      }
    }).catch(() => toast({ variant: 'destructive', title: 'FAULT::EXPIRY_LOAD', description: 'Failed to synchronize expiry dates.' }))
  }, [selectedUnderlying, selectedExchange])

  const fetchGEXData = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const response = await tradingService.getGEXData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: convertExpiryForAPI(selectedExpiry),
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setGexData(response)
      } else {
        toast({ variant: 'destructive', title: 'DATA_FAULT', description: response.message || 'Failed to fetch GEX telemetry.' })
      }
    } catch {
      if (requestIdRef.current !== requestId) return
      toast({ variant: 'destructive', title: 'WRITE_FAULT', description: 'Failed to connect to GEX telemetry node.' })
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange])

  useEffect(() => {
    if (selectedExpiry) fetchGEXData()
  }, [selectedExpiry, fetchGEXData])

  useEffect(() => {
    if (autoRefresh && selectedExpiry) {
      intervalRef.current = setInterval(fetchGEXData, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchGEXData, selectedExpiry])

  const themeColors = useMemo(() => ({
    bg: 'rgba(0,0,0,0)',
    paper: 'rgba(0,0,0,0)',
    text: '#ffffff',
    grid: 'rgba(255,255,255,0.05)',
    ceBar: '#f43f5e',
    peBar: '#10b981',
    positiveGex: '#10b981',
    negativeGex: isAD ? '#f59e0b' : '#f43f5e',
    atmLine: isAD ? '#f59e0b' : '#2dd4bf',
    hoverBg: '#0f172a',
    hoverFont: '#ffffff',
    hoverBorder: isAD ? 'rgba(255,176,0,0.5)' : 'rgba(20,184,166,0.5)', 
  }), [isAD])

  const plotConfig: Partial<PlotlyTypes.Config> = {
    displayModeBar: false,
    responsive: true,
  }

  const oiWallsPlot = useMemo(() => {
    if (!gexData?.chain) return { data: [], layout: {} }
    const lotSize = gexData.lot_size || 1
    const chain = gexData.chain
    const xIndices = chain.map((_, i) => i)
    const tickLabels = chain.map((item: any) => item.strike.toString())
    
    const data: PlotlyTypes.Data[] = [
      {
        x: xIndices,
        y: chain.map((item: any) => Math.round(item.ce_oi / lotSize)),
        type: 'bar',
        name: 'CE_OI [LOTS]',
        marker: { color: themeColors.ceBar },
      },
      {
        x: xIndices,
        y: chain.map((item: any) => Math.round(item.pe_oi / lotSize)),
        type: 'bar',
        name: 'PE_OI [LOTS]',
        marker: { color: themeColors.peBar },
      }
    ]

    const atmIndex = chain.findIndex((item: any) => item.strike === gexData.atm_strike)
    
    const layout: Partial<PlotlyTypes.Layout> = {
      paper_bgcolor: themeColors.paper,
      plot_bgcolor: themeColors.bg,
      font: { color: themeColors.text, family: 'JetBrains Mono, monospace', size: 10 },
      barmode: 'group',
      bargap: 0.2,
      showlegend: true,
      legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.2 },
      margin: { l: 40, r: 10, t: 20, b: 60 },
      xaxis: {
        tickmode: 'array',
        tickvals: xIndices.filter((_, i) => i % Math.max(1, Math.floor(chain.length/12)) === 0),
        ticktext: tickLabels.filter((_, i) => i % Math.max(1, Math.floor(chain.length/12)) === 0),
        gridcolor: themeColors.grid,
        tickangle: -45,
      },
      yaxis: { gridcolor: themeColors.grid },
      shapes: atmIndex >= 0 ? [{
        type: 'line', x0: atmIndex, x1: atmIndex, y0: 0, y1: 1, yref: 'paper',
        line: { color: themeColors.atmLine, width: 2, dash: 'dash' }
      }] : []
    }
    return { data, layout }
  }, [gexData, themeColors])

  const netGexPlot = useMemo(() => {
    if (!gexData?.chain) return { data: [], layout: {} }
    const chain = gexData.chain
    const xIndices = chain.map((_, i) => i)
    const netGexValues = chain.map((item: any) => item.net_gex)
    
    const data: PlotlyTypes.Data[] = [{
      x: xIndices,
      y: netGexValues,
      type: 'bar',
      marker: { color: netGexValues.map(v => v >= 0 ? themeColors.positiveGex : themeColors.negativeGex) },
      name: 'NET_GEX',
    }]

    const atmIndex = chain.findIndex((item: any) => item.strike === gexData.atm_strike)
    
    const layout: Partial<PlotlyTypes.Layout> = {
      paper_bgcolor: themeColors.paper,
      plot_bgcolor: themeColors.bg,
      font: { color: themeColors.text, family: 'JetBrains Mono, monospace', size: 10 },
      margin: { l: 40, r: 10, t: 20, b: 60 },
      xaxis: {
        tickmode: 'array',
        tickvals: xIndices.filter((_, i) => i % Math.max(1, Math.floor(chain.length/12)) === 0),
        ticktext: chain.map((item: any) => item.strike.toString()).filter((_, i) => i % Math.max(1, Math.floor(chain.length/12)) === 0),
        gridcolor: themeColors.grid,
        tickangle: -45,
      },
      yaxis: { gridcolor: themeColors.grid },
      shapes: atmIndex >= 0 ? [{
        type: 'line', x0: atmIndex, x1: atmIndex, y0: 0, y1: 1, yref: 'paper',
        line: { color: themeColors.atmLine, width: 2, dash: 'dash' }
      }] : []
    }
    return { data, layout }
  }, [gexData, themeColors])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <BarChart3 className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>GEX_Dashboard_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic">GAMMA_EXPOSURE // NODE::{selectedUnderlying || 'ASSET_SCAN'}</span>
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

          <div className="h-6 w-px bg-border/40 mx-2" />

          <Button variant={autoRefresh ? 'secondary' : 'outline'} size="sm" onClick={() => setAutoRefresh(!autoRefresh)} className="h-9 font-mono text-[11px] font-black uppercase">
            {autoRefresh ? 'AUTO_ON' : 'AUTO_OFF'}
          </Button>

          <Button onClick={fetchGEXData} disabled={isLoading} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} /> RE_SYNC
          </Button>
        </div>
      </div>

       {gexData && (
        <div className="flex flex-wrap gap-3">
          <Badge className={cn("bg-card/40 border-primary/20 font-mono text-[10px] px-3 py-1", primaryColorClass)}>SPOT::{gexData.spot_price?.toFixed(1)}</Badge>
          <Badge className="bg-card/40 text-muted-foreground border-border/20 font-mono text-[10px] px-3 py-1 uppercase">LOT_SIZE::{gexData.lot_size}</Badge>
          <Badge className={cn("bg-card/40 border-emerald-500/20 font-mono text-[10px] px-3 py-1", isAD ? "text-emerald-400" : "text-teal-400")}>PCR::{gexData.pcr_oi?.toFixed(2)}</Badge>
          <Badge className={cn("bg-card/40 border-primary/20 font-mono text-[10px] px-3 py-1 uppercase", primaryColorClass)}>ATM::{gexData.atm_strike}</Badge>
          <Badge className="bg-card/40 text-sky-400 border-sky-500/20 font-mono text-[10px] px-3 py-1">NET_GEX::{formatNumber(gexData.total_net_gex || 0)}</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AetherPanel className="p-0 border-2 border-border/40 bg-card/10 backdrop-blur-md relative overflow-hidden h-[450px]">
          <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
            <span className={cn("text-[10px] font-black font-mono uppercase tracking-[0.2em]", primaryColorClass)}>OI_Walls_Kernel // Analysis</span>
            <span className="text-[9px] font-mono text-muted-foreground/30 italic uppercase">LOT_NORMALIZED</span>
          </div>
          <div className="p-4 h-[400px]">
            {isLoading && !gexData ? (
              <div className="h-full flex items-center justify-center text-[11px] font-mono font-black text-muted-foreground animate-pulse tracking-widest uppercase">Initializing_Telemetry...</div>
            ) : (
              <Plot data={oiWallsPlot.data} layout={oiWallsPlot.layout} config={plotConfig} useResizeHandler style={{ width: '100%', height: '380px' }} />
            )}
          </div>
        </AetherPanel>

        <AetherPanel className="p-0 border-2 border-border/40 bg-card/10 backdrop-blur-md relative overflow-hidden h-[450px]">
          <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
            <span className={cn("text-[10px] font-black font-mono uppercase tracking-[0.2em]", primaryColorClass)}>Net_GEX_Exposure // Hypervisor</span>
            <span className="text-[9px] font-mono text-muted-foreground/30 italic uppercase">GAMMA_WEIGHTED</span>
          </div>
          <div className="p-4 h-[400px]">
             {isLoading && !gexData ? (
              <div className="h-full flex items-center justify-center text-[11px] font-mono font-black text-muted-foreground animate-pulse tracking-widest uppercase">Initializing_Telemetry...</div>
            ) : (
              <Plot data={netGexPlot.data} layout={netGexPlot.layout} config={plotConfig} useResizeHandler style={{ width: '100%', height: '380px' }} />
            )}
          </div>
        </AetherPanel>
      </div>

      {gexData?.chain && (
        <AetherPanel className="p-0 border-2 border-border/40 bg-card/10 backdrop-blur-md relative overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex justify-between items-center">
            <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-primary/60">Strike_Level_Exposure_Grid</span>
            <div className="flex gap-4">
               <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-widest">RESISTANCE::MAX_CE</span>
               <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest">SUPPORT::MAX_PE</span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
             <table className="w-full text-[11px] font-mono">
               <thead className="sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/60">
                 <tr>
                    <th className="text-left py-3 px-6 text-muted-foreground uppercase tracking-widest">Strike</th>
                    <th className="text-right py-3 px-6 text-rose-400 uppercase tracking-widest">Call GEX</th>
                    <th className="text-right py-3 px-6 text-emerald-400 uppercase tracking-widest">Put GEX</th>
                    <th className="text-right py-3 px-6 text-sky-400 uppercase tracking-widest">Net GEX</th>
                 </tr>
               </thead>
               <tbody>
                  {gexData.chain.map((item: any) => {
                    const isATM = item.strike === gexData.atm_strike
                    return (
                      <tr key={item.strike} className={cn('border-b border-border/20 hover:bg-white/5 transition-colors', isATM && 'bg-primary/10')}>
                         <td className="py-2.5 px-6 font-black">{item.strike} {isATM && <span className="ml-2 text-[9px] bg-primary text-black px-1">ATM</span>}</td>
                          <td className="py-2.5 px-6 text-right text-rose-400/80">{item.ce_gex.toFixed(2)}</td>
                          <td className="py-2.5 px-6 text-right text-emerald-400/80">{item.pe_gex.toFixed(2)}</td>
                          <td className={cn('py-2.5 px-6 text-right font-black', item.net_gex >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                            {item.net_gex >= 0 ? '+' : ''}{item.net_gex.toFixed(2)}
                          </td>
                      </tr>
                    )
                  })}
               </tbody>
                <tfoot className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t-2 border-border/60 font-black">
                   <tr className="bg-foreground/5">
                    <td className="py-3 px-6 uppercase tracking-widest text-[10px] font-black">AGGREGATE_TELEMETRY</td>
                     <td className="py-3 px-6 text-right text-rose-400">{gexData.total_ce_gex?.toFixed(2)}</td>
                     <td className="py-3 px-6 text-right text-emerald-400">{gexData.total_pe_gex?.toFixed(2)}</td>
                     <td className={cn('py-3 px-6 text-right text-[12px]', gexData.total_net_gex >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                       {gexData.total_net_gex >= 0 ? '+' : ''}{formatNumber(gexData.total_net_gex || 0)}
                     </td>
                   </tr>
                </tfoot>
             </table>
          </div>
        </AetherPanel>
      )}
    </div>
  )
}
