import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Loader2, Code2, Target, History, Clock, X, Save, CheckCircle2, Download, BarChart2, Zap, BookMarked, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrategySelectionDialog } from "@/components/trading/StrategySelectionDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { CONFIG } from "@/lib/config";

const AUTH = () => `Bearer ${localStorage.getItem("aether_token") || "test-token"}`;

const DATA_PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

const BENCHMARKS = [
  { label: "None", value: "" },
  { label: "NIFTY 50", value: "NIFTY" },
  { label: "BANKNIFTY", value: "BANKNIFTY" },
  { label: "SENSEX", value: "SENSEX" },
  { label: "MIDCAP", value: "NIFTY_MIDCAP_100" },
];

const TIMEFRAMES = ["1m","3m","5m","15m","30m","1h","1d"];


interface Metrics {
  cagr: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  net_pnl?: number;
}

interface Iteration {
  id: number;
  code: string;
  metrics?: Metrics;
  timestamp: string;
}

export default function AutoResearchPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [baseStrategy, setBaseStrategy] = useState("AetherScalper");
  const [baseCode, setBaseCode] = useState("");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [benchmark, setBenchmark] = useState("");
  const [timeframe, setTimeframe] = useState("1m");
  const [days, setDays] = useState(7);
  const [customDays, setCustomDays] = useState("");
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [targets, setTargets] = useState({ cagr: 40, sharpe: 2.5, maxDD: 5, winRate: 50 });
  const [activeCode, setActiveCode] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployLoading, setDeployLoading] = useState(false);
  const [isSaveVersionOpen, setIsSaveVersionOpen] = useState(false);
  const [saveVersionLabel, setSaveVersionLabel] = useState("");
  const [saveVersionLoading, setSaveVersionLoading] = useState(false);
  const [isDownloadingData, setIsDownloadingData] = useState(false);
  const [dataStatus, setDataStatus] = useState<"none"|"available"|"missing">("none");
  const [activeView, setActiveView] = useState<"base"|"evolved">("base");

  const [availableDays, setAvailableDays] = useState<number | null>(null);
  const [isSyncingData, setIsSyncingData] = useState(false);

  // Fetch base strategy code when strategy changes
  useEffect(() => {
    if (!baseStrategy) return;
    fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/base-code?name=${encodeURIComponent(baseStrategy)}`, {
      headers: { "Authorization": AUTH() }
    })
      .then(r => r.json())
      .then(d => { if (d.code) { setBaseCode(d.code); if (!activeCode) setActiveView("base"); } })
      .catch(() => {});
  }, [baseStrategy]);

  // Sync available days + data status from Historify
  useEffect(() => {
    const syncDays = async () => {
      if (!symbol || !timeframe) return;
      setIsSyncingData(true);
      try {
        const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/historify/catalog?interval=${timeframe}`, {
          headers: { "Authorization": AUTH() }
        });
        const data = await r.json();
        if (data.status === 'success') {
          const entry = data.data.find((i: any) => i.symbol === symbol.toUpperCase() || i.symbol === symbol);
          if (entry && entry.first_ts && entry.last_ts) {
            const diffDays = Math.floor((entry.last_ts - entry.first_ts) / 86400);
            setAvailableDays(diffDays);
            setDataStatus(diffDays >= days ? "available" : "missing");
            setDays(prev => (prev > diffDays || prev === 7) ? Math.max(1, diffDays) : prev);
          } else {
            setAvailableDays(null);
            setDataStatus("missing");
          }
        }
      } catch { setDataStatus("none"); }
      finally { setIsSyncingData(false); }
    };
    syncDays();
  }, [symbol, timeframe, days]);

  const triggerDataDownload = async () => {
    setIsDownloadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/historify/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": AUTH() },
        body: JSON.stringify({ symbols: [symbol], exchange: "NSE", interval: timeframe, from_date: fromDate, to_date: today })
      });
      const d = await r.json();
      if (d.status === "success") {
        toast.success(`Data download triggered for ${symbol}`);
        setDataStatus("available");
      } else toast.error(d.message || "Download failed");
    } catch { toast.error("Download failed"); }
    finally { setIsDownloadingData(false); }
  };

  const saveVersion = async () => {
    if (!activeCode) return;
    setSaveVersionLoading(true);
    try {
      const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/save-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": AUTH() },
        body: JSON.stringify({ name: baseStrategy, code: activeCode, metrics: iterations[iterations.length-1]?.metrics, label: saveVersionLabel })
      });
      const d = await r.json();
      if (d.status === "success") {
        toast.success(`Saved as ${d.filename}`);
        setIsSaveVersionOpen(false);
        setSaveVersionLabel("");
      } else toast.error(d.message || "Save failed");
    } catch { toast.error("Save failed"); }
    finally { setSaveVersionLoading(false); }
  };

  const fetchHistory = async () => {
    try {
      const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/history`, { headers: { "Authorization": AUTH() } });
      if (r.ok) { const d = await r.json(); setHistory(d.history || []); }
    } catch {}
  };

  useEffect(() => { fetchHistory(); }, []);

  const loadHistoryItem = async (id: string) => {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/history/${id}`, { headers: { "Authorization": AUTH() } });
      if (r.ok) {
        const d = await r.json();
        setActiveCode(d.code);
        if (d.metrics) setIterations([{ id: -1, code: d.code, metrics: d.metrics, timestamp: d.metadata?.timestamp || "" }]);
        setIsViewingHistory(true);
        setActiveView("evolved");
      }
    } catch { toast.error("Failed to load historical iteration"); }
    finally { setHistoryLoading(false); }
  };

  const handleDeploy = () => {
    if (!activeCode) { toast.error("No code to deploy."); return; }
    setDeployName(baseStrategy.replace(".py", ""));
    setIsDeploying(true);
  };

  const deployStrategy = async () => {
    if (!activeCode) return;
    setDeployLoading(true);
    try {
      const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": AUTH() },
        body: JSON.stringify({ name: deployName, code: activeCode, metrics: iterations[iterations.length-1]?.metrics })
      });
      if (!r.ok) throw new Error("Deployment failed");
      toast.success(`Strategy ${deployName} queued for approval.`);
      setIsDeploying(false);
    } catch { toast.error("Deployment failed."); }
    finally { setDeployLoading(false); }
  };

  const handleStart = async () => {
    if (isRunning) { setIsRunning(false); return; }
    setIsRunning(true);
    setIterations([]);
    setActiveView("evolved");
    try {
      let currentIteration = 1;
      let currentCode = "";
      let targetsMet = false;
      while (!targetsMet) {
        if (!isRunning && currentIteration > 1) { toast.info("AutoResearch stopped."); break; }
        toast.loading(`Running Iteration ${currentIteration}...`, { id: 'autoresearch' });
        const r = await fetch(`${CONFIG.API_BASE_URL}/api/v1/autoresearch/iteration`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": AUTH() },
          body: JSON.stringify({ strategy_name: currentCode ? undefined : baseStrategy, code: currentCode, symbol, timeframe, days, targets, benchmark: benchmark || undefined })
        });
        if (!r.ok) throw new Error("Failed to run iteration");
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        const iter: Iteration = { id: currentIteration, code: data.new_code || currentCode, metrics: data.metrics, timestamp: new Date().toISOString() };
        setIterations(prev => [...prev, iter]);
        setActiveCode(data.new_code);
        currentCode = data.new_code;
        const m = data.metrics as Metrics;
        if (m && m.cagr >= targets.cagr && m.sharpe_ratio >= targets.sharpe && m.max_drawdown <= targets.maxDD && m.win_rate >= targets.winRate) {
          targetsMet = true;
          toast.success("Target Metrics Achieved!", { id: 'autoresearch' });
          setIsRunning(false);
          break;
        }
        currentIteration++;
      }
    } catch (e: any) {
      toast.error(`AutoResearch failed: ${e.message}`, { id: 'autoresearch' });
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setBaseStrategy("AetherScalper");
    setSymbol("RELIANCE");
    setBenchmark("");
    setTimeframe("1m");
    setDays(7);
    setIsCustomDays(false);
    setCustomDays("");
    setIterations([]);
    setTargets({ cagr: 40, sharpe: 2.5, maxDD: 5, winRate: 50 });
    setActiveCode("");
    setIsViewingHistory(false);
    setActiveView("base");
    toast.success("Research lab reset to defaults.");
  };

  const getTargetProgress = (actual: number, target: number, reverse: boolean = false) => {
    if (!actual) return 0;
    if (reverse) {
        if (actual <= target) return 100;
        return Math.max(0, 100 - ((actual - target) / target * 100));
    }
    return Math.min(100, (actual / target) * 100);
  };

  const latestMetrics = iterations[iterations.length - 1]?.metrics;

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden font-mono">
      {/* TOP HEADER BAR */}
      <div className="flex-none flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-black tracking-tight uppercase">AutoResearch Lab</h1>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Autonomous Target-Driven Strategy Optimization</p>
          </div>
          {isRunning && (
            <Badge className="ml-3 bg-primary/10 text-primary border-primary/30 text-[9px] animate-pulse">
              ⚡ OPTIMIZING
            </Badge>
          )}
          {dataStatus === "missing" && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[9px]">
              ⚠ DATA MISSING
            </Badge>
          )}
          {dataStatus === "available" && (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[9px]">
              ✓ DATA READY
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCode && !isRunning && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-emerald-500/40 text-emerald-400" onClick={() => setIsSaveVersionOpen(true)}>
              <BookMarked className="w-3 h-3" /> Save Version
            </Button>
          )}
          {activeCode && !isRunning && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-primary/40 text-primary" onClick={handleDeploy}>
              <Zap className="w-3 h-3" /> Deploy to Engine
            </Button>
          )}
          {!isRunning && (
            <Button size="sm" variant="ghost" className="h-7 text-[10px] opacity-40 hover:opacity-100" onClick={handleReset}>
              <X className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Config */}
        <div className="w-[340px] flex-none border-r border-border/20 overflow-y-auto p-4 space-y-4">

          {/* Strategy + Symbol */}
          <Card className="bg-card/20 border-border/20">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <GitBranch className="w-3 h-3" /> Strategy Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase opacity-50">Base Strategy</Label>
                <StrategySelectionDialog onSelect={setBaseStrategy} currentStrategy={baseStrategy} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase opacity-50">Symbol</Label>
                  <Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className="h-8 text-xs bg-background/50" disabled={isRunning} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase opacity-50">Timeframe</Label>
                  <select value={timeframe} onChange={e => setTimeframe(e.target.value)} disabled={isRunning}
                    className="flex h-8 w-full border border-input bg-background/50 px-2 py-1 text-xs rounded-md">
                    {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] uppercase opacity-50">Benchmark (optional)</Label>
                <select value={benchmark} onChange={e => setBenchmark(e.target.value)} disabled={isRunning}
                  className="flex h-8 w-full border border-input bg-background/50 px-2 py-1 text-xs rounded-md">
                  {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Data Range */}
          <Card className="bg-card/20 border-border/20">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2"><BarChart2 className="w-3 h-3" /> Data Range</span>
                {isSyncingData && <Loader2 className="w-3 h-3 animate-spin opacity-50" />}
                {availableDays !== null && <span className="text-[9px] text-emerald-500 font-bold normal-case">Avail: {availableDays}d</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {DATA_PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setDays(p.days); setIsCustomDays(false); }} disabled={isRunning}
                    className={`px-2.5 py-1 text-[10px] font-bold border rounded transition-all ${days === p.days && !isCustomDays ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/50 border-border/40 hover:border-primary/40'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => setIsCustomDays(v => !v)} disabled={isRunning}
                  className={`px-2.5 py-1 text-[10px] font-bold border rounded transition-all ${isCustomDays ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/50 border-border/40 hover:border-primary/40'}`}>
                  Custom
                </button>
              </div>
              {isCustomDays && (
                <div className="flex gap-2">
                  <Input type="number" placeholder="Days" value={customDays} onChange={e => setCustomDays(e.target.value)}
                    className="h-7 text-xs bg-background/50" disabled={isRunning} />
                  <Button size="sm" className="h-7 text-[10px]" onClick={() => { const d = parseInt(customDays); if (d > 0) setDays(d); }} disabled={isRunning}>Set</Button>
                </div>
              )}
              {availableDays !== null && (
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => setDays(availableDays)} disabled={isRunning}>
                  Use Max Available ({availableDays}d)
                </Button>
              )}
              {/* Auto-download if missing */}
              {dataStatus === "missing" && (
                <Button size="sm" className="w-full h-7 text-[10px] gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black"
                  onClick={triggerDataDownload} disabled={isDownloadingData || isRunning}>
                  {isDownloadingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {isDownloadingData ? "Downloading..." : `Download ${days}d of ${symbol} data`}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Target Metrics */}
          <Card className="bg-card/20 border-border/20">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Target className="w-3 h-3" /> Target Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cagr", label: "CAGR% >", step: 1 },
                  { key: "sharpe", label: "Sharpe >", step: 0.1 },
                  { key: "maxDD", label: "Max DD% <", step: 1 },
                  { key: "winRate", label: "Win Rate% >", step: 1 },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">{f.label}</Label>
                    <Input type="number" step={f.step} value={(targets as any)[f.key]}
                      onChange={e => setTargets({ ...targets, [f.key]: Number(e.target.value) })}
                      className="h-7 text-xs bg-background/50" disabled={isRunning} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Run Button */}
          <Button onClick={handleStart} className={`w-full font-black text-xs tracking-widest ${isRunning ? 'bg-destructive hover:bg-destructive/90' : ''}`}>
            {isRunning ? <><Square className="w-3.5 h-3.5 mr-2" />Stop Research</> : <><Play className="w-3.5 h-3.5 mr-2" />Initiate Optimization</>}
          </Button>

          {/* Live Metrics */}
          {latestMetrics && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-[10px] uppercase tracking-widest text-primary flex items-center justify-between">
                  Iter {iterations[iterations.length-1].id} Results
                  {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {[
                  { label: "CAGR", val: latestMetrics.cagr, tgt: targets.cagr, fmt: (v: number) => `${v.toFixed(1)}%`, rev: false },
                  { label: "Sharpe", val: latestMetrics.sharpe_ratio, tgt: targets.sharpe, fmt: (v: number) => v.toFixed(2), rev: false },
                  { label: "Max DD", val: latestMetrics.max_drawdown, tgt: targets.maxDD, fmt: (v: number) => `${v.toFixed(1)}%`, rev: true },
                  { label: "Win Rate", val: latestMetrics.win_rate, tgt: targets.winRate, fmt: (v: number) => `${v.toFixed(1)}%`, rev: false },
                ].map(m => (
                  <div key={m.label} className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="text-foreground font-bold">{m.label}</span>
                      <span>{m.fmt(m.val)} / {m.tgt}</span>
                    </div>
                    <Progress value={getTargetProgress(m.val, m.tgt, m.rev)} className="h-0.5 bg-black/40" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Research History */}
          <Card className="bg-card/20 border-border/20">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2"><History className="w-3 h-3" />History</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchHistory}><Clock className="w-3 h-3" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <ScrollArea className="h-[180px]">
                <div className="px-3 space-y-1.5">
                  {history.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground text-center py-6 italic">No history yet...</div>
                  ) : history.map(item => (
                    <div key={item.id} onClick={() => loadHistoryItem(item.id)}
                      className="p-2 bg-background/20 border border-border/20 hover:border-primary/40 cursor-pointer rounded transition-all">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] font-semibold truncate max-w-[140px]">{item.id.split('_')[0]}</span>
                        <span className="text-[8px] text-muted-foreground">{item.id.split('_').slice(-2).join(' ')}</span>
                      </div>
                      <div className="flex gap-1.5 text-[8px]">
                        <span className="bg-primary/10 text-primary px-1 rounded">{item.symbol}</span>
                        <span className="bg-white/5 px-1 rounded">{item.timeframe}</span>
                        {item.metrics && <span className="text-emerald-500 font-mono">{item.metrics.cagr?.toFixed(1)}% CAGR</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Code Evolution Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* View toggle + toolbar */}
          <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-card/10">
            <div className="flex bg-background/40 border border-border/20 rounded p-0.5 gap-0.5">
              <button onClick={() => setActiveView("base")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${activeView === "base" ? "bg-primary text-primary-foreground" : "opacity-40 hover:opacity-70"}`}>
                Base ({baseStrategy.replace(".py","")})
              </button>
              <button onClick={() => setActiveView("evolved")} disabled={!activeCode}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${activeView === "evolved" ? "bg-primary text-primary-foreground" : "opacity-40 hover:opacity-70 disabled:opacity-20"}`}>
                {isViewingHistory ? "History Snapshot" : `Evolved ${iterations.length > 0 ? `(v${iterations.length})` : ""}`}
              </button>
            </div>

            {/* Iteration timeline */}
            {iterations.length > 0 && (
              <div className="flex items-center gap-1 ml-2 overflow-x-auto max-w-[400px]">
                {iterations.map((it, idx) => {
                  const met = it.metrics && it.metrics.cagr >= targets.cagr;
                  return (
                    <button key={it.id} title={`Iter ${it.id} — CAGR: ${it.metrics?.cagr?.toFixed(1)}%`}
                      onClick={() => { setActiveCode(it.code); setActiveView("evolved"); }}
                      className={`w-5 h-5 rounded-sm text-[8px] font-black border transition-all flex-none
                        ${met ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400" : idx === iterations.length-1 ? "bg-primary/20 border-primary/60 text-primary" : "bg-white/5 border-white/10 opacity-50"}`}>
                      {it.id}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {isRunning && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] text-primary/80 font-mono uppercase tracking-widest">Optimizing...</span>
                </div>
              )}
              {historyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {isViewingHistory && (
                <Button variant="ghost" size="sm" className="h-6 text-[9px] gap-1 hover:text-destructive"
                  onClick={() => { setIsViewingHistory(false); setActiveCode(""); setIterations([]); setActiveView("base"); }}>
                  <X className="w-3 h-3" /> Exit History
                </Button>
              )}
            </div>
          </div>

          {/* Code display */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="relative h-full rounded-lg border border-white/5 bg-black/50 overflow-hidden group/code">
              <div className="absolute top-0 left-0 right-0 h-7 flex items-center px-4 bg-white/[0.03] border-b border-white/5 pointer-events-none">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/40" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                </div>
                <span className="ml-3 text-[9px] text-muted-foreground font-mono opacity-40 uppercase">
                  {activeView === "base" ? `${baseStrategy.replace(".py","")}.py [BASE]` : `${baseStrategy.replace(".py","")}_autoresearch_v${iterations.length}.py`}
                </span>
              </div>
              <div className="pt-9 pb-4 px-4 h-full overflow-auto custom-scrollbar">
                <pre className="font-mono text-[11px] leading-relaxed text-blue-100/70 selection:bg-primary/30 whitespace-pre-wrap">
                  {activeView === "base"
                    ? (baseCode || `// Loading ${baseStrategy} source code...`)
                    : (activeCode || "// Optimized logic will appear here with each iteration...")}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Version Dialog */}
      <Dialog open={isSaveVersionOpen} onOpenChange={setIsSaveVersionOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-emerald-400" /> Save Research Version
            </DialogTitle>
            <DialogDescription className="text-white/60 text-xs">
              Saves as <code className="text-emerald-400">{baseStrategy.replace(".py","")}_autoresearch{saveVersionLabel ? `_${saveVersionLabel}` : ""}.py</code> — no approval needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Version Label (optional)</Label>
              <Input placeholder="e.g. v2_high_sharpe" value={saveVersionLabel}
                onChange={e => setSaveVersionLabel(e.target.value)} className="bg-black/40 border-white/10" />
            </div>
            {iterations[iterations.length-1]?.metrics && (
              <div className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded text-[10px] space-y-1">
                {Object.entries(iterations[iterations.length-1].metrics!).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="opacity-50 uppercase">{k}</span><span className="text-emerald-400 font-mono">{typeof v === "number" ? v.toFixed(2) : v}</span></div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveVersionOpen(false)} disabled={saveVersionLoading}>Cancel</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={saveVersion} disabled={saveVersionLoading || !activeCode}>
              {saveVersionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Dialog */}
      <Dialog open={isDeploying} onOpenChange={setIsDeploying}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />Deploy to Engine</DialogTitle>
            <DialogDescription className="text-white/60 text-xs">
              Queues <code className="text-primary">{deployName}_Autoresearch.py</code> for HITL approval before going live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strategy Name</Label>
              <Input placeholder="e.g. OptimizedScalper" value={deployName}
                onChange={e => setDeployName(e.target.value)} className="bg-black/40 border-white/10" />
            </div>
            <div className="p-2 bg-primary/5 border border-primary/10 rounded text-[10px] space-y-1">
              <div className="flex items-center gap-1.5 text-primary/80 font-semibold mb-1"><CheckCircle2 className="w-3 h-3" />Auto-applied</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>• Performance metrics injected into docstrings</div>
                <div>• Requires HITL approval before execution</div>
                <div>• Saved as {deployName || "Strategy"}_Autoresearch.py</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeploying(false)} disabled={deployLoading}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={deployStrategy} disabled={deployLoading || !deployName}>
              {deployLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Queue for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
