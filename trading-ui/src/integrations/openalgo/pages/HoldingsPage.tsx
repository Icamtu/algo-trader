import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Download, TrendingUp, TrendingDown, Briefcase, Activity } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';

interface Holding {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
  pnlpercent: number;
  product: string;
}

export const HoldingsPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const fetchHoldings = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const response = await tradingService.getHoldings(apiKey);
      if (response.status === 'success') {
        setHoldings(response.data.holdings || []);
        setStats(response.data.statistics);
      }
    } catch (error) {
      console.error('Failed to fetch holdings', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchHoldings();
    const interval = setInterval(() => fetchHoldings(), 30000);
    return () => clearInterval(interval);
  }, [fetchHoldings]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Briefcase className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Inventory_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">ALPHA_ALLOCATION // VAULT_INTEGRity</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right pr-4 border-r border-border/10 hidden md:block">
            <div className="text-[8px] font-mono text-muted-foreground/40 italic uppercase tracking-tighter">Current_Mark</div>
            <div className={cn("text-lg font-black font-mono tracking-tighter tabular-nums", primaryColorClass)}>
               ₹{stats?.totalholdingvalue?.toLocaleString() || '0'}
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={() => fetchHoldings(true)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_VAULT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <AetherPanel className={cn("border-border/10 bg-background/20 group hover:border-emerald-500/20 transition-all", (stats?.totalprofitandloss || 0) >= 0 ? "border-emerald-500/10" : "border-rose-500/10")}>
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <div className="micro-label text-muted-foreground/40 italic">Portfolio_Alpha</div>
                  <div className={cn("text-3xl font-black font-mono tracking-tighter", (stats?.totalprofitandloss || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                     {(stats?.totalprofitandloss || 0) >= 0 ? "+" : ""}{stats?.totalprofitandloss?.toLocaleString() || '0'}
                  </div>
               </div>
               <Activity className={cn("w-5 h-5 opacity-20", (stats?.totalprofitandloss || 0) >= 0 ? "text-emerald-500" : "text-rose-500")} />
            </div>
         </AetherPanel>
 
         <AetherPanel className={cn("border-border/10 bg-background/20 group hover:border-primary/20 transition-all", (stats?.totalpnlpercentage || 0) >= 0 ? isAD ? "border-primary/10" : "border-teal-500/10" : "border-rose-500/10")}>
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <div className="micro-label text-muted-foreground/40 italic">Yield_Vector_Identity</div>
                  <div className={cn("text-3xl font-black font-mono tracking-tighter", (stats?.totalpnlpercentage || 0) >= 0 ? primaryColorClass : "text-rose-500")}>
                     {(stats?.totalpnlpercentage || 0) >= 0 ? "+" : ""}{stats?.totalpnlpercentage?.toFixed(2) || '0'}%
                  </div>
               </div>
               <TrendingUp className={cn("w-5 h-5 opacity-20", (stats?.totalpnlpercentage || 0) >= 0 ? primaryColorClass : "text-rose-500")} />
            </div>
         </AetherPanel>
      </div>

      <AetherPanel className={cn("p-0 border-border/10 overflow-hidden bg-background/20", accentBorderClass)}>
         <div className="p-6 border-b border-border/10 flex justify-between items-center bg-foreground/5">
            <div className="micro-label flex items-center gap-2">
               <Download className={cn("w-3.5 h-3.5", primaryColorClass)} /> Vault_Asset_Matrix
            </div>
            <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase">V5_COLDINIT_CACHE</Badge>
         </div>
 
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-foreground/5">
                  <TableRow className="border-border/10 hover:bg-transparent uppercase font-mono text-[9px]">
                     <TableHead className="p-4 font-black">Symbol</TableHead>
                     <TableHead className="p-4 font-black text-right">Quantity</TableHead>
                     <TableHead className="p-4 font-black text-right">Avg_Px</TableHead>
                     <TableHead className="p-4 font-black text-right">LTP</TableHead>
                     <TableHead className="p-4 font-black text-right">Net_PnL</TableHead>
                     <TableHead className="p-4 font-black text-right">Yield%</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {holdings.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={6} className="p-20 text-center opacity-20 italic uppercase tracking-[0.4em] font-mono text-[10px]">NO_VAULT_ASSETS_FOUND</TableCell>
                    </TableRow>
                  ) : (
                    holdings.map((h, idx) => (
                      <tr key={`${h.symbol}-${idx}`} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                         <td className="p-4 font-black font-mono text-[11px]">
                            <div className="flex flex-col">
                               <span>{h.symbol}</span>
                               <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest">{h.exchange}</span>
                            </div>
                         </td>
                         <td className="p-4 text-right font-mono font-bold tabular-nums text-foreground/80">{h.quantity}</td>
                         <td className="p-4 text-right font-mono text-[10px] text-muted-foreground/60 tabular-nums">{h.average_price.toFixed(2)}</td>
                         <td className={cn("p-4 text-right font-mono font-bold tabular-nums", primaryColorClass)}>{h.ltp.toFixed(2)}</td>
                         <td className={cn("p-4 text-right font-mono font-black tabular-nums italic", h.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </td>
                         <td className={cn("p-4 text-right font-mono text-[10px] font-black tabular-nums", h.pnlpercent >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {h.pnlpercent?.toFixed(2)}%
                         </td>
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
