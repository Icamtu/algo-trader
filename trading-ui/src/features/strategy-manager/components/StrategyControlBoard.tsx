import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
import { useAether } from "@/contexts/AetherContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Play,
  Square,
  Pause,
  Terminal,
  Cpu,
  Info,
  ShieldCheck,
  Clock,
  SlidersHorizontal,
  ShieldAlert,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AetherPanel } from "@/components/ui/AetherPanel";

interface StrategyControlBoardProps {
  strategy: any;
}

export const StrategyControlBoard: React.FC<StrategyControlBoardProps> = ({ strategy }) => {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<Record<string, any>>(strategy?.params || {});
  const [isPaperMode, setIsPaperMode] = useState(true);
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const { logs, connectionStatus } = useAether();

  const [capital, setCapital] = useState<string>(strategy?.params?.capital?.toString() || "500000");
  const [riskPct, setRiskPct] = useState<string>(strategy?.params?.risk_pct?.toString() || "1.5");
  const [slType, setSlType] = useState<string>(strategy?.params?.sl_type || "trailing");
  const [isDirty, setIsDirty] = useState(false);

  // Reset form when selected strategy changes
  useEffect(() => {
    if (!strategy?.id) return;
    setCapital(strategy.params?.capital?.toString() || "500000");
    setRiskPct(strategy.params?.risk_pct?.toString() || "1.5");
    setSlType(strategy.params?.sl_type || "trailing");
    setOrderType(strategy.params?.order_type || "MARKET");
    setIsPaperMode(strategy.params?.paper_mode ?? true);

    // Phase 16: Additional Strategy Options
    setStrategyType(strategy.params?.strategy_type?.toLowerCase() || "intraday");
    setTradingMode(strategy.params?.trading_mode || "both");
    setStartTime(strategy.params?.trading_hours?.start || "09:15");
    setEndTime(strategy.params?.trading_hours?.end || "15:15");
    setSquareOffTime(strategy.params?.trading_hours?.square_off || "15:20");
    setProductType(strategy.params?.product_type || "MIS");

    setIsDirty(false);
  }, [strategy?.id]);

  // Phase 16 State
  const [strategyType, setStrategyType] = useState("intraday");
  const [tradingMode, setTradingMode] = useState("both");
  const [startTime, setStartTime] = useState("09:15");
  const [endTime, setEndTime] = useState("15:15");
  const [squareOffTime, setSquareOffTime] = useState("15:20");
  const [productType, setProductType] = useState("MIS");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auto-set product type based on strategy type
  useEffect(() => {
    if (strategyType?.toLowerCase() === 'positional') {
      setProductType("NRML");
    } else if (strategyType?.toLowerCase() === 'intraday') {
      setProductType("MIS");
    }
  }, [strategyType]);

  const validateConfig = (): string | null => {
    const cap = parseFloat(capital.replace(/,/g, ""));
    const risk = parseFloat(riskPct);
    if (isNaN(cap) || cap < 10000) return "Capital must be ≥ ₹10,000";
    if (cap > 100000000) return "Capital must be ≤ ₹10 Crore";
    if (isNaN(risk) || risk <= 0) return "Risk % must be > 0";
    if (risk > 10) return "Risk % must be ≤ 10% per trade";
    return null;
  };

  const saveConfigMutation = useMutation({
    mutationFn: () => {
      const err = validateConfig();
      if (err) throw new Error(err);
      return algoApi.updateStrategyParams(strategy.id, {
        capital: parseFloat(capital.replace(/,/g, "")),
        risk_pct: parseFloat(riskPct),
        sl_type: slType,
        order_type: orderType,
        paper_mode: isPaperMode,
        strategy_type: strategyType,
        trading_mode: tradingMode,
        trading_hours: {
          start: startTime,
          end: endTime,
          square_off: squareOffTime
        },
        product_type: productType
      });
    },
    onSuccess: () => {
      toast.success("Config saved");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: () => algoApi.activateStrategy(strategy.id),
    onSuccess: () => {
      toast.success(`Strategy ${strategy.name} Activated`);
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (err: any) => toast.error(`Activation Failed: ${err.message}`),
  });

  const stopMutation = useMutation({
    mutationFn: (squareOff: boolean) => algoApi.stopStrategy(strategy.id, squareOff),
    onSuccess: () => {
      toast.success(`Strategy ${strategy.name} Halted`);
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (err: any) => toast.error(`Halt Failed: ${err.message}`),
  });

  if (!strategy) return (
    <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[11px] uppercase tracking-[0.5em]">
      SELECT_STRATEGY_FOR_COMMAND
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-surface-container overflow-hidden">
      {/* Control Header */}
      <div className="p-3 border-b border-border bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-h2 text-h2 text-cyan-400">
            {strategy?.name ?? "Active Strategy Control"}
          </h2>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-700" title={`id: ${strategy?.id}`}>
            {strategy?.id ?? "—"}
          </span>
        </div>

        <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open strategy runtime parameters"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-slate-500 hover:text-cyan-400 transition-all border border-transparent hover:border-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60"
              onClick={(e) => {
                e.stopPropagation();
                setIsSettingsOpen(true);
              }}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-[#020617] border-white/5 p-0 sm:max-w-[440px] z-[9999] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <AetherPanel variant="glass" className="h-full border-none rounded-none p-6 space-y-8 overflow-y-auto custom-scrollbar">
              <SheetHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <SheetTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">
                            Runtime Parameters
                        </SheetTitle>
                        <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase mt-1">
                            {strategy?.id} // CONFIG_LAYER_01
                        </p>
                    </div>
                </div>
              </SheetHeader>
            <div className="space-y-8 pt-8">
              <div className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Operational Mode</Label>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400">Strategy Type</Label>
                            <Select value={strategyType} onValueChange={(v) => { setStrategyType(v); setIsDirty(true); }}>
                                <SelectTrigger className="bg-black/60 border-white/5 h-10 text-xs rounded-lg">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                                    <SelectItem value="intraday">Intraday</SelectItem>
                                    <SelectItem value="positional">Positional</SelectItem>
                                </SelectContent>
                            </Select>
                            {strategyType === 'intraday' && (
                                <p className="text-[9px] text-slate-500 italic px-1">
                                    Intraday strategies have auto square-off at market close.
                                </p>
                            )}
                            {strategyType === 'positional' && (
                                <p className="text-[9px] text-emerald-400 italic px-1">
                                    Long-term wealth compounding. No exit time constraints.
                                </p>
                            )}
                        </div>

                        {strategyType?.toLowerCase() === 'intraday' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Product Type</Label>
                                <Select value={productType} onValueChange={(v) => { setProductType(v); setIsDirty(true); }}>
                                    <SelectTrigger className="bg-black/60 border-white/5 h-11 text-xs rounded-lg ring-primary/20 focus:ring-2">
                                        <SelectValue placeholder="Product" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                                        <SelectItem value="MIS">MIS (Intraday)</SelectItem>
                                        <SelectItem value="NRML">NRML (Normal)</SelectItem>
                                        <SelectItem value="CNC">CNC (Cash/Delivery)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400">Trading Mode</Label>
                            <Select value={tradingMode} onValueChange={(v) => { setTradingMode(v); setIsDirty(true); }}>
                                <SelectTrigger className="bg-black/60 border-white/5 h-10 text-xs rounded-lg">
                                    <SelectValue placeholder="Mode" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0f1117] border-white/10 text-white rounded-lg">
                                    <SelectItem value="long">LONG Only</SelectItem>
                                    <SelectItem value="short">SHORT Only</SelectItem>
                                    <SelectItem value="both">BOTH</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[9px] text-slate-500 italic px-1">
                                {tradingMode === 'long' && "Only buy signals (BUY to open, SELL to close)"}
                                {tradingMode === 'short' && "Only sell signals (SELL to open, BUY to close)"}
                                {tradingMode === 'both' && "Bi-directional signals enabled"}
                            </p>
                        </div>
                    </div>
                </div>

                {strategyType?.toLowerCase() === 'intraday' && (
                <div className="space-y-4 p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                    <Label className="text-[10px] uppercase font-black text-cyan-400/60 tracking-[0.2em] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Trading Hours (IST)
                    </Label>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Start Time</span>
                                <Input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => { setStartTime(e.target.value); setIsDirty(true); }}
                                    className="bg-black/60 border-white/5 h-10 text-[11px] px-3 text-cyan-100 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest">End Time</span>
                                <Input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => { setEndTime(e.target.value); setIsDirty(true); }}
                                    className="bg-black/60 border-white/5 h-10 text-[11px] px-3 text-cyan-100 font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Auto Square-Off Time</span>
                            <Input
                                type="time"
                                value={squareOffTime}
                                onChange={(e) => { setSquareOffTime(e.target.value); setIsDirty(true); }}
                                className="bg-black/60 border-white/5 h-10 text-[11px] px-3 text-cyan-100 font-mono"
                            />
                            <p className="text-[9px] text-amber-500/60 italic px-1 pt-1">
                                Strategy will liquidate and stop at this time.
                            </p>
                        </div>
                    </div>
                </div>
                )}
              </div>

                <div className="pt-6 border-t border-white/5">
                    <Button
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-[11px] h-14 rounded shadow-[0_0_20px_rgba(8,145,178,0.2)] group"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      Verify & Commit Configuration
                      <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
              </div>
            </AetherPanel>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col custom-scrollbar">
        {/* Runtime Config Form */}
        <div className="mb-6">
          <h3 className="text-[11px] font-mono-label text-slate-500 uppercase tracking-widest mb-4">Runtime Configuration</h3>
          <form className="grid grid-cols-2 gap-x-6 gap-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Capital Allocation (₹)</Label>
              <Input
                className="w-full bg-surface-dim border border-slate-700 rounded text-sm px-3 py-2 text-cyan-100 font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all h-9"
                value={capital}
                onChange={(e) => { setCapital(e.target.value); setIsDirty(true); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Risk Per Trade (%)</Label>
              <Input
                className="w-full bg-surface-dim border border-slate-700 rounded text-sm px-3 py-2 text-cyan-100 font-mono h-9 outline-none"
                value={riskPct}
                onChange={(e) => { setRiskPct(e.target.value); setIsDirty(true); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">SL Type</Label>
              <Select value={slType} onValueChange={(v) => { setSlType(v); setIsDirty(true); }}>
                <SelectTrigger className="w-full bg-surface-dim border border-slate-700 rounded text-sm h-9 text-cyan-100 outline-none">
                  <SelectValue placeholder="Select SL Type" />
                </SelectTrigger>
                <SelectContent className="bg-surface-dim border border-slate-700 text-cyan-100">
                  <SelectItem value="trailing">Trailing Pct</SelectItem>
                  <SelectItem value="fixed">Fixed Point</SelectItem>
                  <SelectItem value="atr">ATR Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Order Type</Label>
              <div className="flex bg-surface-dim border border-slate-700 rounded p-0.5 h-9">
                <button
                  type="button"
                  onClick={() => setOrderType("MARKET")}
                  className={cn(
                    "flex-1 py-1 text-[11px] font-black rounded uppercase tracking-widest transition-all",
                    orderType === "MARKET" ? "bg-slate-800 text-cyan-400 shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  MARKET
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("LIMIT")}
                  className={cn(
                    "flex-1 py-1 text-[11px] font-black rounded uppercase tracking-widest transition-all",
                    orderType === "LIMIT" ? "bg-slate-800 text-cyan-400 shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  LIMIT
                </button>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors group cursor-pointer"
                 onClick={() => setIsSettingsOpen(true)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center border border-white/5 group-hover:border-cyan-500/30 transition-all">
                  <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Operational Parameters</p>
                  <p className="text-[9px] text-slate-500 uppercase font-mono tracking-tight">Type: {strategyType} // Mode: {tradingMode}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="col-span-2 flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-xs font-black text-slate-200 uppercase tracking-tight">Paper Trading Mode</p>
                  <p className="text-[9px] text-slate-500 uppercase font-mono">Execute without real capital risk</p>
                </div>
              </div>
              <Switch
                checked={isPaperMode}
                onCheckedChange={(checked) => { setIsPaperMode(checked); setIsDirty(true); }}
                aria-label="Toggle paper trading mode"
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </form>
        </div>

        {/* Save Config */}
        {isDirty && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => saveConfigMutation.mutate()}
              disabled={saveConfigMutation.isPending}
              className="w-full py-2 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-[11px] font-mono font-black uppercase tracking-widest hover:bg-cyan-500/20 transition-all disabled:opacity-50"
            >
              {saveConfigMutation.isPending ? "Saving..." : "Apply Config Changes"}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-auto">
          <button
            className="bg-secondary/10 hover:bg-secondary/20 border border-secondary text-secondary font-bold py-3 rounded flex flex-col items-center gap-1 transition-all disabled:opacity-50"
            onClick={() => activateMutation.mutate()}
            disabled={strategy.is_active || activateMutation.isPending || stopMutation.isPending}
          >
            <Play className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-widest font-mono">Activate</span>
          </button>
          <button
            className="bg-tertiary-container/10 hover:bg-tertiary-container/20 border border-tertiary-container text-tertiary font-bold py-3 rounded flex flex-col items-center gap-1 transition-all disabled:opacity-50"
            onClick={() => stopMutation.mutate(false)}
            disabled={!strategy.is_active || stopMutation.isPending || activateMutation.isPending}
            title="Stop strategy loop — keeps open positions"
          >
            <Pause className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-widest font-mono">Stop (Keep Pos)</span>
          </button>
          <button
            className="bg-error-container/10 hover:bg-error-container/20 border border-error text-error font-bold py-3 rounded flex flex-col items-center gap-1 transition-all disabled:opacity-50"
            onClick={() => stopMutation.mutate(true)}
            disabled={!strategy.is_active || stopMutation.isPending || activateMutation.isPending}
          >
            <Square className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-widest font-mono">Stop & SQ Off</span>
          </button>
        </div>

        {/* Mini Engine Log Tail */}
        <div className="mt-6 bg-surface-container-lowest border border-slate-800 rounded p-3 font-mono text-[11px]">
          <div className="flex justify-between items-center mb-2 text-slate-500 border-b border-slate-800 pb-1 uppercase tracking-tight">
            <span className="flex items-center gap-2 font-black"><Terminal className="w-3.5 h-3.5" /> ENGINE_LOGS</span>
            <span className="text-[9px] text-secondary font-bold animate-pulse">WS_CONNECTED</span>
          </div>
          <div className="space-y-1 h-32 overflow-y-auto custom-scrollbar pr-2">
            {logs.length > 0 ? (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2 whitespace-nowrap">
                  <span className="text-slate-600">[{log.time.split('T')[1].split('.')[0]}]</span>
                  <span className={cn(
                    "font-bold",
                    log.level === 'INFO' ? 'text-blue-400' :
                    log.level === 'ERROR' ? 'text-red-400' :
                    log.level === 'WARNING' ? 'text-yellow-400' : 'text-slate-400'
                  )}>
                    {log.level}:
                  </span>
                  <span className="text-slate-300">{log.msg}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-600 italic">... awaiting live telemetry stream ...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
