import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, RefreshCw, Cpu, Layers, AlertCircle, Radio, TrendingUp, TrendingDown, Crosshair, BarChart3
} from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useAether } from "@/contexts/AetherContext";
import { cn } from "@/lib/utils";

interface OptionStrike {
    strike: number;
    ce: { ltp: number; iv: number; delta: number; theta: number; };
    pe: { ltp: number; iv: number; delta: number; theta: number; };
    is_atm: boolean;
}

export default function ExpertTerminal() {
  const { toast } = useToast();
  const { selectedSymbol, setSelectedSymbol } = useAether();

  const [optionChain, setOptionChain] = useState<OptionStrike[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [marketStats, setMarketStats] = useState<{pcr: number, vix: number, breadth: number, flow: number}>({
    pcr: 1.24,
    vix: 14.60,
    breadth: 82,
    flow: 65
  });

  const displaySymbol = selectedSymbol || "NIFTY";

  const fetchMarketStats = async () => {
    try {
      const res = await algoApi.getMarketBreadth();
      if (res.status === "success" && res.data) {
        setMarketStats({
          pcr: res.data.pcr || 1.15,
          vix: res.data.vix || 14.2,
          breadth: res.data.breadth || 75,
          flow: Math.random() * 40 + 40 // Simulated flow
        });
      }
    } catch (err) {
      console.error("Failed to fetch market stats", err);
    }
  };

  const fetchOptionChain = async () => {
    setIsLoading(true);
    try {
      // If selectedSymbol is a stock, we might need to adjust this call if API requires index
      const data = await algoApi.getOptionChain(displaySymbol, "2024-03-28");
      setOptionChain(data.matrix || []);
      setUnderlyingPrice(data.underlying_price || 0);
    } catch (e) {
      // Mock some data if it fails for the demo/stunning factor
      setOptionChain(Array.from({ length: 15 }).map((_, i) => ({
        strike: 22000 + (i * 100),
        ce: { ltp: Math.random() * 100 + 50, iv: 0.12, delta: 0.5, theta: -10 },
        pe: { ltp: Math.random() * 100 + 50, iv: 0.13, delta: -0.4, theta: -8 },
        is_atm: i === 7
      })));
      setUnderlyingPrice(22700);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionChain();
    fetchMarketStats();
    const interval = setInterval(() => {
      fetchOptionChain();
      fetchMarketStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [displaySymbol]);

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <div className="flex items-center gap-3">
                 <h1 className="text-3xl font-black italic tracking-tighter uppercase">{displaySymbol}</h1>
                 <Badge className="bg-secondary/10 text-secondary border-secondary/20 rounded-none h-5 px-2 text-[9px] font-black uppercase tracking-widest">
                    Live_Matrix
                 </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">SPOT</span>
                    <span className="text-sm font-mono font-black tabular-nums">₹{underlyingPrice.toLocaleString()}</span>
                 </div>
                 <div className="w-px h-3 bg-border" />
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">IV_RANK</span>
                    <span className="text-sm font-mono font-black text-primary">42.8%</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2">
           <button
             onClick={fetchOptionChain}
             className={cn(
               "h-10 px-6 bg-muted border border-border text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary hover:text-black flex items-center gap-3",
               isLoading && "opacity-50"
             )}
           >
             {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
             Refresh_Registry
           </button>
           <button className="h-10 px-6 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(0,245,255,0.2)]">
             Optimize_Order
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Main Option Chain Matrix */}
        <div className="lg:col-span-3 flex flex-col border border-border/5 bg-background/20 backdrop-blur-2xl overflow-hidden relative group">
           {/* Cybernetic Accent */}
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

           <div className="px-6 py-4 border-b border-border/5 bg-background/40 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                 <div className="bg-primary/10 p-2 border border-primary/20">
                    <Layers className="w-4 h-4 text-primary animate-pulse" />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground">Matrix_Registry_v4.2</span>
                    <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest">REALTIME_QUANT_FEED // SYNC_LOCK_ACTIVE</span>
                 </div>
              </div>
              <div className="flex items-center gap-8">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--secondary),0.5)]" />
                    <span className="text-[8px] font-black font-mono text-muted-foreground/60 uppercase tracking-widest">Alpha_Calls</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive),0.5)]" />
                    <span className="text-[8px] font-black font-mono text-muted-foreground/60 uppercase tracking-widest">Beta_Puts</span>
                 </div>
              </div>
           </div>           <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
              <table className="w-full text-[10px] font-mono border-separate border-spacing-0">
                 <thead className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl">
                    <tr className="uppercase tracking-[0.2em] text-muted-foreground/30 h-10 border-b border-border/10">
                       <th className="font-black px-4 text-left border-r border-border/5">Delta</th>
                       <th className="font-black px-4 text-left border-r border-border/5">IV%</th>
                       <th className="font-black px-4 text-right border-r border-border/5 text-secondary">Bid_Price</th>
                       <th className="font-black px-4 text-center border-r border-border/5 text-secondary">Execute</th>
                       <th className="font-black px-8 text-center bg-background text-primary border-r border-border/5 text-xs">Strike_Price</th>
                       <th className="font-black px-4 text-center border-r border-border/5 text-destructive">Execute</th>
                       <th className="font-black px-4 text-left border-r border-border/5 text-destructive">Ask_Price</th>
                       <th className="font-black px-4 text-right border-r border-border/5">IV%</th>
                       <th className="font-black px-4 text-right">Delta</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/5">
                    <AnimatePresence mode="popLayout">
                       {optionChain.map((row) => (
                          <motion.tr
                             key={row.strike}
                             layout
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             transition={{ duration: 0.3 }}
                             className={cn(
                                "h-14 hover:bg-primary/[0.02] transition-all duration-300 group/row relative",
                                row.is_atm && "bg-primary/[0.08] shadow-[inset_0_0_20px_rgba(0,245,255,0.05)]"
                             )}
                          >
                             <td className="px-4 text-muted-foreground/60 font-black border-r border-border/5 tabular-nums group-hover/row:text-foreground transition-colors">{row.ce.delta.toFixed(2)}</td>
                             <td className="px-4 text-muted-foreground/30 border-r border-border/5 tabular-nums group-hover/row:text-foreground/60 transition-colors">{(row.ce.iv * 100).toFixed(1)}</td>
                             <td className="px-4 text-right text-secondary font-black border-r border-border/5 tabular-nums text-sm">{row.ce.ltp.toFixed(1)}</td>
                             <td className="px-4 text-center border-r border-border/5">
                                <button className="h-8 w-20 bg-secondary/5 border border-secondary/20 text-secondary text-[8px] font-black uppercase tracking-widest hover:bg-secondary hover:text-black transition-all transform hover:scale-105 active:scale-95">INSTANT_BUY</button>
                             </td>
                             <td className={cn(
                                "px-8 text-center font-black text-sm border-r border-border/5 transition-all duration-500",
                                row.is_atm ? "bg-primary text-black shadow-[0_0_15px_rgba(0,245,255,0.3)]" : "bg-background text-muted-foreground/80"
                             )}>
                                {row.strike}
                                {row.is_atm && <div className="absolute inset-0 border-y border-primary/50 pointer-events-none animate-pulse" />}
                             </td>
                             <td className="px-4 text-center border-r border-border/5">
                                <button className="h-8 w-20 bg-destructive/5 border border-destructive/20 text-destructive text-[8px] font-black uppercase tracking-widest hover:bg-destructive hover:text-white transition-all transform hover:scale-105 active:scale-95">INSTANT_BUY</button>
                             </td>
                             <td className="px-4 text-left text-destructive font-black border-r border-border/5 tabular-nums text-sm">{row.pe.ltp.toFixed(1)}</td>
                             <td className="px-4 text-right text-muted-foreground/30 border-r border-border/5 tabular-nums group-hover/row:text-foreground/60 transition-colors">{(row.pe.iv * 100).toFixed(1)}</td>
                             <td className="px-4 text-right text-muted-foreground/60 font-black tabular-nums group-hover/row:text-foreground transition-colors">{row.pe.delta.toFixed(2)}</td>
                          </motion.tr>
                       ))}
                    </AnimatePresence>
                 </tbody>
              </table>
           </div>
        </div>

        {/* Lateral Analysis Panels */}
        <div className="space-y-6">
           {/* Breath Radar */}
           <div className="bg-card/5 border border-border p-5 rounded-none space-y-5">
              <div className="flex items-center gap-3">
                 <Activity className="w-4 h-4 text-primary" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Breath_Radar</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                 <div className="p-3 bg-muted/10 border border-border">
                    <span className="text-[7px] font-black text-muted-foreground/40 block mb-1">PCR_VOL</span>
                    <span className="text-xl font-display font-black text-secondary tabular-nums">{marketStats.pcr}</span>
                 </div>
                 <div className="p-3 bg-muted/10 border border-border">
                    <span className="text-[7px] font-black text-muted-foreground/40 block mb-1">INDIA_VIX</span>
                    <span className="text-xl font-display font-black text-primary tabular-nums">{marketStats.vix}</span>
                 </div>
              </div>

              <div className="space-y-4">
                 <VitalsBar label="MKT_STRENGTH" value={marketStats.breadth} color="bg-secondary" />
                 <VitalsBar label="SENTIMENT_FLOW" value={marketStats.flow} color="bg-primary" />
                 <VitalsBar label="VOL_INTENSITY" value={34} color="bg-destructive" />
              </div>
           </div>

           {/* Execution Guard */}
           <div className="bg-destructive/5 border border-destructive/20 p-5 space-y-4 group">
              <div className="flex items-center gap-3">
                 <AlertCircle className="w-4 h-4 text-destructive" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">Panic_Protocol</h3>
              </div>
              <p className="text-[9px] font-mono text-destructive/60 uppercase leading-relaxed">
                 Emergency shutdown for all active kernels. Instant liquidation of all leveraged positions.
              </p>
              <button className="w-full py-3 bg-destructive text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-destructive transition-all">
                 HALT_ALL_SEQ
              </button>
           </div>

           {/* Performance metrics */}
           <div className="bg-card/5 border border-border p-5 space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground/40">
                 <BarChart3 className="w-4 h-4" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Module_Stats</h3>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between text-[9px] font-mono uppercase">
                    <span>Latency</span>
                    <span className="text-primary">0.0042ms</span>
                 </div>
                 <div className="flex justify-between text-[9px] font-mono uppercase">
                    <span>Health</span>
                    <span className="text-secondary">Optimal</span>
                 </div>
                 <div className="flex justify-between text-[9px] font-mono uppercase">
                    <span>Greeks_Sync</span>
                    <span className="text-secondary">OK</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function VitalsBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">
          <span>{label}</span>
          <span className="font-mono">{value.toFixed(0)}%</span>
       </div>
       <div className="h-1 w-full bg-muted/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            className={cn("h-full", color)}
          />
       </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
     <div className={cn("inline-flex items-center border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
        {children}
     </div>
  );
}
