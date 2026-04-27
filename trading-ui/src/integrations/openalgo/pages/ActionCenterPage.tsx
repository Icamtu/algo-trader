import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play, Pause, X, Trash2, CheckCircle2, AlertCircle, Info, RefreshCw,
  Terminal, Globe, ShieldCheck, Zap, Activity, Filter, Search, ChevronRight,
  CheckSquare, Square as SquareIcon, AlertTriangle, Layers, ZapOff, PlayCircle,
  PauseCircle, Cpu, Fingerprint, Lock, Command, Database, BarChart3, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { tradingService } from '@/services/tradingService';
import { VirtualizedDataTable } from '../components/VirtualizedDataTable';
import { Switch } from '@/components/ui/switch';
import { useAppModeStore } from '@/stores/appModeStore';

// ---------------------------------------------------------------------------
// 🛰️ COMPONENT: ACTION CONFIRMATION DIALOG
// ---------------------------------------------------------------------------
const ActionConfirmationDialog = ({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  type = 'default',
  metadata = {}
}: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-xl relative z-10"
      >
        <AetherPanel className={cn(
          "bg-[#050505] p-10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative group overflow-hidden",
          type === 'danger' ? "border-destructive/40" : "border-primary/40"
        )}>
          {/* Decorative Corner */}
          <div className={cn("absolute top-0 left-0 w-2 h-2", type === 'danger' ? "bg-rose-500" : "bg-primary")} />
          <div className={cn("absolute bottom-0 right-0 w-2 h-2", type === 'danger' ? "bg-rose-500" : "bg-primary")} />

          <div className="flex items-center gap-6 mb-10">
            <div className={cn(
              "p-4 border",
              type === 'danger' ? "bg-rose-500/10 border-rose-500/40 text-rose-500" : "bg-primary/10 border-primary/40 text-primary"
            )}>
              {type === 'danger' ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">{title}</h2>
              <span className="text-[10px] font-black opacity-40 tracking-[0.4em] uppercase">SYSTEM_INTERCEPT_V4.2</span>
            </div>
          </div>

          <p className="text-sm font-mono text-muted-foreground/60 mb-10 leading-relaxed uppercase tracking-wider">
            {description}
          </p>

          {Object.keys(metadata).length > 0 && (
            <div className="mb-10 grid grid-cols-2 gap-4">
               {Object.entries(metadata).map(([key, val]: any) => (
                 <div key={key} className="p-4 bg-white/[0.02] border border-white/5">
                    <div className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest mb-1">{key}</div>
                    <div className="text-[11px] font-mono text-white/80 font-black truncate">{val}</div>
                 </div>
               ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-5">
            <Button
               onClick={() => { onConfirm(); onOpenChange(false); }}
               className={cn(
                 "flex-1 h-14 font-black uppercase text-xs tracking-[0.4em] rounded-none transition-all",
                 type === 'danger' ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-primary text-black hover:bg-white"
               )}
            >
              AUTHORISE_EXECUTION
            </Button>
            <Button
               variant="outline"
               onClick={() => onOpenChange(false)}
               className="flex-1 h-14 border-white/10 font-black uppercase text-xs tracking-[0.4em] rounded-none hover:bg-white/5 text-white/40 hover:text-white"
            >
              ABORT_PROCEDURE
            </Button>
          </div>
        </AetherPanel>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 🛰️ COMPONENT: REJECTION DIALOG
// ---------------------------------------------------------------------------
const RejectionDialog = ({ isOpen, onOpenChange, onConfirm, batchCount = 1 }: any) => {
  const [reason, setReason] = useState("");
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-xl relative z-10"
      >
        <AetherPanel className="bg-[#050505] p-10 border-rose-500/40 shadow-[0_50px_150px_rgba(255,0,0,0.15)] rounded-none">
          <div className="flex items-center gap-6 mb-10">
            <div className="p-4 bg-rose-500/10 border border-rose-500/40 text-rose-500">
               <ZapOff className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">Signal_Purge_Override</h2>
              <span className="text-[10px] font-black text-rose-500/60 tracking-[0.4em] uppercase">TARGETS_BUFFERED::{batchCount}</span>
            </div>
          </div>

          <div className="space-y-6 pt-4">
             <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">REJECTION_REASON_MANIFEST</label>
                <div className="relative group">
                  <Input
                    placeholder="Enter diagnostic justification..."
                    className="bg-black/40 border-white/5 h-16 rounded-none font-mono text-white tracking-widest focus:border-rose-500 transition-all uppercase px-6"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-rose-500 group-focus-within:w-full transition-all duration-500" />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                {["RISK_BREACH", "SKEW_ERROR", "PROTOCOL_MISS", "MTU_FAULT"].map(tag => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => setReason(tag)}
                    className="h-12 border-white/5 font-black text-[9px] tracking-widest uppercase rounded-none opacity-40 hover:opacity-100 hover:border-rose-500/40"
                  >
                    {tag}
                  </Button>
                ))}
             </div>
          </div>

          <div className="flex gap-5 mt-12">
            <Button
               disabled={!reason}
               onClick={() => { onConfirm(reason); onOpenChange(false); setReason(""); }}
               className="flex-1 h-14 bg-rose-600 text-white font-black uppercase text-xs tracking-[0.4em] rounded-none hover:bg-rose-500 transition-all"
            >
              CONFIRM_PURGE
            </Button>
            <Button
               variant="outline"
               onClick={() => onOpenChange(false)}
               className="flex-1 h-14 border-white/10 font-black uppercase text-xs tracking-[0.4em] rounded-none text-white/40"
            >
              RESET_STATE
            </Button>
          </div>
        </AetherPanel>
      </motion.div>
    </div>
  );
};

// 🛰️ MAIN PAGE: ACTION CENTER
export const ActionCenterPage = () => {
  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';

  const accentColor = isAD ? "amber" : "teal";
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orders, setOrders] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Safeguard & Confirmation States
  const [editingSafeguard, setEditingSafeguard] = useState<string | null>(null);
  const [safeguardConfig, setSafeguardConfig] = useState({ is_armed: false, max_drawdown_pct: 1.0, max_loss_inr: 1000.0 });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", description: "", onAction: () => {}, type: 'default', metadata: {} });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, ids: [] as string[] });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (tabTarget = activeTab) => {
    try {
      setIsLoading(true);
      const [orderRes, stratRes] = await Promise.all([
        tradingService.getActionCenterOrders(tabTarget === 'pending'),
        tradingService.getAllStrategiesStatus()
      ]);
      setOrders(orderRes);
      setStrategies(Object.entries(stratRes).map(([name, status]) => ({ name, ...(status as any) })));
    } catch (error) {
      console.error('Failed to sync Action Center:', error);
      toast({ variant: "destructive", title: "FAULT::SYNC_ERROR", description: "Terminal failed to synchronize with head-unit." });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      o.strategy_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orders, searchQuery]);

  // Order Actions
  const handleApprove = async (id: string) => {
    setIsActionLoading(id);
    try {
      await tradingService.approveActionCenterOrder(id);
      toast({ title: "SIGNAL::ELEVATED", description: "Kernel successfully executed signal buffer." });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::BRIDGE_ERROR", description: "Failed to elevate signal to bridge." });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleApproveSelected = async () => {
    const count = selectedIds.size;
    setIsActionLoading("batch");
    try {
      await tradingService.approveSelectedActionCenterOrders(Array.from(selectedIds));
      toast({ title: "SIGNAL::BATCH_ELEVATED", description: `${count} signals advanced to bridge execution.` });
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::BATCH_FAULT", description: "Protocol failed to bridge selected signals." });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleReject = (id: string) => setRejectModal({ isOpen: true, ids: [id] });
  const handleRejectSelected = () => setRejectModal({ isOpen: true, ids: Array.from(selectedIds) });

  // Strategy Actions
  const handleToggleStrategy = async (name: string, isHalted: boolean) => {
    setIsActionLoading(name);
    try {
      if (isHalted) await tradingService.unhaltStrategy(name);
      else await tradingService.haltStrategy(name);
      toast({ title: `SIGNAL::STATE_${isHalted ? 'UNHALTED' : 'HALTED'}`, description: `Strategy ${name} transition successful.` });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::LOCK_TRANSITION", description: `Strategy lock failed.` });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleInitializeStrategy = (name: string) => {
     setConfirmModal({
       isOpen: true,
       title: "CORE_BOOT_SEQUENCE",
       description: `INITIALISATION_OF_STRATEGY: [${name.toUpperCase()}]. VERIFY_BROKER_LOGINS_AND_MARGINS_BEFORE_ARMING.`,
       type: 'default',
       metadata: { "INSTANCE": name, "TIMESTAMP": new Date().toISOString() },
       onAction: async () => {
         setIsActionLoading(name);
         try {
           await tradingService.initializeStrategy(name);
           toast({ title: "SIGNAL::BOOT_SUCCESS", description: "Strategy kernel initialised." });
           fetchData();
         } catch (error) {
           toast({ variant: "destructive", title: "FAULT::K_ERROR", description: "Failed to boot strategy kernel." });
         } finally {
           setIsActionLoading(null);
         }
       }
     });
  };

  const handleLiquidateStrategy = (name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "PURGE_LIQUIDATION_PROTOCOL",
      description: `CRITICAL: LIQUIDATING_ALL_POSITIONS_FOR_${name.toUpperCase()}. THIS_ACTION_IS_IRREVERSIBLE_AND_TERMINATES_ALL_ACTIVE_HEDGES.`,
      type: 'danger',
      metadata: { "STRATEGY": name, "RISK_LEVEL": "EXTREME" },
      onAction: async () => {
        setIsActionLoading(name);
        try {
          await tradingService.liquidateStrategy(name);
          toast({ variant: "destructive", title: "SIGNAL::LIQUIDATION_ACKNOWLEDGE", description: "All positions purged. Strategy reset." });
          fetchData();
        } catch (error) {
          toast({ variant: "destructive", title: "FAULT::PURGE_ERROR", description: "Terminal failed to liquidate positions." });
        } finally {
          setIsActionLoading(null);
        }
      }
    });
  };

  // Safeguard Actions
  const openSafeguardEditor = async (name: string) => {
    setEditingSafeguard(name);
    try {
      const config = await tradingService.getStrategySafeguards(name);
      setSafeguardConfig(config);
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::METADATA_MISS", description: "Failed to load guardrail parameters." });
    }
  };

  const saveSafeguardConfig = async () => {
    if (!editingSafeguard) return;
    try {
      await tradingService.updateStrategySafeguards(editingSafeguard, safeguardConfig);
      toast({ title: "SIGNAL::COMMIT_ACK", description: "Guardrail matrix updated in kernel memory." });
      setEditingSafeguard(null);
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::MEMORY_SYNC", description: "Failed to commit guardrail changes." });
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map(o => o.id)));
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedOrders(next);
  };

  // Industrial Value Helper
  const IndustrialValue = ({ value, label, trend }: any) => (
    <div className="flex flex-col gap-1.5 group select-none">
       <div className="flex items-center gap-2">
         <span className="text-[10px] font-black font-mono text-muted-foreground/30 uppercase tracking-[0.2em] group-hover:text-muted-foreground/60 transition-colors uppercase">{label}</span>
       </div>
       <div className="flex items-baseline gap-2">
         <span className={cn("text-2xl font-black font-mono tracking-tighter tabular-nums", primaryColorClass)}>
            {value}
         </span>
         {trend && (
           <span className={cn("text-[8px] font-black font-mono px-1.5 py-0.5 border uppercase", trend > 0 ? "text-primary border-primary/20 bg-primary/5" : "text-rose-500 border-rose-500/20 bg-rose-500/5")}>
             {trend > 0 ? "+" : ""}{trend}%
           </span>
         )}
       </div>
    </div>
  );

  // Table Columns
  const columns = [
    {
      header: <div onClick={toggleAll} className="cursor-pointer p-2 hover:bg-white/5 transition-all">{selectedIds.size === filteredOrders.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <SquareIcon className="w-4 h-4 text-muted-foreground/30" />}</div>,
      accessor: "select",
      width: 60,
      cell: (order: any) => (
        <div onClick={() => toggleSelect(order.id)} className="cursor-pointer p-2 group">
          {selectedIds.has(order.id) ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <SquareIcon className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50" />
          )}
        </div>
      )
    },
    {
      header: "SIGNAL_TIMESTAMP",
      accessor: "timestamp",
      width: 180,
      cell: (order: any) => (
        <div className="flex flex-col">
           <span className="text-[11px] font-mono font-black text-white/80 tabular-nums">
             {new Date(order.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
           </span>
           <span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">{new Date(order.created_at).toLocaleDateString()}</span>
        </div>
      )
    },
    {
      header: "PROTOCOL_TYPE",
      accessor: "action_type",
      width: 220,
      cell: (order: any) => (
        <div className="flex items-center gap-4">
           {order.action_type === 'DEPLOY_STRATEGY' ? <Layers className="w-4 h-4 text-blue-400" /> : <Zap className="w-4 h-4 text-primary" />}
           <div className="flex flex-col">
             <span className={cn("text-[10px] font-black uppercase tracking-widest", order.action_type === 'DEPLOY_STRATEGY' ? "text-blue-400" : "text-primary")}>
               {order.action_type.replace(/_/g, ' ')}
             </span>
             <span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest italic">{order.strategy_name}</span>
           </div>
        </div>
      )
    },
    {
      header: "EXPOSURE_VAL",
      accessor: "value",
      width: 150,
      cell: (order: any) => (
        <span className="text-[11px] font-mono font-black text-white px-3 py-1 bg-white/5 border border-white/10 tabular-nums">
          {order.action_type === 'DEPLOY_STRATEGY' ? 'N/A' : `₹${order.exposure_val || '0.00'}`}
        </span>
      )
    },
    {
       header: "STATUS_VECTOR",
       accessor: "status",
       width: 160,
       cell: (order: any) => {
         const isPending = order.status === 'PENDING';
         const isRejected = order.status === 'REJECTED';
         const isApproved = order.status === 'APPROVED';

         return (
            <div className="flex items-center gap-3">
               <div className={cn(
                 "w-2 h-2 rounded-full",
                 isPending ? "bg-amber-500 animate-pulse" : isRejected ? "bg-rose-500" : "bg-primary"
               )} />
               <span className={cn(
                 "text-[9px] font-black uppercase tracking-widest",
                 isPending ? "text-amber-500" : isRejected ? "text-rose-500" : "text-primary"
               )}>
                 {order.status}
               </span>
            </div>
         );
       }
    },
    {
      header: (viewMode === 'table' ? "AUTH_CORE" : ""),
      accessor: "actions",
      width: 150,
      cell: (order: any) => (
        <div className="flex items-center justify-end gap-3 pr-4">
           {order.status === 'PENDING' && (
             <>
                <Button
                  size="sm"
                  onClick={() => handleApprove(order.id)}
                  disabled={isActionLoading === order.id}
                  className="h-8 group bg-primary/10 border border-primary/40 hover:bg-primary text-primary hover:text-black font-black text-[9px] uppercase tracking-widest rounded-none px-4 transition-all"
                >
                   {isActionLoading === order.id ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Play className="w-3 h-3 mr-2 group-hover:scale-125 transition-transform" />}
                   AUTHORISE
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleReject(order.id)}
                  className="h-8 w-8 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all rounded-none"
                >
                   <X className="w-4 h-4" />
                </Button>
             </>
           )}
           <Button
             size="icon"
             variant="ghost"
             onClick={() => toggleExpand(order.id)}
             className={cn("h-8 w-8 text-white/10 hover:text-white transition-all rounded-none", expandedOrders.has(order.id) && "bg-white/5 rotate-90")}
           >
              <ChevronRight className="w-4 h-4" />
           </Button>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col bg-black text-white font-mono overflow-hidden relative">
      {/* Background Hyper-Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,184,166,0.03),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay" />

      {/* 🔴 HEADER: MISSION CONTROL */}
      <div className="flex flex-col md:flex-row md:items-end justify-between p-8 gap-10 relative z-20 shrink-0">
        <div className="flex items-start gap-8">
          <div className="relative group">
            <div className={cn("absolute -inset-2 blur-xl transition-all", isAD ? "bg-amber-500/10 group-hover:bg-amber-500/30" : "bg-teal-500/10 group-hover:bg-teal-500/30")} />
            <div className={cn("relative bg-black border p-6 flex items-center justify-center transition-all duration-700 industrial-corners", accentBorderClass)}>
              <div className="absolute top-0 right-0 p-1">
                <div className={cn("w-1 h-1", isAD ? "bg-amber-500" : "bg-teal-500")} />
              </div>
              <Command className={cn("h-10 w-10 animate-pulse", primaryColorClass)} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-5">
              <h1 className="text-4xl font-black tracking-tighter uppercase whitespace-nowrap">
                Main_Ordinance_Controller
              </h1>
              <div className={cn("flex items-center gap-3 border px-4 py-1.5 industrial-corners", isAD ? "bg-amber-500/10 border-amber-500/40" : "bg-teal-500/10 border-teal-500/40")}>
                <div className={cn("w-2 h-2 rounded-full animate-pulse", isAD ? "bg-amber-500" : "bg-teal-500")} />
                <span className={cn("text-[10px] font-black tracking-[0.3em]", primaryColorClass)}>LIVE_TELEMETRY</span>
              </div>
            </div>
            <div className="flex items-center gap-5 opacity-40">
               <div className="flex items-center gap-2">
                 <Globe className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-black tracking-[0.2em] uppercase">TERMINAL_097</span>
                 <div className="greeble-dash" />
               </div>
               <div className="w-px h-3 bg-white/20" />
               <div className="flex items-center gap-2">
                 <ShieldCheck className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-black tracking-[0.2em] uppercase">GATEWAY_ENFORCED</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-16 border-l border-white/5 pl-16 hidden lg:flex">
          <IndustrialValue label="Pending_Signals" value={orders.filter(o => o.status === 'PENDING').length} trend={+12} />
          <IndustrialValue label="Kernel_Auths" value={orders.filter(o => o.status === 'APPROVED').length} />
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-black tracking-tighter tabular-nums leading-none">
              {currentTime.toLocaleTimeString([], { hour12: false })}
            </span>
            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.4em]">Protocol_Runtime</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => { setActiveTab(v); fetchData(v); }} className="flex-1 flex flex-col min-h-0 relative z-10 px-8 pb-8">
        {/* 🟠 CONTROL STRIP */}
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8 bg-white/[0.02] border border-white/5 p-4 relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />

          <TabsList className="bg-black/40 border border-white/10 h-14 p-1 rounded-none gap-1">
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-primary data-[state=active]:text-black text-[10px] font-black uppercase tracking-[0.2em] px-10 h-full rounded-none transition-all"
            >
              Signal_Queue
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-primary data-[state=active]:text-black text-[10px] font-black uppercase tracking-[0.2em] px-10 h-full rounded-none transition-all"
            >
              Audit_Log
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 relative group w-full max-w-xl">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
             <Input
               placeholder="IDENTIFY_STRATEGY_OR_PROTOCOL_ID..."
               className="h-14 bg-black/40 border-white/5 pl-14 font-mono text-xs tracking-widest text-white placeholder:text-muted-foreground/10 focus:border-primary/50 transition-all rounded-none uppercase"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex bg-black/40 border border-white/10 p-1">
               <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('grid')}
                className={cn("h-10 w-10 rounded-none transition-all", viewMode === 'grid' ? "bg-primary text-black" : "text-white/20 hover:text-white")}
               >
                 <Layers className="w-4 h-4" />
               </Button>
               <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('table')}
                className={cn("h-10 w-10 rounded-none transition-all", viewMode === 'table' ? "bg-primary text-black" : "text-white/20 hover:text-white")}
               >
                 <BarChart3 className="w-4 h-4 rotate-90" />
               </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => fetchData()}
              disabled={isLoading}
              className="h-12 w-12 p-0 border-white/10 rounded-none hover:bg-white/5 text-white/40 hover:text-primary"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* 🟡 DYNAMIC CONTENT HUB */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full overflow-y-auto pr-4 custom-scrollbar"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 pb-10">
                  {strategies.map((m, i) => (
                    <AetherPanel
                      key={m.name}
                      showGreebles
                      scanning={!m.is_halted && m.is_initialized}
                      className={cn(
                        "relative flex flex-col p-10 group transition-all duration-700 overflow-hidden border-2",
                        m.is_initialized
                          ? (m.is_halted ? "border-rose-500/20 bg-rose-500/[0.02]" : accentBorderClass + " " + accentBgClass)
                          : "border-white/5 bg-black/40 opacity-60 hover:opacity-100"
                      )}
                    >
                      {/* Interactive Scaffolding */}
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                         <Database className="w-32 h-32" />
                      </div>

                      {/* Name & Status Header */}
                      <div className="flex items-start justify-between mb-10 relative z-10">
                         <div className="space-y-3">
                            <div className="flex items-center gap-3">
                               <div className={cn("w-2 h-2 rounded-full", m.is_initialized ? (m.is_halted ? "bg-rose-500" : "bg-primary animate-pulse") : "bg-white/10")} />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 italic">MODULE_INIT</span>
                            </div>
                            <h3 className="text-2xl font-black text-white hover:text-primary transition-colors cursor-default uppercase">{m.name}</h3>
                         </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => openSafeguardEditor(m.name)}
                           className="h-10 w-10 border border-white/5 text-muted-foreground/40 hover:text-primary hover:border-primary/40 rounded-none transition-all"
                         >
                           <ShieldCheck className="w-5 h-5" />
                         </Button>
                      </div>

                      {/* Diagnostic Bits */}
                      <div className="grid grid-cols-2 gap-8 mb-10 relative z-10">
                         <div className="space-y-1">
                            <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">STATE_LOCK</span>
                            <div className={cn("text-xs font-black uppercase tracking-widest", m.is_halted ? "text-rose-500" : "text-primary")}>
                              {m.is_initialized ? (m.is_halted ? "HALTED_MANUAL" : "OPERATIONAL") : "OFFLINE"}
                            </div>
                         </div>
                         <div className="space-y-1">
                            <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">GATEWAY_PORT</span>
                            <div className="text-xs font-black text-white/40 uppercase tracking-widest tabular-nums">0XFF-{1000 + i}</div>
                         </div>
                      </div>

                      {/* Interaction Matrix */}
                      <div className="mt-auto flex gap-4 relative z-10">
                        {m.is_initialized ? (
                          <Button
                            onClick={() => handleToggleStrategy(m.name, m.is_halted)}
                            disabled={isActionLoading === m.name}
                            className={cn(
                              "flex-1 h-14 font-black uppercase text-xs tracking-[0.4em] rounded-none transition-all shadow-xl relative overflow-hidden group/btn",
                              m.is_halted
                                ? "bg-primary text-black hover:bg-white"
                                : "bg-white/5 border border-rose-500/40 text-rose-500 hover:bg-rose-500 hover:text-white"
                            )}
                          >
                             <div className="absolute inset-0 bg-white/20 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                             {m.is_halted ? (
                               <><PlayCircle className="w-4 h-4 mr-3" /> RESUME_KERNEL</>
                             ) : (
                               <><PauseCircle className="w-4 h-4 mr-3" /> HALT_KERNEL</>
                             )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleInitializeStrategy(m.name)}
                            disabled={isActionLoading === m.name || m.is_halted}
                            className={cn(
                              "flex-1 h-14 font-black uppercase text-xs tracking-[0.4em] rounded-none transition-all shadow-xl bg-primary text-black hover:bg-white"
                            )}
                          >
                             <PlayCircle className="w-4 h-4 mr-3" /> {m.is_halted ? "KERNEL_HALTED" : "BOOT_PROTOCOL"}
                          </Button>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => handleLiquidateStrategy(m.name)}
                                disabled={isActionLoading === m.name}
                                variant="ghost"
                                className="w-14 h-14 p-0 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all rounded-none shrink-0"
                              >
                                 <X className="w-6 h-6" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-rose-950 border-rose-500 text-rose-500 font-mono text-[9px] uppercase tracking-widest rounded-none p-4">
                               CRITICAL_OVERRIDE_LIQUIDATE_STRATEGY
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                       {/* Interactive Decoration */}
                       <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center opacity-10 group-hover:opacity-30 transition-opacity">
                          <div className="flex gap-1">
                             <div className="greeble-dash" />
                             {Array.from({ length: 8 }).map((_, i) => (
                               <div key={i} className={cn("w-1.5 h-1.5", (i % 4 === 0) ? "bg-primary" : "bg-white/20")} />
                             ))}
                          </div>
                          <span className="text-[8px] font-mono uppercase tracking-[0.5em] italic">SYNOPSIS_VERIFIED</span>
                       </div>
                    </AetherPanel>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full bg-black/40 border border-white/5"
              >
                  <VirtualizedDataTable
                    data={filteredOrders}
                    columns={columns}
                    rowHeight={80}
                    headerHeight={60}
                    className="h-full text-white/80"
                    renderExpandedRow={(order) => (
                      <div className="p-16 bg-[#030303] border-t border-white/5 relative overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,184,166,0.05),transparent)] pointer-events-none" />
                          <div className="grid grid-cols-1 gap-12 relative z-10">
                              {order.action_type === 'DEPLOY_STRATEGY' ? (
                              <div className="col-span-full space-y-8">
                                  <div className="flex items-center justify-between border-b border-white/10 pb-6">
                                     <div className="flex items-center gap-6">
                                       <div className="p-4 bg-blue-500/10 border border-blue-500/40 text-blue-400">
                                          <Database className="w-8 h-8" />
                                       </div>
                                       <div className="flex flex-col">
                                         <span className="text-xl font-black text-white tracking-[0.2em] uppercase">DEPLOYMENT_BLOB_SYNTAX</span>
                                         <span className="text-[10px] font-mono text-blue-400/40 italic uppercase tracking-widest">SHA-256_INTEGRITY_CHECK_PASS</span>
                                       </div>
                                     </div>
                                     <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/40 rounded-none h-8 px-6 uppercase font-mono text-[10px] tracking-widest">
                                        {JSON.parse(typeof order.raw_order_data === 'string' ? order.raw_order_data : '{}').filename}
                                     </Badge>
                                  </div>
                                  <div className="bg-black border border-white/10 p-10 rounded-none max-h-[600px] overflow-y-auto custom-scrollbar group/code relative">
                                    <div className="absolute top-4 right-4 text-[8px] font-black text-white/5 uppercase tracking-[0.5em]">KERNEL_DUMP_V43</div>
                                    <pre className="text-[13px] font-mono text-blue-400/60 leading-relaxed whitespace-pre-wrap selection:bg-blue-500/20">
                                        {JSON.parse(typeof order.raw_order_data === 'string' ? order.raw_order_data : '{}').code}
                                    </pre>
                                  </div>
                              </div>
                              ) : (
                              <>
                                 <div className="flex items-center gap-6 mb-4">
                                    <div className="w-10 h-px bg-primary" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-primary shadow-[0_0_10px_rgba(0,245,255,0.2)]">Protocol_Metadata_Stream</span>
                                 </div>
                                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10">
                                     {Object.entries(typeof order.raw_order_data === 'string' ? JSON.parse(order.raw_order_data) : order.raw_order_data).map(([key, value]) => (
                                     <div key={key} className="space-y-3 group border-l border-white/5 pl-8 py-2 hover:border-primary transition-all duration-500">
                                         <div className="text-[9px] font-black font-mono uppercase tracking-[0.3em] text-muted-foreground/30 group-hover:text-primary/60 transition-colors italic">{key}</div>
                                         <div className="text-sm font-mono font-black text-white/50 group-hover:text-white transition-all break-all tracking-tight">
                                             {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                         </div>
                                     </div>
                                     ))}
                                 </div>
                              </>
                              )}
                          </div>
                      </div>
                    )}
                    isRowExpanded={(order) => expandedOrders.has(order.id)}
                  />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Injections */}
        <ActionConfirmationDialog
          isOpen={confirmModal.isOpen}
          onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, isOpen: open }))}
          title={confirmModal.title}
          description={confirmModal.description}
          type={confirmModal.type}
          metadata={confirmModal.metadata}
          onConfirm={confirmModal.onAction}
        />

        <RejectionDialog
          isOpen={rejectModal.isOpen}
          onOpenChange={(open) => setRejectModal(prev => ({ ...prev, isOpen: open }))}
          batchCount={rejectModal.ids.length}
          onConfirm={async (reason) => {
            try {
              if (rejectModal.ids.length === 1) {
                await tradingService.rejectActionCenterOrder(rejectModal.ids[0], reason);
              } else {
                await tradingService.rejectSelectedActionCenterOrders(rejectModal.ids, reason);
                setSelectedIds(new Set());
              }
              toast({ title: "SIGNAL::PURGE_COMPLETE", description: "Signal(s) successfully removed from queue." });
              fetchData(activeTab);
            } catch (error) {
              toast({ variant: "destructive", title: "FAULT::PURGE_ERROR", description: "Failed to purge signals." });
            }
          }}
        />
      </Tabs>

      {/* 🟢 FOOTER: KERNEL STATUS STRIP */}
      <div className="h-14 border-t border-white/5 bg-[#050505] flex items-center gap-10 px-8 relative z-30 shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/40">KERNEL_ACTIVE</span>
          </div>
          <div className="flex-1 flex items-center gap-4 overflow-hidden">
             <Terminal className="w-3.5 h-3.5 text-white/10" />
             <div className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-[0.3em] italic truncate animate-in fade-in slide-in-from-left duration-1000">
                AUDIT_THREAD_001 :: Handshake_V4 :: Integrity_Sync_Completed :: Secure_Vector_Active :: Latency: 1ms :: Waiting_Human_Protocol_Gate...
             </div>
          </div>
          <div className="flex items-center gap-8 pl-10 border-l border-white/5">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-3.5 h-3.5 text-primary/20" />
                 <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">ENCRYPTED_SSL_AES-256</span>
              </div>
              <span className="text-[9px] font-black text-white/5 tracking-[0.5em] uppercase">BUILD_041824</span>
          </div>
      </div>

      {/* 🟣 BATCH OVERRIDE: COMMAND HUB */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 150, x: '-50%', opacity: 0, scale: 0.9 }}
            animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }}
            exit={{ y: 150, x: '-50%', opacity: 0, scale: 0.9 }}
            className="fixed bottom-20 left-1/2 z-50 w-full max-w-5xl px-8"
          >
            <div className="bg-black/80 backdrop-blur-3xl border-2 border-primary/60 p-10 shadow-[0_50px_100px_rgba(0,245,255,0.3)] relative overflow-hidden group">
              {/* Scanline Effect */}
              <div className="absolute inset-x-0 top-0 h-px bg-primary shadow-[0_0_20px_rgba(0,245,255,1)] animate-scanline pointer-events-none" />

              <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
                <div className="flex items-center gap-8">
                  <div className="p-5 bg-primary/20 border-2 border-primary/40 shadow-[0_0_30px_rgba(0,245,255,0.1)]">
                     <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-black uppercase tracking-[0.5em] text-primary/60">Batch_Override_Kernel</h4>
                    <p className="text-4xl font-black text-white tracking-tighter tabular-nums flex items-baseline gap-4">
                      {selectedIds.size} <span className="text-xl opacity-20 tracking-normal uppercase">Signals_Intercepted</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 w-full lg:w-auto">
                  <Button
                    onClick={handleApproveSelected}
                    className="flex-1 lg:flex-none h-16 px-16 bg-primary text-black font-black uppercase text-sm tracking-[0.4em] rounded-none hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,245,255,0.4)]"
                  >
                    AUTHORISE_ALL
                  </Button>
                  <Button
                    onClick={handleRejectSelected}
                    variant="outline"
                    className="flex-1 lg:flex-none h-16 px-12 border-rose-500/60 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-sm tracking-[0.4em] rounded-none transition-all shadow-xl"
                  >
                    PURGE_QUEUE
                  </Button>
                  <div className="w-px h-10 bg-white/10" />
                  <Button
                   variant="ghost"
                   onClick={() => setSelectedIds(new Set())}
                   className="h-16 w-16 p-0 opacity-20 hover:opacity-100 hover:bg-white/5 border-l border-white/5 transition-all text-white"
                  >
                    <X className="w-8 h-8" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⚪ MODAL: GUARDRAIL CONFIGURATION HUB */}
      <AnimatePresence>
        {editingSafeguard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
              onClick={() => setEditingSafeguard(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotateY: 15 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotateY: 15 }}
              className="w-full max-w-2xl relative z-10"
            >
              <AetherPanel className="border-primary/40 bg-[#050505] p-16 shadow-[0_100px_200px_rgba(0,245,255,0.1)] relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-40" />

                 <div className="absolute top-0 right-0 p-8">
                   <Button variant="ghost" size="icon" onClick={() => setEditingSafeguard(null)} className="opacity-20 hover:opacity-100 transition-all hover:rotate-90 duration-500">
                      <X className="w-8 h-8 text-white" />
                   </Button>
                 </div>

                 <div className="flex items-center gap-8 mb-16">
                   <div className="relative">
                      <div className="absolute -inset-2 bg-primary/20 blur-lg animate-pulse" />
                      <div className="relative p-6 bg-primary/10 border-2 border-primary/40 text-primary">
                        <ShieldCheck className="w-10 h-10" />
                      </div>
                   </div>
                   <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Guard_Matrix_Sync</h2>
                      <div className="flex items-center gap-3 mt-2">
                         <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                         <span className="text-[11px] font-black text-primary/60 tracking-[0.5em] uppercase">MODULE::{editingSafeguard}</span>
                      </div>
                   </div>
                 </div>

                 <div className="space-y-12">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                           <Fingerprint className="w-4 h-4 text-white/20" />
                           <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.4em]">Operational_State</label>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border-primary/20 bg-primary/5 uppercase font-black px-6 py-1 tracking-widest", safeguardConfig.is_armed ? "text-primary shadow-[0_0_15px_rgba(0,245,255,0.1)]" : "text-rose-500 opacity-40")}>
                          {safeguardConfig.is_armed ? "ENFORCEMENT_READY" : "BYPASSED_BY_OPERATOR"}
                        </Badge>
                      </div>

                      <div className={cn(
                        "group p-10 border-2 flex items-center justify-between transition-all duration-700 relative overflow-hidden",
                        safeguardConfig.is_armed ? "bg-primary/[0.02] border-primary/40 shadow-[inner_0_0_80px_rgba(0,245,255,0.05)]" : "bg-black border-white/5 opacity-40 grayscale"
                      )}>
                         <div className="flex items-center gap-10">
                            <div className={cn(
                               "w-20 h-20 border-2 flex items-center justify-center transition-all duration-700",
                               safeguardConfig.is_armed ? "border-primary bg-primary/20 text-primary shadow-[0_0_30px_rgba(0,245,255,0.5)]" : "border-white/10 text-white/10"
                            )}>
                               {safeguardConfig.is_armed ? <Lock className="w-10 h-10 animate-pulse" /> : <ZapOff className="w-10 h-10" />}
                            </div>
                            <div>
                               <div className="text-2xl font-black text-white uppercase tracking-tighter mb-1 select-none">
                                  {safeguardConfig.is_armed ? "SECURE_LOOP_ACTIVE" : "PROTECTION_GAP_DETECTED"}
                               </div>
                               <div className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.4em] italic mt-2">KERNEL_INTERCEPTION_SPEED: <span className="text-white/60">0.05ms</span></div>
                            </div>
                         </div>

                         <div className="flex items-center gap-6">
                           <Switch
                             checked={safeguardConfig.is_armed}
                             onCheckedChange={(checked) => setSafeguardConfig(prev => ({ ...prev, is_armed: checked }))}
                             className="data-[state=checked]:bg-primary h-8 w-14"
                           />
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-16 border-t border-white/5 pt-12">
                       <div className="space-y-4 group">
                          <div className="flex items-center gap-3">
                             <BarChart3 className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-colors" />
                             <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.4em]">Threshold_Drawdown (%)</label>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              value={safeguardConfig.max_drawdown_pct}
                              onChange={(e) => setSafeguardConfig(prev => ({ ...prev, max_drawdown_pct: parseFloat(e.target.value) }))}
                              className="w-full bg-black border-b-4 border-white/5 p-6 pl-0 text-5xl font-black text-white transition-all focus:border-primary outline-none tabular-nums tracking-tighter hover:bg-white/[0.01]"
                            />
                            <span className="absolute right-0 bottom-6 text-xl font-black text-white/20 opacity-0 group-focus-within:opacity-100 transition-opacity">%_PCT</span>
                          </div>
                       </div>
                       <div className="space-y-4 group">
                          <div className="flex items-center gap-3">
                             <Database className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-colors" />
                             <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.4em]">Floor_Capital_Loss (INR)</label>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              value={safeguardConfig.max_loss_inr}
                              onChange={(e) => setSafeguardConfig(prev => ({ ...prev, max_loss_inr: parseFloat(e.target.value) }))}
                              className="w-full bg-black border-b-4 border-white/5 p-6 pl-0 text-5xl font-black text-white transition-all focus:border-primary outline-none tabular-nums tracking-tighter hover:bg-white/[0.01]"
                            />
                            <span className="absolute right-0 bottom-6 text-xl font-black text-white/20 opacity-0 group-focus-within:opacity-100 transition-opacity">₹_INR</span>
                          </div>
                       </div>
                    </div>

                    <div className="pt-16 flex flex-col gap-8">
                       <Button
                         className="h-20 bg-primary text-black font-black uppercase text-sm tracking-[0.8em] rounded-none hover:bg-white transition-all active:scale-[0.98] shadow-[0_20px_60px_rgba(0,245,255,0.2)]"
                         onClick={saveSafeguardConfig}
                       >
                          COMMIT_PARAMETERS_TO_FLASH
                       </Button>
                       <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.5em] text-center italic leading-relaxed">
                          NOTICE: PARAMETER_COMMIT_REQUIRED_FOR_IMMEDIATE_ENFORCEMENT. ALL_ACTIVE_OR_STAGED_SIGNALS_WILL_ABIDE_BY_THESE_VECTORS.
                       </p>
                    </div>
                 </div>
              </AetherPanel>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
