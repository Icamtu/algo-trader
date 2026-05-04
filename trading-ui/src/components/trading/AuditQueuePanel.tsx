import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  History,
  Filter,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MousePointer2,
  Trash2,
  X,
  Database,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONFIG } from "@/lib/config";
import { algoApi } from "@/features/aetherdesk/api/client";
import { useWebSocket } from '@/hooks/useWebSocket';
import { VirtualizedDataTable, type ColumnDefinition } from '../../integrations/aetherdesk/components/VirtualizedDataTable';
import { useAppModeStore } from '@/stores/appModeStore';

interface AuditEntry {
  id: number;
  timestamp: string;
  symbol: string;
  action: string;
  quantity: number;
  status: 'approved' | 'rejected' | 'pending' | 'executed';
  reason?: string;
  strategy?: string;
  ai_conviction?: number;
}

export const AuditQueuePanel = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500" : "bg-teal-500";

  const [data, setData] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { lastMessage } = useWebSocket();

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const result = await algoApi.getActionCenter(200, "all");
      if (result.status === 'success') {
        const orders = result.data.orders || [];
        setData(orders);
      }
    } catch (e) {
      console.error("Audit failed", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'hitl_signal' || lastMessage.type === 'hitl_update') {
      fetchData();
      if (lastMessage.type === 'hitl_update' && lastMessage.payload?.status !== 'pending') {
          setSelectedIds(prev => prev.filter(id => id !== lastMessage.payload.id));
      }
    }
  }, [lastMessage]);

  const toggleSelectAll = () => {
    const pendingIds = filteredData
      .filter(item => item.status === 'pending')
      .map(item => item.id);

    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);

    const endpoint = action === 'approve' ? 'bulk-approve' : 'bulk-reject';
    const body = action === 'approve'
        ? { ids: selectedIds }
        : { ids: selectedIds, reason: `Bulk Rejection of ${selectedIds.length} items` };

    try {
      const result = action === 'approve'
        ? await algoApi.bulkApprove(selectedIds)
        : await algoApi.bulkReject(selectedIds, `Bulk Rejection of ${selectedIds.length} items`);

      if (result.status === 'success') {
        toast.success(`Batch ${action === 'approve' ? 'Approval' : 'Rejection'} Complete`, {
          description: `Successfully processed ${result.data.success} of ${result.data.total} signals.`,
        });
        setSelectedIds([]);
        fetchData();
      } else {
        toast.error("Batch Operation Failed", { description: result.message });
      }
    } catch (e) {
      toast.error("Connection Error", { description: "Failed to reach execution engine." });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredData = useMemo(() => data.filter(item =>
    item.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    item.status.toLowerCase().includes(filter.toLowerCase()) ||
    item.strategy?.toLowerCase().includes(filter.toLowerCase())
  ), [data, filter]);

  const columns = useMemo<ColumnDefinition<AuditEntry>[]>(() => [
    {
      key: 'checkbox',
      header: (
        <Checkbox
          checked={selectedIds.length > 0 && selectedIds.length === filteredData.filter(i => i.status === 'pending').length}
          onCheckedChange={toggleSelectAll}
          className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:text-black"
        />
      ),
      width: 50,
      cell: (item) => (
        <Checkbox
          checked={selectedIds.includes(item.id)}
          disabled={item.status !== 'pending'}
          onCheckedChange={() => toggleSelection(item.id)}
          className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:text-black"
        />
      )
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: 120,
      cell: (item) => (
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      )
    },
    {
      key: 'symbol',
      header: 'Asset',
      width: 150,
      cell: (item) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-none">{item.symbol}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-tighter mt-1">
             Qty: {item.quantity}
          </span>
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action',
      width: 100,
      cell: (item) => (
        <span className={cn(
          "text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded",
          item.action === 'BUY' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
        )}>
          {item.action}
        </span>
      )
    },
    {
      key: 'conviction',
      header: 'Conviction',
      width: 150,
      cell: (item) => item.ai_conviction ? (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.ai_conviction * 100}%` }}
              className={cn("h-full", isAD ? "bg-amber-500" : "bg-teal-500")}
            />
          </div>
          <span className={cn("font-bold text-[10px]", primaryColorClass)}>
            {((item.ai_conviction || 0) * 100).toFixed(0)}%
          </span>
        </div>
      ) : <span className="text-muted-foreground/30 text-[10px]">N/A</span>
    },
    {
      key: 'strategy',
      header: 'Source',
      width: 150,
      cell: (item) => (
        <span className="text-[10px] text-muted-foreground italic">
          {item.strategy || "Core_Alpha"}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      align: 'right',
      cell: (item) => {
        switch (item.status) {
          case 'approved': return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[8px]">APPROVED</Badge>;
          case 'rejected': return <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30 text-[8px]">REJECTED</Badge>;
          case 'executed': return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-[8px]">EXECUTED</Badge>;
          default: return <Badge variant="outline" className="animate-pulse text-[8px] border-primary/20">PENDING</Badge>;
        }
      }
    }
  ], [selectedIds, filteredData, isAD, primaryColorClass]);

  return (
    <div className="flex flex-col h-full bg-background/20 backdrop-blur-sm rounded-xl border border-primary/10 overflow-hidden relative font-mono">
      <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-3">
          <ShieldAlert className={cn("w-5 h-5", primaryColorClass)} />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest leading-none">Safety Audit Matrix</h3>
            <p className="text-[10px] text-muted-foreground uppercase mt-1">Live Human-In-The-Loop Validation Stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Badge variant="outline" className={cn("h-8 px-3 border-primary/30 text-primary bg-primary/5 animate-pulse text-[10px]", primaryColorClass)}>
               {selectedIds.length} SELECTED
            </Badge>
          )}
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search Symbol/Status..."
              className="h-8 pl-8 text-[10px] bg-black/20 border-primary/10 focus-visible:ring-primary/30 font-mono"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} className="h-8 w-8 hover:bg-primary/10">
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isRefreshing && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
            <Download className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <VirtualizedDataTable
          data={filteredData}
          columns={columns}
          emptyMessage="SAFETY_PROTOCOL_IDLE"
        />
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-slate-900/90 backdrop-blur-xl border border-primary/20 rounded-full shadow-2xl flex items-center gap-6"
          >
            <div className="flex items-center gap-2">
              <MousePointer2 className={cn("w-4 h-4 animate-bounce", primaryColorClass)} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {selectedIds.length} Signals Selected
              </span>
            </div>

            <div className="h-6 w-[1px] bg-white/10" />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                className="h-8 text-[9px] font-bold border-red-500/20 text-red-400 hover:bg-red-500/20 bg-red-500/10 rounded-full px-4"
                onClick={() => handleBulkAction('reject')}
              >
                <XCircle className="w-3.5 h-3.5 mr-2" />
                BULK REJECT
              </Button>
              <Button
                size="sm"
                disabled={isProcessing}
                className={cn("h-8 text-[9px] font-black text-black hover:bg-white transition-all shadow-lg rounded-full px-6", accentBgClass)}
                onClick={() => handleBulkAction('approve')}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                BULK DEPLOY
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-white"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2 px-4 border-t border-primary/10 bg-black/20 flex items-center justify-between">
        <div className="flex gap-4">
           <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-[9px] uppercase text-muted-foreground">Approved: {data.filter(i => i.status === 'approved').length}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-red-500" />
              <span className="text-[9px] uppercase text-muted-foreground">Rejected: {data.filter(i => i.status === 'rejected').length}</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <AlertTriangle className="w-3 h-3 text-yellow-500 animate-pulse" />
           <span className="text-[9px] text-yellow-500 font-bold uppercase tracking-tighter">Integrity Check Passing</span>
        </div>
      </div>
    </div>
  );
};
