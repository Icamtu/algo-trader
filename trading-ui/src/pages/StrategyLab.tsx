import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LiveDeployment } from "@/components/trading/LiveDeployment";
import { RiskAnalytics } from "@/components/trading/RiskAnalytics";
import { DataExplorer } from "@/components/trading/DataExplorer";
import { RightPanel } from "@/components/trading/RightPanel";
import { GitBranch, Zap, Loader2 } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { IndicatorAnalyzer } from "@/components/trading/IndicatorAnalyzer";
import Editor from "@monaco-editor/react";
import { BacktestCanvas } from "@/components/trading/BacktestCanvas";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { algoApi } from "@/features/openalgo/api/client";
import { useAppModeStore } from "@/stores/appModeStore";
import { StrategyExplorer } from "@/features/explorer/components/StrategyExplorer";
import { useExplorerStore } from "@/features/explorer/stores/explorerStore";
import { AetherTerminal } from "@/components/terminal/AetherTerminal";

const pageTabs = ["Editor", "Backtest", "Compare", "Equity Curve", "Returns", "Analyzer", "Live", "Risk Analytics", "Data Explorer"] as const;


const DEFAULT_CODE = `class AetherSwing(BaseStrategy):
    def __init__(self):
        super().__init__("AetherSwing", ["NSE:NIFTY"], None)
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

  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [code, setCode] = useState(DEFAULT_CODE);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastBacktestResult, setLastBacktestResult] = useState<any>(null);
  const [backtestSymbol, setBacktestSymbol] = useState("RELIANCE");
  const [slippage, setSlippage] = useState(0.0005);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [dynamicStrategies, setDynamicStrategies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dynamic strategies on mount
  useEffect(() => {
    const fetchStrats = async () => {
      try {
        const res = await algoApi.getStrategies();
        if (!res || !res.strategies) throw new Error("Invalid response format");
        setDynamicStrategies(res.strategies);
      } catch (err) {
        console.error("Failed to fetch strategies", err);
        setDynamicStrategies([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStrats();
  }, []);

  const setActiveTab = (tab: typeof pageTabs[number]) => setSearchParams({ tab });

  const handleSave = async () => {
    if (!currentFile) {
      const name = prompt("Enter Filename (e.g. MyScalper.py):");
      if (!name) return;
      setCurrentFile(name.endsWith('.py') ? name : `${name}.py`);
      return;
    }

    setIsSaving(true);
    try {
      await algoApi.saveStrategyFile(currentFile, code);
      toast({ title: "STRAT_SYNC", description: `${currentFile.toUpperCase()}_PERSISTED_TO_KERNEL` });
    } catch (err) {
      toast({ variant: "destructive", title: "SYNC_ERR", description: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!currentFile) return;
    setIsSaving(true);
    try {
      // Step 1: persist file
      await algoApi.saveStrategyFile(currentFile, code);
      // Step 2: derive strategy id (strip .py, use filename stem as key)
      const stratId = currentFile.replace(/\.py$/, "");
      // Step 3: activate on engine
      await algoApi.activateStrategy(stratId);
      toast({
        title: "DEPLOY_SUCCESS",
        description: `${currentFile.toUpperCase()}_LIVE_ON_ENGINE`,
        style: { border: isAD ? '1px solid #f59e0b' : '1px solid #14b8a6' }
      });
    } catch (err) {
      toast({ variant: "destructive", title: "DEPLOY_ERR", description: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      // Extract class name from code (e.g. class MomentumAlpha)
      const classMatch = code.match(/class\s+(\w+)/);
      const stratKey = classMatch ? classMatch[1] : "AetherScalper";

      const res = await algoApi.runBacktest({
        strategy_key: stratKey,
        symbol: backtestSymbol,
        days: 7,
        slippage: slippage
      });

      setLastBacktestResult(res);
      toast({
        title: "SIM_COMPLETE",
        description: `KERNEL_RETURNED_${res.total_trades}_TRADES | SHARPE: ${res.performance?.sharpe_ratio?.toFixed(2) ?? "N/A"}`
      });
      setActiveTab("Backtest");
    } catch (err) {
      toast({ variant: "destructive", title: "KERNEL_ERR", description: String(err) });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className={cn(
      "h-full flex flex-col overflow-hidden bg-background relative aurora-bg",
      isAD ? "ad-theme" : "oa-theme"
    )}>
      <div className="noise-overlay" />
      <div className={cn("scanline opacity-10", activeTab === "Editor" ? "opacity-20" : "opacity-0")} />

      {/* Industrial Tab Controller */}
      <div className="flex items-center gap-1 px-4 py-2 bg-card/5 border-b border-border relative z-10">
        <div className="flex items-center gap-4 pr-6 mr-6 border-r border-border/20">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-2xl backdrop-blur-md relative overflow-hidden group", accentBorderClass)}>
            <div className={cn("absolute inset-0 bg-current opacity-5 group-hover:opacity-10 transition-opacity", primaryColorClass)} />
            <GitBranch className={cn("h-6 w-6 relative z-10", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-xl font-black font-mono tracking-[0.2em] uppercase glow-sm", primaryColorClass)}>Strategy_Forge_Kernel</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]", primaryColorClass)} />
              <span className="text-[9px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-black">SIM_LAB_v4 // LOG_AUDIT_SYNC</span>
            </div>
          </div>
        </div>
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-[9px] font-mono font-black uppercase tracking-widest transition-all relative group",
              activeTab === tab
                ? primaryColorClass
                : "text-muted-foreground/30 hover:text-foreground/60"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTabUnderline"
                className={cn("absolute bottom-0 left-0 right-0 h-[2px] bg-current", primaryColorClass)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 relative z-10 glass-panel">
        <StrategyExplorer
            onFileSelect={async (path) => {
                try {
                    const res = await algoApi.getExplorerFile(path);
                    setCurrentFile(path);
                    setCode(res.content);
                    useExplorerStore.getState().setSelectedPath(path);
                } catch (err) {
                    toast({ variant: "destructive", title: "LOAD_ERR", description: String(err) });
                }
            }}
        />
        <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 custom-scrollbar relative">
          <AnimatePresence mode="wait">
          {activeTab === "Editor" && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0 aether-panel glass-card overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02] shrink-0">
                  <div className="flex items-center gap-2">
                     <div className={cn("flex items-center gap-2 px-3 py-1.5 border backdrop-blur-xl bg-black/40", accentBorderClass)}>
                        <GitBranch className={cn("w-3.5 h-3.5", primaryColorClass)} />
                        <span className={cn("text-[10px] font-mono font-black uppercase tracking-[0.15em]", primaryColorClass)}>
                          {currentFile ? currentFile.toUpperCase() : "UNSYNCED_FORGE_ASSET"}
                        </span>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-sm overflow-hidden px-2 h-8">
                      <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase mr-3">SYMBOL</span>
                      <input
                        type="text"
                        value={backtestSymbol}
                        onChange={(e) => setBacktestSymbol(e.target.value.toUpperCase())}
                        className={cn("bg-transparent border-none text-[10px] font-mono font-black w-20 focus:ring-0 outline-none", primaryColorClass)}
                      />
                    </div>

                    <div className="flex items-center bg-black/40 border border-white/10 rounded-sm overflow-hidden px-2 h-8">
                      <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase mr-3">SLIPPAGE</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={slippage}
                        onChange={(e) => setSlippage(parseFloat(e.target.value))}
                        className={cn("bg-transparent border-none text-[10px] font-mono font-black w-16 focus:ring-0 outline-none", primaryColorClass)}
                      />
                    </div>

                    <div className="h-6 w-[1px] bg-white/10 mx-1" />

                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={cn("px-4 h-8 border font-mono font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-30 relative group", accentBorderClass, "hover:bg-white/5", primaryColorClass)}
                    >
                      <span className="relative z-10">{isSaving ? "SYNCING..." : "SAVE_ASSET"}</span>
                    </button>
                    <button
                      onClick={handleDeploy}
                      disabled={isSaving}
                      className={cn("px-4 h-8 border font-mono font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-30 border-primary/20 hover:bg-primary/5", primaryColorClass)}
                    >
                      DEPLOY_KERNEL
                    </button>
                    <button
                      onClick={handleRun}
                      disabled={isRunning}
                      className={cn(
                        "px-6 h-8 font-mono font-black text-[9px] uppercase tracking-[0.2em] transition-all disabled:opacity-30 flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.5)]",
                        isAD ? "bg-amber-500 text-black shadow-amber-500/10" : "bg-teal-500 text-black shadow-teal-500/10",
                        "hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      INITIALIZE_FORGE
                    </button>
                  </div>
              </div>
              <div className="flex-1 min-h-[400px] bg-[#020617]/50 relative overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "Fira Code, monospace",
                    lineNumbers: "on",
                    glyphMargin: false,
                    folding: true,
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    automaticLayout: true
                  }}
                />
              </div>
              <AetherTerminal />
            </motion.div>
          )}

          {activeTab === "Backtest" && (
            <motion.div
              key="backtest"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col min-h-0 border border-white/5 glass-card overflow-hidden"
            >
              <BacktestCanvas latestResult={lastBacktestResult} />
            </motion.div>
          )}

          {activeTab === "Compare" && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-black font-mono uppercase tracking-[0.25em] text-foreground">Multi-Strat Benchmark</h3>
                    <p className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase mt-1">Institutional Consensus vs Forge Asset</p>
                  </div>
                  <div className={cn("px-3 py-1 border border-primary/20 bg-primary/5 text-[8px] font-mono font-black uppercase tracking-widest animate-pulse", primaryColorClass)}>Live_Matrix_Compute</div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.01]">
                        {["Strategy", "Sharpe", "Sortino", "CAGR", "Max DD", "PnL (Today)"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[8px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {dynamicStrategies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground/30 font-mono text-[10px] uppercase tracking-widest italic">
                            No strategies registered — deploy one from the Editor tab
                          </td>
                        </tr>
                      ) : dynamicStrategies.map((s) => (
                        <tr key={s.id || s.name} className="group hover:bg-white/[0.02] transition-all cursor-crosshair">
                          <td className="px-4 py-3 text-[11px] font-black font-mono text-foreground/80 group-hover:text-primary transition-colors tracking-tighter">
                            <span className="opacity-20 mr-2 group-hover:opacity-100 transition-opacity">/</span>
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-black tabular-nums text-muted-foreground/40">--</td>
                          <td className="px-4 py-3 text-[11px] font-black tabular-nums text-muted-foreground/40">--</td>
                          <td className="px-4 py-3 text-[11px] font-black tabular-nums text-muted-foreground/40">--</td>
                          <td className="px-4 py-3 text-[11px] font-black tabular-nums text-muted-foreground/40">--</td>
                          <td className="px-4 py-3 text-[11px] font-mono tabular-nums">
                            <span className={cn(s.pnl >= 0 ? "text-secondary" : "text-destructive", "font-black")}>
                              {s.pnl != null ? `₹${Number(s.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : "--"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "Equity Curve" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="aether-panel p-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-[10px] font-black font-display uppercase tracking-[0.3em] text-foreground mb-0.5">Equity_Trail_Buffer</h3>
                  <p className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase">Last Backtest Run</p>
                </div>
              </div>
              {lastBacktestResult?.equityCurve?.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lastBacktestResult.equityCurve.map((v: number, i: number) => ({ day: i + 1, equity: v }))}>
                      <XAxis dataKey="day" stroke="rgba(255,255,255,0.05)" fontSize={7} />
                      <YAxis stroke="rgba(255,255,255,0.05)" fontSize={7} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(51,65,85,0.2)', padding: '8px' }} itemStyle={{ fontFamily: 'Fira Code', fontSize: '9px' }} />
                      <Area type="monotone" dataKey="equity" stroke="#22c55e" fillOpacity={0.05} fill="#22c55e" strokeWidth={1.5} name="Equity" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground/20">
                  <p className="text-[10px] font-mono uppercase tracking-widest">No backtest run yet</p>
                  <p className="text-[9px] font-mono text-muted-foreground/10">Run INITIALIZE_FORGE from the Editor tab to populate this curve</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "Analyzer" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <IndicatorAnalyzer />
            </motion.div>
          )}

          {activeTab === "Live" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col relative w-full border border-slate-800 rounded-lg overflow-hidden glass-card shadow-2xl">
              <LiveDeployment />
            </motion.div>
          )}

          {activeTab === "Risk Analytics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col relative w-full border border-slate-800 rounded-lg overflow-hidden glass-card shadow-2xl">
              <RiskAnalytics />
            </motion.div>
          )}

          {activeTab === "Data Explorer" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col relative w-full border border-slate-800 rounded-lg overflow-hidden glass-card shadow-2xl">
              <DataExplorer />
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <RightPanel onRun={handleRun} isRunning={isRunning} />
      </div>
    </div>
  );
}
