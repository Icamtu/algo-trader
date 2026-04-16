import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Check, 
  X, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Brain,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWebSocket } from '@/hooks/useWebSocket';

interface Signal {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  conviction: number;
  ai_reasoning: string;
  timestamp: string;
  strategy?: string;
  metadata?: {
    regime: string;
    volatility: string;
    vectors: Array<{ label: string, value: number }>;
  };
}

interface HITLSignalSidebarProps {
  onSelectSignal?: (signal: Signal | null) => void;
  selectedSignalId?: number | null;
}

export const HITLSignalSidebar = ({ onSelectSignal, selectedSignalId }: HITLSignalSidebarProps) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const fetchSignals = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/hitl/signals`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data || [];
        setSignals(data);
        // Auto-select first signal if none selected
        if (data.length > 0 && !selectedSignalId && onSelectSignal) {
           onSelectSignal(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch HITL signals", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'hitl_signal' && lastMessage.payload) {
      const newSignal = lastMessage.payload as Signal;
      setSignals(prev => {
        if (prev.some(s => s.id === newSignal.id)) return prev;
        
        if (newSignal.conviction > 0.8) {
          toast.warning("URGENT: High Conviction Signal", {
            description: `${newSignal.symbol} ${newSignal.action} @ ${newSignal.price}`,
            icon: <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
          });
        }
        
        const updated = [newSignal, ...prev];
        // If this is the only signal, select it
        if (updated.length === 1 && onSelectSignal) {
            onSelectSignal(newSignal);
        }
        return updated;
      });
    }

    if (lastMessage.type === 'hitl_update' && lastMessage.payload) {
      const { id, status } = lastMessage.payload as { id: number, status: string };
      if (status === 'approved' || status === 'rejected') {
        setSignals(prev => {
            const filtered = prev.filter(s => s.id !== id);
            if (selectedSignalId === id && onSelectSignal) {
                onSelectSignal(filtered.length > 0 ? filtered[0] : null);
            }
            return filtered;
        });
      }
    }
  }, [lastMessage, selectedSignalId, onSelectSignal]);

  const handleApprove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/hitl/approve`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success("Trade Approved", {
          description: "Signal promoted to live order successfully.",
          icon: <ShieldCheck className="w-4 h-4 text-green-500" />
        });
      }
    } catch (error) {
      toast.error("Approval Failed", { description: "Could not route order to broker." });
    }
  };

  const handleReject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:18788"}/api/v1/hitl/reject`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({ id, reason: 'Manual Rejection' })
      });
      toast.info("Signal Rejected", { description: "Signal has been suppressed." });
    } catch (error) {
      console.error("Reject failed", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-xl border-primary/10 overflow-hidden relative">
      <div className="p-4 border-b flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Deployment Desk</h2>
        </div>
        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 font-mono">
          {signals.length} ACTIVE
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {signals.map((signal) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onSelectSignal && onSelectSignal(signal)}
              >
                <Card className={cn(
                  "group relative overflow-hidden transition-all cursor-pointer border-white/5",
                  selectedSignalId === signal.id ? "ring-2 ring-primary bg-primary/10" : "hover:bg-white/[0.02]",
                  signal.action === 'BUY' ? "border-l-4 border-l-green-500/50" : "border-l-4 border-l-red-500/50"
                )}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black tracking-tight font-mono">{signal.symbol}</span>
                      <Badge variant="outline" className="text-[8px] h-4 bg-black/40 border-white/5 uppercase">
                        {signal.strategy || 'AETHER_AI'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                       <div className={cn(
                        "text-sm font-black tracking-tighter",
                        signal.action === 'BUY' ? "text-green-400" : "text-red-400"
                      )}>
                        {signal.action} @ {signal.price.toFixed(1)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">Q:{signal.quantity}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                       <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[9px] font-bold border-red-500/20 text-red-400 hover:bg-red-500/20 bg-red-500/5"
                        onClick={(e) => handleReject(e, signal.id)}
                      >
                         REJECT
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-[9px] font-black bg-primary text-black hover:bg-white transition-all shadow-lg shadow-primary/20"
                        onClick={(e) => handleApprove(e, signal.id)}
                      >
                         DEPLOY
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {signals.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
              <ShieldCheck className="w-10 h-10 mb-2 stroke-[1px]" />
              <p className="text-[8px] font-black uppercase tracking-[0.3em]">Buffer Clear</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t bg-black/40 flex items-center justify-between font-mono text-[8px]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground uppercase opacity-50">SYNC: 100%</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
    </div>
  );
};
