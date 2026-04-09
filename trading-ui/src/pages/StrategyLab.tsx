import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { BarChart3, Shield, Settings, LineChart as LucideLineChart, Radar, Search, Briefcase, BookOpen, Server, Bell, GitBranch, TrendingUp, TrendingDown, Target, Zap, Activity } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { IndicatorAnalyzer } from "@/components/trading/IndicatorAnalyzer";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import Editor from "@monaco-editor/react";
import { BacktestCanvas } from "@/components/trading/BacktestCanvas";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

const pageTabs = ["Editor", "Backtest", "Compare", "Equity Curve", "Returns", "Analyzer"] as const;

const strategies = [
  { name: "Momentum Alpha", sharpe: 2.34, sortino: 3.12, cagr: 34.2, maxDD: -8.2, trades: 1247 },
  { name: "Mean Rev Nifty", sharpe: 1.89, sortino: 2.45, cagr: 22.1, maxDD: -5.1, trades: 856 },
  { name: "Stat Arb Pairs", sharpe: 2.67, sortino: 3.56, cagr: 41.8, maxDD: -3.8, trades: 2341 },
  { name: "ML Regime", sharpe: 3.12, sortino: 4.23, cagr: 52.4, maxDD: -6.7, trades: 1567 },
];

const equityData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  momentum: 100000 + (i * 3500) + Math.random() * 10000,
  meanRev: 100000 + (i * 2200) + Math.random() * 8000,
  statArb: 100000 + (i * 4200) + Math.random() * 12000,
}));

const DEFAULT_CODE = `class MomentumAlpha(Strategy):
    def __init__(self):
        self.lookback = 14
        
    def on_cycle(self):
        if self.close[-1] > self.sma(self.lookback)[-1]:
            self.buy('NSE:NIFTY', 50)
        else:
            self.sell('NSE:NIFTY', 50)`;

export default function StrategyLab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "Editor";
  const activeTab = (pageTabs as readonly string[]).includes(rawTab) ? (rawTab as typeof pageTabs[number]) : "Editor";
  
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [backtestSymbol, setBacktestSymbol] = useState("RELIANCE");

  const setActiveTab = (tab: typeof pageTabs[number]) => setSearchParams({ tab });

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(() => {
      toast({ title: "STRAT_SYNC", description: "MOMENTUM_ALPHA.PY_REGISTERED" });
      setIsSaving(false);
    }, 800);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setTimeout(() => {
      setActiveTab("Backtest");
      toast({ title: "SIM_COMPLETE", description: "BACKTEST_KERNEL_RETURNED_RESULTS" });
      setIsRunning(false);
    }, 1500);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/strategy-lab" />

      {/* Industrial Tab Controller */}
      <div className="flex items-center gap-1 px-4 py-2 bg-card/5 border-b border-border relative z-10">
        <div className="flex items-center gap-2 pr-4 mr-4 border-r border-border/20">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <div className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.2em]">Lab_v4</div>
        </div>
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-[9px] font-mono font-black uppercase tracking-widest transition-all border-b-[1.5px] ${
              activeTab === tab
                ? "text-primary border-primary bg-primary/5 shadow-[0_4px_10px_rgba(255,176,0,0.05)]"
                : "text-muted-foreground/30 border-transparent hover:text-foreground/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 overflow-auto p-3 flex flex-col min-h-0 no-scrollbar">
          {activeTab === "Editor" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 border border-border bg-card/5">
              <div className="flex items-center justify-between p-2 border-b border-border bg-card/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 py-1 border border-primary/20 bg-primary/5">
                       <GitBranch className="w-3 h-3 text-primary" />
                       <span className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.1em]">MOMENTUM_ALPHA.PY</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-background border border-border/50 p-0.5">
                      <span className="px-2 text-[8px] font-mono font-black text-muted-foreground/30 uppercase leading-none">SYM:</span>
                      <input 
                        type="text" 
                        value={backtestSymbol}
                        onChange={(e) => setBacktestSymbol(e.target.value.toUpperCase())}
                        className="bg-transparent border-none text-[9px] font-mono font-black text-primary w-16 focus:ring-0 outline-none p-1"
                      />
                    </div>
                    
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-1.5 border border-border text-[9px] font-mono font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all disabled:opacity-30"
                    >
                      {isSaving ? "TX..." : "SAVE"}
                    </button>
                    <button 
                      onClick={handleRun}
                      disabled={isRunning}
                      className="px-5 py-1.5 bg-primary text-black border border-primary font-mono font-black text-[9px] uppercase tracking-widest hover:bg-black hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
                    >
                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      RUN_SIM
                    </button>
                  </div>
              </div>
              <div className="flex-1 min-h-0 bg-[#0d0d0d] relative overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "IBM Plex Mono, monospace",
                    lineNumbers: "on",
                    glyphMargin: false,
                    folding: false,
                    scrollbar: { vertical: 'hidden', horizontal: 'hidden' }
                  }}
                />
              </div>
            </motion.div>
          )}

          {activeTab === "Backtest" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 border border-border bg-background/50">
              <BacktestCanvas />
            </motion.div>
          )}

          {activeTab === "Compare" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="border border-border bg-card/5">
                <div className="p-3 border-b border-border bg-card/10 flex items-center justify-between">
                  <h3 className="text-[10px] font-black font-syne uppercase tracking-[0.2em] text-foreground">Multi-Strat Benchmark</h3>
                  <div className="px-2 py-0.5 border border-primary/20 bg-primary/5 text-[7px] font-mono font-black text-primary uppercase animate-pulse">Live_Compute</div>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/5">
                        {["Strategy", "Sharpe", "Sortino", "CAGR", "Max DD", "Trades"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[8px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/30">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {strategies.map((s) => (
                        <tr key={s.name} className="group hover:bg-primary/[0.03] transition-all cursor-crosshair">
                          <td className="px-3 py-2.5 text-[10px] font-black font-syne text-foreground/80 group-hover:text-primary transition-colors">{s.name}</td>
                          <td className="px-3 py-2.5">
                            <IndustrialValue value={s.sharpe} className="text-[10px] font-black text-primary" />
                          </td>
                          <td className="px-3 py-2.5">
                            <IndustrialValue value={s.sortino} className="text-[10px] font-black text-secondary" />
                          </td>
                          <td className="px-3 py-2.5">
                            <IndustrialValue value={s.cagr} suffix="%" className="text-[10px] font-black text-secondary" />
                          </td>
                          <td className="px-3 py-2.5">
                            <IndustrialValue value={s.maxDD} suffix="%" className="text-[10px] font-black text-destructive" />
                          </td>
                          <td className="px-3 py-2.5 text-[9px] font-mono text-muted-foreground/20 tabular-nums">{s.trades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Equity Curve" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border bg-card/5 p-4">
               <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-[10px] font-black font-syne uppercase tracking-[0.3em] text-foreground mb-0.5">Equity_Trail_Buffer</h3>
                    <p className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase">Nexus_Stream</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {[{ l: "MOM", c: "#ffb000" }, { l: "REV", c: "#00d4d4" }, { l: "ARB", c: "#ef4444" }].map(l => (
                      <div key={l.l} className="flex items-center gap-2">
                        <div className="w-2.5 h-0.5" style={{ backgroundColor: l.c }} />
                        <span className="text-[7px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">{l.l}</span>
                      </div>
                    ))}
                  </div>
               </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.05)" fontSize={7} font-family="IBM Plex Mono" />
                    <YAxis stroke="rgba(255,255,255,0.05)" fontSize={7} font-family="IBM Plex Mono" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #222', padding: '8px' }} itemStyle={{ fontFamily: 'IBM Plex Mono', fontSize: '9px' }} />
                    <Area type="step" dataKey="momentum" stroke="#ffb000" fillOpacity={0.05} fill="#ffb000" strokeWidth={1.5} name="MOM" isAnimationActive={false} />
                    <Area type="step" dataKey="meanRev" stroke="#00d4d4" fillOpacity={0.05} fill="#00d4d4" strokeWidth={1.5} name="REV" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {activeTab === "Analyzer" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <IndicatorAnalyzer />
            </motion.div>
          )}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
