import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, BarChart3, Shield, Zap, Target, ArrowLeft, Download, Share2, Maximize2, Database, Loader2, Activity } from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  ComposedChart
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- Types ---
interface BacktestTrade {
  id: number;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  pnlPct?: number;
  mae: number;
  mfe: number;
}

interface BacktestResult {
  id?: string;
  name: string;
  date: string;
  cagr: number;
  sharpe: number;
  maxDD: number;
  winRate: number;
  pf: number;
  tradesCount: number;
  trades: BacktestTrade[];
  equityCurve: number[];
  metrics: Record<string, any>;
}

interface Props {
  result: BacktestResult;
  onClose: () => void;
}

// ... rest of the helper functions unchanged ...
const tabs = ["Equity Curve", "Trade List", "Distribution"] as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel-elevated rounded-md p-2 border border-border text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="mono-text">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export function BacktestAnalyticsView({ result, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Equity Curve");
  const [tradeSort, setTradeSort] = useState<"date" | "pnl" | "pnlPct">("date");
  const [isSaving, setIsSaving] = useState(false);

  const processedEquity = useMemo(() => {
    if (!result.equityCurve?.length) return [];
    let peak = -Infinity;
    return result.equityCurve.map((equity, i) => {
      peak = Math.max(peak, equity);
      const dd = ((equity - peak) / peak) * 100;
      return {
        index: i,
        equity,
        drawdown: Math.round(dd * 100) / 100,
      };
    });
  }, [result.equityCurve]);

  const processedTrades = useMemo(() => {
    if (!result.trades?.length) return [];
    return result.trades.map((t, i) => ({
      ...t,
      id: i + 1,
      pnlPct: Math.round((t.pnl / (t.entry_price * t.quantity)) * 10000) / 100,
      date: t.entry_time.split(" ")[0],
    }));
  }, [result.trades]);

  const handleSaveToDB = async () => {
    setIsSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        toast.error("AUTH_REQUIRED: ACCESS_DENIED");
        return;
      }

      const { error } = await supabase.from("backtest_results").insert({
        user_id: authData.user.id,
        strategy_name: result.name,
        instrument: "Basket",
        side: "Mixed",
        entry_price: 0,
        exit_price: 0,
        pnl: totalPnl,
        metadata: {
          metrics: result.metrics,
          equityCurve: result.equityCurve,
          trades: result.trades
        } as any
      });

      if (error) throw error;
      toast.success("SIMULATION_ARCHIVED: KERNEL_SYNC_COMPLETE");
    } catch (err: any) {
      toast.error("SYNC_FAILURE: " + (err.message || "UNKNOWN_ERROR"));
    } finally {
      setIsSaving(false);
    }
  };

  const sortedTrades = useMemo(() => {
    const t = [...processedTrades];
    if (tradeSort === "pnl") t.sort((a, b) => b.pnl - a.pnl);
    else if (tradeSort === "pnlPct") t.sort((a, b) => (b.pnlPct || 0) - (a.pnlPct || 0));
    else t.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
    return t;
  }, [processedTrades, tradeSort]);

  const totalPnl = result.metrics?.net_pnl || result.metrics?.net_profit || 0;
  const winCount = result.trades?.filter(t => t.pnl > 0).length || 0;
  const lossCount = (result.trades?.length || 0) - winCount;
  const avgWin = result.trades?.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / (winCount || 1);
  const avgLoss = result.trades?.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0) / (lossCount || 1);

  const pnlBuckets = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = -10; i <= 10; i++) buckets[`${i}%`] = 0;
    processedTrades.forEach(t => {
      const b = Math.max(-10, Math.min(10, Math.round(t.pnlPct || 0)));
      buckets[`${b}%`] = (buckets[`${b}%`] || 0) + 1;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count, value: parseInt(range) }));
  }, [processedTrades]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background industrial-grid overflow-hidden">
      <div className="scanline" />
      
      {/* Simulation Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/10 relative z-10">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 border border-border group hover:border-primary transition-all">
            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
          </button>
          <div>
            <h2 className="text-xl font-black font-mono uppercase tracking-[0.2em] text-foreground leading-none mb-2">{result.name}</h2>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Runtime: {result.date}</span>
               <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.5)]" />
               <span className="text-[10px] font-mono text-secondary uppercase font-black">{result.tradesCount.toLocaleString()} DATA_POINTS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-background border border-border/50 overflow-hidden mr-4">
            {[
              { label: "CAGR", value: `${result.cagr}%`, color: "text-secondary" },
              { label: "SHARPE", value: `${result.sharpe}`, color: "text-primary" },
              { label: "MAX_DD", value: `${result.maxDD}%`, color: "text-destructive" },
              { label: "WIN_RATE", value: `${result.winRate}%`, color: "text-foreground" },
            ].map(s => (
              <div key={s.label} className="px-5 py-2 border-r border-border/30 last:border-0 bg-card/5">
                <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest mb-1">{s.label}</div>
                <div className={`text-sm font-mono font-black ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          
          <button
            onClick={handleSaveToDB}
            disabled={isSaving}
            className={`flex items-center gap-3 px-5 py-2.5 border-2 transition-all group ${
              isSaving 
                ? "border-muted text-muted-foreground" 
                : "border-primary text-primary hover:bg-primary hover:text-black shadow-[0_0_15px_rgba(255,176,0,0.2)]"
            }`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em]">PERSIST_TO_KERNEL</span>
          </button>

          <button onClick={onClose} className="p-2 ml-2 hover:bg-destructive/10 group transition-all">
            <X className="w-5 h-5 text-muted-foreground group-hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Navigation Matrix */}
      <div className="flex px-6 pt-4 gap-0 border-b border-border z-10">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 text-[10px] font-mono font-black uppercase tracking-[0.3em] transition-all relative ${
              activeTab === tab
                ? "text-primary bg-primary/5"
                : "text-muted-foreground/40 hover:text-foreground hover:bg-card/5"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeAnalyticsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Core Readout Area */}
      <div className="flex-1 overflow-auto p-6 space-y-8 no-scrollbar z-10 relative">
        {activeTab === "Equity Curve" && (
          <div className="space-y-6">
            <div className="bg-background border border-border p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] flex items-center gap-3">
                   <Activity className="w-4 h-4 text-primary" /> Alpha_Traction_Map
                </h3>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedEquity}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="index" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke="var(--secondary)" fill="url(#eqGrad)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-background border border-border p-6">
              <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] text-destructive flex items-center gap-3 mb-6">
                <TrendingDown className="w-4 h-4" /> Structural_Drain_Analysis
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedEquity}>
                    <defs>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="index" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Area type="monotone" dataKey="drawdown" stroke="var(--destructive)" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Trade List" && (
          <div className="space-y-6">
            <div className="grid grid-cols-6 gap-0 border border-border bg-card/5">
              {[
                { label: "Aggregate_Flux", value: result.tradesCount, color: "text-foreground" },
                { label: "Alpha_Vectors", value: winCount, color: "text-secondary" },
                { label: "Entropy_Loss", value: lossCount, color: "text-destructive" },
                { label: "Sim_Net_Exposure", value: `₹${Math.round(totalPnl).toLocaleString()}`, color: totalPnl >= 0 ? "text-secondary" : "text-destructive" },
                { label: "Avg_Capture", value: `₹${Math.round(avgWin).toLocaleString()}`, color: "text-secondary" },
                { label: "Avg_Drain", value: `₹${Math.round(avgLoss).toLocaleString()}`, color: "text-destructive" },
              ].map(m => (
                <div key={m.label} className="p-5 border-r border-border/30 last:border-0 hover:bg-card/10 transition-colors group">
                  <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2 group-hover:text-primary transition-colors">{m.label}</div>
                  <div className={`text-lg font-mono font-black ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-background border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card/10 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono font-black uppercase text-muted-foreground tracking-widest">Trade_Log_Array</span>
                 </div>
                 <div className="flex items-center gap-2">
                   {(["date", "pnl", "pnlPct"] as const).map(s => (
                     <button
                       key={s}
                       onClick={() => setTradeSort(s)}
                       className={`px-3 py-1 text-[8px] font-mono font-black uppercase tracking-[0.2em] border transition-all ${
                         tradeSort === s ? "border-primary bg-primary text-black" : "border-border/50 text-muted-foreground/40 hover:text-foreground"
                       }`}
                     >
                       {s}
                     </button>
                   ))}
                 </div>
              </div>
              <div className="overflow-auto max-h-[calc(100vh-450px)] no-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="border-b border-border text-muted-foreground/40">
                      {["Index", "Timestamp", "Volume", "Entry_Base", "Exit_Base", "P&L_Delta", "Net%", "MAE", "MFE"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[9px] font-mono font-black uppercase tracking-[0.2em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-primary/5 transition-all group">
                        <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground/30">{t.id}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground/60">{t.date}</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-black text-foreground/80">{t.quantity}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-foreground/60">₹{t.entry_price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-foreground/60">₹{t.exit_price.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-[10px] font-mono font-black ${t.pnl >= 0 ? "text-secondary" : "text-destructive"}`}>
                          {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 text-[10px] font-mono font-black ${t.pnlPct >= 0 ? "text-secondary" : "text-destructive"}`}>
                          {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct}%
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold text-destructive/60">{t.mae}%</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold text-secondary/60">+{t.mfe}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Distribution" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-background border border-border p-6 shadow-2xl">
              <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] text-foreground mb-8 border-b border-border/50 pb-2">Entropy_Distribution (P&L %)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x="0%" stroke="rgba(255,255,255,0.1)" />
                    <Bar dataKey="count" radius={[1, 1, 0, 0]}>
                      {pnlBuckets.map((entry, i) => (
                        <Cell key={i} fill={entry.value >= 0 ? 'var(--secondary)' : 'var(--destructive)'} fillOpacity={0.6} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-background border border-border p-6 shadow-2xl">
              <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] text-foreground mb-8 border-b border-border/50 pb-2">Vector_Excursion_Matrix (MAE vs MFE)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" dataKey="mae" name="MAE" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} label={{ value: "ADVERSE (%)", fontSize: 8, fill: 'rgba(255,255,255,0.2)', position: "bottom", fontFamily: 'IBM Plex Mono' }} />
                    <YAxis type="number" dataKey="mfe" name="MFE" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} label={{ value: "FAVORABLE (%)", fontSize: 8, fill: 'rgba(255,255,255,0.2)', angle: -90, position: "left", fontFamily: 'IBM Plex Mono' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Scatter name="Vectors" data={processedTrades} fill="var(--primary)" fillOpacity={0.4} r={4} strokeWidth={1} stroke="var(--primary)" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card/5 border border-border p-6">
               <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] text-primary mb-6">Aggregate_Expectancy_Readout</h3>
               <div className="space-y-4">
                  <div className="flex justify-between border-l-2 border-primary/20 pl-4 py-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Expected_Value_per_Cycle</span>
                    <span className={`text-[12px] font-mono font-black ${totalPnl / result.tradesCount >= 0 ? "text-secondary" : "text-destructive"}`}>
                      ₹{Math.round(totalPnl / result.tradesCount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-l-2 border-primary/20 pl-4 py-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Efficiency_Ratio (Capture/Drain)</span>
                    <span className="text-[12px] font-mono font-black text-primary">{Math.abs(avgWin / avgLoss).toFixed(2)}X</span>
                  </div>
                  <div className="flex justify-between border-l-2 border-primary/20 pl-4 py-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Kelly_Fractional_Threshold</span>
                    <span className="text-[12px] font-mono font-black text-secondary">
                      {(((winCount / result.tradesCount) - ((lossCount / result.tradesCount) / (Math.abs(avgWin / avgLoss) || 1))) * 100).toFixed(1)}%
                    </span>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
