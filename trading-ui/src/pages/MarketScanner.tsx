import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, RefreshCw, Brain, PlayCircle, Settings2,
  Terminal, Fingerprint
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { algoApi } from "@/features/openalgo/api/client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

type IndexType = "NIFTY_50" | "NIFTY_BANK" | "NIFTY_AUTO" | "NIFTY_PHARMA" | "NIFTY_REALTY";

export default function MarketScanner() {
  const { toast } = useToast();
  const [selectedIndices, setSelectedIndices] = useState<IndexType[]>(["NIFTY_50"]);
  const [results, setResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  
  const [decisionMode, setDecisionMode] = useState("ai");
  const [llmModel, setLlmModel] = useState("mistral");
  const [logicProvider, setLogicProvider] = useState("ollama");
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [agentErrorReason, setAgentErrorReason] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadSettings = async () => {
    try {
      const settings = await algoApi.getSystemSettings();
      setDecisionMode(settings.decision_mode || "ai");
      setLlmModel(settings.llm_model || "mistral");
      setLogicProvider(settings.provider || "ollama");
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
    try {
      const allResults = await Promise.all(
        selectedIndices.map(idx => algoApi.runScanner(idx).then(res => res.results || []))
      );
      setResults(allResults.flat());
      toast({ title: "SCAN_COMPLETE", description: "RADAR_MATCH_STORED" });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/scanner" />

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/20 bg-background/50">
          
          {/* Neural Control Strip */}
           <div className="px-4 py-3 border-b border-border bg-card/5 relative z-20">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
                   <Brain className={cn("h-6 w-6", primaryColorClass)} />
                 </div>
                 <div>
                   <h1 className={cn("text-xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Neural_Discovery_Kernel</h1>
                   <div className="flex items-center gap-3 mt-0.5">
                     <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Radar_V4 // QUANT_SYNC</span>
                     <div className={cn("flex items-center gap-1.5 px-1.5 py-0.5 border bg-background/50", accentBorderClass)}>
                        <Fingerprint className={cn("w-2.5 h-2.5", agentEnabled ? "text-secondary" : "text-destructive")} />
                        <span className={cn("text-[7px] font-mono font-black uppercase tracking-widest", agentEnabled ? "text-secondary" : "text-destructive")}>
                          {agentEnabled ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                     </div>
                   </div>
                 </div>
               </div>
                            <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                   className={cn("flex items-center gap-2 px-4 py-1.5 border transition-all font-mono font-black text-[9px] uppercase tracking-[0.2em]", 
                     isSettingsOpen ? (isAD ? "bg-amber-500 text-black border-amber-500" : "bg-teal-500 text-black border-teal-500") : "border-border text-muted-foreground/40 hover:border-primary/40"
                   )}
                 >
                   <Settings2 className="w-3.5 h-3.5" />
                   Intel
                 </button>
                 
                 <button 
                   onClick={runDiscovery}
                   disabled={isScanning}
                   className={cn("px-5 py-1.5 font-mono font-black text-[9px] uppercase tracking-[0.2em] transition-all disabled:opacity-30 flex items-center gap-2", isAD ? "bg-amber-500 text-black hover:bg-white" : "bg-teal-500 text-black hover:bg-white")}
                 >
                   {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                   SCAN_PULSE
                 </button>
               </div>
            </div>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-3">
                    <div className="border border-primary/20 bg-primary/5 p-4 grid grid-cols-12 gap-4">
                       <div className="col-span-4 border-r border-border/20 pr-4">
                          <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase mb-3">Model_Core</div>
                          <div className={cn("flex items-center bg-background border p-1", accentBorderClass)}>
                             <Terminal className={cn("w-3 h-3 ml-1", primaryColorClass, "opacity-40")} />
                             <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className={cn("bg-transparent border-none text-[9px] font-mono font-black w-full p-1 focus:ring-0", primaryColorClass)} />
                          </div>
                       </div>
                      <div className="col-span-8">
                         <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase mb-3">Sectors</div>
                         <div className="flex flex-wrap gap-2">
                            {["NIFTY_50", "NIFTY_BANK", "NIFTY_AUTO"].map(s => (
                              <button key={s} onClick={() => {}} className="px-3 py-1 border border-border text-[8px] font-mono font-black uppercase text-muted-foreground/60 hover:border-primary">{s}</button>
                            ))}
                         </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-auto p-3 custom-scrollbar relative z-10">
            {results.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.2em] border-b border-border/10 sticky top-0 bg-background/80 backdrop-blur-md z-20">
                  <div className="col-span-3">SYMBOL</div>
                  <div className="col-span-2 text-center">PROBABILITY</div>
                  <div className="col-span-2 text-center">RSI</div>
                  <div className="col-span-5 pl-2 border-l border-border/10">DIAGNOSTICS</div>
                </div>
                
                {results.map((sym, i) => (
                  <motion.div key={sym.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border/10 bg-card/5 p-3 hover:bg-card/10 transition-all group">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 ${sym.score > 60 ? "bg-secondary" : "bg-primary"}`} />
                          <div>
                            <div className="text-[11px] font-black font-display uppercase group-hover:text-primary transition-colors">{sym.symbol}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-black text-foreground/60">₹{sym.price}</span>
                              <span className={`text-[8px] font-mono font-black ${sym.change >= 0 ? "text-secondary" : "text-destructive"}`}>{sym.change >= 0 ? "+" : ""}{sym.change}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-center">
                        <IndustrialValue value={sym.score} suffix="%" className="text-lg font-black font-display text-foreground" />
                      </div>

                      <div className="col-span-2 text-center">
                        <div className="text-[10px] font-mono font-black text-foreground/40 border border-border/20 px-2 py-1 inline-block">{sym.rsi}</div>
                      </div>

                       <div className="col-span-5">
                          <div className={cn("p-2 border-l bg-primary/[0.02]", accentBorderClass)}>
                             <p className="text-[9px] font-mono font-black text-muted-foreground/60 italic leading-tight">"{sym.ai_reasoning || 'ANALYZING_PHASE_COMPLETE'}"</p>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 filter grayscale">
                 <Search className="w-12 h-12 mb-4" />
                 <span className="text-[9px] font-mono font-black uppercase tracking-[0.4em]">Radar_Standby</span>
              </div>
            )}
          </div>
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
