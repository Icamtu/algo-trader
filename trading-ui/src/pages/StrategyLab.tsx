import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { BarChart3, Shield, Settings, LineChart as LucideLineChart, Radar, Search, Briefcase, BookOpen, Server, Bell, GitBranch, TrendingUp, TrendingDown, Target, Zap, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { IndicatorAnalyzer } from "@/components/trading/IndicatorAnalyzer";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import Editor from "@monaco-editor/react";
import { BacktestCanvas } from "@/components/trading/BacktestCanvas";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const pageTabs = ["Editor", "Backtest", "Compare", "Equity Curve", "Monthly Returns", "Analyzer"] as const;

// Mock strategy comparison data
const strategies = [
  { name: "Momentum Alpha", sharpe: 2.34, sortino: 3.12, calmar: 4.21, expectancy: 1.24, cagr: 34.2, maxDD: -8.2, winRate: 67.3, trades: 1247 },
  { name: "Mean Rev Nifty", sharpe: 1.89, sortino: 2.45, calmar: 3.12, expectancy: 0.89, cagr: 22.1, maxDD: -5.1, winRate: 71.2, trades: 856 },
  { name: "Stat Arb Pairs", sharpe: 2.67, sortino: 3.56, calmar: 5.23, expectancy: 1.56, cagr: 41.8, maxDD: -3.8, winRate: 58.4, trades: 2341 },
  { name: "ML Regime", sharpe: 3.12, sortino: 4.23, calmar: 6.12, expectancy: 1.89, cagr: 52.4, maxDD: -6.7, winRate: 64.1, trades: 1567 },
  { name: "Options Greeks", sharpe: 1.98, sortino: 2.67, calmar: 3.45, expectancy: 0.98, cagr: 28.9, maxDD: -4.5, winRate: 72.3, trades: 892 },
];

// Equity curve data
const equityData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  momentum: 100000 + (i * 3500) + Math.random() * 10000,
  meanRev: 100000 + (i * 2200) + Math.random() * 8000,
  statArb: 100000 + (i * 4200) + Math.random() * 12000,
}));

// Monthly returns heatmap data
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const generateMonthlyReturns = () => {
  return months.map(month => ({
    month,
    Momentum: (Math.random() - 0.3) * 15,
    "Mean Rev": (Math.random() - 0.3) * 12,
    "Stat Arb": (Math.random() - 0.2) * 18,
  }));
};

const monthlyReturns = generateMonthlyReturns();

const DEFAULT_CODE = `class MomentumAlpha(Strategy):
    def __init__(self):
        self.lookback = 14
        
    def on_cycle(self):
        # Execute momentum trading logic here
        if self.close[-1] > self.sma(self.lookback)[-1]:
            self.buy('NSE:NIFTY', 50)
        else:
            self.sell('NSE:NIFTY', 50)`;

export default function StrategyLab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "Editor";
  const activeTab = (pageTabs as readonly string[]).includes(rawTab) ? (rawTab as typeof pageTabs[number]) : "Editor";
  
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Backtest Parameters
  const [backtestSymbol, setBacktestSymbol] = useState("RELIANCE");
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const setActiveTab = (tab: typeof pageTabs[number]) => {
    setSearchParams({ tab });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Simulate/Implement save to backend
      toast({ title: "Strategy Saved", description: "Momentum_Alpha.py has been updated successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed", description: "Check your connection and try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    try {
      setIsRunning(true);
      
      const payload = {
        strategy_key: "momentum_alpha", // Hardcoded for now based on the strategy name
        symbol: backtestSymbol,
        from_date: startDate,
        to_date: endDate,
        initial_cash: 100000.0
      };

      toast({ 
        title: "Backtest Started", 
        description: `Spawning engine for ${backtestSymbol} (${startDate} to ${endDate})...` 
      });

      // Import the api client dynamically
      const { algoApi } = await import("@/lib/api-client");
      const result = await algoApi.runBacktest(payload);
      
      if (result.error) throw new Error(result.error);

      setActiveTab("Backtest");
      toast({ 
        title: "Backtest Complete", 
        description: `Net P&L: ₹${result.net_pnl.toLocaleString()} | Trades: ${result.trades.length}` 
      });

    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Execution Failed", 
        description: e.message || "Could not initialize backtest engine." 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <GlobalHeader />
      <MarketNavbar activeTab="/strategy-lab" />

      {/* Page Sub-Tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 bg-background/50">
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0">
          {activeTab === "Editor" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col min-h-0 glass-panel rounded-xl overflow-hidden border border-border"
            >
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Momentum_Alpha.py</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-background/40 border border-border/50 rounded-md px-2 py-1">
                      <Search className="w-3 h-3 text-muted-foreground mr-1.5" />
                      <input 
                        type="text" 
                        value={backtestSymbol}
                        onChange={(e) => setBacktestSymbol(e.target.value.toUpperCase())}
                        className="bg-transparent border-none text-[10px] font-bold text-foreground w-20 focus:ring-0 placeholder:text-muted-foreground/50 hover:bg-muted/10 transition-colors"
                        placeholder="SYMBOL"
                      />
                    </div>
                    
                    <div className="flex items-center bg-background/40 border border-border/50 rounded-md px-2 py-1 gap-2">
                      <div className="flex items-center gap-1.5 border-r border-border/30 pr-2">
                        <span className="text-[9px] text-muted-foreground font-bold">FROM</span>
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-transparent border-none text-[10px] font-bold text-foreground w-24 focus:ring-0 p-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground font-bold">TO</span>
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-transparent border-none text-[10px] font-bold text-foreground w-24 focus:ring-0 p-0 cursor-pointer"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="text-[10px] font-bold px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-md hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "SAVING..." : "SAVE STRATEGY"}
                    </button>
                    <button 
                      onClick={handleRun}
                      disabled={isRunning}
                      className="glow-button px-3 py-1.5 rounded-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin text-primary-foreground" /> : <Zap className="w-3 h-3 text-primary-foreground" />}
                      <span className="text-[10px] font-bold text-primary-foreground">RUN BACKTEST</span>
                    </button>
                  </div>
              </div>
              <div className="flex-1 min-h-0 bg-[#1e1e1e] pt-2">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, monospace"
                  }}
                />
              </div>
            </motion.div>
          )}

          {activeTab === "Backtest" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col min-h-0 bg-background/50 rounded-xl overflow-hidden border border-border"
            >
              <BacktestCanvas />
            </motion.div>
          )}

          {activeTab === "Compare" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="p-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-foreground">Strategy Comparison</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Strategy", "Sharpe", "Sortino", "Calmar", "Expectancy", "CAGR", "Max DD", "Win Rate", "Trades"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((s, i) => (
                      <tr key={s.name} className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer">
                        <td className="px-3 py-2.5 text-xs font-medium text-foreground">{s.name}</td>
                        <td className="px-3 py-2.5 text-xs text-primary font-semibold">{s.sharpe}</td>
                        <td className="px-3 py-2.5 text-xs text-neon-cyan">{s.sortino}</td>
                        <td className="px-3 py-2.5 text-xs text-neon-purple">{s.calmar}</td>
                        <td className="px-3 py-2.5 text-xs text-neon-green">{s.expectancy}</td>
                        <td className="px-3 py-2.5 text-xs text-neon-green">{s.cagr}%</td>
                        <td className="px-3 py-2.5 text-xs text-neon-red">{s.maxDD}%</td>
                        <td className="px-3 py-2.5 text-xs text-foreground">{s.winRate}%</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.trades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "Equity Curve" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-xl p-4"
            >
              <h3 className="text-xs font-semibold text-foreground mb-4">Live Equity Curve</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="colorMomentum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMeanRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStatArb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(183, 100%, 49%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(183, 100%, 49%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="hsl(215, 20%, 55%)" fontSize={10} tickLine={false} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={10} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(217, 33%, 17%)', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(210, 40%, 93%)' }}
                    />
                    <Area type="monotone" dataKey="momentum" stroke="hsl(234, 89%, 64%)" fillOpacity={1} fill="url(#colorMomentum)" strokeWidth={2} name="Momentum Alpha" />
                    <Area type="monotone" dataKey="meanRev" stroke="hsl(160, 84%, 39%)" fillOpacity={1} fill="url(#colorMeanRev)" strokeWidth={2} name="Mean Reversion" />
                    <Area type="monotone" dataKey="statArb" stroke="hsl(183, 100%, 49%)" fillOpacity={1} fill="url(#colorStatArb)" strokeWidth={2} name="Stat Arb" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Momentum Alpha</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-emerald" />
                  <span className="text-xs text-muted-foreground">Mean Reversion</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-cyan" />
                  <span className="text-xs text-muted-foreground">Stat Arb</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Monthly Returns" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-xl p-4"
            >
              <h3 className="text-xs font-semibold text-foreground mb-4">Monthly Returns Heatmap (%)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Month</th>
                      {strategies.slice(0, 3).map(s => (
                        <th key={s.name} className="px-2 py-2 text-center text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{s.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReturns.map((row) => (
                      <tr key={row.month} className="border-b border-border/30">
                        <td className="px-2 py-2 text-xs font-medium text-foreground">{row.month}</td>
                        {["Momentum", "Mean Rev", "Stat Arb"].map(strategy => {
                          const value = row[strategy as keyof typeof row] as number;
                          const isPositive = value >= 0;
                          return (
                            <td key={strategy} className="px-1 py-1">
                              <div 
                                className="text-xs font-medium text-center py-1.5 rounded"
                                style={{ 
                                  background: isPositive 
                                    ? `hsl(160, 84%, 39%, ${0.1 + (value / 20) * 0.4})`
                                    : `hsl(0, 72%, 51%, ${0.1 + (Math.abs(value) / 20) * 0.4})`,
                                  color: Math.abs(value) > 5 ? 'white' : 'inherit'
                                }}
                              >
                                {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-neon-green/60" />
                  <span className="text-[10px] text-muted-foreground">Profit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-neon-red/60" />
                  <span className="text-[10px] text-muted-foreground">Loss</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Analyzer" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <IndicatorAnalyzer />
            </motion.div>
          )}
        </div>

        <RightPanel />
      </div>

      <NewOrderModal 
        isOpen={orderModalOpen} 
        onClose={() => setOrderModalOpen(false)} 
        prefilledSymbol={prefilledSymbol}
      />
    </div>
  );
}
