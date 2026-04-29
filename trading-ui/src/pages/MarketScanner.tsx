import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, RefreshCw, Brain, PlayCircle, Settings2,
  Terminal, Fingerprint, Radar, Target, Cpu, Activity
} from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useAether } from "@/contexts/AetherContext";
import { cn } from "@/lib/utils";

type IndexType = "NIFTY_50" | "NIFTY_BANK" | "NIFTY_AUTO" | "NIFTY_PHARMA" | "NIFTY_REALTY";

export default function MarketScanner() {
  const { toast } = useToast();
  const { setSelectedSymbol } = useAether();
  const [selectedIndices, setSelectedIndices] = useState<IndexType[]>(["NIFTY_50"]);
  const [results, setResults] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmModel, setLlmModel] = useState("mistral");
  const [agentEnabled, setAgentEnabled] = useState(true);

  const DISPLAY_LIMIT = 50;
  const displayedResults = showAll ? results : results.slice(0, DISPLAY_LIMIT);

  const loadSettings = async () => {
    try {
      const settings = await algoApi.getSystemSettings();
      setLlmModel(settings.llm_model || "mistral");
      setAgentEnabled(String(settings.agent_enabled) === 'True' || settings.agent_enabled === true);
    } catch (e) {}
  };

  useEffect(() => {
    loadSettings();
    const interval = setInterval(loadSettings, 30000);
    return () => clearInterval(interval);
  }, []);

  const runDiscovery = async () => {
    setIsScanning(true);
    setShowAll(false);
    try {
      const allResults = await Promise.all(
        selectedIndices.map(idx => algoApi.runScanner(idx).then(res => res.results || []))
      );
      setResults(allResults.flat());
      toast({ title: "SCAN_COMPLETE", description: "RADAR_MATCH_STORED" });
    } catch (e) {
      toast({ variant: "destructive", title: "SCAN_ERROR", description: "FAILED_TO_INIT_RADAR" });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-3xl font-black uppercase tracking-[0.1em] text-foreground">Discovery_Array</h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.3em]">
          Sectoral_Radar // Quantum_Pattern_Matching_Active
        </p>
      </div>

      {/* Control Strip */}
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-8 flex flex-col gap-6">
          <div className="p-6 bg-card/5 border border-border/50 relative overflow-hidden group">
            <div className="scanline opacity-[0.02]" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="bg-primary/10 p-4 border border-primary/20">
                  <Radar className="w-8 h-8 text-primary" />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Neural_Scanner_V4</h3>
                   <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/10 border border-secondary/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                         <span className="text-[8px] font-mono font-black text-secondary uppercase">Relay_Active</span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/40">Mistral_7B_Instruct</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                 <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={cn(
                    "px-4 py-2 border text-[10px] font-black uppercase tracking-widest transition-all",
                    isSettingsOpen ? "bg-primary text-black border-primary" : "border-border text-muted-foreground/40 hover:text-foreground"
                  )}
                 >
                   Configuration
                 </button>
                 <button
                  onClick={runDiscovery}
                  disabled={isScanning}
                  className="px-6 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-30 flex items-center gap-2"
                 >
                   {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                   Execute_Pulse
                 </button>
              </div>
            </div>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-6 pt-6 border-t border-border/20"
                >
                  <div className="grid grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Discovery_Indices</label>
                        <div className="flex flex-wrap gap-2">
                           {["NIFTY_50", "NIFTY_BANK", "NIFTY_AUTO", "NIFTY_PHARMA"].map(idx => (
                             <button
                              key={idx}
                              onClick={() => {
                                setSelectedIndices(prev =>
                                  prev.includes(idx as IndexType)
                                    ? prev.filter(p => p !== idx)
                                    : [...prev, idx as IndexType]
                                )
                              }}
                              className={cn(
                                "px-3 py-1 border text-[9px] font-mono font-black transition-all",
                                selectedIndices.includes(idx as IndexType) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground/30"
                              )}
                             >
                               {idx}
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Engine_Model</label>
                        <div className="bg-background border border-border p-2 flex items-center justify-between">
                           <span className="text-[10px] font-mono font-black uppercase text-foreground">{llmModel}</span>
                           <Cpu className="w-3 h-3 text-muted-foreground/20" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Probability_Threshold</label>
                        <div className="bg-background border border-border p-2">
                           <div className="h-1 bg-muted relative">
                              <div className="absolute top-0 left-0 w-3/4 h-full bg-primary" />
                           </div>
                           <div className="flex justify-between mt-1 text-[8px] font-mono font-black text-muted-foreground/40">
                              <span>0%</span>
                              <span className="text-primary">75%</span>
                              <span>100%</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Results Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Detected_Signals: {results.length}</span>
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-secondary" />
                     <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">High_Prob</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-primary" />
                     <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">Standard</span>
                  </div>
               </div>
            </div>

            {results.length > 0 ? (
               <div className="grid grid-cols-1 gap-3">
                  {displayedResults.map((sym, i) => (
                    <motion.div
                      key={sym.symbol + i}
                      onClick={() => setSelectedSymbol(sym.symbol)}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="group p-4 bg-card/2 border border-border/30 hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-6 divide-x divide-border/20">
                           <div className="flex flex-col min-w-[120px]">
                              <span className="text-lg font-black tracking-tight group-hover:text-primary transition-colors uppercase">{sym.symbol}</span>
                              <span className="text-[9px] font-mono text-muted-foreground/40">LTP: ₹{sym.price}</span>
                           </div>
                           <div className="px-6 text-center">
                              <IndustrialValue value={sym.score} suffix="%" className="text-2xl font-black font-display" />
                              <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase">Match</div>
                           </div>
                           <div className="px-6 text-center">
                              <div className="text-lg font-mono font-bold text-foreground/80">{sym.rsi}</div>
                              <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase">RSI_14</div>
                           </div>
                        </div>

                        <div className="flex-1 px-8">
                           <div className="p-3 bg-muted/5 border-l-2 border-primary/20 italic">
                              <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed uppercase tracking-tight">
                                "{sym.ai_reasoning || 'No diagnostics available for this signal cycle.'}"
                              </p>
                           </div>
                        </div>

                        <button className="px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-black transition-all">
                           Trade_Signal
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {!showAll && results.length > DISPLAY_LIMIT && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                        Showing {DISPLAY_LIMIT} of {results.length} signals
                      </span>
                      <button
                        onClick={() => setShowAll(true)}
                        className="px-6 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                      >
                        LOAD_ALL_{results.length - DISPLAY_LIMIT}_MORE
                      </button>
                    </div>
                  )}
               </div>
            ) : (
               <div className="py-20 flex flex-col items-center justify-center border border-border/20 bg-card/2 border-dashed">
                  <div className="w-16 h-16 bg-muted/5 border border-border/20 flex items-center justify-center opacity-20">
                     <Target className="w-8 h-8" />
                  </div>
                  <span className="mt-4 text-[10px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.4em]">Awaiting_Scan_Sequence</span>
               </div>
            )}
          </div>
        </div>

        <div className="col-span-4 space-y-6">
           {/* Discovery Intelligence Panel */}
           <div className="p-6 bg-card/5 border border-border/50">
              <div className="flex items-center gap-3 mb-6">
                 <Activity className="w-4 h-4 text-primary" />
                 <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Scan_Telemetry</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-muted-foreground/40 uppercase">Total_Scan_Time</span>
                    <span className="font-black">1.2s</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-muted-foreground/40 uppercase">Agents_Deployed</span>
                    <span className="font-black">4</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-muted-foreground/40 uppercase">Logic_Registry</span>
                    <span className="font-black text-secondary uppercase">Synced</span>
                 </div>
                 <div className="h-[1px] bg-border/20 my-2" />
                 <div className="p-3 bg-muted/10 border border-border/30">
                    <div className="text-[8px] font-black uppercase text-primary/60 mb-1">Observation_Log</div>
                    <p className="text-[9px] font-mono text-muted-foreground/40 leading-tight uppercase">
                       Sectoral imbalance detected in NIFTY_AUTO. Bullish divergence forming on 3 major counters.
                    </p>
                 </div>
              </div>
           </div>

           <div className="p-6 bg-primary/5 border border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 -mr-8 -mt-8 rotate-45" />
              <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Agent_Alpha</span>
                 </div>
                 <p className="text-[9px] font-mono text-muted-foreground/60 uppercase leading-snug">
                    Real-time liquidity analysis is being computed by decentralized nodes. High fidelity patterns will be piped directly.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
