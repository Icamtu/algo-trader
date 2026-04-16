import { useState, useEffect, useMemo } from "react";
import { Calendar, ChevronDown, Settings2, Download, Eye, Loader2 } from "lucide-react";
import { BacktestAnalyticsView } from "./BacktestAnalyticsView";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "./IndustrialValue";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const canvasTabs = ["Backtest", "Walk-Forward", "Monte Carlo", "Forward Test", "Live"] as const;

export function BacktestCanvas() {
  const [activeTab, setActiveTab] = useState<typeof canvasTabs[number]>("Backtest");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<any | null>(null);
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState("AetherSwing");

  // Simulation Flags
  const [useCache, setUseCache] = useState(true);
  const [parallelExec, setParallelExec] = useState(false);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    toast({
      title: "Kernel Initialization",
      description: `Starting backtest for ${selectedStrategy}...`,
    });

    try {
      const response = await algoApi.runBacktest({
        strategy_key: selectedStrategy, // Uses dynamically selected strategy
        symbol: "RELIANCE",
        days: 7 // Backend default
      });

      if (response) {
        toast({
          title: "Execution Complete",
          description: "Backtest successfully finalized.",
        });
        // Success: Trigger results refresh
        fetchResults();
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Kernel Panic",
        description: err.message || "An unexpected error occurred during execution.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const fetchResults = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      // Small delay on first fetch to allow kernel to finalize disk write
      if (retryCount === 0) await new Promise(r => setTimeout(r, 800));

      const results = await algoApi.getBacktestResults();
      if (results) {
        const mapped = [{
          id: Date.now().toString(),
          name: results.strategy || "Institutional Strategy",
          date: new Date().toISOString().split("T")[0],
          cagr: results.performance?.total_return_pct || 0,
          sharpe: results.performance?.sharpe_ratio || 0,
          maxDD: results.performance?.max_drawdown_pct || 0,
          winRate: results.performance?.win_rate_pct || 0,
          pf: results.performance?.profit_factor || 0,
          tradesCount: results.total_trades || 0,
          trades: results.trades || [],
          equityCurve: results.equity_curve || [],
          metrics: results.performance || {},
          isReal: true
        }];
        setDbResults(mapped);
      } else if (retryCount < 2) {
        // Retry if nothing found yet
        setTimeout(() => fetchResults(retryCount + 1), 1000);
      }
    } catch (err) {
      console.warn("Retrying backtest fetch...", retryCount);
      if (retryCount < 2) {
        setTimeout(() => fetchResults(retryCount + 1), 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const resultsData = useMemo(() => dbResults, [dbResults]);

  return (
    <div className="flex-1 flex flex-col min-w-0 industrial-grid relative border-r border-border/50 bg-background/50">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Simulation Controls */}
      <div className="px-3 py-2 bg-card/10 border-b border-border flex items-center gap-3 flex-wrap relative z-10">
        <div className="flex items-center gap-2 border-r border-border/20 pr-3">
            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-primary animate-pulse shadow-[0_0_8px_#ffb000]' : 'bg-muted/20'}`} />
            <h2 className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-foreground">Kernel_v4</h2>
        </div>

        <ControlDropdown label="STRAT" value={selectedStrategy} />
        <ControlDropdown label="SCRIPT" value="Nifty_M5" />

        <div className="flex items-center gap-2 px-2 py-1 border border-border/30 bg-background/30">
          <Calendar className="w-2.5 h-2.5 text-muted-foreground/40" />
          <span className="text-[8px] font-mono font-black text-foreground/60 uppercase">2020-2024</span>
        </div>

        <ControlDropdown label="UNI" value="NIFTY_50" />

        <div className="flex items-center gap-6 px-4 py-1.5 border border-border/20 bg-card/5 ml-2">
            <div className="flex items-center gap-3 group">
               <span className={cn(
                 "text-[7px] font-mono font-black transition-colors uppercase tracking-widest",
                 useCache ? "text-primary" : "text-muted-foreground/30"
               )}>USE_CACHE</span>
               <Switch
                 checked={useCache}
                 onCheckedChange={setUseCache}
                 className="scale-75"
               />
            </div>
            <div className="flex items-center gap-3 group">
               <span className={cn(
                 "text-[7px] font-mono font-black transition-colors uppercase tracking-widest",
                 parallelExec ? "text-primary" : "text-muted-foreground/30"
               )}>PARALLEL_EXEC</span>
               <Switch
                 checked={parallelExec}
                 onCheckedChange={setParallelExec}
                 className="scale-75"
               />
            </div>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground font-mono text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:translate-y-[2px] active:shadow-none"
        >
          {isRunning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Settings2 className="w-3 h-3" />
          )}
          {isRunning ? "Kernel Active" : "Run Backtest"}
        </button>
      </div>

      {/* Historical Telemetry Table */}
      <div className="flex-1 overflow-auto p-3 custom-scrollbar relative z-10">
        <div className="border border-border bg-card/5 overflow-hidden relative">
          {isLoading && (
             <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
             </div>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-card/20 text-muted-foreground">
                {["TAG", "DATE", "CAGR", "SHARPE", "MAX_DD", "WIN%", "PF", "FLUX", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[8px] font-mono font-black uppercase tracking-[0.2em] border-r border-border/10 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultsData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRow(row.id)}
                  className={`border-b border-border/10 cursor-crosshair transition-all hover:bg-primary/[0.03] group ${
                    selectedRow === row.id ? "bg-primary/[0.05]" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 border-r border-border/5">
                    <div className="flex items-center gap-2">
                       <div className="w-1 h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                       <span className="text-[10px] font-mono font-black text-foreground/80 uppercase tracking-widest truncate max-w-[120px]">{row.name}</span>
                       {row.isReal && <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-[9px] font-mono text-muted-foreground/30 tabular-nums border-r border-border/5">{row.date}</td>
                  <td className="px-3 py-1.5 border-r border-border/5">
                    <IndustrialValue value={row.cagr} suffix="%" className="text-[10px] font-black text-secondary tabular-nums" />
                  </td>
                  <td className="px-3 py-1.5 border-r border-border/5">
                    <IndustrialValue value={row.sharpe} className="text-[10px] font-black text-primary tabular-nums" />
                  </td>
                  <td className="px-3 py-1.5 border-r border-border/5">
                    <IndustrialValue value={row.maxDD} suffix="%" className="text-[10px] font-black text-destructive tabular-nums" />
                  </td>
                  <td className="px-3 py-1.5 text-[9px] font-mono font-bold text-foreground/60 tabular-nums border-r border-border/5">{row.winRate}%</td>
                  <td className="px-3 py-1.5 text-[9px] font-mono font-bold text-foreground/60 tabular-nums border-r border-border/5">{row.pf}</td>
                  <td className="px-3 py-1.5 text-[9px] font-mono text-muted-foreground/30 tabular-nums border-r border-border/5">{row.tradesCount}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-1 text-muted-foreground/20 hover:text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); setAnalyticsResult(row); }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-muted-foreground/20 hover:text-foreground transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analyticsResult && (
        <BacktestAnalyticsView result={analyticsResult} onClose={() => setAnalyticsResult(null)} />
      )}
    </div>
  );
}

function ControlDropdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border border-border/20 bg-background/30 group">
      <div className="px-1.5 py-0.5 border-b border-border/20 bg-card/5">
         <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.1em]">{label}</span>
      </div>
      <button className="px-1.5 py-1 flex items-center gap-2 hover:bg-primary/5 transition-all">
        <span className="text-[9px] font-mono font-black text-foreground/70 uppercase tracking-wider">{value}</span>
        <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}
