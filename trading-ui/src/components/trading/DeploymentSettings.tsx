import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Rocket,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Settings2,
  Lock,
  Unlock,
  Loader2,
  Clock,
  Timer,
  Zap,
  ShieldCheck
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StrategySelectionDialog } from './StrategySelectionDialog';
import { algoApi } from '@/features/aetherdesk/api/client';
import { toast } from 'sonner';

export function DeploymentSettings() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [maxRisk, setMaxRisk] = useState("500");
  const [capitalMult, setCapitalMult] = useState("1.0");
  const [targetPnl, setTargetPnl] = useState("2500");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // New Strategy Options (Requested by User)
  const [strategyType, setStrategyType] = useState("intraday");
  const [tradingMode, setTradingMode] = useState("both");
  const [startTime, setStartTime] = useState("09:15");
  const [endTime, setEndTime] = useState("15:15");
  const [squareOffTime, setSquareOffTime] = useState("15:20");
  const [productType, setProductType] = useState("MIS");

  // Auto-set product type based on strategy type
  React.useEffect(() => {
    if (strategyType?.toLowerCase() === 'positional') {
      setProductType("NRML");
    } else if (strategyType?.toLowerCase() === 'intraday') {
      setProductType("MIS");
    }
  }, [strategyType]);

  // Sync state with engine on mount
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await algoApi.getStrategies();
        const activeStrat = data.strategies.find((s: any) => s.is_active);
        if (activeStrat && !selectedStrategy) {
          setSelectedStrategy(activeStrat.id);
          setIsLive(true);
        }
      } catch (e) {
        console.error("Failed to sync deployment status", e);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    checkStatus();
  }, []);

  // Phase 16: Sync isLive state when selectedStrategy changes
  React.useEffect(() => {
    if (!selectedStrategy) return;

    const verifySpecificStatus = async () => {
      try {
        const data = await algoApi.getStrategies();
        const current = data.strategies.find((s: any) => s.id === selectedStrategy);
        setIsLive(current?.is_active || false);
      } catch (e) {
        console.error("Status verification fault", e);
      }
    };
    verifySpecificStatus();
  }, [selectedStrategy]);

  const handleInitiateRun = async () => {
    if (!selectedStrategy) {
      toast.error("Deployment Error", { description: "You must select a base strategy first." });
      return;
    }

    setIsDeploying(true);
    try {
      const strategyId = selectedStrategy.toLowerCase();
      await algoApi.startStrategy(strategyId, {
        max_risk: parseFloat(maxRisk),
        capital_multiplier: parseFloat(capitalMult),
        target_pnl: parseFloat(targetPnl),
        strategy_type: strategyType,
        trading_mode: tradingMode,
        trading_hours: {
          start: startTime,
          end: endTime,
          square_off: squareOffTime
        },
        product_type: productType,
        mode: 'live'
      });
      toast.success("Deployment Successful", {
        description: `${selectedStrategy} is now active in the production environment.`,
        icon: <Unlock className="w-4 h-4 text-green-500" />
      });
      setIsLive(true);
    } catch (e: any) {
      toast.error("Deployment Failed", { description: e.message || "Engine rejected the initiation request." });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleStopRun = async () => {
    if (!selectedStrategy) return;

    setIsDeploying(true);
    try {
      const strategyId = selectedStrategy.toLowerCase();
      await algoApi.stopStrategy(strategyId, false);
      setIsLive(false);
      toast.info("Production Stopped", {
        description: "Strategy halted successfully.",
        icon: <Lock className="w-4 h-4 text-orange-500" />
      });
    } catch (e: any) {
      toast.error("Halt Failed", { description: "Could not stop the strategy runner." });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="bg-slate-950/40 border-primary/20 backdrop-blur-md overflow-hidden group">
      <CardHeader className="pb-3 border-b border-white/5 bg-primary/5">
        <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Strategic Deployment
            </CardTitle>
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Base Strategy Engine</Label>
          <StrategySelectionDialog
            onSelect={setSelectedStrategy}
            currentStrategy={selectedStrategy || undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" /> Max Risk
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">₹</span>
              <Input
                value={maxRisk}
                onChange={(e) => setMaxRisk(e.target.value)}
                className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Allocation
            </Label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">x</span>
                <Input
                  value={capitalMult}
                  onChange={(e) => setCapitalMult(e.target.value)}
                  className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
                />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" /> Target Daily P&L Cutoff
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">₹</span>
            <Input
              value={targetPnl}
              onChange={(e) => setTargetPnl(e.target.value)}
              className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* --- New Strategy Manager Options --- */}
        <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Strategy Type</Label>
                    <Select value={strategyType} onValueChange={setStrategyType}>
                        <SelectTrigger className="bg-black/60 border-white/5 h-11 text-xs rounded-lg focus:ring-primary/20">
                            <SelectValue placeholder="Select Strategy Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                            <SelectItem value="intraday">Intraday</SelectItem>
                            <SelectItem value="positional">Positional</SelectItem>
                        </SelectContent>
                    </Select>
                    {strategyType?.toLowerCase() === 'intraday' && (
                        <p className="text-[10px] text-muted-foreground/60 italic px-1 animate-in fade-in slide-in-from-top-1">
                            Intraday strategies have trading hours and auto square-off.
                        </p>
                    )}
                    {strategyType?.toLowerCase() === 'positional' && (
                        <p className="text-[10px] text-emerald-400/60 italic px-1 animate-in fade-in slide-in-from-top-1">
                            Positional strategies are held across days without time constraints.
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Trading Mode</Label>
                    <Select value={tradingMode} onValueChange={setTradingMode}>
                        <SelectTrigger className="bg-black/60 border-white/5 h-11 text-xs rounded-lg ring-primary/20 focus:ring-2">
                            <SelectValue placeholder="Select Mode" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                            <SelectItem value="long">LONG Only</SelectItem>
                            <SelectItem value="short">SHORT Only</SelectItem>
                            <SelectItem value="both">BOTH</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground/60 italic px-1">
                        {tradingMode === 'long' && "Buy signals only (Long execution)"}
                        {tradingMode === 'short' && "Sell signals only (Short execution)"}
                        {tradingMode === 'both' && "Bi-directional trading enabled"}
                    </p>
                </div>
            </div>

            {strategyType?.toLowerCase() === 'intraday' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Order Execution Type (Product)</Label>
                    <Select value={productType} onValueChange={setProductType}>
                        <SelectTrigger className="bg-black/60 border-white/5 h-11 text-xs rounded-lg ring-primary/20 focus:ring-2">
                            <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                            <SelectItem value="MIS">MIS (Intraday Margin)</SelectItem>
                            <SelectItem value="NRML">NRML (Normal/Positional)</SelectItem>
                            <SelectItem value="CNC">CNC (Cash & Carry/Delivery)</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground/60 italic px-1">
                        {productType === 'MIS' && "Auto-closed at 3:20 PM. Requires less capital."}
                        {productType === 'NRML' && "Can be held overnight. Recommended for Swing/Positional."}
                        {productType === 'CNC' && "Full delivery into Demat. No margin/leverage."}
                    </p>
                </div>
            )}

            {strategyType?.toLowerCase() === 'intraday' && (
                <div className="space-y-3 p-3 bg-white/[0.02] border border-white/5 rounded-sm">
                    <Label className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em] flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Trading Hours
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase text-muted-foreground/40 font-bold">Start</span>
                            <Input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="bg-black/60 border-white/5 h-8 text-[10px] px-2"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase text-muted-foreground/40 font-bold">End</span>
                            <Input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="bg-black/60 border-white/5 h-8 text-[10px] px-2"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase text-muted-foreground/40 font-bold">Square Off</span>
                            <Input
                                type="time"
                                value={squareOffTime}
                                onChange={(e) => setSquareOffTime(e.target.value)}
                                className="bg-black/60 border-white/5 h-8 text-[10px] px-2"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="pt-6 grid grid-cols-2 gap-4">
           {isLive ? (
               <Button
                variant="destructive"
                className="w-full h-12 uppercase font-black tracking-widest text-[10px] rounded-lg col-span-2"
                onClick={handleStopRun}
               >
                 <Lock className="w-4 h-4 mr-2" /> Deactivate Runner
               </Button>
           ) : (
               <>
                <Button
                    variant="outline"
                    className="w-full h-12 bg-transparent border-white/10 text-white uppercase font-black tracking-widest text-[10px] rounded-lg hover:bg-white/5"
                    onClick={() => setSelectedStrategy(null)}
                >
                    Cancel
                </Button>
                <Button
                    className="w-full h-12 bg-[#7c7cfc] hover:bg-[#6c6cfc] text-white uppercase font-black tracking-widest text-[10px] rounded-lg shadow-xl shadow-indigo-500/20"
                    onClick={handleInitiateRun}
                    disabled={isDeploying}
                >
                    {isDeploying ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                        "Create Strategy"
                    )}
                </Button>
               </>
           )}
        </div>
        <p className="text-center text-[9px] text-muted-foreground uppercase mt-4 tracking-tighter opacity-40">
          Safety Mode: Institutional (Manual Approve)
        </p>
      </CardContent>
    </Card>
  );
}
