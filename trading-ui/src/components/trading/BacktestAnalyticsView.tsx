import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, BarChart3, Shield, Zap, Target, ArrowLeft, Download, Database, Loader2, Activity, ArrowDownLeft, Layers } from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ... [rest of types and helper components like StatCard] ...

interface BacktestTrade {
  id: number;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  charges: number;
  pnlPct?: number;
  mae: number;
  mfe: number;
}

interface BacktestResult {
  strategy_id?: string;
  symbol: string;
  date: string;
  name: string;
  cagr: number;
  sharpe: number;
  sortino?: number;
  maxDD: number;
  winRate: number;
  tradesCount: number;
  trades: BacktestTrade[];
  equityCurve: number[];
  benchmarkCurve?: number[];
  metrics: {
    k_ratio?: number;
    omega_ratio?: number;
    alpha?: number;
    beta?: number;
    tracking_error?: number;
    info_ratio?: number;
    stability?: number;
    profit_factor?: number;
    recovery_factor?: number;
    expectancy?: number;
    avg_win?: number;
    avg_loss?: number;
    max_win?: number;
    max_loss?: number;
    total_charges?: number;
    net_profit?: number;
    win_rate_pct?: number;
    [key: string]: any;
  };
}

interface Props {
  result: BacktestResult;
  onClose: () => void;
}

const StatCard = ({ label, value, subValue, icon, color = "text-foreground" }: any) => (
  <div className="bg-card/5 border border-border p-4 group hover:border-primary/50 transition-all relative overflow-hidden">
    <div className="absolute top-0 right-0 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
      {icon}
    </div>
    <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-xl font-mono font-black ${color}`}>{value}</div>
    {subValue && <div className="text-[9px] font-mono text-muted-foreground/60 mt-1 uppercase leading-none">{subValue}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border border-border p-2 text-[10px] font-mono shadow-2xl backdrop-blur-md">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-black flex justify-between gap-4">
          <span>{p.name}:</span>
          <span>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const tabs = ["Equity Curve", "Trade List", "Institutional", "Distribution"] as const;

export function BacktestAnalyticsView({ result, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Equity Curve");
  const [tradeSort, setTradeSort] = useState<"date" | "pnl" | "pnlPct">("date");
  const [isSaving, setIsSaving] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(true);

  const processedEquity = useMemo(() => {
    if (!result.equityCurve?.length) return [];
    let peak = -Infinity;
    return result.equityCurve.map((equity, i) => {
      peak = Math.max(peak, equity);
      const dd = ((equity - peak) / peak) * 100;
      return {
        index: i,
        equity,
        benchmark: result.benchmarkCurve?.[i],
        drawdown: Math.round(dd * 100) / 100,
      };
    });
  }, [result.equityCurve, result.benchmarkCurve]);

  const processedTrades = useMemo(() => {
    if (!result.trades?.length) return [];
    return result.trades.map((t, i) => ({
      ...t,
      id: i + 1,
      pnlPct: Math.round((t.pnl / (Math.max(1, t.entry_price * t.quantity))) * 10000) / 100,
      date: t.entry_time.split(" ")[0],
    }));
  }, [result.trades]);

  const sortedTrades = useMemo(() => {
    const t = [...processedTrades];
    if (tradeSort === "pnl") t.sort((a, b) => b.pnl - a.pnl);
    else if (tradeSort === "pnlPct") t.sort((a, b) => (b.pnlPct || 0) - (a.pnlPct || 0));
    else t.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
    return t;
  }, [processedTrades, tradeSort]);

  const totalGross = result.metrics?.gross_pnl || result.metrics?.gross_profit || 0;
  const totalCharges = result.metrics?.total_charges || 0;
  const totalPnl = result.metrics?.net_pnl || result.metrics?.net_profit || (totalGross - totalCharges);
  const winCount = result.trades?.filter(t => t.pnl > 0).length || 0;
  const lossCount = (result.trades?.length || 0) - winCount;
  const avgWin = result.metrics?.avg_win || 0;
  const avgLoss = result.metrics?.avg_loss || 0;

  const pnlBuckets = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = -10; i <= 10; i++) buckets[`${i}%`] = 0;
    processedTrades.forEach(t => {
      const b = Math.max(-10, Math.min(10, Math.round(t.pnlPct || 0)));
      buckets[`${b}%`] = (buckets[`${b}%`] || 0) + 1;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count, value: parseInt(range) }));
  }, [processedTrades]);

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest_${result.strategy_id || 'export'}_${result.symbol}.json`;
      a.click();
    } else {
      const headers = Object.keys(result.trades[0] || {}).join(',');
      const rows = result.trades.map(t => Object.values(t).map(v => typeof v === 'string' ? `"${v}"` : v).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest_${result.strategy_id || 'export'}_${result.symbol}.csv`;
      a.click();
    }
  };

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
        instrument: result.symbol,
        side: "ALGO",
        entry_price: 0,
        exit_price: 0,
        pnl: totalPnl,
        metadata: result as any
      });
      if (error) throw error;
      toast.success("SIMULATION_ARCHIVED: KERNEL_SYNC_COMPLETE");
    } catch (err: any) {
      toast.error("SYNC_FAILURE: " + (err.message || "UNKNOWN_ERROR"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background industrial-grid overflow-hidden">
      <div className="scanline" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/10 relative z-10">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 border border-border group hover:border-primary transition-all">
            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
          </button>
          <div>
            <h2 className="text-xl font-black font-mono uppercase tracking-[0.2em] text-foreground leading-none mb-2">Backtest Result: {result.symbol}</h2>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Date: {result.date}</span>
               <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.5)]" />
               <span className="text-[10px] font-mono text-secondary uppercase font-black">{result.tradesCount} DATA_POINTS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-background border-border hover:border-primary/50 font-mono text-[10px] tracking-widest uppercase h-10 px-6">
                <Download className="w-4 h-4 mr-2" /> EXPORT_MATRIX
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border-border font-mono">
              <DropdownMenuItem onClick={() => handleExport('csv')} className="text-[10px] uppercase cursor-pointer hover:bg-primary/10">CSV_Flatfile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')} className="text-[10px] uppercase cursor-pointer hover:bg-primary/10">JSON_Structure</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleSaveToDB}
            disabled={isSaving}
            className="font-mono text-[10px] tracking-widest uppercase h-10 px-6 bg-primary text-black hover:bg-primary/80"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
            PERSIST_TO_KERNEL
          </Button>

          <button onClick={onClose} className="p-2 hover:bg-destructive/10 group transition-all">
            <X className="w-5 h-5 text-muted-foreground group-hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Tabs Nav */}
      <div className="flex px-6 pt-4 gap-2 border-b border-border z-10 bg-card/5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 text-[10px] font-mono font-black uppercase tracking-[0.3em] transition-all relative ${
              activeTab === tab ? "text-primary" : "text-muted-foreground/40 hover:text-foreground"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeAnalyticsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8 custom-scrollbar z-10 relative">
        {/* High Density Summary Bar Always Visible? No, let's keep it in the tabs for better focus */}

        {activeTab === "Equity Curve" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* The High Density Summary Box */}
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="Vector_Efficiency"
                value={result.metrics.profit_factor?.toFixed(2) || "N/A"}
                subValue={`PF: ${result.metrics.expectancy > 0 ? '+' : ''}${Math.round(result.metrics.expectancy || 0)} avg`}
                icon={<TrendingUp className="w-3 h-3" />}
                color="text-primary"
              />
              <StatCard
                label="Strike_Velocity"
                value={`${result.winRate.toFixed(1)}%`}
                subValue={`${Math.round(result.tradesCount / (result.equityCurve.length || 1))} signals/day`}
                icon={<Target className="w-3 h-3" />}
                color="text-secondary"
              />
              <StatCard
                label="Risk_Adjusted"
                value={result.sharpe.toFixed(2)}
                subValue={`Sortino: ${result.sortino?.toFixed(2) || 'N/A'}`}
                icon={<Shield className="w-3 h-3" />}
              />
              <StatCard
                label="Drawdown_Gate"
                value={`-${result.maxDD.toFixed(1)}%`}
                subValue={`Recovery: ${result.metrics.recovery_factor?.toFixed(1)}x`}
                icon={<ArrowDownLeft className="w-3 h-3" />}
                color="text-destructive"
              />
              <StatCard
                label="Projected_Yield"
                value={`${result.cagr.toFixed(1)}%`}
                subValue={`CAGR: ${result.metrics.stability > 0.8 ? 'Stable' : 'Volatile'}`}
                icon={<Zap className="w-3 h-3" />}
                color="text-secondary"
              />
            </div>

            <div className="bg-background border border-border p-6 shadow-2xl relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] flex items-center gap-3">
                   <Activity className="w-4 h-4 text-primary" /> Alpha_Traction_Map
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBenchmark(!showBenchmark)}
                    className={`px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest border border-border transition-all ${showBenchmark ? "bg-primary/20 text-primary border-primary/50" : "text-muted-foreground/30"}`}
                  >
                    Benchmark: {showBenchmark ? "ACTIVE" : "HIDDEN"}
                  </button>
                </div>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedEquity}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="index" hide />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke="var(--secondary)" fill="url(#eqGrad)" strokeWidth={2.5} dot={false} name="Strategy" />
                    {showBenchmark && result.benchmarkCurve && (
                      <Area type="monotone" dataKey="benchmark" stroke="var(--primary)" fill="none" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Benchmark" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-background border border-border p-6 shadow-xl">
               <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-destructive mb-6 flex items-center gap-2">
                 <TrendingDown className="w-3 h-3" /> Drawdown_Array
               </h4>
               <div className="h-[150px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={processedEquity}>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                     <XAxis dataKey="index" hide />
                     <YAxis tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                     <Tooltip content={<CustomTooltip />} />
                     <Area type="monotone" dataKey="drawdown" stroke="var(--destructive)" fill="url(#ddGrad)" strokeWidth={1} dot={false} name="DD" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {activeTab === "Trade List" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-6 gap-0 border border-border bg-card/5">
              {[
                { label: "Aggregate_Flux", value: result.tradesCount, color: "text-foreground" },
                { label: "Alpha_Vectors", value: winCount, color: "text-secondary" },
                { label: "Entropy_Loss", value: lossCount, color: "text-destructive" },
                { label: "Gross_Yield", value: `₹${Math.round(totalGross).toLocaleString()}`, color: "text-foreground" },
                { label: "Fee_Drain", value: `₹${Math.round(totalCharges).toLocaleString()}`, color: "text-muted-foreground/60" },
                { label: "Net_Capture", value: `₹${Math.round(totalPnl).toLocaleString()}`, color: totalPnl >= 0 ? "text-secondary" : "text-destructive" },
              ].map(m => (
                <div key={m.label} className="p-5 border-r border-border/30 last:border-0 hover:bg-card/10 transition-colors">
                  <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">{m.label}</div>
                  <div className={`text-lg font-mono font-black ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-background border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card/10 flex items-center justify-between font-mono">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Trade_Log_Matrix</span>
                  <div className="flex gap-2">
                    {["date", "pnl", "pnlPct"].map(s => (
                      <button key={s} onClick={() => setTradeSort(s as any)} className={`px-2 py-1 text-[8px] font-black uppercase border ${tradeSort === s ? 'bg-primary text-black border-primary' : 'text-muted-foreground border-border/50'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
              </div>
              <div className="overflow-auto max-h-[500px] custom-scrollbar">
                <table className="w-full border-collapse font-mono">
                  <thead className="sticky top-0 z-20 bg-background border-b border-border">
                    <tr className="text-[9px] font-black text-muted-foreground uppercase opacity-50">
                      <th className="px-4 py-3 text-left">TS</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">Exit</th>
                      <th className="px-4 py-3 text-right">PnL</th>
                      <th className="px-4 py-3 text-right">Net%</th>
                      <th className="px-4 py-3 text-right">MAE</th>
                      <th className="px-4 py-3 text-right">MFE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map(t => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-primary/5 transition-all group">
                        <td className="px-4 py-3 text-[10px] text-muted-foreground">{t.entry_time.split(' ')[1]}</td>
                        <td className="px-4 py-3 text-[10px] text-right font-black">{t.quantity}</td>
                        <td className="px-4 py-3 text-[10px] text-right text-muted-foreground">₹{t.entry_price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-[10px] text-right text-muted-foreground">₹{t.exit_price.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-[10px] text-right font-black ${t.pnl >= 0 ? "text-secondary" : "text-destructive"}`}>₹{t.pnl.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-[10px] text-right font-black ${t.pnl >= 0 ? "text-secondary" : "text-destructive"}`}>{t.pnlPct}%</td>
                        <td className="px-4 py-3 text-[10px] text-right text-destructive/40">{t.mae}%</td>
                        <td className="px-4 py-3 text-[10px] text-right text-secondary/40">+{t.mfe}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Institutional" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-4 gap-6">
              {[
                { label: "K-Ratio", value: result.metrics.k_ratio?.toFixed(2), desc: "Consistency of equity growth" },
                { label: "Omega Ratio", value: result.metrics.omega_ratio?.toFixed(2), desc: "Weighted gain/loss probability" },
                { label: "Profit Factor", value: result.metrics.profit_factor?.toFixed(2), desc: "Gross profit / Gross loss" },
                { label: "Expectancy", value: `₹${Math.round(result.metrics.expectancy || 0).toLocaleString()}`, desc: "Avg profit per trade" },
              ].map(m => (
                <div key={m.label} className="bg-card/5 border border-border p-5 group hover:border-primary/50 transition-all">
                  <div className="text-[9px] font-mono font-black text-primary uppercase tracking-widest mb-1">{m.label}</div>
                  <div className="text-2xl font-mono font-black text-foreground mb-2">{m.value}</div>
                  <div className="text-[8px] font-mono text-muted-foreground leading-tight">{m.desc}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="bg-background border border-border p-6 shadow-xl relative overflow-hidden">
                <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-secondary mb-6 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" /> Risk_Adjusted_Returns
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Annualized CAGR", value: `${result.cagr}%` },
                    { label: "Sharpe Ratio", value: result.sharpe.toFixed(2) },
                    { label: "Sortino Ratio", value: result.sortino?.toFixed(2) },
                    { label: "Calmar Ratio", value: result.metrics.calmar_ratio?.toFixed(2) },
                    { label: "Recovery Factor", value: result.metrics.recovery_factor?.toFixed(2) },
                    { label: "Max Drawdown", value: `${result.maxDD}%` },
                  ].map(item => (
                    <div key={item.label} className="border-l-2 border-border/30 pl-4 py-1">
                      <div className="text-[8px] font-mono text-muted-foreground uppercase">{item.label}</div>
                      <div className="text-sm font-mono font-black">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-background border border-border p-6 shadow-xl relative overflow-hidden">
                <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-primary mb-6 flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Benchmark_Correlation
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Alpha (Rel)", value: `${result.metrics.alpha?.toFixed(2)}%` },
                    { label: "Beta (Sys Risk)", value: result.metrics.beta?.toFixed(2) },
                    { label: "Tracking Error", value: `${result.metrics.tracking_error?.toFixed(2)}%` },
                    { label: "Information Ratio", value: result.metrics.info_ratio?.toFixed(2) },
                    { label: "Equity Stability", value: result.metrics.stability?.toFixed(2) },
                    { label: "Benchmark (NIFTY 50)", value: "NSE_ANCHOR" },
                  ].map(item => (
                    <div key={item.label} className="border-l-2 border-primary/20 pl-4 py-1">
                      <div className="text-[8px] font-mono text-muted-foreground uppercase">{item.label}</div>
                      <div className="text-sm font-mono font-black">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card/10 border-2 border-dashed border-border p-6 rounded-none">
               <div className="flex items-start gap-6">
                  <div className="p-3 bg-secondary/10 border border-secondary/30">
                     <Shield className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground mb-2">Institutional Quality Score: {Math.round((result.metrics.stability || 0) * 100)}/100</h5>
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed max-w-2xl">
                      The strategy exhibits {(result.metrics.stability || 0) > 0.8 ? "extremely high" : (result.metrics.stability || 0) > 0.5 ? "moderate" : "low"} linear consistency.
                      With an Alpha of {result.metrics.alpha?.toFixed(2)}% and a Beta of {result.metrics.beta?.toFixed(2)}, it is
                      {(result.metrics.beta || 0) < 1 ? " less sensitive " : " more sensitive "} than the market anchor.
                      The K-Ratio of {result.metrics.k_ratio?.toFixed(2)} confirms a {(result.metrics.k_ratio || 0) > 1 ? "professional" : "retail"} grade performance trend.
                    </p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === "Distribution" && (
          <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-background border border-border p-6 shadow-2xl">
              <h3 className="text-[11px] font-mono font-black uppercase tracking-[0.3em] text-foreground mb-8 border-b border-border/50 pb-2">Entropy_Distribution (P&L %)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
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
                    <XAxis type="number" dataKey="mae" name="MAE" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} label={{ value: "ADVERSE (%)", fontSize: 8, fill: 'rgba(255,255,255,0.2)', position: "bottom" }} />
                    <YAxis type="number" dataKey="mfe" name="MFE" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} label={{ value: "FAVORABLE (%)", fontSize: 8, fill: 'rgba(255,255,255,0.2)', angle: -90, position: "left" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter name="Trades" data={processedTrades} fill="var(--primary)" fillOpacity={0.4} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
