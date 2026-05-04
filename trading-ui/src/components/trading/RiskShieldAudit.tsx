import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Zap,
  ZapOff,
  Activity,
  AlertOctagon,
  RefreshCw,
  Eye,
  Settings2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { algoApi } from '@/features/aetherdesk/api/client';
import { useAppModeStore } from '@/stores/appModeStore';

interface TelemetryData {
  audit: {
    auto_execute: boolean;
    last_audit_ts: string;
    pending_approvals: number;
    risk_lock: boolean;
  };
  engine: string;
  uptime: string;
  trading_mode: string;
  pnl: any;
  performance: any;
}

export const RiskShieldAudit = () => {
  const { mode } = useAppModeStore();
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const isAD = mode === 'AD';

  const fetchTelemetry = async () => {
    try {
      const data = await algoApi.getTelemetry();
      setTelemetry(data);
    } catch (error) {
      console.error("Failed to fetch telemetry", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoExecute = async () => {
    setProcessing(true);
    try {
      const newState = !telemetry?.audit.auto_execute;
      await algoApi.toggleAutoExecute(newState);

      toast.success(newState ? "AUTOPILOT ARMED" : "MANUAL OVERSIGHT ENGAGED", {
        description: newState ? "Strategies will execute without manual confirmation." : "Manual approval required for all signals."
      });
      fetchTelemetry();
    } catch (error) {
      toast.error("COMMUNICATION ERROR", { description: "Failed to update audit state." });
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleRiskLock = async () => {
    setProcessing(true);
    try {
      const newState = !telemetry?.audit.risk_lock;
      await algoApi.toggleRiskLock(newState);

      toast.warning(newState ? "CORE RISK LOCK ENGAGED" : "CORE RISK LOCK RELEASED", {
        description: newState ? "All execution suspended immediately." : "Execution privileges restored."
      });
      fetchTelemetry();
    } catch (error) {
      toast.error("LOCKDOWN ERROR", { description: "Failed to toggle risk lock." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden font-mono shadow-2xl relative">
      {/* Dynamic Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
        <div className="flex items-center gap-4">
          <div className="relative">
            <ShieldCheck className={cn(
              "w-6 h-6 transition-colors duration-500",
              telemetry?.audit.risk_lock ? "text-red-500" : (telemetry?.audit.auto_execute ? "text-cyan-400" : "text-amber-500")
            )} />
            {telemetry?.audit.auto_execute && !telemetry?.audit.risk_lock && (
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-cyan-400/30 rounded-full blur-sm"
              />
            )}
          </div>
          <div>
            <h2 className="text-sm font-black tracking-[0.2em] uppercase text-white/90">Institutional Control</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-muted-foreground uppercase">Engine: {telemetry?.engine || "Connecting..."}</span>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[9px] text-muted-foreground uppercase">Uptime: {telemetry?.uptime?.split('.')[0] || "0:00:00"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 gap-1.5 border-white/10 bg-black/40 text-[9px] font-bold px-2.5">
            <Activity className="w-3 h-3 text-cyan-400" />
            LIVE_FEED
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5" onClick={fetchTelemetry}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5 flex-1">
        {/* Pilar 1: Auto-Execute */}
        <div className="p-6 bg-slate-950/20 group hover:bg-slate-900/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              {telemetry?.audit.auto_execute ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5 opacity-50" />}
            </div>
            <Switch
              checked={telemetry?.audit.auto_execute || false}
              onCheckedChange={handleToggleAutoExecute}
              disabled={processing || telemetry?.audit.risk_lock}
              className="data-[state=checked]:bg-cyan-500 border-white/10"
            />
          </div>
          <h4 className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-1">Execution Mode</h4>
          <span className={cn(
             "text-lg font-black tracking-tighter transition-all",
             telemetry?.audit.auto_execute ? "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "text-white/30"
          )}>
            {telemetry?.audit.auto_execute ? "AUTOPILOT" : "MANUAL_HITL"}
          </span>
          <p className="text-[9px] text-white/30 mt-3 leading-relaxed">
            {telemetry?.audit.auto_execute
              ? "All validated signals will be routed to broker without confirmation."
              : "Human-In-The-Loop required for every execution order."}
          </p>
        </div>

        {/* Pilar 2: Risk Lock */}
        <div className="p-6 bg-slate-950/20 group hover:bg-slate-900/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              "p-2.5 rounded-xl transition-colors border",
              telemetry?.audit.risk_lock
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "bg-white/5 border-white/10 text-white/40"
            )}>
              {telemetry?.audit.risk_lock ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <Button
              size="sm"
              variant={telemetry?.audit.risk_lock ? "destructive" : "outline"}
              onClick={handleToggleRiskLock}
              disabled={processing}
              className={cn(
                "h-7 text-[9px] font-black tracking-widest px-4 rounded-full transition-all",
                telemetry?.audit.risk_lock ? "bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "border-white/10 hover:bg-white/5"
              )}
            >
              {telemetry?.audit.risk_lock ? "RELEASE" : "ENGAGE"}
            </Button>
          </div>
          <h4 className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-1">Risk Override</h4>
          <span className={cn(
             "text-lg font-black tracking-tighter transition-all",
             telemetry?.audit.risk_lock ? "text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]" : "text-white/30"
          )}>
            {telemetry?.audit.risk_lock ? "LOCKED" : "UNRESTRICTED"}
          </span>
          <p className="text-[9px] text-white/30 mt-3 leading-relaxed">
            {telemetry?.audit.risk_lock
              ? "Emergency Kill Switch active. All execution circuits severed."
              : "Standard safety protocols active. Risk units functional."}
          </p>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="p-6 bg-slate-950/40 grid grid-cols-3 gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] text-white/20 uppercase tracking-widest mb-1">Oversight Load</span>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-white/80 tabular-nums">
              {telemetry?.audit.pending_approvals || 0}
            </span>
            <span className="text-[9px] text-amber-500 font-bold mb-1.5 uppercase tracking-tighter">Pending Approval</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white/20 uppercase tracking-widest mb-1">System Health</span>
          <div className="flex items-end gap-2">
            <span className={cn(
               "text-2xl font-black tabular-nums",
               telemetry?.audit.risk_lock ? "text-red-500" : "text-cyan-400"
            )}>
              {telemetry?.audit.risk_lock ? "SUSPENDED" : "NOMINAL"}
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white/20 uppercase tracking-widest mb-1">Audit Log</span>
          <div className="flex items-end gap-2 overflow-hidden">
            <span className="text-[10px] font-mono text-white/40 truncate">
              Last Sync: {telemetry?.audit.last_audit_ts ? new Date(telemetry.audit.last_audit_ts).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Emergency Action */}
      <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-500/50" />
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Institutional Security Protocol v4.2</span>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" className="h-8 text-[10px] gap-2 text-white/60 hover:text-white hover:bg-white/5">
              <Eye className="w-3.5 h-3.5" />
              VIEW_LOGS
           </Button>
           <Button variant="ghost" className="h-8 text-[10px] gap-2 text-white/60 hover:text-white hover:bg-white/5">
              <Settings2 className="w-3.5 h-3.5" />
              CONFIGURE
           </Button>
        </div>
      </div>
    </div>
  );
};
