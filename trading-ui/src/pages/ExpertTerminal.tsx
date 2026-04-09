import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Activity, RefreshCw, Cpu, Layers, AlertCircle, Radio, BarChart3
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { CommandBar } from "@/components/terminal/CommandBar";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

interface OptionStrike {
    strike: number;
    ce: { ltp: number; iv: number; delta: number; theta: number; };
    pe: { ltp: number; iv: number; delta: number; theta: number; };
    is_atm: boolean;
}

export default function ExpertTerminal() {
  const { toast } = useToast();
  const [optionChain, setOptionChain] = useState<OptionStrike[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(22450.0);
  const [symbol] = useState("NIFTY");
  const [expiry] = useState("2024-03-28");
  const [isLoading, setIsLoading] = useState(false);

  const fetchOptionChain = async () => {
    setIsLoading(true);
    try {
      const data = await algoApi.getOptionChain(symbol, expiry);
      setOptionChain(data.matrix || []);
      setUnderlyingPrice(data.underlying_price || 22450);
    } catch (e) {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionChain();
    const interval = setInterval(fetchOptionChain, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/terminal" />

      <div className="flex-1 overflow-hidden p-4 relative flex flex-col gap-4 z-10">
        
        {/* Command Surface */}
        <div className="relative py-1 px-4 bg-card/5 border border-border/20">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-primary" />
            <CommandBar onCommandExecuted={fetchOptionChain} />
        </div>

        <div className="flex-1 overflow-hidden flex gap-4">
            {/* Matrix Registry */}
            <div className="flex-1 flex flex-col bg-card/5 border border-border/20 overflow-hidden relative">
                <div className="px-4 py-2 border-b border-border/20 bg-card/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-primary" />
                        <div>
                           <h2 className="text-sm font-black font-syne uppercase tracking-tight leading-none">MATRIX_REGISTRY</h2>
                           <p className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em]">Live_Options</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-2 py-1 bg-background border border-border/20">
                           <span className="text-[9px] font-mono font-black text-primary uppercase">{symbol}</span>
                           <IndustrialValue value={underlyingPrice} prefix="₹" className="text-[9px] font-mono font-black text-foreground" />
                        </div>
                        <button onClick={fetchOptionChain} className={`p-1 text-muted-foreground/20 hover:text-primary transition-all ${isLoading ? "animate-spin" : ""}`}>
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto no-scrollbar">
                    <table className="w-full text-[9px] font-mono font-black border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-background z-20">
                            <tr className="bg-card/20 text-[7px] text-muted-foreground/20 uppercase tracking-widest">
                                <th className="p-2 border-r border-border/20">DELTA</th>
                                <th className="p-2 border-r border-border/20">THETA</th>
                                <th className="p-2 border-r border-border/20">IV%</th>
                                <th className="p-2 border-r border-border/20 text-secondary">CALLS</th>
                                <th className="p-2 bg-card/30 text-foreground border-r border-border/20">STRIKE</th>
                                <th className="p-2 border-r border-border/20 text-destructive">PUTS</th>
                                <th className="p-2 border-r border-border/20">IV%</th>
                                <th className="p-2 border-r border-border/20">THETA</th>
                                <th className="p-2">DELTA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {optionChain.map((row) => (
                                <tr key={row.strike} className={`group ${row.is_atm ? "bg-primary/[0.03]" : "hover:bg-card/10"}`}>
                                    <td className="p-2 text-center text-muted-foreground/40 border-r border-border/5">{row.ce.delta.toFixed(2)}</td>
                                    <td className="p-2 text-center text-muted-foreground/20 border-r border-border/5">{row.ce.theta.toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground/20 border-r border-border/5">{(row.ce.iv * 100).toFixed(1)}</td>
                                    <td className="p-2 text-center text-secondary border-r border-border/5 font-black">{row.ce.ltp.toFixed(1)}</td>
                                    <td className={`p-2 text-center font-black text-xs border-r border-border/20 ${row.is_atm ? "bg-primary text-black" : "bg-card/10 text-foreground/60"}`}>{row.strike}</td>
                                    <td className="p-2 text-center text-destructive border-r border-border/5 font-black">{row.pe.ltp.toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground/20 border-r border-border/5">{(row.pe.iv * 100).toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground/20 border-r border-border/5">{row.pe.theta.toFixed(1)}</td>
                                    <td className="p-2 text-center text-muted-foreground/40">{row.pe.delta.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Wing */}
            <div className="w-80 flex flex-col gap-4">
                <div className="p-4 border border-border/20 bg-card/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-black font-syne uppercase tracking-widest">BREATH_RADAR</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <div className="p-4 bg-background border border-border/10 text-center">
                            <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase block mb-1">PCR</span>
                            <IndustrialValue value={1.24} className="text-xl font-black font-syne text-secondary" />
                        </div>
                        <div className="p-4 bg-background border border-border/10 text-center">
                            <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase block mb-1">VIX</span>
                            <IndustrialValue value={14.60} className="text-xl font-black font-syne text-primary" />
                        </div>
                    </div>
                    <div className="space-y-4">
                         <RadarLine label="BREADTH" value={82} color="bg-secondary" />
                         <RadarLine label="FLOW" value={65} color="bg-primary" />
                    </div>
                    <button className="w-full mt-6 py-2 bg-foreground text-background font-mono font-black text-[9px] uppercase tracking-widest hover:bg-primary transition-all">ANALYZE_MATRIX</button>
                </div>

                <div className="p-4 border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-[9px] font-mono font-black text-destructive uppercase tracking-widest">PANIC_BYPASS</span>
                    </div>
                    <SlideToConfirm label="SLIDE_TO_KILL_ALL" onConfirm={async () => { await algoApi.triggerPanic(); toast({ title: "PURGE_COMPLETE" }); }} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function RadarLine({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div>
            <div className="flex justify-between text-[7px] font-mono font-black text-muted-foreground/20 uppercase mb-1">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <div className="h-0.5 w-full bg-border/20">
                <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full ${color}`} />
            </div>
        </div>
    )
}
