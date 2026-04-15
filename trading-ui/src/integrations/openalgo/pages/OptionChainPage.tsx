import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, RefreshCw, TrendingUp, Wifi, WifiOff, LayoutDashboard, Settings2, BarChart3, Presentation, Columns3 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useOptionChainLive } from '@/hooks/useOptionChainLive'
import { useOptionChainPreferences } from '@/hooks/useOptionChainPreferences'
import { tradingService } from '@/services/tradingService'
import type { BarDataSource, BarStyle, ColumnKey, OptionStrike } from '@/integrations/openalgo/types/option-chain'
import { COLUMN_DEFINITIONS } from '@/integrations/openalgo/types/option-chain'
import { BarSettingsDropdown, ColumnConfigDropdown, ColumnReorderPanel } from '../components/option-chain'
import { NewOrderModal } from '@/components/trading/NewOrderModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AetherPanel } from '@/components/ui/AetherPanel'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/lib/utils'

const STRIKE_COUNTS = [
  { value: 5, label: '5 STRIKES' },
  { value: 10, label: '10 STRIKES' },
  { value: 15, label: '15 STRIKES' },
  { value: 20, label: '20 STRIKES' },
  { value: 25, label: '25 STRIKES' },
]

function formatInLakhs(num: number | undefined | null): string {
  if (num === undefined || num === null || num === 0) return '0'
  const lakhs = num / 100000
  if (lakhs >= 100) return lakhs.toFixed(0) + 'L'
  if (lakhs >= 10) return lakhs.toFixed(1) + 'L'
  if (lakhs >= 1) return lakhs.toFixed(2) + 'L'
  const thousands = num / 1000
  if (thousands >= 1) return thousands.toFixed(1) + 'K'
  return num.toLocaleString()
}

function formatPrice(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0.00'
  return num.toFixed(2)
}

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

const OptionChainRow = React.memo(function OptionChainRow({
  strike,
  previousStrike,
  maxBarValue,
  visibleCeColumns,
  visiblePeColumns,
  barDataSource,
  barStyle,
  optionExchange,
  onPlaceOrder,
  isAD,
}: {
  strike: OptionStrike
  previousStrike: OptionStrike | undefined
  maxBarValue: number
  visibleCeColumns: ColumnKey[]
  visiblePeColumns: ColumnKey[]
  barDataSource: BarDataSource
  barStyle: BarStyle
  optionExchange: string
  onPlaceOrder: (symbol: string, side: 'BUY' | 'SELL') => void
  isAD: boolean
}) {
  const primaryColor = isAD ? "text-amber-500" : "text-teal-500"
  const buyColor = isAD ? "bg-emerald-600" : "bg-teal-600"
  const sellColor = isAD ? "bg-rose-600" : "bg-rose-700"
  const ce = strike.ce
  const pe = strike.pe
  const label = ce?.label ?? pe?.label ?? ''
  const isATM = label === 'ATM'
  const isCeOTM = label.startsWith('OTM')
  const isPeOTM = label.startsWith('ITM')

  const ceLtpChanged = previousStrike?.ce?.ltp !== undefined && previousStrike.ce.ltp !== ce?.ltp
  const peLtpChanged = previousStrike?.pe?.ltp !== undefined && previousStrike.pe.ltp !== pe?.ltp

  const ceFlashClass = ceLtpChanged ? (ce && previousStrike?.ce && ce.ltp > previousStrike.ce.ltp ? (isAD ? 'text-emerald-400 font-bold' : 'text-teal-400 font-bold') : 'text-rose-500 font-bold') : ''
  const peFlashClass = peLtpChanged ? (pe && previousStrike?.pe && pe.ltp > previousStrike.pe.ltp ? (isAD ? 'text-emerald-400 font-bold' : 'text-teal-400 font-bold') : 'text-rose-500 font-bold') : ''

  const ceSpread = ce && ce.bid > 0 && ce.ask > 0 ? ce.ask - ce.bid : 0
  const peSpread = pe && pe.bid > 0 && pe.ask > 0 ? pe.ask - pe.bid : 0

  const ceBarValue = barDataSource === 'oi' ? ce?.oi : ce?.volume
  const peBarValue = barDataSource === 'oi' ? pe?.oi : pe?.volume
  const ceBarPercent = ceBarValue ? Math.min((ceBarValue / maxBarValue) * 100, 100) : 0
  const peBarPercent = peBarValue ? Math.min((peBarValue / maxBarValue) * 100, 100) : 0

  const ceBarClass = barStyle === 'gradient' ? cn('bg-gradient-to-r from-transparent', isAD ? 'to-amber-500/20' : 'to-teal-500/20') : (isAD ? 'bg-amber-500/10' : 'bg-teal-500/10')
  const peBarClass = barStyle === 'gradient' ? cn('bg-gradient-to-l from-transparent', isAD ? 'to-rose-500/20' : 'to-rose-500/20') : 'bg-rose-500/10'

  const numClass = 'font-mono tabular-nums text-[11px] tracking-tight'

  return (
    <TableRow className="hover:bg-muted/10 group h-10 border-b border-border/40">
      <TableCell className={cn('p-0 relative', isCeOTM && !isATM && (isAD ? 'bg-amber-500/5' : 'bg-teal-500/5'))}>
        <div className={cn('absolute left-0 top-0 bottom-0 pointer-events-none z-0 transition-all duration-300', ceBarClass)} style={{ width: `${ceBarPercent}%` }} />
        {ce && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onPlaceOrder(ce.symbol, 'BUY')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-emerald-600 shadow-emerald-900/40" : "bg-teal-600 shadow-teal-900/40")}>B</button>
            <button onClick={() => onPlaceOrder(ce.symbol, 'SELL')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-amber-600 shadow-amber-900/40" : "bg-rose-600 shadow-rose-900/40")}>S</button>
          </div>
        )}
        <div className="relative z-10 flex">
          {visibleCeColumns.map(key => (
            <div key={key} className="flex-1 px-2 py-2 text-right">
              {key === 'ce_oi' && <span className={numClass}>{formatInLakhs(ce?.oi)}</span>}
              {key === 'ce_volume' && <span className={numClass}>{formatInLakhs(ce?.volume)}</span>}
              {key === 'ce_ltp' && <span className={cn(numClass, ceFlashClass)}>{formatPrice(ce?.ltp)}</span>}
              {/* Add other columns as needed matching the keys */}
              {key === 'ce_spread' && <span className={numClass}>{formatPrice(ceSpread)}</span>}
              {['ce_delta', 'ce_gamma', 'ce_theta', 'ce_vega', 'ce_iv'].includes(key) && (
                 <span className={cn(numClass, isAD ? 'text-amber-400' : 'text-teal-400')}>
                   {formatPrice(ce ? (ce as any)[key.replace('ce_', '')] : 0)}
                 </span>
              )}
              {['ce_bid', 'ce_ask', 'ce_bid_qty', 'ce_ask_qty'].includes(key) && (
                 <span className={cn(numClass, key.includes('bid') ? 'text-rose-400' : 'text-teal')}>
                   {formatPrice(ce ? (ce as any)[key.replace('ce_', '')] : 0)}
                 </span>
              )}
            </div>
          ))}
        </div>
      </TableCell>

      <TableCell className={cn('text-center font-black px-2 py-2 text-[11px] font-mono w-24 border-x border-border/60', isATM ? (isAD ? 'bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(255,176,0,0.2)]' : 'bg-teal-500/20 text-teal-500 shadow-[inset_0_0_10px_rgba(20,184,166,0.2)]') : 'bg-foreground/5 text-muted-foreground')}>
        {strike.strike}
      </TableCell>

      <TableCell className={cn('p-0 relative', isPeOTM && !isATM && 'bg-rose-500/5')}>
        <div className={cn('absolute right-0 top-0 bottom-0 pointer-events-none z-0 transition-all duration-300', peBarClass)} style={{ width: `${peBarPercent}%` }} />
        {pe && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onPlaceOrder(pe.symbol, 'BUY')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-emerald-600 shadow-emerald-900/40" : "bg-teal-600 shadow-teal-900/40")}>B</button>
            <button onClick={() => onPlaceOrder(pe.symbol, 'SELL')} className={cn("px-2 py-0.5 text-[9px] font-black rounded text-white shadow-lg", isAD ? "bg-amber-600 shadow-amber-900/40" : "bg-rose-600 shadow-rose-900/40")}>S</button>
          </div>
        )}
        <div className="relative z-10 flex">
          {visiblePeColumns.map(key => (
            <div key={key} className="flex-1 px-2 py-2 text-left">
              {key === 'pe_ltp' && <span className={cn(numClass, peFlashClass)}>{formatPrice(pe?.ltp)}</span>}
              {key === 'pe_oi' && <span className={numClass}>{formatInLakhs(pe?.oi)}</span>}
              {key === 'pe_volume' && <span className={numClass}>{formatInLakhs(pe?.volume)}</span>}
              {/* Add other columns */}
              {key === 'pe_spread' && <span className={numClass}>{formatPrice(peSpread)}</span>}
              {['pe_delta', 'pe_gamma', 'pe_theta', 'pe_vega', 'pe_iv'].includes(key) && (
                 <span className={cn(numClass, isAD ? 'text-amber-400' : 'text-teal-400')}>
                   {formatPrice(pe ? (pe as any)[key.replace('pe_', '')] : 0)}
                 </span>
              )}
              {['pe_bid', 'pe_ask', 'pe_bid_qty', 'pe_ask_qty'].includes(key) && (
                 <span className={cn(numClass, key.includes('bid') ? 'text-rose-400' : 'text-teal')}>
                   {formatPrice(pe ? (pe as any)[key.replace('pe_', '')] : 0)}
                 </span>
              )}
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
})

export default function OptionChainPage() {
  const { toast } = useToast()
  const { apiKey } = useAuthStore()
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColorClass = isAD ? "text-primary text-amber-500" : "text-teal-500"
  const accentBorderClass = isAD ? "border-primary/20" : "border-teal-500/20"
  const accentBgClass = isAD ? "bg-primary/5" : "bg-teal-500/5"
  const { fnoExchanges, defaultFnoExchange, defaultUnderlyings } = useSupportedExchanges()
  const {
    preferences,
    updatePreferences
  } = useOptionChainPreferences()

  const { visibleColumns, columnOrder, strikeCount, selectedUnderlying, barDataSource, barStyle } = preferences

  const toggleColumn = (key: ColumnKey) => {
    const newColumns = visibleColumns.includes(key) 
      ? visibleColumns.filter(c => c !== key) 
      : [...visibleColumns, key]
    updatePreferences({ visibleColumns: newColumns })
  }

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(defaultUnderlyings[defaultFnoExchange] || [])
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [expiries, setExpiries] = useState<string[]>([])
  const previousDataRef = useRef<Map<number, OptionStrike>>(new Map())
  
  const [orderModal, setOrderModal] = useState<{ open: boolean, symbol: string, side: 'BUY' | 'SELL' }>({
    open: false,
    symbol: '',
    side: 'BUY'
  })

  useEffect(() => {
    setSelectedExchange(prev => fnoExchanges.some(ex => ex.value === prev) ? prev : defaultFnoExchange)
  }, [defaultFnoExchange, fnoExchanges])

  const { data, isConnected, isLoading, error, refetch } = useOptionChainLive(
    apiKey,
    selectedUnderlying,
    selectedExchange,
    selectedExchange,
    convertExpiryForAPI(selectedExpiry),
    strikeCount,
    { enabled: !!selectedExpiry }
  )

  useEffect(() => {
    const defaults = defaultUnderlyings[selectedExchange] || []
    setUnderlyings(defaults)
    updatePreferences({ selectedUnderlying: defaults[0] || '' })
    setExpiries([])
    setSelectedExpiry('')

    tradingService.getUnderlyings(selectedExchange).then(res => {
      if (res.status === 'success' && res.underlyings.length > 0) {
        setUnderlyings(res.underlyings)
        if (!res.underlyings.includes(defaults[0])) {
          updatePreferences({ selectedUnderlying: res.underlyings[0] })
        }
      }
    }).catch(() => {})
  }, [selectedExchange])

  useEffect(() => {
    if (!selectedUnderlying) return
    tradingService.getExpiries(selectedExchange, selectedUnderlying).then(res => {
      if (res.status === 'success' && res.expiries.length > 0) {
        setExpiries(res.expiries)
        setSelectedExpiry(res.expiries[0])
      }
    }).catch(() => toast({ variant: 'destructive', title: 'FAULT::EXPIRY_LOAD', description: 'Failed to synchronize expiry dates.' }))
  }, [selectedUnderlying, selectedExchange])

  useEffect(() => {
    if (data?.chain) {
      const timeoutId = setTimeout(() => {
        const newMap = new Map<number, OptionStrike>()
        data.chain.forEach(s => newMap.set(s.strike, s))
        previousDataRef.current = newMap
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [data?.chain])

  const visibleCeColumns = useMemo(() => columnOrder.filter(k => {
    const col = COLUMN_DEFINITIONS.find(c => c.key === k)
    return col?.side === 'ce' && visibleColumns.includes(k)
  }), [columnOrder, visibleColumns])

  const visiblePeColumns = useMemo(() => columnOrder.filter(k => {
    const col = COLUMN_DEFINITIONS.find(c => c.key === k)
    return col?.side === 'pe' && visibleColumns.includes(k)
  }), [columnOrder, visibleColumns])

  const totals = useMemo(() => {
    let ceOi = 0, peOi = 0
    data?.chain?.forEach(s => {
      ceOi += s.ce?.oi ?? 0
      peOi += s.pe?.oi ?? 0
    })
    const pcr = ceOi === 0 ? 0 : peOi / ceOi
    return { ceOi, peOi, pcr }
  }, [data?.chain])

  const maxBarValue = useMemo(() => {
    let max = 1
    data?.chain?.forEach(s => {
      const v1 = barDataSource === 'oi' ? s.ce?.oi : s.ce?.volume
      const v2 = barDataSource === 'oi' ? s.pe?.oi : s.pe?.volume
      if (v1 && v1 > max) max = v1
      if (v2 && v2 > max) max = v2
    })
    return max
  }, [data?.chain, barDataSource])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Badge variant="destructive" className="font-black tracking-widest px-4 py-1">READ_FAULT::OPTION_CHAIN</Badge>
        <p className="text-muted-foreground font-mono text-sm max-w-md text-center">{error}</p>
        <Button onClick={() => refetch()} variant="outline" className="border-2 border-primary/20 hover:border-primary">
          <RefreshCw className="w-4 h-4 mr-2" /> RE_INITIALIZE
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", isAD ? "border-primary/40 shadow-primary/20" : "border-teal-500/40 shadow-teal-500/20")}>
            <TrendingUp className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Option_Chain_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', isConnected ? (isAD ? 'bg-amber-500 shadow-[0_0_5px_rgba(255,176,0,0.5)]' : 'bg-teal-500 shadow-[0_0_5px_rgba(20,184,166,0.5)]') : 'bg-rose-500')} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic">
                {isConnected ? 'STREAM_LINKED' : 'STREAM_OFFLINE'} // NODE::{selectedUnderlying}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-card/20 p-2 border border-border/40 rounded-sm">
          <Select value={selectedExchange} onValueChange={setSelectedExchange}>
            <SelectTrigger className="w-24 font-mono text-[11px] font-black h-9 border-border/40 bg-background/50">
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
            <PopoverContent className="w-48 p-0 border-border shadow-2xl" align="start">
              <Command className="bg-background">
                <CommandInput placeholder="Search ticker..." className="font-mono text-xs" />
                <CommandList>
                  <CommandEmpty className="p-4 text-[10px] font-mono uppercase text-muted-foreground/40">Not found</CommandEmpty>
                  <CommandGroup>
                    {underlyings.map(u => (
                      <CommandItem key={u} value={u} onSelect={() => { updatePreferences({ selectedUnderlying: u }); setUnderlyingOpen(false); }} className="font-mono text-[11px] font-black">
                        <Check className={cn('mr-2 h-3 w-3', selectedUnderlying === u ? 'opacity-100' : 'opacity-0')} />
                        {u}
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

          <Select value={String(strikeCount)} onValueChange={v => updatePreferences({ strikeCount: Number(v) })}>
            <SelectTrigger className="w-32 font-mono text-[11px] font-black h-9 border-border/40 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRIKE_COUNTS.map(sc => <SelectItem key={sc.value} value={String(sc.value)} className="text-[11px] font-mono font-black">{sc.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <BarSettingsDropdown 
            barDataSource={barDataSource} barStyle={barStyle}
            onBarDataSourceChange={v => updatePreferences({ barDataSource: v })}
            onBarStyleChange={v => updatePreferences({ barStyle: v })}
          />
          <ColumnConfigDropdown visibleColumns={visibleColumns} onToggleColumn={toggleColumn} onResetToDefaults={() => updatePreferences({ visibleColumns: COLUMN_DEFINITIONS.filter(c => c.defaultVisible).map(c => c.key) })} />
          <ColumnReorderPanel columnOrder={columnOrder} visibleColumns={visibleColumns} onReorderColumns={v => updatePreferences({ columnOrder: v })} />
          
          <Button onClick={() => refetch()} variant="secondary" className="h-9 font-mono text-[11px] font-black px-4 ml-2 shadow-[0_0_15px_rgba(255,176,0,0.1)]">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} /> RE_SYNC
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Metrics Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AetherPanel className={cn("p-4 border-2", isAD ? "border-primary/20" : "border-teal-500/20")}>
               <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest opacity-40 mb-1", primaryColorClass)}>SPOT_VALUATION</div>
               <div className="text-2xl font-black font-mono tracking-tighter text-foreground">{formatPrice(data.underlying_ltp)}</div>
               <div className={cn('text-[9px] font-mono font-bold mt-1 uppercase italic', data.underlying_ltp >= data.underlying_prev_close ? 'text-emerald-500' : 'text-rose-500')}>
                 {data.underlying_ltp >= data.underlying_prev_close ? '+' : ''}{(data.underlying_ltp - data.underlying_prev_close).toFixed(2)} [{( (data.underlying_ltp - data.underlying_prev_close) / data.underlying_prev_close * 100).toFixed(2)}%]
               </div>
            </AetherPanel>
 
            <AetherPanel className={cn("p-4 border-2", isAD ? "border-primary/20" : "border-teal-500/20")}>
               <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest opacity-40 mb-1", primaryColorClass)}>EQUILIBRIUM_STRIKE</div>
               <div className="text-2xl font-black font-mono tracking-tighter">{data.atm_strike}</div>
               <div className="text-[9px] font-mono font-bold text-muted-foreground/40 mt-1 uppercase tracking-widest">EXPIRY::{selectedExpiry}</div>
            </AetherPanel>
 
            <AetherPanel className={cn("p-4 border-2", isAD ? "border-primary/20" : "border-teal-500/20")}>
               <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest opacity-40 mb-1", primaryColorClass)}>PCR_SENTIMENT</div>
               <div className={cn('text-2xl font-black font-mono tracking-tighter', totals.pcr > 1.2 ? 'text-emerald-500' : totals.pcr < 0.8 ? 'text-rose-500' : primaryColorClass)}>
                  {totals.pcr.toFixed(2)}
               </div>
               <div className="text-[9px] font-mono font-bold text-muted-foreground/40 mt-1 uppercase tracking-widest">VOL_PUT_CALL_RATIO</div>
            </AetherPanel>
 
            <AetherPanel className={cn("p-4 border-2", isAD ? "border-primary/20" : "border-teal-500/20")}>
               <div className="flex justify-between items-center mb-1">
                 <div className={cn("text-[10px] font-black font-mono uppercase tracking-widest opacity-40", primaryColorClass)}>DEPTH_SCAN</div>
                 <div className="text-[9px] font-mono font-bold text-muted-foreground/30 italic uppercase">OI_DISTRIBUTION</div>
               </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("text-[11px] font-mono font-black", isAD ? "text-emerald-500" : "text-teal-500")}>{formatInLakhs(totals.ceOi)}</span>
                  <div className="flex-1 h-2 bg-foreground/5 rounded-none overflow-hidden flex">
                    <div className={cn("h-full", isAD ? "bg-emerald-500" : "bg-teal-500")} style={{ width: `${(totals.ceOi / (totals.ceOi + totals.peOi)) * 100}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${(totals.peOi / (totals.ceOi + totals.peOi)) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-mono font-black text-rose-500">{formatInLakhs(totals.peOi)}</span>
                </div>
            </AetherPanel>
          </div>

          {/* Grid Panel */}
          <AetherPanel className="p-0 overflow-hidden border-2 border-border/40 bg-card/10 backdrop-blur-md relative">
            <div className="scanline pointer-events-none opacity-5" />
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-card/40 border-b-2 border-border/60 hover:bg-transparent h-12">
                    <TableHead className={cn("text-center font-black text-[10px] uppercase tracking-[0.4em] border-r border-border/60", primaryColorClass)}>Call_Side_Intelligence</TableHead>
                    <TableHead className={cn("w-24 text-center font-black text-[10px] uppercase tracking-[0.2em]", isAD ? "bg-primary/10 text-primary" : "bg-teal-500/10 text-teal-500")}>Strike</TableHead>
                    <TableHead className="text-center font-black text-[10px] uppercase tracking-[0.4em] text-rose-500 border-l border-border/60">Put_Side_Intelligence</TableHead>
                  </TableRow>
                  <TableRow className="bg-background/20 hover:bg-transparent h-8 border-b border-border/40">
                    <TableHead className="p-0 border-r border-border/60">
                      <div className="flex">
                        {visibleCeColumns.map(key => (
                          <div key={key} className="flex-1 px-2 py-1 text-[9px] font-black text-muted-foreground/40 text-right uppercase tracking-widest italic">{COLUMN_DEFINITIONS.find(c => c.key === key)?.label}</div>
                        ))}
                      </div>
                    </TableHead>
                    <TableHead />
                    <TableHead className="p-0 border-l border-border/60">
                      <div className="flex">
                        {visiblePeColumns.map(key => (
                          <div key={key} className="flex-1 px-2 py-1 text-[9px] font-black text-muted-foreground/40 text-left uppercase tracking-widest italic">{COLUMN_DEFINITIONS.find(c => c.key === key)?.label}</div>
                        ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.chain.map((row, idx) => (
                    <OptionChainRow 
                      key={row.strike}
                      strike={row}
                      previousStrike={previousDataRef.current.get(row.strike)}
                      maxBarValue={maxBarValue}
                      visibleCeColumns={visibleCeColumns}
                      visiblePeColumns={visiblePeColumns}
                      barDataSource={barDataSource}
                      barStyle={barStyle}
                      optionExchange={selectedExchange}
                      onPlaceOrder={(sym, side) => setOrderModal({ open: true, symbol: sym, side })}
                      isAD={isAD}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </AetherPanel>
          
          <div className="flex justify-between items-center px-2">
            <div className="flex gap-4">
              <span className="text-[9px] font-mono text-muted-foreground/30 font-black uppercase tracking-widest">MODE::HYBRID_STREAM</span>
              <span className="text-[9px] font-mono text-muted-foreground/30 font-black uppercase tracking-widest">SYMBOLS::{data.chain.length * 2 + 1}</span>
            </div>
            <div className="text-[9px] font-mono text-primary/40 font-black uppercase tracking-widest">
              LST_SYNC::{new Date().toLocaleTimeString()} :: REFRESH::{preferences.strikeCount}
            </div>
          </div>
        </>
      )}

      <NewOrderModal 
        isOpen={orderModal.open} 
        onClose={() => setOrderModal(prev => ({ ...prev, open: false }))} 
        prefilledSymbol={orderModal.symbol}
      />
    </div>
  )
}
