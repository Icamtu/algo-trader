import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/lib/api-client";
import {
  TrendingUp, TrendingDown, Brain, Sparkles, Send,
  Loader2, Search, Activity, Zap, WifiOff
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

interface AIAnnotation {
  type: "support" | "resistance" | "pattern" | "signal";
  label: string;
  value: number;
  confidence: number;
  reasoning: string;
}

const symbols = ["NIFTY", "BANKNIFTY", "SBIN", "RELIANCE", "HDFC"];
const timeframes = ["1m", "5m", "15m", "1H", "D"];

export default function AetherAIChartPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [timeframe, setTimeframe] = useState("D");
  const [candles, setCandles] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<AIAnnotation[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    loadChart();
  }, [symbol, timeframe]);

  const loadChart = async () => {
    setIsLoadingChart(true);
    try {
      const data = await algoApi.getHistory({ symbol, exchange: "NSE", interval: timeframe === "D" ? "1" : timeframe });
      setCandles(data || []);
    } catch {
      setCandles([]);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const lastPrice = candles[candles.length - 1]?.close || 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/charting" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/20">
          
          {/* Industrial Control Strip */}
          <div className="flex items-center justify-between px-4 py-2 bg-card/5 border-b border-border/20">
            <div className="flex items-center gap-4">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-background border border-border/40 px-3 py-1 text-[9px] font-mono font-black text-primary focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer tracking-widest uppercase rounded-none"
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <div className="flex bg-border/10 border border-border/20">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-[8px] font-mono font-black uppercase tracking-tighter transition-all ${
                      timeframe === tf ? "bg-primary text-black" : "text-muted-foreground/30 hover:text-foreground/60"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 ml-2 border-l border-border/20 pl-4">
                <IndustrialValue value={lastPrice} className="text-xl font-black font-syne text-foreground" />
                <div className={`px-2 py-0.5 border text-[8px] font-mono font-black flex items-center gap-1.5 tracking-tighter ${lastPrice >= 20000 ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                  <TrendingUp className="w-2.5 h-2.5" />
                  +1.24%
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAnalyzing(true)}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-1.5 bg-primary text-black font-mono font-black text-[9px] uppercase tracking-widest hover:bg-black hover:text-primary transition-all disabled:opacity-30"
            >
              {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              NEURAL_SCAN
            </button>
          </div>

          {/* Chart Layer */}
          <div className="flex-1 p-4 min-h-0 bg-background/20 overflow-hidden relative">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center opacity-20 filter grayscale">
                 <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={candles} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={["auto", "auto"]} orientation="right" tick={{ fill: "rgba(255,255,255,0.1)", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "0", padding: "8px" }}
                    itemStyle={{ color: "#ffb000", fontSize: "9px", fontFamily: "IBM Plex Mono" }}
                  />
                  <Area type="step" dataKey="close" stroke="#00f5ff" strokeWidth={1.5} fill="rgba(0,245,255,0.02)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* AI Console */}
          <div className="px-4 py-2 border-t border-border/20 bg-card/10 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Brain className="w-3.5 h-3.5 text-primary/40" />
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="NEURAL_CMD_INPUT..."
                className="flex-1 bg-transparent text-[10px] font-mono font-black text-foreground placeholder:text-muted-foreground/10 uppercase tracking-widest focus:outline-none"
              />
              <Send className="w-3.5 h-3.5 text-primary/40 cursor-not-allowed" />
            </div>
          </div>
        </div>

        {/* Observation Deck */}
        <div className="w-80 bg-card/5 backdrop-blur-xl flex flex-col border-l border-border/20">
          <div className="px-4 py-2 border-b border-border/20 bg-card/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-foreground">Observation_Deck</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            <div className="border border-primary/20 bg-primary/5 p-4 relative">
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
                 <span className="text-[8px] font-mono font-black uppercase tracking-widest text-primary">Core_Output</span>
              </div>
              <p className="text-[9px] font-mono font-black text-foreground/60 leading-relaxed uppercase tracking-widest">
                Aether_Core is monitoring {symbol} for pattern saturation. Current regime: Low Volatility Consolidation.
              </p>
            </div>

            <div className="space-y-2">
               <h4 className="text-[7px] font-mono font-black uppercase tracking-widest text-muted-foreground/20 px-1">Telemetry_Units</h4>
               {[1, 2, 3].map(i => (
                 <div key={i} className="border border-border/10 bg-card/5 p-3 hover:bg-card/10 transition-all">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black font-syne uppercase text-foreground/80">NODE_MATCH_{i}</span>
                       <span className="text-[8px] font-mono font-black text-secondary border border-secondary/20 px-1.5">9{i}%</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase">Threshold</span>
                       <span className="text-[10px] font-mono font-black text-foreground/40">22.4K</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
