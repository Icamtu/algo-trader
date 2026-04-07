import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { algoApi } from "@/lib/api-client";
import { ApiErrorBoundary } from "@/components/ui/ApiErrorBoundary";
import {
  TrendingUp, TrendingDown, Brain, Sparkles, Send,
  Loader2, Search, Calendar, BarChart3, Activity,
  AlertTriangle, WifiOff, RefreshCw, Zap
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";

// --- Mock OHLC data (to be replaced with GET /api/history) ---
function generateMockCandles(symbol: string, count = 60) {
  let price = symbol === "NIFTY" ? 22450 : symbol === "SBIN" ? 790 : 2450;
  const data = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - count);

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * price * 0.015;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.005;
    const low = Math.min(open, close) - Math.random() * price * 0.005;
    const vol = Math.floor(500000 + Math.random() * 2000000);
    
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    
    data.push({
      date: d.toISOString().split("T")[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: vol,
    });
    price = close;
  }
  return data;
}

interface AIAnnotation {
  type: "support" | "resistance" | "pattern" | "signal";
  label: string;
  value: number;
  confidence: number;
  reasoning: string;
}

const mockAnnotations: AIAnnotation[] = [
  { type: "resistance", label: "Resistance Zone", value: 22680, confidence: 0.87, reasoning: "Multiple rejections at this level over the past 5 sessions. Supply zone identified with declining volume on approach." },
  { type: "support", label: "Strong Support", value: 22310, confidence: 0.92, reasoning: "Demand zone with high OI buildup. Previous breakout level now acting as support." },
  { type: "pattern", label: "Bullish Engulfing", value: 22500, confidence: 0.78, reasoning: "Classic bullish engulfing pattern on daily timeframe with above-average volume confirmation." },
  { type: "signal", label: "RSI Divergence", value: 22420, confidence: 0.71, reasoning: "Positive RSI divergence forming. Price making lower lows while RSI makes higher lows." },
];

const symbols = ["NIFTY", "BANKNIFTY", "SBIN", "RELIANCE", "HDFC", "TCS", "INFY"];
const timeframes = ["1m", "5m", "15m", "1H", "4H", "D", "W"];

export default function AetherAIChartPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [timeframe, setTimeframe] = useState("D");
  const [candles, setCandles] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<AIAnnotation[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiOnline, setAiOnline] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    loadChart();
  }, [symbol, timeframe]);

  const loadChart = async () => {
    setIsLoadingChart(true);
    setChartError(null);
    try {
      // Try real API first
      const data = await algoApi.getHistory({ symbol, exchange: "NSE", interval: timeframe === "D" ? "1" : timeframe });
      if (data && Array.isArray(data) && data.length > 0) {
        setCandles(data);
      } else {
        // Fallback to mock
        setCandles(generateMockCandles(symbol));
      }
    } catch {
      // Fallback to mock data for development
      setCandles(generateMockCandles(symbol));
    } finally {
      setIsLoadingChart(false);
    }
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // In production: POST /api/ai/chart-annotate with candle data
      await new Promise((r) => setTimeout(r, 1500)); // Simulate latency
      setAnnotations(mockAnnotations);
      setAiSummary(
        `${symbol} is currently trading at ${candles[candles.length - 1]?.close?.toFixed(2)} with a slight bullish bias. ` +
        `Key resistance at ${mockAnnotations[0].value} with ${(mockAnnotations[0].confidence * 100).toFixed(0)}% confidence. ` +
        `A bullish engulfing pattern has formed on the daily timeframe. RSI divergence suggests potential reversal. ` +
        `Recommendation: Watch for a break above ${mockAnnotations[0].value} with volume confirmation for a long entry.`
      );
    } catch {
      setAiOnline(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;
    setIsAnalyzing(true);
    // Simulate AI answering a chart question
    await new Promise((r) => setTimeout(r, 1200));
    setAiSummary(
      `Regarding "${aiQuery}": Based on the current ${symbol} chart, ` +
      `the price action shows consolidation near the ${candles[candles.length - 1]?.close?.toFixed(2)} level. ` +
      `The trend is neutral-to-bullish with improving momentum indicators.`
    );
    setAiQuery("");
    setIsAnalyzing(false);
  };

  const lastPrice = candles[candles.length - 1]?.close || 0;
  const prevPrice = candles[candles.length - 2]?.close || lastPrice;
  const priceChange = lastPrice - prevPrice;
  const pricePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;

  const annotationTypeColors: Record<string, string> = {
    resistance: "text-destructive",
    support: "text-neon-green",
    pattern: "text-primary",
    signal: "text-warning",
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <GlobalHeader />
      <MarketNavbar activeTab="/charting" />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart Controls */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
            <div className="flex items-center gap-3">
              {/* Symbol Selector */}
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:border-primary/50"
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Timeframe */}
              <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                      timeframe === tf
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Price */}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-lg font-black">{lastPrice.toFixed(2)}</span>
                <span className={`text-xs font-bold flex items-center gap-0.5 ${priceChange >= 0 ? "text-neon-green" : "text-destructive"}`}>
                  {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)} ({pricePct.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* AI Status Badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                aiOnline
                  ? "text-primary bg-primary/10 border-primary/20"
                  : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {aiOnline ? <Brain className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {aiOnline ? "AI ONLINE" : "AI OFFLINE"}
              </div>

              {/* Analyze Button */}
              <button
                onClick={runAIAnalysis}
                disabled={isAnalyzing || candles.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="text-xs font-bold text-primary">
                  {isAnalyzing ? "Analyzing..." : "AI Analyze"}
                </span>
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 p-4 min-h-0">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading chart data...</span>
                </div>
              </div>
            ) : chartError ? (
              <ApiErrorBoundary error={chartError} onRetry={loadChart} label="Chart Data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={candles} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis 
                    domain={["auto", "auto"]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  
                  {/* Annotation reference lines */}
                  {annotations.map((a, i) => (
                    <ReferenceLine
                      key={i}
                      y={a.value}
                      stroke={
                        a.type === "resistance" ? "hsl(0, 72%, 51%)" :
                        a.type === "support" ? "hsl(160, 84%, 39%)" :
                        "hsl(234, 89%, 64%)"
                      }
                      strokeDasharray="6 3"
                      label={{
                        value: a.label,
                        position: "right",
                        fill: a.type === "resistance" ? "hsl(0, 72%, 51%)" : a.type === "support" ? "hsl(160, 84%, 39%)" : "hsl(234, 89%, 64%)",
                        fontSize: 10,
                        fontWeight: "bold",
                      }}
                    />
                  ))}
                  
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(234, 89%, 64%)"
                    strokeWidth={2}
                    fill="url(#chartGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(234, 89%, 64%)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* AI Query Bar */}
          <div className="px-4 py-2 border-t border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary shrink-0" />
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiQuery()}
                placeholder="Ask about this chart... (e.g., 'Where is the nearest support?', 'Is there a divergence?')"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={handleAiQuery}
                disabled={isAnalyzing || !aiQuery.trim()}
                className="p-1.5 rounded-md bg-primary/20 hover:bg-primary/30 transition-colors disabled:opacity-30"
              >
                <Send className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: AI Analysis */}
        <div className="w-[320px] border-l border-border bg-background/50 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">Aether AI Analysis</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {/* AI Summary */}
            {aiSummary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-xl p-3 border border-primary/20"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">AI Summary</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{aiSummary}</p>
              </motion.div>
            )}

            {/* Annotations */}
            {annotations.length > 0 ? (
              <>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Detected Annotations</h4>
                {annotations.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-panel rounded-xl p-3 hover:border-primary/20 border border-transparent transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className={`w-3 h-3 ${annotationTypeColors[a.type]}`} />
                        <span className="text-xs font-bold text-foreground">{a.label}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        a.confidence > 0.85 ? "text-neon-green bg-neon-green/10" :
                        a.confidence > 0.7 ? "text-primary bg-primary/10" :
                        "text-warning bg-warning/10"
                      }`}>
                        {(a.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Level:</span>
                      <span className="text-xs font-mono font-bold">{a.value}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{a.reasoning}</p>
                  </motion.div>
                ))}
              </>
            ) : !isAnalyzing ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                  <p className="text-xs text-muted-foreground">Click "AI Analyze" to detect patterns, support/resistance, and signals</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Analyzing price action...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
