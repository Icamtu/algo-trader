import React, { useState } from "react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Square, Loader2, Code2, Target, History, Clock, X, ChevronRight, Save, CheckCircle2 } from "lucide-react";
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
  const [symbol, setSymbol] = useState("RELIANCE");
  const [timeframe, setTimeframe] = useState("1m");
  const [days, setDays] = useState(7);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [targets, setTargets] = useState({
    cagr: 40,
    sharpe: 2.5,
    maxDD: 5,
    winRate: 50,
  });

  const [activeCode, setActiveCode] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployLoading, setDeployLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}autoresearch/history`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("aether_token") || "test-token"}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  };

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const loadHistoryItem = async (id: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}autoresearch/history/${id}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("aether_token") || "test-token"}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveCode(data.code);
        // Create a 'dummy' iteration to show metrics if needed, or handle separately
        if (data.metrics) {
            setIterations([{ id: -1, code: data.code, metrics: data.metrics, timestamp: data.metadata?.timestamp || "" }]);
        }
        setIsViewingHistory(true);
      }
    } catch (e) {
      toast.error("Failed to load historical iteration");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!activeCode) {
        toast.error("No code to deploy. Complete research first.");
        return;
    }
    // backend will append _Autoresearch.py
    setDeployName(baseStrategy.replace(".py", ""));
    setIsDeploying(true);
  };

  const deployStrategy = async () => {
    if (!activeCode) return;
    setDeployLoading(true);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}autoresearch/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("aether_token") || "test-token"}`
        },
        body: JSON.stringify({
          name: deployName,
          code: activeCode,
          metrics: iterations.length > 0 ? iterations[iterations.length - 1].metrics : undefined
        })
      });
      
      if (!response.ok) throw new Error("Deployment failed");
      
      toast.success(`Deployment successful! Strategy ${deployName} is now in production.`);
      setIsDeploying(false);
      setDeployName("");
    } catch (e) {
      toast.error("Deployment failed. Check filesystem permissions.");
    } finally {
      setDeployLoading(false);
    }
  };

  const handleStart = async () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    
    setIsRunning(true);
    setIterations([]);
    
    try {
      let currentIteration = 1;
      let currentCode = ""; 
      
      let targetsMet = false;
      
      while (!targetsMet) {
        if (!isRunning && currentIteration > 1) {
            toast.info("AutoResearch stopped by user.");
            break;
        }

        toast.loading(`Running Iteration ${currentIteration}...`, { id: 'autoresearch' });
        
        const response = await fetch(`${CONFIG.API_BASE_URL}autoresearch/iteration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("aether_token") || "test-token"}`
          },
          body: JSON.stringify({
            strategy_name: currentCode ? undefined : baseStrategy,
            code: currentCode,
            symbol,
            timeframe,
            days,
            targets
          })
        });

        if (!response.ok) {
          throw new Error("Failed to run iteration");
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        const iter: Iteration = {
            id: currentIteration,
            code: data.new_code || currentCode,
            metrics: data.metrics,
            timestamp: new Date().toISOString()
        };
        
        setIterations(prev => [...prev, iter]);
        setActiveCode(data.new_code);
        currentCode = data.new_code;

        const m = data.metrics as Metrics;
        if (
            m && 
            m.cagr >= targets.cagr &&
            m.sharpe_ratio >= targets.sharpe &&
            m.max_drawdown <= targets.maxDD &&
            m.win_rate >= targets.winRate
        ) {
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
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <GlobalHeader />
      <MarketNavbar activeTab="strategies" />
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* LEFT: Controls & Metrics */}
        <div className="w-[400px] flex-none space-y-6 overflow-y-auto pr-2">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">AutoResearch Lab</h1>
              <p className="text-xs text-muted-foreground">Autonomous Target-Driven Optimization</p>
            </div>
          </div>

          <Card className="bg-background/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label className="text-[10px] text-muted-foreground uppercase opacity-70">Base Strategy</Label>
                    <StrategySelectionDialog 
                        onSelect={setBaseStrategy} 
                        currentStrategy={baseStrategy} 
                    />
                  </div>
                  <div className="space-y-2">
                      <Label className="text-xs">Symbol / Instrument</Label>
                      <Input value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-background/50 h-8 text-xs" disabled={isRunning} />
                  </div>
                  <div className="space-y-2">
                      <Label className="text-xs">Timeframe</Label>
                      <select 
                          value={timeframe} 
                          onChange={e => setTimeframe(e.target.value)} 
                          className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm shadow-black/5 outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                          disabled={isRunning}
                      >
                          <option value="1m">1m</option>
                          <option value="5m">5m</option>
                          <option value="15m">15m</option>
                          <option value="1h">1h</option>
                          <option value="1d">1d</option>
                      </select>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-xs">Days Data</Label>
                      <Input type="number" value={days} onChange={e => setDays(Number(e.target.value))} className="bg-background/50 h-8 text-xs" disabled={isRunning} />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Target Metrics</CardTitle>
              <CardDescription className="text-xs">Optimization goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">CAGR (%) &gt;</Label>
                      <Input type="number" value={targets.cagr} onChange={e => setTargets({...targets, cagr: Number(e.target.value)})} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Sharpe Ratio &gt;</Label>
                      <Input type="number" step="0.1" value={targets.sharpe} onChange={e => setTargets({...targets, sharpe: Number(e.target.value)})} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max DD (%) &lt;</Label>
                      <Input type="number" value={targets.maxDD} onChange={e => setTargets({...targets, maxDD: Number(e.target.value)})} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Win Rate (%) &gt;</Label>
                      <Input type="number" value={targets.winRate} onChange={e => setTargets({...targets, winRate: Number(e.target.value)})} className="h-7 text-xs" />
                  </div>
              </div>
            </CardContent>
          </Card>

          <Button 
              onClick={handleStart} 
              className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
          >
              {isRunning ? (
                  <><Square className="w-4 h-4 mr-2" /> Stop Research</>
              ) : (
                  <><Play className="w-4 h-4 mr-2" /> Initiate Optimization</>
              )}
          </Button>

          {/* LIVE METRICS */}
          {latestMetrics && (
              <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex justify-between">
                          Iter {iterations[iterations.length-1].id} Results
                          {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-muted-foreground"><span className="text-foreground">CAGR</span> {latestMetrics.cagr.toFixed(2)}% / {targets.cagr}%</div>
                          <Progress value={getTargetProgress(latestMetrics.cagr, targets.cagr)} className="h-1 bg-black/40" />
                      </div>
                      <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-muted-foreground"><span className="text-foreground">Sharpe</span> {latestMetrics.sharpe_ratio.toFixed(2)} / {targets.sharpe}</div>
                          <Progress value={getTargetProgress(latestMetrics.sharpe_ratio, targets.sharpe)} className="h-1 bg-black/40" />
                      </div>
                      <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-muted-foreground"><span className="text-foreground">Max DD</span> {latestMetrics.max_drawdown.toFixed(2)}% / {targets.maxDD}%</div>
                          <Progress value={getTargetProgress(latestMetrics.max_drawdown, targets.maxDD, true)} className="h-1 bg-black/40" />
                      </div>
                      <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-muted-foreground"><span className="text-foreground">Win Rate</span> {latestMetrics.win_rate.toFixed(1)}% / {targets.winRate}%</div>
                          <Progress value={getTargetProgress(latestMetrics.win_rate, targets.winRate)} className="h-1 bg-black/40" />
                      </div>
                  </CardContent>
              </Card>
          )}

          {/* RESEARCH HISTORY */}
          <Card className="bg-background/40 flex-1 flex flex-col min-h-[300px]">
              <CardHeader className="pb-2 flex-none">
                  <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        Research History
                      </div>
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={fetchHistory}>
                        <Clock className="w-3 h-3" />
                      </Button>
                  </CardTitle>
                  <CardDescription className="text-xs">Past optimization results</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-[250px]">
                      <div className="p-4 space-y-2">
                          {history.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground text-center py-4 italic">No history found yet...</div>
                          ) : (
                              history.map((item) => (
                                  <div 
                                      key={item.id}
                                      onClick={() => loadHistoryItem(item.id)}
                                      className="group p-2 rounded-lg bg-background/20 border border-border/20 hover:border-primary/40 cursor-pointer transition-all"
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <div className="text-[11px] font-semibold truncate max-w-[150px]">{item.id.split('_')[0]}</div>
                                          <div className="text-[9px] text-muted-foreground">{item.id.split('_').slice(-2).join(' ')}</div>
                                      </div>
                                      <div className="flex gap-2 text-[9px] text-muted-foreground">
                                          <span className="bg-primary/10 text-primary px-1 rounded">{item.symbol}</span>
                                          <span className="bg-white/5 px-1 rounded">{item.timeframe}</span>
                                          {item.metrics && (
                                              <span className="text-green-500 font-mono">{item.metrics.cagr.toFixed(1)}% CAGR</span>
                                          )}
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
        </div>

        {/* RIGHT: Visual Editor / Code */}
        <Card className="flex-1 flex flex-col bg-card/40 border-border/40 overflow-hidden">
          <div className="flex-none flex items-center justify-between p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">
                      {isViewingHistory ? "Historical Snapshot" : `Strategy Evolution (${iterations.length > 0 ? `v${iterations.length}` : 'Base'})`}
                  </span>
                  {historyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>
              <div className="flex items-center gap-2">
                  {isViewingHistory && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                          setIsViewingHistory(false);
                          setIterations([]); // Clear dummy iteration
                          setActiveCode("");
                      }}
                    >
                        <X className="w-3 h-3" /> Exit History
                    </Button>
                  )}
                  {activeCode && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={handleDeploy}
                      disabled={isRunning}
                    >
                        <Save className="w-3 h-3" /> Deploy to Production
                    </Button>
                  )}
              </div>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <pre className="font-mono text-xs text-muted-foreground p-4 bg-black/40 rounded-md whitespace-pre-wrap outline outline-1 outline-border/20">
              {activeCode || (isViewingHistory ? "// Loading code..." : "// Optimized logic will appear here synchronously with iterations...")}
            </pre>
          </div>
        </Card>
      </div>

        {/* Deploy Dialog */}
        <Dialog open={isDeploying} onOpenChange={setIsDeploying}>
          <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Save className="w-5 h-5 text-primary" />
                Deploy to Production
              </DialogTitle>
              <DialogDescription className="text-white/60 text-xs">
                This will save the optimized logic as <code className="text-primary">{deployName}_Autoresearch.py</code> in your strategies folder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="strategy-name" className="text-xs text-muted-foreground">Strategy File Name</Label>
                <Input 
                  id="strategy-name"
                  placeholder="e.g. OptimizedScalper"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  className="bg-black/40 border-white/10"
                />
              </div>
              
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-md space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary/80">
                   <CheckCircle2 className="w-3 h-3" /> Automatic Enhancements
                </div>
                <ul className="text-[10px] text-muted-foreground space-y-1">
                  <li>• Performance metadata will be injected into docstrings.</li>
                  <li>• Filename will be normalized to snake_case.</li>
                  <li>• Strategy will be discoverable by the live engine.</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeploying(false)} disabled={deployLoading}>
                Cancel
              </Button>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={deployStrategy}
                disabled={deployLoading || !deployName}
              >
                {deployLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Deployment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
