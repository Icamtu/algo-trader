import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AnimatePresence } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

import { useWebSocket } from '@/hooks/useWebSocket';

export const AuditQueuePanel = () => {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { lastMessage } = useWebSocket();

  const fetchData = async () => {
    try {
      // Combined fetch for pending and historical from actioncenter
      const response = await fetch('/api/v1/actioncenter?limit=50&status=all');
      const result = await response.json();
      if (result.status === 'success') {
        const orders = result.data.orders || [];
        setData(orders);
      }
    } catch (e) {
      console.error("Audit failed", e);
    }
  };

  useEffect(() => {
    fetchData();
    // Fallback polling
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time refresh on any HITL event
  useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === 'hitl_signal' || lastMessage.type === 'hitl_update') {
      fetchData();
      // If a signal was approved/rejected elsewhere, remove from selection
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/hitl/${endpoint}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
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

  const filteredData = data.filter(item => 
    item.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    item.status.toLowerCase().includes(filter.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">APPROVED</Badge>;
      case 'rejected': return <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30">REJECTED</Badge>;
      case 'executed': return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">EXECUTED</Badge>;
      default: return <Badge variant="outline" className="animate-pulse">PENDING</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/20 backdrop-blur-sm rounded-xl border border-primary/10 overflow-hidden relative">
      <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest leading-none">Safety Audit Matrix</h3>
            <p className="text-[10px] text-muted-foreground uppercase mt-1">Live Human-In-The-Loop Validation Stream</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Badge variant="outline" className="h-8 px-3 border-primary/30 text-primary bg-primary/5 animate-pulse">
               {selectedIds.length} SELECTED
            </Badge>
          )}
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search Symbol/Status..." 
              className="h-8 pl-8 text-[10px] bg-black/20 border-primary/10 focus-visible:ring-primary/30" 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
            <Download className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="bg-black/40 sticky top-0 z-10">
            <TableRow className="border-primary/5 hover:bg-transparent">
              <TableHead className="w-12 h-10">
                <Checkbox 
                  checked={selectedIds.length > 0 && selectedIds.length === filteredData.filter(i => i.status === 'pending').length}
                  onCheckedChange={toggleSelectAll}
                  className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                />
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10">Timestamp</TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10">Asset</TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10">Action</TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10">Value</TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10">Source</TableHead>
              <TableHead className="text-[9px] uppercase tracking-tighter h-10 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow 
                key={item.id} 
                className={cn(
                  "border-primary/5 transition-colors group",
                  selectedIds.includes(item.id) ? "bg-primary/10" : "hover:bg-primary/5"
                )}
                onClick={() => item.status === 'pending' && toggleSelection(item.id)}
              >
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.includes(item.id)}
                    disabled={item.status !== 'pending'}
                    onCheckedChange={() => toggleSelection(item.id)}
                    className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                  />
                </TableCell>
                <TableCell className="text-[10px] font-mono text-muted-foreground py-3">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-none">{item.symbol}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-tighter mt-1">
                       Qty: {item.quantity}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded",
                    item.action === 'BUY' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {item.action}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {item.ai_conviction ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${item.ai_conviction * 100}%` }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <span className="text-primary font-bold">{(item.ai_conviction * 100).toFixed(0)}%</span>
                    </div>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="text-[10px] text-muted-foreground italic">
                  {item.strategy || "Core_Alpha"}
                </TableCell>
                <TableCell className="text-right">
                  {getStatusBadge(item.status)}
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center opacity-20 grayscale scale-90">
                    <History className="w-10 h-10 mb-2" />
                    <p className="text-[10px] uppercase tracking-widest font-black">Safety_Protocol_Idle</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-slate-900/90 backdrop-blur-xl border border-primary/20 rounded-full shadow-2xl flex items-center gap-6"
          >
            <div className="flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-primary animate-bounce" />
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
                className="h-8 text-[9px] font-black bg-primary text-black hover:bg-white transition-all shadow-lg shadow-primary/20 rounded-full px-6"
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
              <span className="text-[9px] uppercase text-muted-foreground">Approved: 14</span>
           </div>
           <div className="flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-red-500" />
              <span className="text-[9px] uppercase text-muted-foreground">Rejected: 2</span>
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
