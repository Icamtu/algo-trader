import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { algoApi } from "@/features/aetherdesk/api/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { Loader2, Search, Play, Settings2, BarChart2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function IndicatorAnalyzer() {
  const [symbol, setSymbol] = useState("SBIN");
  const [interval, setInterval] = useState("1");
  const [selectedIndicators, setSelectedIndicators] = useState<{name: string, params: any[]}[]>([
    { name: "ema", params: [20] },
    { name: "ema", params: [50] }
  ]);

  const { data: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["history", symbol, interval],
    queryFn: () => algoApi.getHistory({ symbol, interval }),
  });

  const { data: indicators, mutate: calculate, isPending: isCalculating } = useMutation({
    mutationFn: (candles: any[]) => algoApi.calculateIndicators({
      symbol,
      candles,
      indicators: selectedIndicators
    }),
  });

  const chartData = useMemo(() => {
    if (!history || !Array.isArray(history)) return [];

    return history.map((candle, idx) => {
      const data: any = { ...candle };
      if (indicators?.results) {
        Object.entries(indicators.results).forEach(([name, values]: [string, any]) => {
          data[name] = values[idx];
        });
      }
      return data;
    });
  }, [history, indicators]);

  const handleCalculate = () => {
    if (history && Array.isArray(history)) {
      calculate(history);
    } else {
      toast.error("No historical data available to analyze");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="glass-panel p-6 flex flex-wrap items-center gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-white/5 bg-white/[0.02]">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Instrument_Tag</label>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-black/40 border border-white/10 rounded-sm px-9 py-2 text-[11px] font-mono focus:outline-none focus:border-primary/40 focus:bg-black/60 w-40 transition-all placeholder:text-muted-foreground/5"
              placeholder="e.g. RELIANCE"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Time_Resolution</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-sm px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-primary/40 focus:bg-black/60 transition-all appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
          >
            <option value="1">1_MIN_INTERRUPT</option>
            <option value="5">5_MIN_QUANTI</option>
            <option value="15">15_MIN_SYSTEM</option>
            <option value="60">60_MIN_MACRO</option>
            <option value="D">D1_INSTITUTIONAL</option>
          </select>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleCalculate}
          disabled={isLoadingHistory || isCalculating}
          className="flex items-center gap-3 bg-primary text-primary-foreground px-6 py-2.5 rounded-sm text-[10px] font-mono font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
        >
          {isCalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          Execute_Analysis
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-panel p-6 min-h-[500px] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h3 className="text-[12px] font-mono font-black uppercase tracking-widest">{symbol} // ARCHIVE_ANALYTIC</h3>
              </div>
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase mt-1 tracking-[0.3em]">Institutional_Engine_Output</span>
            </div>
            <div className="text-[8px] font-mono font-bold text-muted-foreground/40 flex gap-6 uppercase tracking-widest">
              {Object.keys(indicators?.results || {}).map(name => (
                <div key={name} className="flex items-center gap-2 px-2 py-1 bg-black/40 border border-white/5 rounded-sm">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: name.includes('ema') ? 'hsl(234, 89%, 64%)' : 'hsl(160, 84%, 39%)' }} />
                  {name}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[400px]">
            {isLoadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                  <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">Hydrating_Context...</span>
                </div>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="rgba(255,255,255,0.15)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    dy={10}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="rgba(255,255,255,0.15)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    dx={10}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(5, 5, 5, 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '12px'
                    }}
                    labelStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: '8px' }}
                    itemStyle={{ fontSize: '10px', padding: '2px 0', fontFamily: 'monospace' }}
                  />
                  <Area type="monotone" dataKey="close" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} name="SYSTEM_PRICE" animationDuration={1500} />

                  {indicators?.results && Object.keys(indicators.results).map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={i === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
                      dot={false}
                      strokeWidth={1.5}
                      name={name.toUpperCase()}
                      animationDuration={1500}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-4">
                <div className="relative">
                  <Search className="w-12 h-12 opacity-10" />
                  <div className="absolute inset-0 blur-xl bg-primary/20 opacity-20" />
                </div>
                <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em]">Null_Domain_Detected // Run_Analysis</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-mono font-black uppercase tracking-widest">Asset_Logic</span>
          </div>

          <div className="space-y-4 flex-1">
            {selectedIndicators.map((ind, i) => (
              <div key={i} className="bg-white/[0.02] rounded-sm p-4 border border-white/5 group hover:border-primary/20 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <span className="text-[11px] font-mono font-black uppercase text-primary tracking-widest">{ind.name}</span>
                  <button className="text-muted-foreground/20 hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {ind.params.map((p, pi) => (
                    <div key={pi} className="px-2 py-1 bg-black/40 border border-white/5 rounded-xs text-[9px] font-mono text-muted-foreground/60">
                      P_{pi}: <span className="text-foreground/80">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button className="w-full py-3 border border-dashed border-white/5 rounded-sm text-[9px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.25em] hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Inject_Logic
            </button>
          </div>

          <div className="mt-auto pt-6 border-t border-white/5 relative">
            <div className="absolute -top-1 px-3 bg-card text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest">Engine_Intel</div>
            <div className="bg-black/20 rounded-sm p-5 border border-white/5">
              <h4 className="text-[10px] font-mono font-black uppercase text-primary/60 mb-3 tracking-widest">Architecture_Manifest</h4>
              <p className="text-[10px] font-mono text-muted-foreground/30 leading-relaxed uppercase tracking-tighter">
                Numba-accelerated vectorized compute pipeline. O(n) linear complexity ensures &lt;10ms latency on institutional datasets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
