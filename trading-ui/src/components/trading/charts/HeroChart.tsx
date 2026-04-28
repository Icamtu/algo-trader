import React from 'react';
import { useChartData } from '@/hooks/useChartData';
import { Area, AreaChart, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IndustrialValue } from '@/components/trading/IndustrialValue';

interface HeroChartProps {
  symbol: string;
  change: number;
  ltp: number;
}

export function HeroChart({ symbol, change, ltp }: HeroChartProps) {
  const { data, isLoading } = useChartData(symbol, '15'); // 15 min or 1D
  const isPositive = change >= 0;

  // Choose colors based on momentum
  const color = isPositive ? '#26a69a' : '#ef5350';
  const colorName = isPositive ? 'emerald' : 'rose';

  if (isLoading) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center border border-white/5 bg-white/[0.02]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Ensure data exists
  const chartData = data && data.length > 0 ? data : [];

  return (
    <div className="w-full relative border border-white/5 bg-black/40 backdrop-blur-md p-6 overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 opacity-5 blur-3xl pointer-events-none" style={{ backgroundColor: color }} />

      <div className="flex flex-col mb-6 relative z-10">
        <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">{symbol}</h2>
        <div className="flex items-center gap-3 mt-1">
          <IndustrialValue value={ltp} prefix="₹" className="text-4xl font-black font-mono tabular-nums text-foreground tracking-tighter" />
          <div className="flex flex-col">
             <span className={cn("text-lg font-bold tabular-nums font-mono", isPositive ? "text-emerald-500" : "text-rose-500")}>
               {isPositive ? '+' : ''}{change.toFixed(2)}%
             </span>
             <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">1D_Trend</span>
          </div>
        </div>
      </div>

      <div className="h-[250px] min-h-[250px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-black/80 border border-white/10 p-2 backdrop-blur-md shadow-xl">
                      <p className="text-[10px] font-mono font-black text-muted-foreground mb-1 uppercase tracking-widest">
                        {new Date((payload[0].payload.time) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm font-mono font-bold text-foreground">
                        ₹{val.toFixed(2)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <YAxis
              domain={['auto', 'auto']}
              hide
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${symbol})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
