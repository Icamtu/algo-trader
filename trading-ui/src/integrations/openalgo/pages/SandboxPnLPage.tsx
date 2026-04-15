import React, { useEffect, useState } from 'react';
import { BarChart3, Calendar, Briefcase, Package, Activity, Download, Settings, ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCw } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { tradingService } from '@/services/tradingService';
import { IndustrialValue } from '@/components/trading/IndustrialValue';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAppModeStore } from '@/stores/appModeStore';

interface Summary {
  today_realized_pnl: number;
  positions_unrealized_pnl: number;
  holdings_unrealized_pnl: number;
  today_total_mtm: number;
  all_time_realized_pnl: number;
}

interface SandboxData {
  summary: Summary;
  daily_pnl: any[];
  positions: any[];
  holdings: any[];
  trades: any[];
}

export const SandboxPnLPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [data, setData] = useState<SandboxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('daily');

  const fetchData = async () => {
    try {
      const res = await tradingService.getSandboxPnLData();
      if (res.status === 'success') {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load sandbox pnl data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <BarChart3 className={cn("w-10 h-10 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  const summary = data?.summary || {
    today_realized_pnl: 0,
    positions_unrealized_pnl: 0,
    holdings_unrealized_pnl: 0,
    today_total_mtm: 0,
    all_time_realized_pnl: 0,
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <BarChart3 className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Simulation_Analytics_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">HISTORICAL_PNL_VECTOR // MTM_AUDIT_STREAM</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={fetchData} 
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> 
            RE_CALC_MTM
          </Button>
          <Button asChild variant="outline" className="h-10 border-border/10 font-mono text-[10px] uppercase tracking-widest bg-background/40">
            <Link to="/openalgo/sandbox">
              <Settings className="w-4 h-4 mr-2" />
              BACK_TO_CONFIG
            </Link>
          </Button>
        </div>
      </div>

       {/* Summary Matrix */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {[
            { label: "Today_Realized", value: summary.today_realized_pnl, badge: "DAILY" },
            { label: "Positions_MTM", value: summary.positions_unrealized_pnl, badge: "UNREALIZED" },
            { label: "Holdings_MTM", value: summary.holdings_unrealized_pnl, badge: "UNREALIZED" },
            { label: "Aggregate_MTM", value: summary.today_total_mtm, badge: "SESSION", highlight: true },
            { label: "Lifetime_PnL", value: summary.all_time_realized_pnl, badge: "LIFETIME" },
          ].map((item, i) => (
            <AetherPanel key={i} className={cn("border-border/10 bg-background/40 group", item.highlight && (isAD ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(255,176,0,0.05)]" : "border-teal-500/40 bg-teal-500/5 shadow-[0_0_20px_rgba(20,184,166,0.05)]"))}>
               <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                     <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest mb-1">{item.label}</span>
                     <IndustrialValue 
                       value={item.value} 
                       className={cn("text-xl font-black", item.value >= 0 ? "text-emerald-500" : "text-rose-500")} 
                       prefix="₹"
                     />
                  </div>
                  <Badge variant="outline" className="text-[7px] font-mono border-border/10 opacity-40 group-hover:opacity-100 transition-opacity uppercase">{item.badge}</Badge>
               </div>
               <div className="h-[1px] w-full bg-border/10 relative overflow-hidden">
                  <div className={cn("absolute inset-0 origin-left animate-glint", item.value >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
               </div>
            </AetherPanel>
          ))}
       </div>

       {/* Data Terminal */}
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-background/40 border border-border/10 p-1 h-auto grid grid-cols-2 md:grid-cols-4 gap-1">
             {[
               { id: 'daily', icon: Calendar, label: "Temporal_PnL" },
               { id: 'positions', icon: Briefcase, label: "Active_Nodes" },
               { id: 'holdings', icon: Package, label: "Vault_Inventory" },
               { id: 'trades', icon: Activity, label: "Op_Logs" },
             ].map(tab => (
               <TabsTrigger 
                 key={tab.id} 
                 value={tab.id}
                 className={cn(
                   "data-[state=active]:text-black font-mono text-[9px] uppercase tracking-widest py-3 rounded-none transition-all",
                   isAD ? "data-[state=active]:bg-primary" : "data-[state=active]:bg-teal-500"
                 )}
               >
                  <tab.icon className="w-3.5 h-3.5 mr-2" />
                  {tab.label}
               </TabsTrigger>
             ))}
          </TabsList>

          <TabsContent value="daily">
             <AetherPanel className="border-border/10 bg-background/20 p-0 overflow-hidden">
                <div className="p-6 border-b border-border/10 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <Calendar className={cn("w-4 h-4", primaryColorClass)} />
                      <h3 className="text-xs font-black font-mono uppercase tracking-widest">Temporal_Report_Matrix</h3>
                   </div>
                   <Button variant="ghost" size="sm" className="h-8 border border-border/10 font-mono text-[8px] uppercase tracking-widest opacity-40 hover:opacity-100">
                      <Download className="w-3 h-3 mr-2" /> Export_Data
                   </Button>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left font-mono text-[10px]">
                      <thead>
                         <tr className="border-b border-border/10 bg-foreground/5 uppercase tracking-tighter">
                            <th className="p-4 font-black text-muted-foreground/60">Sync_Date</th>
                            <th className="p-4 font-black text-right text-muted-foreground/60">Realized</th>
                            <th className="p-4 font-black text-right text-muted-foreground/60">Unrealized</th>
                            <th className="p-4 font-black text-right text-muted-foreground/60">Total_MTM</th>
                            <th className={cn("p-4 font-black text-right", primaryColorClass)}>Portfolio_Val</th>
                         </tr>
                      </thead>
                      <tbody>
                         {data?.daily_pnl.map((day, i) => (
                           <tr key={i} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                              <td className="p-4 font-black text-muted-foreground group-hover:text-foreground italic">{day.date}</td>
                              <td className="p-4 text-right italic">
                                 <IndustrialValue value={day.realized_pnl} className={cn(day.realized_pnl >= 0 ? "text-emerald-500" : "text-rose-500")} />
                              </td>
                              <td className="p-4 text-right italic">
                                 <IndustrialValue value={day.total_unrealized} className={cn(day.total_unrealized >= 0 ? "text-emerald-500" : "text-rose-500")} />
                              </td>
                              <td className="p-4 text-right font-black italic">
                                 <IndustrialValue value={day.total_mtm} className={cn(day.total_mtm >= 0 ? "text-emerald-500" : "text-rose-500")} />
                              </td>
                              <td className={cn("p-4 text-right font-black", primaryColorClass, "opacity-60 group-hover:opacity-100")}>
                                 <IndustrialValue value={day.portfolio_value} />
                              </td>
                           </tr>
                         ))}
                         {(!data?.daily_pnl || data.daily_pnl.length === 0) && (
                           <tr>
                              <td colSpan={5} className="p-20 text-center opacity-20 italic uppercase tracking-[0.3em]">NO_TEMPORAL_DATA_SNAPSHOTTED</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </AetherPanel>
          </TabsContent>

          <TabsContent value="positions">
             <div className="p-20 text-center border border-dashed border-border/10 opacity-20">
                <Briefcase className="w-8 h-8 mx-auto mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">Redirecting to LIVE_MONITOR_V4...</p>
             </div>
          </TabsContent>
          
          <TabsContent value="holdings">
             <div className="p-20 text-center border border-dashed border-border/10 opacity-20">
                <Package className="w-8 h-8 mx-auto mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">SECURE_VAULT_INTERFACE_LOCKED</p>
             </div>
          </TabsContent>

          <TabsContent value="trades">
             <div className="p-20 text-center border border-dashed border-border/10 opacity-20">
                <Activity className="w-8 h-8 mx-auto mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">LOG_STREAM_PIPE_ACTIVE</p>
             </div>
          </TabsContent>
       </Tabs>
    </div>
  );
};
