import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Zap, 
  Brain, 
  TrendingUp, 
  Activity, 
  ShieldCheck,
  Cpu,
  Globe,
  LineChart
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

interface Vector {
  label: string;
  value: number;
}

interface AnalysisData {
  logic_core: string;
  regime: string;
  volatility: string;
  vectors: Vector[];
  conviction: number;
  symbol: string;
}

interface AetherAIReasoningPanelProps {
  data?: AnalysisData | AnalysisData[];
  isLoading?: boolean;
}

export function AetherAIReasoningPanel({ data, isLoading }: AetherAIReasoningPanelProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  
  const results = React.useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }, [data]);

  // Reset index if results change significantly
  React.useEffect(() => {
    if (activeIndex >= results.length) {
        setActiveIndex(0);
    }
  }, [results.length]);

  // Fallback defaults for when no data is provided or loading
  const currentData = results[activeIndex] || {
    logic_core: "Aether_Core is in standby mode. Initiate NEURAL_SCAN to populate reasoning vectors.",
    regime: "STANDBY",
    volatility: "IDLE",
    vectors: [
      { label: "Order Imbalance", value: 0 },
      { label: "Dynamic GEX Profile", value: 0 },
      { label: "Sentiment Delta", value: 0 }
    ],
    conviction: 0,
    symbol: "NONE"
  };

  return (
    <Card className="bg-slate-950/40 border-primary/20 backdrop-blur-md h-full flex flex-col overflow-hidden relative group">
      {/* Background Animated Glow */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      <CardHeader className="pb-3 border-b border-white/5 bg-primary/5 flex flex-row items-center justify-between space-y-0 relative z-10">
        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Brain className={cn("w-4 h-4 text-primary", isLoading && "animate-pulse")} />
          AetherAI Reasoning
        </CardTitle>
        <div className="flex items-center gap-3">
            {isLoading && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/20 rounded-full">
                    <div className="w-1 h-1 bg-primary animate-ping rounded-full" />
                    <span className="text-[8px] font-mono font-bold text-primary animate-pulse italic">SCANNING...</span>
                </div>
            )}
            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">
              GEN-4 ARCH
            </Badge>
        </div>
      </CardHeader>

      {/* Multi-result Tab Bar */}
      {results.length > 1 && (
          <div className="flex bg-black/40 border-b border-white/5 p-1 gap-1 overflow-x-auto custom-scrollbar no-scrollbar">
              {results.map((res, idx) => (
                  <button
                    key={res.symbol + idx}
                    onClick={() => setActiveIndex(idx)}
                    className={cn(
                        "px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded",
                        activeIndex === idx 
                          ? "bg-primary text-black" 
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    {res.symbol}
                  </button>
              ))}
          </div>
      )}
      
      <CardContent className="flex-1 p-0 flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentData.symbol + currentData.regime}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className={cn("flex flex-col h-full transition-all duration-500", isLoading && "opacity-50 blur-[1px]")}
          >
            {/* Core Logic Section */}
            <div className="p-4 border-b border-white/5 space-y-3 bg-white/[0.02] relative overflow-hidden">
              {isLoading && (
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent skew-x-12"
                />
              )}
              <div className="flex items-center gap-2">
                <Cpu className={cn("w-3.5 h-3.5 text-primary/60", isLoading && "animate-spin")} />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Active Logic Core</h4>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3 py-1">
                "{isLoading ? "Intercepting neural signals and reconstructing decision tree..." : currentData.logic_core}"
              </p>
            </div>

            {/* Market Indicators Grid */}
            <div className="grid grid-cols-2 p-px bg-white/5">
              <div className="bg-slate-950/20 p-4 space-y-2 border-r border-b border-white/5">
                 <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[9px] uppercase font-black tracking-tighter opacity-70">Market Regime</span>
                 </div>
                 <div className="text-[11px] font-bold text-blue-400 font-mono tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                    {isLoading ? "CALCULATING..." : currentData.regime}
                 </div>
              </div>
              <div className="bg-slate-950/20 p-4 space-y-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[9px] uppercase font-black tracking-tighter opacity-70">Volatility Fix</span>
                 </div>
                 <div className="text-[11px] font-bold text-orange-400 font-mono tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                    {isLoading ? "PROBING..." : currentData.volatility}
                 </div>
              </div>
            </div>

            {/* Decision Breakdown */}
            <div className="flex-1 p-4 space-y-4 overflow-auto custom-scrollbar relative">
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Decision Vectors</span>
                    <Badge variant="outline" className="text-[8px] h-4 border-primary/10 bg-primary/5">WEIGHTED</Badge>
                 </div>
                 
                 <div className="space-y-4">
                    {currentData.vectors.map((vec, idx) => (
                        <VectorItem 
                          key={vec.label} 
                          label={vec.label} 
                          value={isLoading ? 0 : vec.value} 
                          color={idx === 0 ? "bg-primary" : idx === 1 ? "bg-primary/60" : "bg-primary/30"} 
                        />
                    ))}
                 </div>
              </div>

              <div className={cn("p-3 rounded-lg border transition-colors", isLoading ? "bg-primary/5 border-primary/5 shadow-inner" : "bg-primary/5 border-primary/10")}>
                <div className="flex items-center gap-2">
                   <ShieldCheck className={cn("w-3.5 h-3.5 text-primary", isLoading && "animate-pulse")} />
                   <span className="text-[9px] uppercase font-bold tracking-widest text-primary">Safety Protocol Verify</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {isLoading ? 
                    "Verifying kernel integrity and liquidity constraints for incoming telemetry stream..." : 
                    `Risk Engine has validated current liquidity buffer. Conviction threshold: ${(currentData.conviction * 100).toFixed(0)}%`
                  }
                </p>
              </div>
            </div>

            <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                 <div className={cn(
                   "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", 
                   isLoading ? "bg-primary animate-ping" : 
                   currentData.symbol !== "NONE" ? "bg-green-500 shadow-green-500/50" : "bg-yellow-500/50 shadow-yellow-500/20"
                 )} />
                 <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                    Neural Link: {isLoading ? "ESTABLISHING..." : currentData.symbol !== "NONE" ? "ACTIVE" : "STANDBY"}
                 </span>
              </div>
              <LineChart className={cn("w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors", isLoading && "animate-bounce text-primary")} />
            </div>
          </motion.div>

        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function VectorItem({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-0.5 text-[9px]">
        <span className="font-bold text-white/50 uppercase tracking-wider">{label}</span>
        <span className="font-mono text-primary font-black">{value}%</span>
      </div>
      <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
        <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 1.2, ease: "circOut" }}
            className={cn("h-full relative", color)} 
        >
            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-r from-transparent to-white/20" />
        </motion.div>
      </div>
    </div>
  );
}
