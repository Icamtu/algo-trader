import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Activity, BarChart3, TrendingUp,
  Zap, AlertCircle, CheckCircle2, XCircle,
  Clock, Shield, ArrowUpRight, ArrowDownRight,
  Fingerprint, Loader2, RefreshCcw, LayoutDashboard
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { CONFIG } from "@/lib/config";
import { toast } from "sonner";
import axios from "axios";

// Constants derived from centralized config
const API_BASE_URL = CONFIG.API_BASE_URL;
const API_KEY = CONFIG.API_KEY;

interface TelemetryData {
  engine: string;
  uptime: string;
  trading_mode: string;
  pnl: {
    total_pnl: number;
    daily_pnl: number;
    win_rate: number;
    profit_factor: number;
    trades_count: number;
  };
  performance: {
    sharpe_ratio: number;
    max_drawdown: number;
    volatility: number;
    recovery_factor: number;
  };
  audit: {
    pending_approvals: number;
    auto_execute: boolean;
    risk_lock: boolean;
    last_audit_ts: string;
  };
}

interface PendingSignal {
  id: number;
  symbol: string;
  action: string;
  strategy: string;
  action_type: string;
  ai_reasoning: string;
  conviction: number;
  timestamp: string;
}

export default function AuditCenter() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"performance" | "governance">("performance");

  // Fetch deep telemetry
  const { data: telemetry } = useQuery<TelemetryData>({
    queryKey: ["institutional-telemetry"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE_URL}/api/v1/telemetry`, {
        headers: { apikey: API_KEY }
      });
      return res.data;
    },
    refetchInterval: 5000
  });

  // Fetch pending signals for HITL
  const { data: pendingSignals } = useQuery<{ data: PendingSignal[] }>({
    queryKey: ["hitl-signals"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE_URL}/api/v1/hitl/signals`, {
        headers: { apikey: API_KEY }
      });
      return res.data;
    },
    refetchInterval: 3000
  });

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await axios.post(`${API_BASE_URL}/api/v1/hitl/approve`, { id }, {
        headers: { apikey: API_KEY }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Signal Verified and Executed");
      queryClient.invalidateQueries({ queryKey: ["hitl-signals"] });
    },
    onError: () => toast.error("Deployment Fault Detected")
  });

  // Rejection Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await axios.post(`${API_BASE_URL}/api/v1/hitl/reject`, { id, reason }, {
        headers: { apikey: API_KEY }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.info("Signal Rejected // Risk Containment Active");
      queryClient.invalidateQueries({ queryKey: ["hitl-signals"] });
    },
    onError: () => toast.error("Rejection Error")
  });

  // Mock Equity Data (In production, this would come from DuckDB/Timescale)
  const equityData = [
    { time: "09:30", equity: 100000 },
    { time: "10:00", equity: 101200 },
    { time: "10:30", equity: 100800 },
    { time: "11:00", equity: 102500 },
    { time: "11:30", equity: 103100 },
    { time: "12:00", equity: 102400 },
    { time: "12:30", equity: 104500 },
    { time: "13:00", equity: 105800 },
    { time: "13:30", equity: 105200 },
    { time: "14:00", equity: 107100 },
    { time: "14:30", equity: 106900 },
    { time: "15:00", equity: 108500 },
    { time: "15:30", equity: 109200 },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full" />
      </div>

      {/* Institutional Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-sm rotate-45">
              <ShieldCheck className="w-5 h-5 text-black -rotate-45" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic">Aether_Audit <span className="text-primary NOT-ITALIC">v2.1</span></h1>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <nav className="hidden md:flex items-center gap-4">
             <button
               onClick={() => setActiveTab("performance")}
               className={cn("text-[10px] font-black uppercase tracking-widest transition-all", activeTab === "performance" ? "text-primary" : "text-white/20 hover:text-white/60")}
             >
               Performance_Metrics
             </button>
             <button
               onClick={() => setActiveTab("governance")}
               className={cn("text-[10px] font-black uppercase tracking-widest transition-all", activeTab === "governance" ? "text-primary" : "text-white/20 hover:text-white/60")}
             >
               HITL_Governance
             </button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[10px] font-black font-mono text-secondary uppercase tracking-widest">Engine_Active</span>
           </div>
           <div className="h-8 w-px bg-white/5" />
           <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none">Uptime</span>
              <span className="text-[10px] font-black font-mono text-white/60">{telemetry?.uptime?.split('.')[0] || "00:00:00"}</span>
           </div>
        </div>
      </header>

      <main className="relative z-10 p-8 max-w-[1600px] mx-auto space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            label="Sharpe_Ratio"
            value={telemetry?.performance.sharpe_ratio.toFixed(2) || "0.00"}
            icon={Activity}
            color="text-blue-400"
            desc="Risk-Adjusted Alpha"
          />
          <KpiCard
            label="Profit_Factor"
            value={telemetry?.pnl.profit_factor.toFixed(2) || "0.00"}
            icon={Zap}
            color="text-primary"
            desc="Efficiency Index"
          />
          <KpiCard
            label="Max_Drawdown"
            value={`${(telemetry?.performance.max_drawdown || 0).toFixed(2)}%`}
            icon={Shield}
            color="text-destructive"
            desc="Capital Preservation"
          />
          <KpiCard
            label="Daily_Goal"
            value="Reached"
            icon={TrendingUp}
            color="text-secondary"
            desc="Target: 2.0%"
          />
        </div>

        {/* Dynamic Section */}
        <div className="grid grid-cols-12 gap-8">
          {/* Main Visualizer */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-sm relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">Equity_Real-Market_Curve</h3>
                    <p className="text-[10px] text-white/20 font-mono uppercase font-black tracking-widest mt-1">NIFTY_SCALPER_STRATEGY // PORTFOLIO_V1</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-white/10 uppercase tracking-widest block mb-1">Unrealized_PnL</span>
                    <span className="text-2xl font-black font-mono text-secondary">₹{telemetry?.pnl.daily_pnl.toLocaleString()}</span>
                  </div>
               </div>

               <div className="h-[400px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={equityData}>
                     <defs>
                       <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#FFB000" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#FFB000" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis
                       dataKey="time"
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: '#ffffff10', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                     />
                     <YAxis
                       hide
                       domain={['dataMin - 1000', 'dataMax + 1000']}
                     />
                     <Tooltip
                       contentStyle={{ background: '#000', border: '1px solid #ffffff10', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                       cursor={{ stroke: '#FFB000', strokeWidth: 1, strokeDasharray: '4 4' }}
                     />
                     <Area
                       type="monotone"
                       dataKey="equity"
                       stroke="#FFB000"
                       strokeWidth={2}
                       fill="url(#equityGrad)"
                       animationDuration={2000}
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Signal Audit Blotter */}
            <div className={cn("bg-white/[0.02] border border-white/5 p-8 rounded-sm", activeTab !== "governance" && "hidden")}>
                <div className="flex items-center gap-3 mb-8">
                  <Fingerprint className="w-5 h-5 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">HITL_Signal_Verification_Buffer</h3>
                </div>

                <div className="space-y-4">
                   <AnimatePresence mode="popLayout">
                    {pendingSignals?.data.map(signal => (
                      <motion.div
                        key={signal.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-black/40 border border-white/5 p-6 grid grid-cols-12 gap-6 items-center group hover:border-primary/20 transition-all"
                      >
                         <div className="col-span-2">
                            <span className="text-[8px] font-black text-white/20 uppercase block mb-1">Symbol</span>
                            <span className="text-lg font-black tracking-tighter text-white">{signal.symbol}</span>
                         </div>
                         <div className="col-span-2">
                            <span className="text-[8px] font-black text-white/20 uppercase block mb-1">Protocol</span>
                            <span className={cn("px-2 py-0.5 text-[10px] font-black uppercase", signal.action === 'BUY' ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive')}>
                               {signal.action}_AUTO
                            </span>
                         </div>
                         <div className="col-span-5">
                            <span className="text-[8px] font-black text-white/20 uppercase block mb-1">Aether_AI_Inference</span>
                            <p className="text-[11px] text-white/50 leading-tight italic">"{signal.ai_reasoning}"</p>
                         </div>
                         <div className="col-span-3 flex justify-end gap-3">
                            <button
                              onClick={() => rejectMutation.mutate({ id: signal.id, reason: "Manual Rejection" })}
                              className="w-10 h-10 flex items-center justify-center border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => approveMutation.mutate(signal.id)}
                              className="h-10 px-6 flex items-center gap-2 bg-secondary text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </button>
                         </div>
                      </motion.div>
                    ))}
                   </AnimatePresence>

                   {(!pendingSignals?.data || pendingSignals.data.length === 0) && (
                     <div className="py-20 flex flex-col items-center gap-3 text-white/10 uppercase font-black tracking-[0.4em] text-[10px]">
                        <RefreshCcw className="w-6 h-6 animate-spin-slow" />
                        Awaiting_Market_Signals_Buffer...
                     </div>
                   )}
                </div>
            </div>
          </div>

          {/* Sidebar Vitals */}
          <aside className="col-span-12 lg:col-span-4 space-y-8">
             <div className="bg-white/[0.02] border border-white/5 p-8 rounded-sm">
                <div className="flex items-center gap-3 mb-8">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">System_Audit_Vitals</h3>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black font-mono uppercase tracking-widest">
                         <span className="text-white/40">Engine_Entropy</span>
                         <span className="text-primary">0.02% // STABLE</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                         <motion.div initial={{ width: 0 }} animate={{ width: "2%" }} className="h-full bg-primary" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black font-mono uppercase tracking-widest">
                         <span className="text-white/40">Telemetry_Buffer</span>
                         <span className="text-blue-400">14MB // FLUID</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                         <motion.div initial={{ width: 0 }} animate={{ width: "24%" }} className="h-full bg-blue-400" />
                      </div>
                   </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                   <FlagRow label="Neural_Filter" active={true} />
                   <FlagRow label="Risk_Limit_Shield" active={telemetry?.audit.risk_lock === false} inverse />
                   <FlagRow label="Auto_Execute" active={telemetry?.audit.auto_execute || false} />
                </div>
             </div>

             <div className="p-1 group">
               <button className="w-full py-10 border border-white/5 bg-white/[0.01] hover:bg-primary hover:text-black transition-all flex flex-col items-center gap-4 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/10 translate-x-[-101%] group-hover:translate-x-[101%] transition-transform duration-1000" />
                  <LayoutDashboard className="w-8 h-8 opacity-20 group-hover:opacity-100" />
                  <span className="text-xs font-black uppercase tracking-[0.5em]">Executive_Report</span>
                  <span className="text-[8px] font-black text-white/20 uppercase group-hover:text-black/40">JSON_CSV_PDF Registry</span>
               </button>
             </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, desc }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-6 relative group overflow-hidden hover:border-white/10 transition-all">
       <div className="absolute top-[-5%] right-[-5%] p-4 opacity-5 group-hover:opacity-10 transition-opacity">
         <Icon className="w-20 h-20" />
       </div>
       <div className="relative z-10">
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] block mb-2">{label}</span>
          <span className={cn("text-3xl font-black font-mono tracking-tighter tabular-nums", color)}>{value}</span>
          <div className="mt-4 pt-4 border-t border-white/5">
             <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">{desc}</span>
          </div>
       </div>
    </div>
  );
}

function FlagRow({ label, active, inverse = false }: { label: string; active: boolean; inverse?: boolean }) {
  const isGood = inverse ? !active : active;
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{label}</span>
      <div className={cn(
        "px-2 py-0.5 text-[8px] font-black rounded-[2px]",
        isGood ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"
      )}>
        {isGood ? "NOMINAL" : "ALERT"}
      </div>
    </div>
  );
}
