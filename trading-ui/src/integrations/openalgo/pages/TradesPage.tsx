import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Download, Zap, TrendingUp, TrendingDown, Loader2, History, Activity } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { useAppModeStore } from '@/stores/appModeStore';
import { cn } from '@/lib/utils';

interface Trade {
  orderid: string;
  symbol: string;
  exchange: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  average_price: number;
  trade_value: number;
  product: string;
  timestamp: string;
}

export const TradesPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTrades = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const response = await tradingService.getTrades(apiKey);
      if (response.status === 'success') {
        setTrades(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch trades', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(() => fetchTrades(), 10000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <History className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Execution_Audit_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">FIRM_TRADES_DB // ARCHIVE_V8_SYNC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => fetchTrades(true)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_TRADES
          </Button>
          <Button variant="outline" className="h-10 border-white/5 font-mono text-[10px] uppercase tracking-widest bg-background/40 hover:bg-neutral-800 transition-all rounded-none">
            <Download className="h-4 w-4 mr-2" />
            ARCHIVE_EXPORT
          </Button>
        </div>
      </div>

      <AetherPanel className={cn("p-0 border-border/10 overflow-hidden bg-background/20", accentBorderClass)}>
         <div className="p-6 border-b border-border/10 flex justify-between items-center bg-foreground/5">
            <div className="micro-label flex items-center gap-2">
               <Zap className={cn("w-3.5 h-3.5", primaryColorClass)} /> Fulfillment_Stream_Buffer
            </div>
            <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase">V5_AUDIT_READY</Badge>
         </div>

         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-foreground/5">
                  <TableRow className="border-border/10 hover:bg-transparent uppercase font-mono text-[9px]">
                     <TableHead className="p-4 font-black">Symbol</TableHead>
                     <TableHead className="p-4 font-black">Action</TableHead>
                     <TableHead className="p-4 font-black text-right">Qty</TableHead>
                     <TableHead className="p-4 font-black text-right">Exec_Price</TableHead>
                     <TableHead className="p-4 font-black text-right">Value</TableHead>
                     <TableHead className="p-4 font-black">Time</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={6} className="p-20 text-center opacity-20 italic uppercase tracking-[0.4em] font-mono text-[10px]">NO_SIGNALS_EXECUTED_IN_CURRENT_SESSION</TableCell>
                    </TableRow>
                  ) : (
                    trades.map((trade, idx) => (
                      <tr key={`${trade.orderid}-${idx}`} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                         <td className="p-4 font-black font-mono text-[11px]">
                            <div className="flex flex-col">
                               <span>{trade.symbol}</span>
                               <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest">{trade.exchange}</span>
                            </div>
                         </td>
                         <td className="p-4">
                            <div className="flex items-center gap-2">
                               {trade.action === 'BUY' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                               <span className={cn("text-[10px] font-black", trade.action === 'BUY' ? "text-emerald-500" : "text-rose-500")}>
                                 {trade.action}
                               </span>
                            </div>
                         </td>
                         <td className="p-4 text-right font-mono font-bold tabular-nums text-foreground/80">{trade.quantity}</td>
                         <td className={cn("p-4 text-right font-mono font-black tabular-nums italic", primaryColorClass)}>{trade.average_price.toFixed(2)}</td>
                         <td className="p-4 text-right font-mono font-bold tabular-nums opacity-80">₹{trade.trade_value.toLocaleString()}</td>
                         <td className="p-4 text-[9px] text-muted-foreground/60 font-mono italic">{trade.timestamp}</td>
                      </tr>
                    ))
                  )}
               </TableBody>
            </Table>
          </div>
       </AetherPanel>
    </div>
  );
};
