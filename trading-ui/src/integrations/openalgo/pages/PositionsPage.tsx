import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X, TrendingUp, TrendingDown, Target, ShieldAlert, Radio, Loader2, Activity } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tradingService } from '@/services/tradingService';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { toast } from 'sonner';

interface Position {
  symbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
  pnlpercent?: number;
}

export const PositionsPage: React.FC = () => {
  const { apiKey } = useAuthStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const fetchPositions = useCallback(async (showRefresh = false) => {
    if (!apiKey) return;
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const response = await tradingService.getPositions(apiKey);
      if (response.status === 'success') {
        setPositions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch positions', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(() => fetchPositions(), 5000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const handleClose = async (pos: Position) => {
    if (!apiKey) return;
    if (!window.confirm(`PROTOCOL_SIGNAL: SQUARE_OFF_POSITION for ${pos.symbol}?`)) return;
    setIsProcessing(pos.symbol);
    try {
      await tradingService.closePosition(pos.symbol, pos.exchange, pos.product);
      toast.success(`POSITION_${pos.symbol}_CLOSED`);
      fetchPositions(true);
    } catch (error) {
      toast.error("SQUARE_OFF_FAILED");
    } finally {
      setIsProcessing(null);
    }
  };

  const totalPnl = Array.isArray(positions) 
    ? positions.reduce((acc, pos) => acc + (pos.pnl || 0), 0)
    : 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Radio className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Exposure_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">REALTIME_LIQUIDITY // RISK_VECTOR_TRACKER</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right pr-4 border-r border-border/10 hidden md:block">
            <div className="text-[8px] font-mono text-muted-foreground/40 italic uppercase tracking-tighter">Net_Aggregator</div>
            <div className={cn("text-lg font-black font-mono tracking-tighter tabular-nums", totalPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
               ₹{totalPnl.toLocaleString()}
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={() => fetchPositions(true)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_POSITIONS
          </Button>
        </div>
      </div>

      <AetherPanel className={cn("p-0 border-border/10 overflow-hidden bg-background/20", accentBorderClass)}>
         <div className="p-6 border-b border-border/10 flex justify-between items-center bg-foreground/5">
            <div className="micro-label flex items-center gap-2">
               <Target className={cn("w-3.5 h-3.5", primaryColorClass)} /> Exposure_Command_Matrix
            </div>
            <Badge variant="outline" className="text-[7px] font-mono tracking-widest opacity-40 uppercase">V4_REALTIME_HOOKS</Badge>
         </div>
 
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-foreground/5">
                  <TableRow className="border-border/10 hover:bg-transparent uppercase font-mono text-[9px]">
                     <TableHead className="p-4 font-black">Symbol</TableHead>
                     <TableHead className="p-4 font-black">Segment</TableHead>
                     <TableHead className="p-4 font-black text-right">Quantity</TableHead>
                     <TableHead className="p-4 font-black text-right">Avg_Px</TableHead>
                     <TableHead className="p-4 font-black text-right">LTP</TableHead>
                     <TableHead className="p-4 font-black text-right">Net_PnL</TableHead>
                     <TableHead className="p-4 font-black text-right">Actions</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {positions.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={7} className="p-20 text-center opacity-20 italic uppercase tracking-[0.4em] font-mono text-[10px]">NO_EXPOSURE_INTERCEPTED</TableCell>
                    </TableRow>
                  ) : (
                    positions.map((pos, idx) => (
                      <tr key={`${pos.symbol}-${idx}`} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                         <td className="p-4 font-black font-mono text-[11px]">
                            <div className="flex flex-col">
                               <span>{pos.symbol}</span>
                               <span className="text-[7px] text-muted-foreground/40 uppercase tracking-widest">{pos.exchange}</span>
                            </div>
                         </td>
                         <td className="p-4">
                            <Badge variant="outline" className="text-[8px] border-border/10 font-mono italic opacity-60">{pos.product}</Badge>
                         </td>
                         <td className={cn("p-4 text-right font-mono font-black tabular-nums", pos.quantity > 0 ? "text-emerald-500" : "text-rose-500")}>
                            {pos.quantity}
                         </td>
                         <td className="p-4 text-right font-mono text-[10px] text-muted-foreground/60 tabular-nums">{pos.average_price.toFixed(2)}</td>
                         <td className={cn("p-4 text-right font-mono font-bold tabular-nums", primaryColorClass)}>{pos.ltp.toFixed(2)}</td>
                         <td className={cn("p-4 text-right font-mono font-black tabular-nums italic", pos.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {pos.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </td>
                         <td className="p-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleClose(pos)}
                              disabled={isProcessing === pos.symbol}
                              className="h-8 border border-border/10 text-[9px] uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/40 opacity-0 group-hover:opacity-100 transition-all font-mono"
                            >
                               {isProcessing === pos.symbol ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5 mr-2" />}
                               Square_Off
                            </Button>
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
