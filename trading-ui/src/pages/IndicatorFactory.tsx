import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { Play, Save, Trash2, Info, ChevronRight, BarChart2, Loader2, FlaskConical, Beaker } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { algoApi } from "@/features/aetherdesk/api/client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_CODE = `import pandas as pd
import numpy as np

def calculate(df, period=14):
    """
    Custom indicator calculation logic.
    Input: df (Pandas DataFrame with ohlcv columns)
    Output: pd.Series or pd.DataFrame
    """
    # Simple Moving Average example
    return df['close'].rolling(window=period).mean()
`;

export default function IndicatorFactory() {
  const { toast } = useToast();
  const [name, setName] = useState("MyIndicator");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [symbol, setSymbol] = useState("RELIANCE");
  const [interval, setInterval] = useState("1");
  const [testResult, setTestResult] = useState<any[]>([]);
  const [indicatorsList, setIndicatorsList] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchIndicators();
  }, []);

  const fetchIndicators = async () => {
    try {
      const res = await algoApi.getIndicatorsList();
      if (res.status === "success") setIndicatorsList(res.indicators);
    } catch (err) {
      console.error("Failed to fetch indicators", err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await algoApi.saveIndicator({ name, code });

      if (res.status === "success") {
        toast({ title: "INDICATOR_SAVED", description: `KERNEL_ASSET_${name.toUpperCase()}_PERSISTED` });
        fetchIndicators();
      } else {
        throw new Error(res.detail || "Save failed");
      }
    } catch (err) {
      toast({ variant: "destructive", title: "SAVE_ERR", description: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsRunning(true);
    try {
      // Step 1: Save it first
      await handleSave();

      // Step 2: Fetch history
      const hist = await algoApi.getHistory({ symbol, interval });
      setHistory(hist);

      // Step 3: Calculate
      const res = await algoApi.calculateIndicator({ name, candles: hist, params: { period: 14 } });

      if (res.status === "success") {
        const processed = hist.map((candle, idx) => ({
          ...candle,
          indicator: res.result[idx]
        }));
        setTestResult(processed);
        toast({ title: "CALC_COMPLETE", description: `PROCESSED_${hist.length}_DATAPOINTS_SUCCESSFULLY` });
      } else {
        throw new Error(res.detail || "Calculation failed");
      }
    } catch (err) {
      toast({ variant: "destructive", title: "CALC_ERR", description: String(err) });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden ad-theme aurora-bg">
      <div className="noise-overlay" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/5 border-b border-white/5 relative z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/10 p-2.5 border border-amber-500/20 rounded-sm shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <Beaker className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-black font-mono tracking-[0.25em] uppercase text-amber-500 glow-sm">Indicator_Factory</h1>
            <div className="flex items-center gap-2 mt-0.5 opacity-40">
              <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[8px] font-mono font-black tracking-widest uppercase">Phase_5 // Neural_Asset_Foundry</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/40 border border-white/5 rounded-sm px-3 h-9">
            <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase mr-3">ASSET_ID</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
              className="bg-transparent border-none text-[11px] font-mono font-black text-amber-500 focus:ring-0 outline-none w-32"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 h-9 border border-amber-500/20 bg-amber-500/5 text-amber-500 font-mono font-black text-[9px] uppercase tracking-widest hover:bg-amber-500/10 transition-all disabled:opacity-30"
          >
            {isSaving ? "PERSISTING..." : "SAVE_ASSET"}
          </button>

          <button
            onClick={handleTest}
            disabled={isRunning}
            className="px-6 h-9 bg-amber-500 text-black font-mono font-black text-[9px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
            INITIATE_SIM
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Left: Editor */}
        <div className="w-1/2 flex flex-col border-r border-white/5 bg-black/20">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/5">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3 text-amber-500" />
              <span className="text-[9px] font-mono font-black uppercase tracking-widest text-muted-foreground">Logic_Engine_v1.2</span>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
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
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20 }
              }}
            />
          </div>
        </div>

        {/* Right: Preview & Controls */}
        <div className="flex-1 flex flex-col min-h-0 bg-white/[0.01] overflow-auto custom-scrollbar">
          {/* Test Controls */}
          <div className="p-6 grid grid-cols-2 gap-6 bg-white/[0.02] border-b border-white/5">
            <div className="space-y-2">
              <label className="text-[9px] font-mono font-black uppercase text-muted-foreground/30 tracking-widest">Test_Instrument</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-black/40 border border-white/10 rounded-sm px-4 py-2 text-xs font-mono font-black text-amber-500/80 focus:border-amber-500/40 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-mono font-black uppercase text-muted-foreground/30 tracking-widest">Resolution</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-sm px-4 py-2 text-xs font-mono font-black text-amber-500/80 outline-none appearance-none"
              >
                <option value="1">1_MIN_QUANTI</option>
                <option value="5">5_MIN_SYSTEM</option>
                <option value="15">15_MIN_MACRO</option>
                <option value="60">60_MIN_DEEP</option>
              </select>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="flex-1 p-6 flex flex-col gap-6">
            <div className="glass-card flex-1 min-h-[400px] p-6 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <BarChart2 className="h-4 w-4 text-amber-500" />
                  <span className="text-[11px] font-mono font-black uppercase tracking-[0.2em]">{symbol} // FACTORY_OVERLAY</span>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500/40" />
                     <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">Price_Domain</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                     <span className="text-[8px] font-mono text-amber-500 uppercase font-black">Custom_Signal</span>
                   </div>
                </div>
              </div>

              <div className="flex-1">
                {isRunning ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin opacity-20" />
                  </div>
                ) : testResult.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={testResult}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.05}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.02)" />
                      <XAxis
                        dataKey="timestamp"
                        stroke="rgba(255,255,255,0.1)"
                        fontSize={8}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        stroke="rgba(255,255,255,0.1)"
                        fontSize={8}
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ background: '#020617', border: '1px solid rgba(245,158,11,0.1)', padding: '12px' }}
                        itemStyle={{ fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase' }}
                      />
                      <Area type="monotone" dataKey="close" stroke="#f59e0b" fillOpacity={1} fill="url(#priceGradient)" strokeWidth={1} name="PRICE" />
                      <Line type="monotone" dataKey="indicator" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="CUSTOM_SIGNAL" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/10 gap-4 border border-dashed border-white/5">
                    <FlaskConical className="h-12 w-12 opacity-5" />
                    <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em]">Ready_For_Simulation // Define_Logic</span>
                  </div>
                )}
              </div>
            </div>

            {/* Asset Library */}
            <div className="glass-card p-6">
               <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-muted-foreground/40 mb-4 flex items-center gap-2">
                 <Save className="h-3 w-3" /> PERSISTED_INDICATOR_CACHE
               </h3>
               <div className="grid grid-cols-4 gap-4">
                 {indicatorsList.map(idxName => (
                   <div key={idxName} className="group p-4 bg-white/[0.02] border border-white/5 rounded-sm hover:border-amber-500/20 transition-all cursor-pointer relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Trash2 className="h-3 w-3 text-destructive/40 hover:text-destructive transition-colors" />
                     </div>
                     <span className="text-[11px] font-mono font-black uppercase tracking-tighter text-foreground/70 group-hover:text-amber-500 transition-colors">
                       {idxName}
                     </span>
                   </div>
                 ))}
                 <div className="p-4 border border-dashed border-white/5 rounded-sm flex items-center justify-center opacity-20 hover:opacity-100 hover:border-amber-500/40 transition-all cursor-pointer">
                    <span className="text-[8px] font-mono font-black uppercase tracking-widest">+ NEW_ASSET</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
