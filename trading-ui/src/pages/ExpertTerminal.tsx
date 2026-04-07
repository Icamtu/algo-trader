import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Command, Shield, BarChart3, Radio, 
  Activity, Target, Crosshair, TrendingUp, 
  TrendingDown, Layers, Terminal, AlertCircle,
  Sparkles, Bot, Fingerprint, RefreshCw, Cpu
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { CommandBar } from "@/components/terminal/CommandBar";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface OptionStrike {
    strike: number;
    ce: { ltp: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; };
    pe: { ltp: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; };
    is_atm: boolean;
}

export default function ExpertTerminal() {
  const { toast } = useToast();
  const [optionChain, setOptionChain] = useState<OptionStrike[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(22450.0);
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState("2024-03-28");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchOptionChain();
    const interval = setInterval(fetchOptionChain, 15000);
    return () => clearInterval(interval);
  }, [symbol, expiry]);

  const fetchOptionChain = async () => {
    setIsLoading(true);
    try {
      const data = await algoApi.getOptionChain(symbol, expiry);
      setOptionChain(data.matrix);
      setUnderlyingPrice(data.underlying_price);
    } catch (e) {
      console.error("Chain fetch failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground selection:bg-primary/30 font-sans">
      <GlobalHeader />
      <MarketNavbar activeTab="/terminal" />

      <div className="flex-1 overflow-hidden p-6 relative flex flex-col gap-6 bg-dots-grid">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
        
        {/* Command Surface */}
        <div className="relative z-[60] py-2">
            <CommandBar onCommandExecuted={() => fetchOptionChain()} />
        </div>

        {/* Dynamic Matrix View */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
            
            {/* Left Wing: Option Chain */}
            <div className="flex-1 flex flex-col glass-panel-elevated rounded-3xl border border-border/40 overflow-hidden relative group">
                <div className="px-6 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">Option Matrix Registry</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground mr-2">{symbol} : ₹{underlyingPrice.toFixed(2)}</span>
                        <div className="w-px h-3 bg-border" />
                        <span className="text-[10px] font-mono font-bold text-foreground italic">{expiry}</span>
                        <button onClick={() => fetchOptionChain()} className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${isLoading ? "animate-spin" : ""}`}>
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-[10px] uppercase font-bold border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-xl z-20 shadow-sm">
                            <tr className="border-b border-border/50">
                                <th className="p-3 text-neon-emerald bg-neon-emerald/5 border-r border-border/30">Calls (CE)</th>
                                <th colSpan={6} className="bg-neon-emerald/5 border-r border-border/30" />
                                <th className="p-3 text-foreground bg-muted border-r border-border/30">Strike</th>
                                <th className="p-3 text-neon-red bg-neon-red/5 border-r border-border/30">Puts (PE)</th>
                                <th colSpan={6} className="bg-neon-red/5" />
                            </tr>
                            <tr className="bg-muted/40 border-b border-border/50 text-[8px] tracking-widest text-muted-foreground">
                                <th className="p-2 border-r border-border/30">Delta</th>
                                <th className="p-2 border-r border-border/30">Theta</th>
                                <th className="p-2 border-r border-border/30">IV</th>
                                <th className="p-2 border-r border-border/30">LTP</th>
                                <th className="p-3 bg-background/50 text-foreground border-r border-border/30">-</th>
                                <th className="p-2 border-r border-border/30">LTP</th>
                                <th className="p-2 border-r border-border/30">IV</th>
                                <th className="p-2 border-r border-border/30">Theta</th>
                                <th className="p-2">Delta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {optionChain.map((row) => (
                                <tr key={row.strike} className={`hover:bg-white/5 transition-colors group ${row.is_atm ? "bg-primary/5" : ""}`}>
                                    <td className="p-2 text-center text-neon-emerald border-r border-border/20">{row.ce.delta.toFixed(2)}</td>
                                    <td className="p-2 text-center text-muted-foreground border-r border-border/20">{row.ce.theta.toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground border-r border-border/20">{(row.ce.iv * 100).toFixed(1)}%</td>
                                    <td className="p-3 text-center text-foreground font-black border-r border-border/20 shadow-sm">{row.ce.ltp || (row.ce.delta * 100).toFixed(1)}</td>
                                    <td className="p-3 text-center bg-muted/40 font-black text-xs border-r border-border/20 relative group-hover:bg-primary/20 transition-all">
                                        {row.strike}
                                    </td>
                                    <td className="p-3 text-center text-foreground font-black border-r border-border/20 shadow-sm">{row.pe.ltp || (Math.abs(row.pe.delta) * 100).toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground border-r border-border/20">{(row.pe.iv * 100).toFixed(1)}%</td>
                                    <td className="p-2 text-center text-muted-foreground border-r border-border/20">{row.pe.theta.toFixed(1)}</td>
                                    <td className="p-2 text-center text-neon-red">{row.pe.delta.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Wing: Analytics & Radar */}
            <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 relative z-10">
                
                {/* Integration Radar */}
                <div className="glass-panel-elevated p-6 rounded-3xl border border-border/40 bg-gradient-to-br from-primary/5 to-transparent flex flex-col justify-between overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5 translate-x-1/2 -translate-y-1/2 scale-150 rotate-12">
                        <Radio className="w-32 h-32 text-primary" />
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-3.5 h-3.5 text-primary" />
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] italic">Market Breath Radar</h3>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-60">Macro Sentiment Dashboard</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-center flex flex-col items-center">
                                <span className="text-[8px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Global PCR</span>
                                <span className="text-lg font-black text-neon-emerald tracking-tighter">1.24</span>
                                <span className="text-[8px] text-neon-emerald uppercase font-bold tracking-tighter mt-1">Bullish Conviction</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-center flex flex-col items-center">
                                <span className="text-[8px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Market VIX</span>
                                <span className="text-lg font-black text-warning tracking-tighter">14.60</span>
                                <span className="text-[8px] text-warning uppercase font-bold tracking-tighter mt-1">Stable Volatility</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <RadarLine label="Indices Breadth" value={82} color="bg-neon-green" />
                            <RadarLine label="Smart Money Flow" value={65} color="bg-primary" />
                            <RadarLine label="Put Volume Exposure" value={34} color="bg-neon-red" />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
                        <button className="glow-button w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5" />
                            Analyze All Expiries
                        </button>
                        <p className="text-[8px] text-muted-foreground text-center font-bold tracking-widest uppercase opacity-60">Intelligence Source: OpenAlgo V1.0</p>
                    </div>
                </div>

                {/* Kill Switch Panel */}
                <div className="glass-panel-elevated p-6 rounded-3xl border border-destructive/20 bg-destructive/5 relative overflow-hidden group">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-destructive">Emergency Kill Switch</span>
                    </div>
                    
                    <SlideToConfirm 
                        label="SLIDE TO SQUARE-OFF ALL"
                        onConfirm={async () => {
                            try {
                                await algoApi.triggerPanic();
                                toast({ title: "PANIC EXECUTED", description: "All positions closed.", variant: "destructive" });
                            } catch (e) {
                                toast({ title: "Panic Failed", description: String(e), variant: "destructive" });
                            }
                        }}
                    />
                    
                    <p className="text-[9px] text-destructive/60 font-bold tracking-widest uppercase mt-4 text-center">Protocol V1.0 - 256-bit isolation</p>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
}

function RadarLine({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{label}</span>
                <span className="text-[10px] font-mono font-bold">{value}%</span>
            </div>
            <div className="h-1 w-full bg-muted-foreground/10 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full ${color}`} 
                />
            </div>
        </div>
    )
}
