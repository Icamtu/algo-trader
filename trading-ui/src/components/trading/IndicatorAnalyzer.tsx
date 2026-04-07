
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { algoApi } from "@/lib/api-client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { Loader2, Search, Play, Settings2, BarChart2 } from "lucide-react";
import { toast } from "sonner";

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
    <div className="space-y-4">
      <div className="glass-panel p-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">Symbol</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-muted/20 border border-border rounded px-7 py-1.5 text-xs focus:outline-none focus:border-primary w-32"
              placeholder="e.g. RELIANCE"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-muted-foreground font-medium">Interval</label>
          <select 
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="bg-muted/20 border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
          >
            <option value="1">1 Min</option>
            <option value="5">5 Min</option>
            <option value="15">15 Min</option>
            <option value="60">1 Hour</option>
            <option value="D">Daily</option>
          </select>
        </div>

        <div className="flex-1" />

        <button 
          onClick={handleCalculate}
          disabled={isLoadingHistory || isCalculating}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          Run Analysis
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 glass-panel p-4 min-h-[450px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">{symbol} Technical Architecture</h3>
            </div>
            <div className="text-[10px] text-muted-foreground flex gap-4">
              {Object.keys(indicators?.results || {}).map(name => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" style={{ backgroundColor: name.includes('ema') ? 'hsl(234, 89%, 64%)' : 'hsl(160, 84%, 39%)' }} />
                  {name.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          <div className="h-[350px]">
            {isLoadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(234, 89%, 64%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(217, 33%, 17%)" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="hsl(215, 20%, 55%)" 
                    fontSize={10} 
                    tickLine={false} 
                    tickFormatter={(v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    stroke="hsl(215, 20%, 55%)" 
                    fontSize={10} 
                    tickLine={false} 
                    orientation="right"
                  />
                  <Tooltip 
                    contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(217, 33%, 17%)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="close" stroke="hsl(234, 89%, 64%)" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} name="Price" />
                  
                  {indicators?.results && Object.keys(indicators.results).map((name, i) => (
                    <Line 
                      key={name}
                      type="monotone" 
                      dataKey={name} 
                      stroke={i === 0 ? "hsl(160, 84%, 39%)" : "hsl(38, 92%, 50%)"} 
                      dot={false}
                      strokeWidth={1.5}
                      name={name.toUpperCase()}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Search className="w-8 h-8 opacity-20" />
                <span className="text-xs">Enter a symbol and run analysis to see technicals</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">Active Indicators</span>
          </div>
          
          <div className="space-y-3">
            {selectedIndicators.map((ind, i) => (
              <div key={i} className="bg-muted/20 rounded p-2 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-primary">{ind.name}</span>
                  <button className="text-muted-foreground hover:text-neon-red px-1">×</button>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Params: {ind.params.join(', ')}
                </div>
              </div>
            ))}
            
            <button className="w-full py-2 border border-dashed border-border rounded text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-all">
              + Add Indicator
            </button>
          </div>

          <div className="mt-auto pt-4 border-t border-border">
            <div className="bg-primary/5 rounded p-3">
              <h4 className="text-[10px] font-bold uppercase text-primary mb-1">Architecture Insight</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                OpenAlgo's Numba-optimized indicators are processed on the backend with O(n) complexity, ensuring zero lag even with 10k+ data points.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
