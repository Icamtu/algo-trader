import React, { useEffect, useState, useCallback } from 'react';
import { PlayCircle, ShieldCheck, Activity, Check, X, Trash2, RefreshCw, Info, ArrowUp, ArrowDown, ChevronDown, ChevronUp, AlertTriangle, Terminal, Settings, Shield, ShieldAlert, ZapOff } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { algoApi } from '@/features/openalgo/api/client';
import { type StrategyMetrics } from '@/types/api';
import { useAppModeStore } from '@/stores/appModeStore';
import { useToast } from '@/hooks/use-toast';

interface PendingOrder {
  id: number;
  strategy: string;
  api_type: string;
  symbol: string;
  exchange: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  price_type: string;
  product_type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at_ist: string;
  raw_order_data: Record<string, any>;
  rejection_reason?: string;
}

export const ActionCenterPage: React.FC = () => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [stats, setStats] = useState<any>({
    total_pending: 0,
    total_approved: 0,
    total_rejected: 0,
    total_buy_orders: 0,
    total_sell_orders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [riskMatrix, setRiskMatrix] = useState<Record<string, StrategyMetrics>>({});
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [editingSafeguard, setEditingSafeguard] = useState<string | null>(null);
  const [safeguardConfig, setSafeguardConfig] = useState<{
    max_drawdown_pct: number;
    max_loss_inr: number;
    is_armed: boolean;
  }>({ max_drawdown_pct: 10, max_loss_inr: 5000, is_armed: true });

  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500" : "bg-teal-500";
  const accentBgSoftClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  const accentBorderHoverClass = isAD ? "hover:border-amber-500/50" : "hover:border-teal-500/50";

  const fetchData = useCallback(async (tabName: string) => {
    try {
      if (tabName === 'strategies') {
        const res = await algoApi.getRiskMatrix();
        if (res.status === 'success') {
          setRiskMatrix(res.matrix);
        }
      } else {
        const res = await tradingService.getActionCenterData(tabName);
        if (res.status === 'success') {
          setOrders(res.data.orders || []);
          setStats(res.data.statistics);
        }
      }
    } catch (error) {
      console.error('Failed to load action center data', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
    const interval = setInterval(() => fetchData(activeTab), 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchData]);

  const handleApprove = async (id: number) => {
    try {
      await tradingService.approveActionCenterOrder(id);
      toast({ title: "SIGNAL::PROTOCOL_APPROVED", description: `Order ${id} has been routed to execution bridge.` });
      fetchData(activeTab);
    } catch (error) {
      console.error('Approval failed', error);
      toast({ variant: "destructive", title: "FAULT::ENGINE_REJECT", description: "Terminal failed to relay approval signal." });
    }
  };

  const handleReject = async (id: number, reason?: string) => {
    try {
      await tradingService.rejectActionCenterOrder(id, reason);
      toast({ title: "SIGNAL::PROTOCOL_KILLED", description: `Order ${id} has been purged from the queue.${reason ? ` Reason: ${reason}` : ''}` });
      fetchData(activeTab);
    } catch (error) {
      console.error('Rejection failed', error);
      toast({ variant: "destructive", title: "FAULT::PURGE_FAILED", description: "Terminal failed to purge volatile signal." });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tradingService.deleteActionCenterOrder(id);
      fetchData(activeTab);
    } catch (error) {
      console.error('Deletion failed', error);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('SYSTEM_ELEVATION_WARNING: APPROVE_ALL_QUEUED_ORDERS? ALL_ORDERS_WILL_BE_ROUTED_TO_BROKER.')) return;
    try {
      await tradingService.approveAllActionCenterOrders();
      toast({ title: "SIGNAL::BATCH_FIRE_INITIATED", description: "All queued signals have been elevated to bridge." });
      fetchData(activeTab);
    } catch (error) {
      console.error('Batch approval failed', error);
      toast({ variant: "destructive", title: "FAULT::BATCH_COLLAPSE", description: "Critical fault during mass elevation." });
    }
  };

  const handleStartStrategy = async (id: string) => {
    setIsActionLoading(id);
    try {
      await algoApi.startStrategy(id);
      toast({ title: "UNIT_STATUS::OPERATIONAL", description: `Strategy ${id} kernel is now active.` });
      fetchData(activeTab);
    } catch (e) {
      console.error("Start failed", e);
      toast({ variant: "destructive", title: "FAULT::UNIT_COLD_START", description: "Failed to initialize strategy instance." });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleStopStrategy = async (id: string) => {
    setIsActionLoading(id);
    try {
      await algoApi.stopStrategy(id);
      fetchData(activeTab);
    } catch (e) {
      console.error("Stop failed", e);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleLiquidateStrategy = async (id: string) => {
    if (!confirm(`CRITICAL_ACTION_WARNING: LIQUIDATE_STRATEGY_${id}? ALL_POSITIONS_WILL_BE_EXITED_AT_MARKET.`)) return;
    setIsActionLoading(id);
    try {
      await algoApi.liquidateStrategy(id);
      toast({ title: "PROTOCOL::PANIC_LIQUIDATE", description: `Emergency exit signal broadcast for ${id}.` });
      fetchData(activeTab);
    } catch (e) {
      console.error("Liquidation failed", e);
      toast({ variant: "destructive", title: "FAULT::LIQUIDATION_HALT", description: "Critical error during emergency exit." });
    } finally {
      setIsActionLoading(null);
    }
  };

  const openSafeguardConfig = (name: string, metrics: StrategyMetrics) => {
    setEditingSafeguard(name);
    setSafeguardConfig({
      max_drawdown_pct: metrics.safeguard?.max_drawdown_pct || 15,
      max_loss_inr: metrics.safeguard?.max_loss_inr || 10000,
      is_armed: metrics.safeguard?.is_armed ?? true
    });
  };

  const saveSafeguardConfig = async () => {
    if (!editingSafeguard) return;
    try {
      await algoApi.updateStrategySafeguards(editingSafeguard, {
        ...safeguardConfig,
        clear_breach: true // Clear breach if re-arming or updating
      });
      setEditingSafeguard(null);
      fetchData(activeTab);
    } catch (e) {
      console.error("Safeguard update failed", e);
      toast({ variant: "destructive", title: "FAULT::GUARD_WRITE", description: "Failed to persist safeguard configuration." });
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <PlayCircle className={cn("w-10 h-10 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <PlayCircle className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Action_Center_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className={cn("w-3 h-3 animate-pulse", isAD ? "text-emerald-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">EXECUTION_BRIDGE // MODE::{isAD ? 'INDUSTRIAL_AMBER' : 'OPENALGO_TEAL'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => fetchData(activeTab)} 
            disabled={isRefreshing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />} 
            RE_SYNC_SIGNALS
          </Button>
        </div>
      </div>

       {/* Protocol Status Cards */}
       <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Queued", value: stats.total_pending, color: primaryColorClass, pulse: stats.total_pending > 0 },
            { label: "Buying", value: stats.total_buy_orders, color: "text-emerald-500" },
            { label: "Selling", value: stats.total_sell_orders, color: "text-rose-500" },
            { label: "Approved", value: stats.total_approved, color: isAD ? "text-amber-500/40" : "text-teal-500/40" },
            { label: "Rejected", value: stats.total_rejected, color: "text-muted-foreground/40" },
          ].map((stat, i) => (
            <AetherPanel key={i} className="border-border/10 bg-background/20 group">
               <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-2">{stat.label}</div>
               <div className={cn("text-2xl font-black font-mono tracking-tighter", stat.color, stat.pulse && "animate-pulse")}>{stat.value}</div>
            </AetherPanel>
          ))}
       </div>

       {/* Operation Log */}
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-background/20 border border-border/10 h-10 p-1 rounded-none">
              <TabsTrigger value="pending" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Pending</TabsTrigger>
              <TabsTrigger value="strategies" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Strategy_Field</TabsTrigger>
              <TabsTrigger value="approved" className={cn("rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:text-black", isAD ? "data-[state=active]:bg-amber-500" : "data-[state=active]:bg-teal-500")}>Audit_Approved</TabsTrigger>
              <TabsTrigger value="rejected" className="rounded-none text-[10px] font-black uppercase px-6 data-[state=active]:bg-rose-500 data-[state=active]:text-white">Audit_Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value="strategies">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {Object.entries(riskMatrix).map(([name, metrics]) => {
                 const m = metrics as StrategyMetrics;
                 return (
                 <AetherPanel key={name} className={cn(
                   "p-6 relative group border transition-all duration-500 overflow-hidden",
                   m.is_halted ? "border-rose-500/50 bg-rose-500/5 shadow-[0_0_30px_rgba(244,63,94,0.05)]" : cn("border-border/10 bg-background/40", accentBorderHoverClass)
                 )}>
                    {m.is_halted && (
                      <div className="absolute top-0 right-0 p-1.5 bg-rose-500 text-white text-[8px] font-black uppercase tracking-[0.2em] z-20 animate-pulse">
                         SAFEGUARD_BREACH_HALTED
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-6">
                       <div className="space-y-1">
                          <div className="text-[12px] font-black font-mono text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                            {name}
                            {m.safeguard?.is_armed && !m.is_halted && <Shield className={cn("w-3.5 h-3.5 animate-pulse", primaryColorClass)} />}
                            {m.is_halted && <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-bounce" />}
                          </div>
                          <div className="flex items-center gap-2">
                             <div className={cn("w-1.5 h-1.5 rounded-full", m.is_active && !m.is_halted ? (isAD ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]") : "bg-muted-foreground/30")} />
                             <span className="text-[8px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest">
                               {m.is_halted ? "PROTOCOL_TERMINATED" : m.is_active ? "UNIT_OPERATIONAL" : "UNIT_IDLE"}
                             </span>
                          </div>
                       </div>
                       <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className={cn("text-[9px] font-mono px-3 py-1", isAD ? "border-amber-500/20 text-amber-500 bg-amber-500/5" : "border-teal-500/20 text-teal-500 bg-teal-500/5")}>
                             {m.total_trades} TXNS
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5 border border-transparent hover:border-border/10"
                            onClick={() => openSafeguardConfig(name, m)}
                          >
                             <Settings className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-8 border-y border-border/10 py-4 bg-background/40">
                       <div className="space-y-1 pl-2">
                          <div className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">Sharpe_Ratio</div>
                          <div className={cn("text-sm font-black font-mono", primaryColorClass)}>{m.sharpe.toFixed(2)}</div>
                       </div>
                       <div className="space-y-1">
                          <div className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">Max_Drawdown</div>
                          <div className={cn("text-sm font-black font-mono", m.max_drawdown >= (m.safeguard?.max_drawdown_pct || 15) ? "text-rose-500 animate-pulse" : "text-rose-500/60")}>
                            {m.max_drawdown.toFixed(1)}%
                          </div>
                       </div>
                       <div className="space-y-1 pr-2">
                          <div className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">Unit_PnL_IST</div>
                          <div className={cn("text-sm font-black font-mono", m.net_pnl >= 0 ? primaryColorClass : "text-rose-500")}>
                             ₹{m.net_pnl.toFixed(0)}
                          </div>
                       </div>
                    </div>

                    <div className="flex gap-2">
                       {m.is_active && !m.is_halted ? (
                         <Button 
                           onClick={() => handleStopStrategy(name)}
                           disabled={isActionLoading === name}
                           className={cn("flex-1 h-10 text-black font-mono text-[9px] font-black uppercase tracking-widest hover:bg-white", accentBgClass)}
                         >
                            <X className="w-3.5 h-3.5 mr-2" /> Stop_Unit
                         </Button>
                       ) : (
                         <Button 
                           onClick={() => handleStartStrategy(name)}
                           disabled={isActionLoading === name || m.is_halted}
                           className={cn(
                             "flex-1 h-10 font-mono text-[9px] font-black uppercase tracking-widest",
                             m.is_halted ? "bg-muted text-muted-foreground cursor-not-allowed" : (isAD ? "bg-amber-500 text-black hover:bg-white" : "bg-teal-500 text-black hover:bg-white")
                           )}
                         >
                            <PlayCircle className="w-3.5 h-3.5 mr-2" /> {m.is_halted ? "HALTED_BY_GUARD" : "Start_Unit"}
                         </Button>
                       )}
                       <Button 
                         onClick={() => handleLiquidateStrategy(name)}
                         disabled={isActionLoading === name}
                         variant="ghost" 
                         className="flex-1 h-10 border border-rose-500/30 text-rose-500 font-mono text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white"
                       >
                          <X className="w-3.5 h-3.5 mr-2" /> Panic_Clear
                       </Button>
                    </div>
                 </AetherPanel>
                 );
               })}
             </div>
          </TabsContent>
          <TabsContent value={activeTab}>
             <AetherPanel className="p-0 border-border/10 overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left font-mono text-[10px]">
                      <thead>
                         <tr className="border-b border-border/10 bg-background/40 uppercase tracking-tighter text-muted-foreground">
                            <th className="p-4 font-black">Strategy</th>
                            <th className="p-4 font-black">Contract</th>
                            <th className="p-4 font-black">Operation</th>
                            <th className="p-4 font-black text-right">Qty</th>
                            <th className="p-4 font-black text-right">Price</th>
                            <th className="p-4 font-black">Sync_Time</th>
                            <th className="p-4 font-black text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody>
                         {orders.map((order, i) => (
                           <React.Fragment key={order.id}>
                             <tr className={cn("border-b border-border/10 transition-colors group", accentBgSoftClass)}>
                                <td className="p-4">
                                   <div className={cn("font-black", primaryColorClass)}>{order.strategy}</div>
                                   <div className="text-[8px] text-muted-foreground/40 mt-0.5">{order.api_type}</div>
                                </td>
                                <td className="p-4">
                                   <div className="font-black">{order.symbol}</div>
                                   <div className="text-[8px] text-muted-foreground/40 mt-0.5 uppercase tracking-tighter">{order.exchange} // {order.product_type}</div>
                                </td>
                                <td className="p-4">
                                   <Badge className={cn("text-[8px] font-black uppercase tracking-widest h-5 text-black", order.action === 'BUY' ? accentBgClass : "bg-rose-500 text-white")}>
                                      {order.action === 'BUY' ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                                      {order.action}
                                   </Badge>
                                </td>
                                <td className="p-4 text-right">{order.quantity}</td>
                                <td className="p-4 text-right">
                                   <div>{order.price || 'MTKT'}</div>
                                   <div className="text-[8px] text-muted-foreground/40 uppercase">{order.price_type}</div>
                                </td>
                                <td className="p-4 text-muted-foreground/60">{order.created_at_ist}</td>
                                <td className="p-4 text-right">
                                   <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(order.id)} className="h-8 border border-border/10 opacity-20 hover:opacity-100 italic font-mono text-[8px]">
                                         {expandedOrders.has(order.id) ? "SHRINK_V" : "GROW_V"}
                                      </Button>
                                      {order.status === 'pending' ? (
                                        <>
                                          <Button size="sm" onClick={() => handleApprove(order.id)} className={cn("font-mono text-[9px] font-black uppercase h-8 px-4 text-black shadow-lg", isAD ? "bg-amber-500 hover:bg-amber-600" : "bg-teal-500 hover:bg-teal-400")}>
                                            <Check className="h-3 w-3 mr-1" /> Approve
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            onClick={() => {
                                              const res = prompt("Enter REJECTION_REASON (Optional):");
                                              if (res !== null) handleReject(order.id, res);
                                            }} 
                                            className="h-8 px-4 bg-rose-500 text-white hover:bg-white hover:text-rose-500 transition-all"
                                          >
                                             <X className="w-4 h-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(order.id)} className="h-8 px-4 border border-border/10 text-rose-500 opacity-40 hover:opacity-100">
                                           <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                   </div>
                                </td>
                             </tr>
                             {expandedOrders.has(order.id) && (
                                 <tr className={cn("border-b border-border/10 animate-in slide-in-from-top-2", accentBgSoftClass)}>
                                    <td colSpan={7} className="p-6">
                                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                          {Object.entries(order.raw_order_data).map(([key, value]) => (
                                            <div key={key} className="space-y-1">
                                               <div className={cn("text-[7px] font-black font-mono uppercase tracking-widest opacity-40")}>{key}</div>
                                               <div className="text-[10px] font-mono break-all font-black text-muted-foreground italic">
                                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                               </div>
                                            </div>
                                          ))}
                                        </div>
                                        {order.rejection_reason && (
                                          <div className="mt-6 p-4 border border-rose-500/20 bg-rose-500/5 rounded-sm">
                                             <div className="text-[7px] font-black font-mono uppercase tracking-widest text-rose-500/60 mb-1">REJECTION_REASON_LOG</div>
                                             <div className="text-[11px] font-mono font-bold text-rose-500 uppercase tracking-tighter italic">
                                                {order.rejection_reason}
                                             </div>
                                          </div>
                                        )}
                                   </td>
                                </tr>
                             )}
                           </React.Fragment>
                         ))}
                         {orders.length === 0 && (
                           <tr>
                              <td colSpan={7} className="p-20 text-center flex flex-col items-center gap-4 opacity-20">
                                 <ShieldCheck className="w-8 h-8" />
                                 <p className="text-[10px] font-mono uppercase tracking-[0.4em]">NO_ORDERS_QUEUED_IN_BUFFER</p>
                                 <Button variant="ghost" asChild className="text-[8px] underline">
                                    <Link to="/openalgo/connectivity">CHECK_PROTOCOL_SETTINGS</Link>
                                 </Button>
                              </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </AetherPanel>
          </TabsContent>
       </Tabs>

       <div className="mt-8 p-6 border border-border/10 bg-background/40 flex items-center gap-6">
          <Terminal className="w-5 h-5 text-muted-foreground/20" />
          <div className="flex-1 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-relaxed italic opacity-40">
             HYPERVISOR_NOTES: ALL_PENDING_OPERATIONS_REMAIN_IN_VOLATILE_STATE_UNTIL_HUMAN_INTERVENTION. 
             ENSURE_CONNECTIVITY_MODULE_IS_ARMED_FOR_BROKER_HANDOFF.
          </div>
       </div>

       {/* Safeguard Config Modal */}
       {editingSafeguard && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
           <AetherPanel className={cn("max-w-md w-full border transition-all duration-500", isAD ? "border-primary/30 shadow-[0_0_50px_rgba(255,176,0,0.1)]" : "border-teal-500/30 shadow-[0_0_50px_rgba(20,184,166,0.1)]")}>
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <ShieldCheck className={cn("w-5 h-5", primaryColorClass)} />
                    <h2 className={cn("text-xl font-black font-mono uppercase tracking-widest", primaryColorClass)}>GUARD_CONFIG_{editingSafeguard}</h2>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => setEditingSafeguard(null)} className="opacity-40 hover:opacity-100">
                    <X className="w-5 h-5" />
                 </Button>
              </div>

              <div className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[9px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest pl-1">Institutional Kill-Switch</label>
                    <div 
                      onClick={() => setSafeguardConfig(prev => ({ ...prev, is_armed: !prev.is_armed }))}
                      className={cn(
                        "p-4 border font-mono text-[10px] font-black uppercase flex items-center justify-between cursor-pointer transition-all",
                        safeguardConfig.is_armed ? (isAD ? "bg-primary/10 border-primary text-primary" : "bg-teal-500/10 border-teal-500 text-teal-500") : "bg-muted/10 border-border/20 text-muted-foreground/40"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          {safeguardConfig.is_armed ? <Shield className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                          {safeguardConfig.is_armed ? "ARMED_AND_WATCHING" : "DISARMED_PROTOCOL"}
                       </div>
                       <div className={cn("w-2 h-2 rounded-full", safeguardConfig.is_armed ? (isAD ? "bg-primary animate-pulse shadow-[0_0_8px_rgba(255,176,0,0.5)]" : "bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]") : "bg-muted-foreground/20")} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[8px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest">Max Drawdown (%)</label>
                       <input 
                         type="number"
                         value={safeguardConfig.max_drawdown_pct}
                         onChange={(e) => setSafeguardConfig(prev => ({ ...prev, max_drawdown_pct: parseFloat(e.target.value) }))}
                         className="w-full bg-black/40 border border-white/10 p-3 font-mono text-sm text-white focus:border-primary/50 outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[8px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest">Max Loss (INR)</label>
                       <input 
                         type="number"
                         value={safeguardConfig.max_loss_inr}
                         onChange={(e) => setSafeguardConfig(prev => ({ ...prev, max_loss_inr: parseFloat(e.target.value) }))}
                         className="w-full bg-black/40 border border-white/10 p-3 font-mono text-sm text-white focus:border-primary/50 outline-none"
                       />
                    </div>
                 </div>

                 <div className="pt-6 flex gap-3">
                    <Button 
                      className={cn("flex-1 h-12 text-black font-mono font-black uppercase tracking-widest hover:bg-white", accentBgClass)}
                      onClick={saveSafeguardConfig}
                    >
                       COMMIT_PROTOCOL_UPDATES
                    </Button>
                 </div>
                 
                 <div className="text-[8px] font-mono text-muted-foreground/40 uppercase leading-relaxed text-center">
                    BREACH_DETECTION_CYCLES_RUN_EVERY_30S. UPDATING_GUARD_LIMITS_WILL_AUTOMATICALLY_RESOLUTION_ACTIVE_HALTS_UNTIL_NEXT_PROTOCOL_BREACH.
                 </div>
              </div>
           </AetherPanel>
         </div>
       )}
    </div>
  );
};
