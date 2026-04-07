import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, BarChart3, Shield, Zap, Target, ArrowLeft, Download, Share2, Maximize2, Database, Loader2 } from "lucide-react";
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
      date: t.entry_time.split(" ")[0], // Extract date from ISO/timestamp
    }));
  }, [result.trades]);


  const handleSaveToDB = async () => {
    setIsSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        toast.error("Authentication required to persist data");
        return;
      }

      const { data, error } = await supabase.from("backtest_results").insert({
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
      toast.success("Backtest results archived in Data Vault");
    } catch (err: any) {
      toast.error(err.message || "Failed to persist backtest");
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

  const cyanColor = "hsl(183, 100%, 49%)";
  const purpleColor = "hsl(272, 87%, 53%)";
  const greenColor = "hsl(142, 71%, 45%)";
  const redColor = "hsl(0, 72%, 51%)";
  const mutedColor = "hsl(0, 0%, 55%)";

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border glass-panel-elevated">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{result.name}</h2>
            <p className="text-[10px] text-muted-foreground">Backtest run: {result.date} · {result.tradesCount.toLocaleString()} trades</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick stats */}
          {[
            { label: "CAGR", value: `${result.cagr}%`, color: "text-neon-green" },
            { label: "Sharpe", value: `${result.sharpe}`, color: "text-primary" },
            { label: "Sortino", value: `${result.metrics?.sortino_ratio || 0.0}`, color: "text-neon-purple" },
            { label: "Calmar", value: `${result.metrics?.calmar_ratio || 0.0}`, color: "text-primary" },
            { label: "Max DD", value: `${result.maxDD}%`, color: "text-neon-red" },
            { label: "Win Rate", value: `${result.winRate}%`, color: "text-foreground" },
            { label: "PF", value: `${result.pf}`, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="text-right px-3 border-l border-border first:border-l-0">
              <div className="metric-label">{s.label}</div>
              <div className={`metric-value ${s.color}`}>{s.value}</div>
            </div>
          ))}
          <div className="w-px h-6 bg-border ml-2" />
          
          <button
            onClick={handleSaveToDB}
            disabled={isSaving}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md border border-primary/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-bold uppercase tracking-wider">Persist to Vault</span>
          </button>

          <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 pt-3 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium rounded-t-md transition-all border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "Equity Curve" && (
          <div className="space-y-4">
            {/* Equity + Benchmark */}
            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-foreground">Equity Curve vs Benchmark</h3>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ background: cyanColor }} /> Strategy
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ background: mutedColor }} /> Benchmark
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={processedEquity}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cyanColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={cyanColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,14%)" />
                  <XAxis dataKey="index" tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="equity" stroke={cyanColor} fill="url(#eqGrad)" strokeWidth={2} name="Strategy" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Drawdown Chart */}
            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">Underwater (Drawdown) Chart</h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={processedEquity}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={redColor} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={redColor} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,14%)" />
                  <XAxis dataKey="index" tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(0,0%,20%)" />
                  <Area type="monotone" dataKey="drawdown" stroke={redColor} fill="url(#ddGrad)" strokeWidth={1.5} name="Drawdown" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* No Monthly Returns for now - derived from trades in future */}
          </div>
        )}

        {activeTab === "Trade List" && (
          <div className="space-y-3">
            {/* Trade summary cards */}
            {/* Trade summary cards */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: "Total Trades", value: result.tradesCount, color: "text-foreground" },
                { label: "Winners", value: winCount, color: "text-neon-green" },
                { label: "Losers", value: lossCount, color: "text-neon-red" },
                { label: "Avg Win", value: `₹${Math.round(avgWin).toLocaleString()}`, color: "text-neon-green" },
                { label: "Avg Loss", value: `₹${Math.round(avgLoss).toLocaleString()}`, color: "text-neon-red" },
                { label: "Net P&L", value: `₹${Math.round(totalPnl).toLocaleString()}`, color: totalPnl >= 0 ? "text-neon-green" : "text-neon-red" },
              ].map(m => (
                <div key={m.label} className="glass-panel rounded-lg p-3">
                  <div className="metric-label mb-1">{m.label}</div>
                  <div className={`metric-value ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Sort by:</span>
              {(["date", "pnl", "pnlPct"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setTradeSort(s)}
                  className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                    tradeSort === s ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "date" ? "Date" : s === "pnl" ? "P&L" : "P&L %"}
                </button>
              ))}
            </div>

            {/* Trade table */}
            <div className="glass-panel rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-320px)]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-muted/30 backdrop-blur-sm">
                      {["#", "Date", "Side", "Qty", "Entry", "Exit", "P&L", "P&L %", "MAE", "MFE"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 data-cell text-muted-foreground">{t.id}</td>
                        <td className="px-3 py-2 data-cell text-muted-foreground">{t.date}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.pnl >= 0 ? "bg-neon-green/10 text-neon-green" : "bg-neon-red/10 text-neon-red"}`}>
                             TRADE
                          </span>
                        </td>
                        <td className="px-3 py-2 data-cell text-foreground">{t.quantity}</td>
                        <td className="px-3 py-2 data-cell text-foreground">₹{t.entry_price.toLocaleString()}</td>
                        <td className="px-3 py-2 data-cell text-foreground">₹{t.exit_price.toLocaleString()}</td>
                        <td className={`px-3 py-2 data-cell font-semibold ${t.pnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                          {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toLocaleString()}
                        </td>
                        <td className={`px-3 py-2 data-cell ${t.pnlPct >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                          {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct}%
                        </td>
                        <td className="px-3 py-2 data-cell text-neon-red">{t.mae}%</td>
                        <td className="px-3 py-2 data-cell text-neon-green">+{t.mfe}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        
        {activeTab === "Distribution" && (
          <div className="space-y-4">
            {/* P&L Distribution */}
            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">Trade P&L Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pnlBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,14%)" />
                  <XAxis dataKey="range" tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x="0%" stroke="hsl(0,0%,20%)" />
                  <Bar dataKey="count" name="Trades" radius={[2, 2, 0, 0]}>
                    {pnlBuckets.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? greenColor : redColor} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* MAE vs MFE Scatter */}
            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">MAE vs MFE (Maximum Adverse / Favorable Excursion)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,14%)" />
                  <XAxis type="number" dataKey="mae" name="MAE" tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} label={{ value: "MAE %", fontSize: 9, fill: mutedColor, position: "bottom" }} />
                  <YAxis type="number" dataKey="mfe" name="MFE" tick={{ fontSize: 9, fill: mutedColor }} tickLine={false} axisLine={false} label={{ value: "MFE %", fontSize: 9, fill: mutedColor, angle: -90, position: "left" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={0} stroke="hsl(0,0%,20%)" />
                  <ReferenceLine y={0} stroke="hsl(0,0%,20%)" />
                  <Scatter name="Trades" data={processedTrades} fill={cyanColor} fillOpacity={0.6} r={4} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Win/Loss streak */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel rounded-lg p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Win/Loss Ratio</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-4 rounded-full overflow-hidden bg-muted/30 flex">
                    <div className="h-full rounded-l-full" style={{ width: `${(winCount / result.tradesCount) * 100}%`, background: greenColor, opacity: 0.7 }} />
                    <div className="h-full rounded-r-full" style={{ width: `${(lossCount / result.tradesCount) * 100}%`, background: redColor, opacity: 0.7 }} />
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-neon-green">{winCount} wins ({((winCount / result.tradesCount) * 100).toFixed(1)}%)</span>
                  <span className="text-[10px] text-neon-red">{lossCount} losses ({((lossCount / result.tradesCount) * 100).toFixed(1)}%)</span>
                </div>
              </div>
              <div className="glass-panel rounded-lg p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Expectancy</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Expected Value</span>
                    <span className={`data-cell font-semibold ${totalPnl / result.tradesCount >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                      ₹{Math.round(totalPnl / result.tradesCount).toLocaleString()}/trade
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Avg Win / Avg Loss</span>
                    <span className="data-cell text-primary">{Math.abs(avgWin / avgLoss).toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Kelly %</span>
                    <span className="data-cell text-neon-purple">
                      {(((winCount / result.tradesCount) - ((lossCount / result.tradesCount) / (Math.abs(avgWin / avgLoss) || 1))) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
