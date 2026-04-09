import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, BarChart3, Shield, Briefcase, BookOpen, Server, 
  Bell, GitBranch, RefreshCw, Zap, Brain, Cpu, User, 
  ChevronDown, Hexagon, Filter, PlayCircle, Eye, Info,
  CheckCircle2, AlertCircle, Loader2, Settings2, Sparkles,
  Terminal, Activity, Globe, ZapOff, Fingerprint, Network,
  Power, PowerOff, ShieldAlert
} from "lucide-react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

type IndexType = "NIFTY_50" | "NIFTY_BANK" | "NIFTY_AUTO" | "NIFTY_PHARMA" | "NIFTY_REALTY";

export default function MarketScanner() {
  const { toast } = useToast();
  const [selectedIndices, setSelectedIndices] = useState<IndexType[]>(["NIFTY_50"]);
  const [results, setResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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
                <div className="w-10 h-10 border border-primary/20 bg-primary/5 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-black font-syne tracking-tighter uppercase leading-none mb-0.5">
                    NEURAL_<span className="text-primary">SCANNER</span>
                  </h1>
                  <div className="flex items-center gap-3">
                    <p className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Radar_V4</p>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 border border-border/50 bg-background/50">
                       <Fingerprint className={`w-2.5 h-2.5 ${agentEnabled ? "text-secondary" : "text-destructive"}`} />
                       <span className={`text-[7px] font-mono font-black uppercase tracking-widest ${agentEnabled ? "text-secondary" : "text-destructive"}`}>
                         {agentEnabled ? 'ACTIVE' : 'OFFLINE'}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`flex items-center gap-2 px-4 py-1.5 border transition-all font-mono font-black text-[9px] uppercase tracking-[0.2em] ${
                    isSettingsOpen ? "bg-primary text-black border-primary" : "border-border text-muted-foreground/40 hover:border-primary/40"
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Intel
                </button>
                
                <button 
                  onClick={runDiscovery}
                  disabled={isScanning}
                  className="px-5 py-1.5 bg-primary text-black font-mono font-black text-[9px] uppercase tracking-[0.2em] hover:bg-black hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
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
                         <div className="flex items-center bg-background border border-border/50 p-1">
                            <Terminal className="w-3 h-3 text-primary/40 ml-1" />
                            <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="bg-transparent border-none text-[9px] font-mono font-black text-primary w-full p-1 focus:ring-0" />
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

          <div className="flex-1 overflow-auto p-3 no-scrollbar relative z-10">
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
                            <div className="text-[11px] font-black font-syne uppercase group-hover:text-primary transition-colors">{sym.symbol}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-black text-foreground/60">₹{sym.price}</span>
                              <span className={`text-[8px] font-mono font-black ${sym.change >= 0 ? "text-secondary" : "text-destructive"}`}>{sym.change >= 0 ? "+" : ""}{sym.change}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-center">
                        <IndustrialValue value={sym.score} suffix="%" className="text-lg font-black font-syne text-foreground" />
                      </div>

                      <div className="col-span-2 text-center">
                        <div className="text-[10px] font-mono font-black text-foreground/40 border border-border/20 px-2 py-1 inline-block">{sym.rsi}</div>
                      </div>

                      <div className="col-span-5">
                         <div className="p-2 border-l border-primary/20 bg-primary/[0.02]">
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
