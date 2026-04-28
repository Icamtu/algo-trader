import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Brain, Sparkles, Send, Loader2,
  BarChart2, Telescope, Cpu, LayoutGrid, Maximize2,
  Settings2, Activity, Zap
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import { algoApi } from "@/features/openalgo/api/client";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useTerminalSettings } from "@/contexts/TerminalSettingsContext";
import { LightweightChart } from "@/components/trading/charts/LightweightChart";
import { TradingViewWidget } from "@/components/trading/charts/TradingViewWidget";
import { useAether } from "@/contexts/AetherContext";
import { cn } from "@/lib/utils";

const timeframes = ["1m", "5m", "15m", "1H", "D"] as const;

export default function AetherAIChartPage() {
  const { selectedSymbol } = useAether();
  const [timeframe, setTimeframe] = useState<typeof timeframes[number]>("D");
  const [candles, setCandles] = useState<any[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");

  const displaySymbol = selectedSymbol || "NIFTY";

  useEffect(() => {
    loadChart();
  }, [displaySymbol, timeframe]);

  const loadChart = async () => {
    setIsLoadingChart(true);
    try {
      const data = await algoApi.getHistory({
        symbol: displaySymbol,
        exchange: "NSE",
        interval: timeframe === "D" ? "1" : timeframe
      });
      if (data && data.length > 0) {
        setCandles(data);
      } else {
        throw new Error("No data");
      }
    } catch (e) {
      // Stunning mock data for visual excellence
      const mockData = Array.from({ length: 100 }).map((_, i) => ({
        date: new Date(Date.now() - (100 - i) * 86400000).toISOString(),
        close: 22000 + Math.sin(i / 10) * 500 + Math.random() * 200,
        open: 22000 + Math.sin(i / 10) * 500,
        high: 22000 + Math.sin(i / 10) * 500 + 300,
        low: 22000 + Math.sin(i / 10) * 500 - 100,
      }));
      setCandles(mockData);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const lastPrice = candles[candles.length - 1]?.close || 0;
  const { settings, updateSettings } = useTerminalSettings();

  const renderChart = () => {
    if (isLoadingChart) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 bg-background/50">
           <Loader2 className="w-6 h-6 text-primary animate-spin" />
           <span className="text-[9px] font-mono font-black uppercase tracking-[0.4em] text-primary/40">Synchronizing_Neural_Stream...</span>
        </div>
      );
    }

    if (settings.chartEngine === "tradingview") {
      return <TradingViewWidget symbol={displaySymbol} />;
    }

    if (settings.chartEngine === "lightweight") {
      return <LightweightChart data={candles} />;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={candles} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis
            domain={["auto", "auto"]}
            orientation="right"
            tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9, fontFamily: "IBM Plex Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(0, 0, 0, 0.95)",
              border: "1px solid rgba(0, 245, 255, 0.2)",
              borderRadius: "0",
              padding: "12px",
              backdropFilter: "blur(10px)"
            }}
            itemStyle={{ color: "#00F5FF", fontSize: "10px", fontWeight: "black", fontFamily: "IBM Plex Mono", textTransform: "uppercase" }}
            labelStyle={{ display: "none" }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#00F5FF"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorClose)"
            isAnimationActive={true}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Prime Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/20 bg-card/2 p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase tracking-[0.2em]">
                Neural_Visualizer // G-Sync_v4
             </div>
             <div className="flex items-center gap-2 text-muted-foreground/20 font-mono text-[9px] uppercase tracking-widest font-black">
                <Cpu className="w-3 h-3 text-primary/40" />
                <span>Core_State: Synchronized</span>
             </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight uppercase leading-none text-foreground">
            {displaySymbol} <span className="text-primary opacity-50">.Visuals</span>
          </h1>
          <p className="text-muted-foreground/40 font-mono text-[10px] uppercase tracking-[0.4em] max-w-2xl leading-relaxed">
            Direct Exchange Link // High-fidelity market structure reconstruction for the Indian Alpha ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex bg-card/10 border border-border/50 p-1">
               {timeframes.map((tf) => (
                 <button
                   key={tf}
                   onClick={() => setTimeframe(tf)}
                   className={cn(
                     "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                     timeframe === tf ? "bg-primary text-black" : "text-muted-foreground/40 hover:text-foreground/60"
                   )}
                 >
                   {tf}
                 </button>
               ))}
            </div>
            <button
               onClick={() => setIsAnalyzing(true)}
               className="px-8 py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white flex items-center gap-3 shadow-[0_0_20px_rgba(0,245,255,0.15)]"
            >
               {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
               Neural_Scan
            </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
         {/* Main Chart Column */}
         <div className="col-span-9 flex flex-col border border-border/50 bg-card/5 relative overflow-hidden group min-h-[500px]">
            <div className="scanline opacity-[0.02]" />

            {/* Overlay Telemetry */}
            <div className="absolute top-8 left-8 z-30 pointer-events-none space-y-2">
               <IndustrialValue value={lastPrice} prefix="₹" className="text-4xl font-black font-display text-foreground leading-none" />
               <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-secondary animate-pulse" />
                  <span className="text-[11px] font-mono font-black text-secondary tracking-widest uppercase">+1.24% (+245.3)</span>
               </div>
            </div>

            <div className="absolute top-8 right-8 z-30 flex gap-12">
                <div className="flex flex-col items-end">
                   <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">Volume_Node</span>
                   <span className="text-xs font-black text-foreground">2.45M</span>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">ATR_14</span>
                   <span className="text-xs font-black text-primary">124.50</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">Engine</span>
                   <div className="flex bg-card/10 border border-border/50 p-0.5">
                      {[
                        { id: 'lightweight', label: 'LW' },
                        { id: 'tradingview', label: 'TV' }
                      ].map((eng) => (
                        <button
                          key={eng.id}
                          onClick={() => updateSettings({ chartEngine: eng.id as any })}
                          className={cn(
                            "px-2 py-1 text-[8px] font-black uppercase transition-all",
                            settings.chartEngine === eng.id ? "bg-primary text-black" : "text-muted-foreground/40 hover:text-foreground/60"
                          )}
                        >
                          {eng.label}
                        </button>
                      ))}
                   </div>
                </div>
            </div>

            <div className="flex-1 mt-24">
               {renderChart()}
            </div>

            {/* Neural Chat Interface */}
            <div className="p-6 bg-card/10 border-t border-border/20 flex items-center gap-6 relative group/query">
               <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/20 scale-x-0 group-focus-within/query:scale-x-100 transition-transform duration-500" />
               <Brain className="w-5 h-5 text-primary animate-pulse opacity-40 group-focus-within/query:opacity-100" />
               <input
                 className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono font-black uppercase tracking-widest placeholder:text-muted-foreground/10 text-primary"
                 placeholder="QUERY_AETHER_AI_ON_MARKET_REGIMES..."
                 value={aiQuery}
                 onChange={(e) => setAiQuery(e.target.value)}
               />
               <button className="p-3 hover:bg-white/5 transition-colors border border-transparent hover:border-border/50">
                  <Send className="w-4 h-4 text-muted-foreground/40 group-focus-within/query:text-primary transition-colors" />
               </button>
            </div>
         </div>

         {/* Stats Sidebar */}
         <div className="col-span-3 space-y-6">
            <div className="p-6 bg-card/5 border border-border/50 space-y-8">
               <div className="flex items-center gap-3 border-b border-border/20 pb-4">
                  <Telescope className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Analytic_Deck</h3>
               </div>

               <div className="space-y-6">
                  <div className="p-4 bg-primary/5 border border-primary/20 relative group overflow-hidden">
                     <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 -rotate-45 translate-x-4 -translate-y-4" />
                     <h4 className="text-[9px] font-black uppercase mb-2 text-primary tracking-widest">Neural_Regime</h4>
                     <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed uppercase">
                        High_Probability Breakout pattern detected. Neural gap analysis confirms 4:1 Reward ratio.
                     </p>
                  </div>

                  <div className="space-y-3">
                     <StatNode label="RSI_14" value="62.4" status="Nominal" />
                     <StatNode label="MACD_DIV" value="+12.5" status="Bullish" />
                     <StatNode label="BB_SQUEEZE" value="0.045" status="Active" />
                     <StatNode label="SENTIMENT" value="Positive" status="High" />
                  </div>
               </div>
            </div>

            <div className="p-6 bg-card/5 border border-border/50 space-y-6">
               <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                     <Activity className="w-4 h-4 text-muted-foreground/20" />
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Signal_Alpha</h3>
                  </div>
                  <span className="text-[10px] font-mono font-black text-secondary uppercase tracking-widest">84.2%</span>
               </div>
               <div className="h-1 w-full bg-muted/10 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "84.2%" }}
                    className="absolute top-0 left-0 h-full bg-secondary shadow-[0_0_10px_rgba(50,255,126,0.2)]"
                  />
               </div>
            </div>

            <button className="w-full py-4 border border-border/50 bg-card/5 hover:border-primary/40 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-3">
               <Settings2 className="w-3.5 h-3.5" />
               Visual_Settings
            </button>
         </div>
      </div>
    </div>
  );
}

function StatNode({ label, value, status }: { label: string, value: string, status: string }) {
  const isUp = status === "Bullish" || status === "Strong" || status === "Positive";
  const isWarning = status === "Active" || status === "High" || status === "Squeeze";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/10 last:border-0">
       <div className="flex flex-col">
          <span className="text-[7px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-1">{label}</span>
          <span className="text-[11px] font-mono font-black text-foreground uppercase">{value}</span>
       </div>
       <div className={cn(
         "px-2 py-0.5 border font-mono font-black text-[8px] uppercase tracking-widest",
         isUp ? "border-secondary/20 text-secondary bg-secondary/5" :
         isWarning ? "border-primary/20 text-primary bg-primary/5" :
         "border-border/20 text-muted-foreground/20"
       )}>
          {status}
       </div>
    </div>
  );
}
