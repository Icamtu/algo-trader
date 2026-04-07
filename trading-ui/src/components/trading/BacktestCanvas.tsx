import { useState, useEffect, useMemo } from "react";
import { Calendar, ChevronDown, Play, Settings2, Download, Eye, Loader2 } from "lucide-react";
import { BacktestAnalyticsView } from "./BacktestAnalyticsView";
import { supabase } from "@/integrations/supabase/client";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

const canvasTabs = ["Backtest", "Walk-Forward", "Monte Carlo", "Forward Test", "Live"] as const;

const mockData = [
  { id: "m1", name: "Momentum Alpha v3", date: "2024-01-15", cagr: 34.2, sharpe: 2.34, maxDD: -8.2, winRate: 67.3, pf: 2.1, trades: 1247 },
  { id: "m2", name: "Momentum Alpha v2", date: "2024-01-10", cagr: 28.9, sharpe: 2.01, maxDD: -11.4, winRate: 63.1, pf: 1.8, trades: 1189 },
  { id: "m3", name: "Mean Rev Nifty", date: "2024-01-08", cagr: 22.1, sharpe: 1.89, maxDD: -5.1, winRate: 71.2, pf: 2.4, trades: 856 },
];

export function BacktestCanvas() {
  const [activeTab, setActiveTab] = useState<typeof canvasTabs[number]>("Backtest");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<any | null>(null);
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const fetchResults = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("backtest_results")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map((r: any) => {
        const meta = r.metadata || {};
        const metrics = meta.metrics || {};
        return {
          id: r.id,
          name: r.strategy_name,
          date: new Date(r.created_at).toISOString().split("T")[0],
          cagr: metrics.cagr || 0,
          sharpe: metrics.sharpe_ratio || metrics.sharpe || 0,
          maxDD: metrics.max_drawdown || metrics.maxDD || 0,
          winRate: metrics.winRate || metrics.win_rate || 0,
          pf: metrics.profit_factor || metrics.pf || 0,
          tradesCount: metrics.total_trades || metrics.trades || 0,
          trades: meta.trades || [],
          equityCurve: meta.equity_curve || meta.equityCurve || [],
          metrics: metrics, // Store full metrics
          isReal: true
        };
      });
      setDbResults(mapped);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchResults();

    const channel = supabase
      .channel("backtest-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "backtest_results" }, () => {
        fetchResults();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resultsData = useMemo(() => [...dbResults, ...mockData], [dbResults]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Canvas Tabs */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-0">
        {canvasTabs.map((tab) => (
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
            {tab === "Live" && <span className="ml-1.5 status-dot-live inline-block" />}
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border flex-wrap">
        <ControlDropdown label="Strategy" value="Momentum Alpha" />
        <ControlDropdown label="Script Group" value="Nifty-Momentum-5min" />
        
        <div className="flex items-center gap-1.5 glass-panel px-2.5 py-1.5 rounded-md">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-foreground">Jan 2020 — Dec 2024</span>
        </div>

        <ControlDropdown label="Universe" value="Nifty 50" />

        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/30 transition-colors">
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Advanced Criteria</span>
        </button>

        <div className="flex-1" />

        <button
          disabled={isRunning}
          onClick={async () => {
            setIsRunning(true);
            try {
              // 1. Fetch historical candles for the selected symbol
              const historyData = await algoApi.getHistory({ symbol: "SBIN", exchange: "NSE", interval: "D", start_date: "2020-01-01" });
              const candles = Array.isArray(historyData) ? historyData : historyData?.data || historyData?.candles || [];
              if (!candles.length) {
                toast({ title: "No Data", description: "No candle data returned for the selected symbol.", variant: "destructive" });
                setIsRunning(false);
                return;
              }
              // 2. Run backtest via backend
              const result = await algoApi.runBacktest({ strategy_key: "sample_strategy", symbol: "SBIN", candles, initial_cash: 100000 });
              toast({ title: "Backtest Complete", description: `Strategy returned ${result.total_trades || 0} trades.` });
              // 3. Refresh results table
              fetchResults();
            } catch (err) {
              toast({ title: "Backtest Failed", description: String(err), variant: "destructive" });
            } finally {
              setIsRunning(false);
            }
          }}
          className="glow-button rounded-md px-4 py-1.5 flex items-center gap-2 group disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 text-primary-foreground transition-transform group-hover:scale-110" />
          )}
          <span className="text-xs font-bold text-primary-foreground uppercase tracking-wider">
            {isRunning ? "Running..." : "Run Backtest"}
          </span>
        </button>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="glass-panel rounded-lg overflow-hidden relative">
          {isLoading && (
             <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
             </div>
          )}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Name", "Date", "CAGR", "Sharpe", "Max DD", "Win Rate", "PF", "Trades", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
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
                  className={`border-b border-border/50 cursor-pointer transition-colors ${
                    selectedRow === row.id
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "hover:bg-muted/20"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-medium text-foreground">{row.name}</span>
                       {row.isReal && <span className="px-1 py-0.5 rounded-[2px] bg-primary/20 text-primary text-[8px] font-bold uppercase tracking-tighter">Vault</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 data-cell text-muted-foreground">{row.date}</td>
                  <td className="px-3 py-2.5 data-cell text-neon-green">{row.cagr}%</td>
                  <td className="px-3 py-2.5 data-cell text-primary">{row.sharpe}</td>
                  <td className="px-3 py-2.5 data-cell text-neon-red">{row.maxDD}%</td>
                  <td className="px-3 py-2.5 data-cell text-foreground">{row.winRate}%</td>
                  <td className="px-3 py-2.5 data-cell text-foreground">{row.pf}</td>
                  <td className="px-3 py-2.5 data-cell text-muted-foreground">{(row.tradesCount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 rounded hover:bg-muted/50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setAnalyticsResult(row); }}
                      >
                        <Eye className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <Download className="w-3 h-3 text-muted-foreground" />
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
    <button className="flex items-center gap-1.5 glass-panel px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
      <span className="text-[10px] text-muted-foreground uppercase">{label}:</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
    </button>
  );
}
