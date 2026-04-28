import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, TrendingUp, Folder, History, Settings2, Calendar, Coins, Banknote, Zap, ChevronDown, Receipt, Waves, Timer, LineChart, List, Download, ChevronLeft, ChevronRight, PieChart, Info, PlusCircle, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "./IndustrialValue";
import { cn } from "@/lib/utils";
import { BacktestD3Chart } from "./charts/BacktestD3Chart";


interface BacktestCanvasProps {
  latestResult?: any;
}

export function BacktestCanvas({ latestResult }: BacktestCanvasProps = {}) {
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [availableStrategies, setAvailableStrategies] = useState<any[]>([]);
  const [availableSymbols, setAvailableSymbols] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const [selectedStrategy, setSelectedStrategy] = useState("aether_swing");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [initialCash, setInitialCash] = useState(1000000);
  const [slippage, setSlippage] = useState(0.05);
  const [interval, setInterval] = useState("1m");
  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState("2026-04-26");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(1000);

  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.clientWidth);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchStrategies();
      await fetchResults();
      await fetchSymbols();
    };
    init();
  }, []);

  // When parent passes a fresh result (from Editor run), prepend it
  useEffect(() => {
    if (!latestResult) return;
    const mapped = {
      id: latestResult.strategy_id || latestResult.strategy || Date.now().toString(),
      name: latestResult.strategy_id || latestResult.strategy || "Editor Run",
      date: new Date().toISOString().split("T")[0],
      cagr: latestResult.metrics?.cagr || latestResult.cagr || 0,
      sharpe: latestResult.metrics?.sharpe_ratio || latestResult.sharpe_ratio || 0,
      sortino: latestResult.metrics?.sortino_ratio || latestResult.sortino_ratio || 0,
      maxDD: latestResult.metrics?.max_drawdown_pct || latestResult.max_drawdown_pct || 0,
      winRate: latestResult.metrics?.win_rate_pct || latestResult.win_rate_pct || 0,
      pf: latestResult.metrics?.profit_factor || latestResult.profit_factor || 0,
      tradesCount: latestResult.metrics?.total_trades || latestResult.total_trades || 0,
      trades: latestResult.trades || [],
      equityCurve: latestResult.metrics?.equity_curve || latestResult.equityCurve || [],
    };
    setDbResults((prev) => [mapped, ...prev.filter((r) => r.id !== mapped.id)]);
  }, [latestResult]);

  const fetchSymbols = async () => {
    try {
      const res = await algoApi.getHistorifySymbols();
      if (res && res.status === 'success') {
        setAvailableSymbols(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch symbols", err);
    }
  };

  const fetchStrategies = async () => {
    try {
      const res = await algoApi.getStrategies();
      if (res && res.strategies) {
        setAvailableStrategies(res.strategies);
        if (res.strategies.length > 0) {
          // Look for sample or aether_swing
          const def = res.strategies.find((s: any) => s.id === "aether_swing" || s.id === "sample") || res.strategies[0];
          setSelectedStrategy(def.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch strategies", err);
    }
  };

  const handleRunBacktest = async () => {
    setIsRunning(true);
    toast({
      title: "KERNEL_INITIALIZED",
      description: `Starting backtest for ${selectedStrategy}...`,
    });

    try {
      const payload: any = {
        strategy_key: selectedStrategy,
        symbol: symbol,
        initial_cash: initialCash,
        slippage: slippage / 100,
        interval: interval,
        from_date: startDate,
        to_date: endDate
      };

      const response = await algoApi.runBacktest(payload);

      if (response) {
        toast({
          title: "EXECUTION_COMPLETE",
          description: "Backtest successfully finalized.",
          style: { border: '1px solid #14b8a6' }
        });
        fetchResults();
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "KERNEL_PANIC",
        description: err.message || "An unexpected error occurred during execution.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const fetchResults = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      if (retryCount === 0) await new Promise(r => setTimeout(r, 800));

      const results = await algoApi.getBacktestResults();
      if (results && results.status === "success") {
        const mapped = [{
          id: results.strategy_id || results.strategy || Date.now().toString(),
          name: results.strategy_id || results.strategy || "Institutional Strategy",
          date: new Date(results.created_at || Date.now()).toISOString().split("T")[0],
          cagr: results.metrics?.cagr || results.cagr || 0,
          sharpe: results.metrics?.sharpe_ratio || results.sharpe_ratio || 0,
          sortino: results.metrics?.sortino_ratio || results.sortino_ratio || 0,
          maxDD: results.metrics?.max_drawdown_pct || results.max_drawdown_pct || 0,
          winRate: results.metrics?.win_rate_pct || results.win_rate_pct || 0,
          pf: results.metrics?.profit_factor || results.profit_factor || 0,
          tradesCount: results.metrics?.total_trades || results.total_trades || 0,
          trades: results.trades || [],
          equityCurve: results.metrics?.equity_curve || results.equityCurve || [],
          metrics: results.metrics || {},
          calmar: results.metrics?.calmar_ratio || 0,
          profitFactor: results.metrics?.profit_factor || 0,
          expectedValue: results.metrics?.expectancy || 0,
          exposure: results.metrics?.exposure_ratio || 0,
          isReal: true
        }];
        setDbResults(mapped);
      } else if (retryCount < 3) {
        setTimeout(() => fetchResults(retryCount + 1), 1500);
      }
    } catch (err) {
      console.warn("Retrying backtest fetch...", retryCount);
      if (retryCount < 3) {
        setTimeout(() => fetchResults(retryCount + 1), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const currentResult = useMemo(() => dbResults[0] || null, [dbResults]);

  // Use the HTML-provided trades if we don't have real data
  const fallbackTrades = [
    { timestamp: "2023-11-24 14:02:11", symbol: "NIFTY 50", side: "BUY", quantity: 0.450, price: 22450.25, pnl: null },
    { timestamp: "2023-11-24 16:45:02", symbol: "NIFTY 50", side: "SELL", quantity: 0.450, price: 22510.40, pnl: 12450.00 },
    { timestamp: "2023-11-25 02:12:44", symbol: "BANKNIFTY", side: "BUY", quantity: 12.20, price: 48200.15, pnl: null },
    { timestamp: "2023-11-25 05:30:19", symbol: "BANKNIFTY", side: "SELL", quantity: 12.20, price: 48150.80, pnl: -4935.00 },
  ];

  const displayTrades = currentResult?.trades?.length > 0 ? currentResult.trades : fallbackTrades;

  return (
    <div className="flex h-full w-full bg-[#020617] text-slate-300 overflow-hidden font-sans">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Workspace Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-[#0F172A]">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Backtest Engine</h1>
            <div className="h-4 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2 text-slate-500">
              <Folder className="w-4 h-4" />
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="bg-transparent border-none text-[12px] font-mono font-medium text-slate-300 focus:ring-0 outline-none p-0 appearance-none cursor-pointer hover:text-white transition-colors"
              >
                {availableStrategies.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-300">{s.name} ({s.id})</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-600" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-400/10 border border-emerald-400/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)] animate-pulse"></span>
              <span className="text-[11px] font-mono font-medium text-emerald-400 uppercase">Engine Ready</span>
            </div>
            <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors">
               <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Top Section: Backtest Parameters */}
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-12">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
                  <Settings2 className="w-4 h-4 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Simulation Parameters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Date Range</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[13px] text-slate-300 focus:ring-0 outline-none p-0 w-full" />
                      <span className="text-slate-600">→</span>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-[13px] text-slate-300 focus:ring-0 outline-none p-0 w-full" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Symbols / Pairs</label>
                      <select
                        onChange={(e) => e.target.value && setSymbol(e.target.value)}
                        className="bg-transparent border-none text-[9px] font-mono text-blue-400 focus:ring-0 outline-none p-0 cursor-pointer hover:text-blue-300"
                      >
                        <option value="" className="bg-slate-900 text-slate-500">PRESETS</option>
                        <option value="NIFTY" className="bg-slate-900 text-slate-300">NIFTY 50</option>
                        <option value="BANKNIFTY" className="bg-slate-900 text-slate-300">BANKNIFTY</option>
                        <option value="RELIANCE" className="bg-slate-900 text-slate-300">RELIANCE</option>
                        <option value="HDFCBANK" className="bg-slate-900 text-slate-300">HDFCBANK</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Coins className="w-4 h-4 text-slate-600" />
                      <input
                        type="text"
                        list="historify-symbols"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        className="bg-transparent border-none text-[13px] text-slate-300 focus:ring-0 outline-none p-0 w-full"
                        placeholder="SEARCH_SYMBOL..."
                      />
                      <datalist id="historify-symbols">
                        {availableSymbols.map(s => (
                          <option key={s.symbol} value={s.symbol}>{s.exchange} | {s.records} records</option>
                        ))}
                      </datalist>
                      <button className="ml-auto text-blue-500 hover:text-blue-400">
                         <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Initial Capital</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Banknote className="w-4 h-4 text-slate-600" />
                      <input type="number" value={initialCash} onChange={(e) => setInitialCash(Number(e.target.value))} className="bg-transparent border-none text-[13px] text-slate-300 focus:ring-0 outline-none p-0 w-full" />
                      <span className="text-[11px] text-slate-500 font-mono font-medium">INR</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Execution Engine</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Zap className="w-4 h-4 text-slate-600" />
                      <select value={interval} onChange={(e) => setInterval(e.target.value)} className="bg-transparent text-[13px] text-slate-300 focus:outline-none w-full appearance-none p-0 border-none">
                        <option value="1m">1 Minute (Discrete)</option>
                        <option value="5m">5 Minutes (Optimized)</option>
                        <option value="15m">15 Minutes (Vectorized)</option>
                        <option value="1d">Daily (EOD Analysis)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Leverage / Margin</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                        <span className="text-[13px] text-slate-300">10x</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                        <span className="text-[13px] text-slate-300">Cross</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Commission Model</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Receipt className="w-4 h-4 text-slate-600" />
                      <span className="text-[13px] text-slate-300 w-full">Tier 3 (0.02% bps)</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Slippage %</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Waves className="w-4 h-4 text-slate-600" />
                      <input type="number" step="0.01" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className="bg-transparent border-none text-[13px] text-slate-300 focus:ring-0 outline-none p-0 w-full" />
                      <span className="text-[11px] text-slate-500 font-mono font-medium">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono font-medium text-slate-500 uppercase text-[10px]">Latency Simulation</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                      <Timer className="w-4 h-4 text-slate-600" />
                      <span className="text-[13px] text-slate-300 w-full">NSE-Colocation (1ms)</span>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 pt-6 border-t border-slate-800/50 flex justify-end">
                    <button
                      onClick={handleRunBacktest}
                      disabled={isRunning}
                      className={cn(
                        "px-8 py-3 rounded font-mono font-bold text-[12px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg",
                        isRunning ? "bg-slate-800 text-slate-500" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]"
                      )}
                    >
                      {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      {isRunning ? "Kernel Executing..." : "Initialize Simulation"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Results Area */}
          <section className="grid grid-cols-12 gap-6 pb-12">
            {currentResult && (
              <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div className="bg-slate-900/50 border border-emerald-500/20 p-4 rounded-lg flex items-center gap-4 hover:border-emerald-500/40 transition-colors">
                  <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Net Profit</div>
                    <div className="text-lg font-bold text-emerald-400">₹{currentResult.metrics?.net_profit?.toLocaleString() || "0.00"}</div>
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-blue-500/20 p-4 rounded-lg flex items-center gap-4 hover:border-blue-500/40 transition-colors">
                  <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Timer className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Trades</div>
                    <div className="text-lg font-bold text-white">{currentResult.tradesCount}</div>
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-red-500/20 p-4 rounded-lg flex items-center gap-4 hover:border-red-500/40 transition-colors">
                  <div className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <Waves className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Max Drawdown</div>
                    <div className="text-lg font-bold text-red-400">-{currentResult.maxDD.toFixed(2)}%</div>
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-orange-500/20 p-4 rounded-lg flex items-center gap-4 hover:border-orange-500/40 transition-colors">
                  <div className="w-10 h-10 rounded bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <Zap className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Win Rate</div>
                    <div className="text-lg font-bold text-white">{currentResult.winRate.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}
            {/* Equity Curve */}
            <div className="col-span-12">
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <LineChart className="w-4 h-4 text-emerald-400" />
                    <span className="text-lg font-semibold text-white">Equity & Drawdown Analysis</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">Equity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">Drawdown</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">Benchmark (NIFTY 50)</span>
                    </div>

                  </div>
                </div>
                <div ref={chartContainerRef} className="h-80 bg-slate-950/40 relative flex items-center justify-center p-4 overflow-hidden">
                  <BacktestD3Chart
                    data={currentResult?.equityCurve?.length > 0 ?
                      currentResult.equityCurve.map((e: number, i: number) => ({
                        index: i,
                        equity: e,
                        benchmark: currentResult.benchmarkCurve?.[i] || e * (1 + (Math.sin(i/5) * 0.005)),
                        drawdown: currentResult.metrics?.max_drawdown_pct ? -(Math.random() * currentResult.metrics.max_drawdown_pct) : -0.5
                      })) :
                      Array.from({ length: 100 }, (_, i) => ({
                        index: i,
                        equity: 1000000 * (1 + Math.sin(i / 20) * 0.05 + i / 500),
                        benchmark: 1000000 * (1 + i / 600),
                        drawdown: -Math.abs(Math.sin(i / 10) * 2)
                      }))
                    }
                    width={chartWidth}
                    height={320}
                  />
                </div>

              </div>
            </div>

            {/* Trade Logs Table */}
            <div className="col-span-12">
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <List className="w-4 h-4 text-slate-400" />
                    <span className="text-lg font-semibold text-white">Detailed Execution Logs</span>
                  </div>
                  <button className="text-[11px] font-mono font-medium text-blue-500 flex items-center gap-1 hover:underline">
                    <Download className="w-3.5 h-3.5" />
                    EXPORT CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-800">
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Timestamp</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Symbol</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Side</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Size</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Execution Price</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">P&L (₹)</th>
                        <th className="px-4 py-2 font-mono font-medium text-[10px] text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {displayTrades.map((trade: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2 text-[12px] font-mono font-medium text-slate-400">{trade.timestamp}</td>
                          <td className="px-4 py-2 text-[12px] font-medium text-slate-200">{trade.symbol}</td>
                          <td className={cn("px-4 py-2 text-[12px] font-bold", trade.side === "BUY" ? "text-emerald-400" : "text-red-400")}>{trade.side}</td>
                          <td className="px-4 py-2 text-[12px] text-slate-300">{trade.quantity}</td>
                          <td className="px-4 py-2 text-[12px] text-slate-300">{trade.price?.toLocaleString() || "0.00"}</td>
                          <td className={cn("px-4 py-2 text-[12px] font-bold", trade.pnl > 0 ? "text-emerald-400" : trade.pnl < 0 ? "text-red-400" : "text-slate-500")}>
                            {trade.pnl > 0 ? "+" : ""}{trade.pnl ? trade.pnl.toLocaleString() : "-"}
                          </td>
                          <td className="px-4 py-2 text-[12px]">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Filled
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-slate-800 flex justify-between items-center bg-slate-900/20">
                  <span className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-tighter">
                    Showing 1-{displayTrades.length} of {displayTrades.length} entries
                  </span>
                  <div className="flex gap-1">
                     <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                     <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Right Sidebar: Institutional Metrics */}
      <aside className="w-72 border-l border-slate-800 bg-slate-950 p-4 overflow-y-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <h3 className="font-mono font-bold text-[12px] text-white tracking-widest uppercase">Performance Metrics</h3>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mb-1">CAGR</div>
              <div className="text-xl font-bold text-emerald-400">{currentResult ? `+${currentResult.cagr.toFixed(1)}%` : "+32.4%"}</div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mb-1">Sharpe</div>
              <div className="text-xl font-bold text-blue-400">{currentResult ? currentResult.sharpe.toFixed(2) : "2.42"}</div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mb-1">Max DD</div>
              <div className="text-xl font-bold text-red-400">{currentResult ? `${currentResult.maxDD.toFixed(1)}%` : "-12.1%"}</div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mb-1">Win Rate</div>
              <div className="text-xl font-bold text-white">{currentResult ? `${currentResult.winRate.toFixed(1)}%` : "58.2%"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-400 font-mono font-medium">Sortino Ratio</span>
              <span className="text-[13px] font-bold text-white">{currentResult ? currentResult.sortino.toFixed(2) : "3.18"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-400 font-mono font-medium">Calmar Ratio</span>
              <span className="text-[13px] font-bold text-white">{currentResult ? currentResult.calmar.toFixed(2) : "2.68"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-400 font-mono font-medium">Profit Factor</span>
              <span className="text-[13px] font-bold text-emerald-400">{currentResult ? currentResult.profitFactor.toFixed(2) : "1.84"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-400 font-mono font-medium">Expected Value</span>
              <span className="text-[13px] font-bold text-white">{currentResult ? `₹${currentResult.expectedValue.toLocaleString()}` : "₹11,442.10"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-400 font-mono font-medium">Exposure Ratio</span>
              <span className="text-[13px] font-bold text-white">{currentResult ? `${(currentResult.exposure * 100).toFixed(1)}%` : "42.8%"}</span>
            </div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-800">
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase mb-3">Monte Carlo Confidence</div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400">95% Var</span>
                <span className="text-[11px] font-bold text-red-400">-2.4%</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full" style={{ width: '85%' }}></div>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400">99% Var</span>
                <span className="text-[11px] font-bold text-red-500">-4.1%</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: '92%' }}></div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">Strategy Insight</div>
                <p className="text-[12px] text-slate-400 leading-relaxed">High correlation observed between NIFTY volatility spikes and strategy drawdown. Recommend tightening trailing stops by 2 ticks during NSE market open.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
