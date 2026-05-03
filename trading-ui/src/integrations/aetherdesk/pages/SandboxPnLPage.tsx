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
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
            <Link to="/aetherdesk/simulation">
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

       {/* Historical PnL Vector Chart */}
       <AetherPanel className="h-[300px] border-border/10 bg-background/40 p-6 relative overflow-hidden group">
          <div className="absolute top-6 left-6 z-10">
             <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", primaryColorClass.replace("text-", "bg-"))} />
                <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">EQUITY_CURVE_REALTIME</span>
             </div>
          </div>

          <div className="w-full h-full mt-4">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.daily_pnl || []}>
                   <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor={isAD ? "#F59E0B" : "#14B8A6"} stopOpacity={0.3}/>
                         <stop offset="95%" stopColor={isAD ? "#F59E0B" : "#14B8A6"} stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                   <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 8, fill: '#ffffff20', fontFamily: 'monospace' }}
                   />
                   <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 8, fill: '#ffffff20', fontFamily: 'monospace' }}
                      tickFormatter={(value) => `₹${value}`}
                   />
                   <Tooltip
                      contentStyle={{
                         backgroundColor: '#0A0A0A',
                         border: '1px solid rgba(255,255,255,0.1)',
                         fontSize: '10px',
                         fontFamily: 'monospace',
                         borderRadius: '2px'
                      }}
                      itemStyle={{ color: isAD ? "#F59E0B" : "#14B8A6" }}
                   />
                   <Area
                      type="monotone"
                      dataKey="portfolio_value"
                      stroke={isAD ? "#F59E0B" : "#14B8A6"}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#pnlGradient)"
                      animationDuration={2000}
                   />
                </AreaChart>
             </ResponsiveContainer>
          </div>

          <div className="scanline opacity-5" />
       </AetherPanel>

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
                         {Array.isArray(data?.daily_pnl) && data.daily_pnl.map((day, i) => (
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
             <AetherPanel className="border-border/10 bg-background/20 p-0 overflow-hidden">
                <div className="p-6 border-b border-border/10 flex items-center gap-3">
                   <Briefcase className={cn("w-4 h-4", primaryColorClass)} />
                   <h3 className="text-xs font-black font-mono uppercase tracking-widest">Active_Position_Nodes</h3>
                </div>
                <div className="overflow-x-auto">
                   {isLoading ? (
                     <div className="space-y-2 p-4">
                       {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
                     </div>
                   ) : !data?.positions || data.positions.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                       <Briefcase className="w-6 h-6 mb-3 opacity-20" />
                       <span>No open positions in sandbox session</span>
                     </div>
                   ) : (
                     <table className="w-full text-left font-mono text-[10px]">
                       <thead>
                         <tr className="border-b border-border/10 bg-foreground/5 uppercase tracking-tighter">
                           <th className="p-4 font-black text-muted-foreground/60">Symbol</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Qty</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Avg_Price</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">LTP</th>
                           <th className={cn("p-4 font-black text-right", primaryColorClass)}>P&amp;L</th>
                         </tr>
                       </thead>
                       <tbody>
                         {Array.isArray(data?.positions) && data.positions.map((pos, i) => (
                           <tr key={i} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                             <td className="p-4 font-black text-muted-foreground group-hover:text-foreground italic">{pos.symbol || pos.tradingsymbol || '—'}</td>
                             <td className="p-4 text-right italic">{pos.quantity ?? pos.netqty ?? 0}</td>
                             <td className="p-4 text-right italic">₹{Number(pos.average_price ?? pos.avg_price ?? 0).toLocaleString('en-IN')}</td>
                             <td className="p-4 text-right italic">₹{Number(pos.ltp ?? pos.last_price ?? 0).toLocaleString('en-IN')}</td>
                             <td className={cn("p-4 text-right font-black", Number(pos.pnl ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                               ₹{Number(pos.pnl ?? 0).toLocaleString('en-IN')}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                </div>
             </AetherPanel>
          </TabsContent>

          <TabsContent value="holdings">
             <AetherPanel className="border-border/10 bg-background/20 p-0 overflow-hidden">
                <div className="p-6 border-b border-border/10 flex items-center gap-3">
                   <Package className={cn("w-4 h-4", primaryColorClass)} />
                   <h3 className="text-xs font-black font-mono uppercase tracking-widest">Vault_Inventory_Matrix</h3>
                </div>
                <div className="overflow-x-auto">
                   {isLoading ? (
                     <div className="space-y-2 p-4">
                       {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
                     </div>
                   ) : !data?.holdings || data.holdings.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                       <Package className="w-6 h-6 mb-3 opacity-20" />
                       <span>No holdings in sandbox vault</span>
                     </div>
                   ) : (
                     <table className="w-full text-left font-mono text-[10px]">
                       <thead>
                         <tr className="border-b border-border/10 bg-foreground/5 uppercase tracking-tighter">
                           <th className="p-4 font-black text-muted-foreground/60">Symbol</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Qty</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Avg_Price</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">CMP</th>
                           <th className={cn("p-4 font-black text-right", primaryColorClass)}>Unrealized_P&amp;L</th>
                         </tr>
                       </thead>
                       <tbody>
                         {Array.isArray(data?.holdings) && data.holdings.map((h, i) => (
                           <tr key={i} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                             <td className="p-4 font-black text-muted-foreground group-hover:text-foreground italic">{h.symbol || h.tradingsymbol || '—'}</td>
                             <td className="p-4 text-right italic">{h.quantity ?? h.holdingqty ?? 0}</td>
                             <td className="p-4 text-right italic">₹{Number(h.average_price ?? h.avg_price ?? 0).toLocaleString('en-IN')}</td>
                             <td className="p-4 text-right italic">₹{Number(h.ltp ?? h.cmp ?? h.close ?? 0).toLocaleString('en-IN')}</td>
                             <td className={cn("p-4 text-right font-black", Number(h.pnl ?? h.unrealized_pnl ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                               ₹{Number(h.pnl ?? h.unrealized_pnl ?? 0).toLocaleString('en-IN')}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                </div>
             </AetherPanel>
          </TabsContent>

          <TabsContent value="trades">
             <AetherPanel className="border-border/10 bg-background/20 p-0 overflow-hidden">
                <div className="p-6 border-b border-border/10 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <Activity className={cn("w-4 h-4", primaryColorClass)} />
                      <h3 className="text-xs font-black font-mono uppercase tracking-widest">Op_Log_Stream</h3>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   {isLoading ? (
                     <div className="space-y-2 p-4">
                       {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
                     </div>
                   ) : !data?.trades || data.trades.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                       <Activity className="w-6 h-6 mb-3 opacity-20" />
                       <span>No trade logs in sandbox session</span>
                     </div>
                   ) : (
                     <table className="w-full text-left font-mono text-[10px]">
                       <thead>
                         <tr className="border-b border-border/10 bg-foreground/5 uppercase tracking-tighter">
                           <th className="p-4 font-black text-muted-foreground/60">Time</th>
                           <th className="p-4 font-black text-muted-foreground/60">Symbol</th>
                           <th className="p-4 font-black text-muted-foreground/60">Side</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Qty</th>
                           <th className="p-4 font-black text-right text-muted-foreground/60">Price</th>
                           <th className={cn("p-4 font-black text-right", primaryColorClass)}>Status</th>
                         </tr>
                       </thead>
                       <tbody>
                         {Array.isArray(data?.trades) && data.trades.map((t, i) => (
                           <tr key={i} className={cn("border-b border-border/10 transition-colors group", isAD ? "hover:bg-primary/5" : "hover:bg-teal-500/5")}>
                             <td className="p-4 italic text-muted-foreground group-hover:text-foreground">{t.time || t.timestamp || t.fill_timestamp || '—'}</td>
                             <td className="p-4 font-black italic">{t.symbol || t.tradingsymbol || '—'}</td>
                             <td className={cn("p-4 font-black italic", (t.side || t.action || t.transactiontype || '').toUpperCase() === 'BUY' ? "text-emerald-500" : "text-rose-500")}>
                               {(t.side || t.action || t.transactiontype || '—').toUpperCase()}
                             </td>
                             <td className="p-4 text-right italic">{t.quantity ?? t.qty ?? t.filled_quantity ?? 0}</td>
                             <td className="p-4 text-right italic">₹{Number(t.price ?? t.fill_price ?? t.average_price ?? 0).toLocaleString('en-IN')}</td>
                             <td className={cn("p-4 text-right font-black opacity-60 group-hover:opacity-100", primaryColorClass)}>
                               {(t.status || t.order_status || 'EXECUTED').toUpperCase()}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                </div>
             </AetherPanel>
          </TabsContent>
       </Tabs>
    </div>
  );
};
