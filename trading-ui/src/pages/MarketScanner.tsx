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

type IndexType = "NIFTY_50" | "NIFTY_BANK" | "NIFTY_AUTO" | "NIFTY_PHARMA" | "NIFTY_REALTY";

export default function MarketScanner() {
  const { toast } = useToast();
  const [selectedIndices, setSelectedIndices] = useState<IndexType[]>(["NIFTY_50"]);
  const [results, setResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Intelligence Settings
  const [decisionMode, setDecisionMode] = useState("ai");
  const [llmModel, setLlmModel] = useState("mistral");
  const [logicProvider, setLogicProvider] = useState("ollama");
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [agentErrorReason, setAgentErrorReason] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    const interval = setInterval(loadSettings, 30000); // Poll for auto-disable (30s is sufficient)
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await algoApi.getSystemSettings();
      setDecisionMode(settings.decision_mode || "ai");
      setLlmModel(settings.llm_model || "mistral");
      setLogicProvider(settings.provider || "ollama");
      setAgentEnabled(String(settings.agent_enabled) === 'True' || settings.agent_enabled === true);
      setAgentErrorReason(settings.agent_error_reason || "");
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const updateSettings = async (updates: any) => {
    try {
      await algoApi.updateSystemSettings(updates);
      toast({ 
        title: "Intelligence Synchronized", 
        description: `Active core: ${updates.decision_mode || decisionMode} | Agentic Layer: ${updates.agent_enabled ?? agentEnabled ? 'ACTIVE' : 'ISOLATED'}`,
        className: "bg-background border-primary/20"
      });
      // Immediately refresh to clear error strings if manual override
      loadSettings();
    } catch (e) {
      toast({ title: "Sync Failed", description: "Critical: Could not update intelligence parameters.", variant: "destructive" });
    }
  };

  const runDiscovery = async () => {
    if (selectedIndices.length === 0) {
      toast({ title: "No Sectors Selected", description: "Please select at least one sector to scan.", variant: "warning" });
      return;
    }
    setIsScanning(true);
    setResults([]);
    try {
      const allResults = await Promise.all(
        selectedIndices.map(idx => algoApi.runScanner(idx).then(res => res.results || []))
      );
      const combinedResults = allResults.flat().filter((r, index, self) => index === self.findIndex((t) => t.symbol === r.symbol)); // Deduplicate
      setResults(combinedResults);
      toast({ 
        title: "Discovery Complete", 
        description: `Identified ${combinedResults.length} valid opportunities across ${selectedIndices.length} sectors.`,
      });
      
      if (combinedResults.length > 0) {
        runAnalysis(combinedResults.slice(0, 5));
      }
    } catch (error) {
      toast({ title: "Radar Error", description: "Interference detected in market data stream.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const runAnalysis = async (topResults: any[]) => {
    setIsAnalyzing(true);
    try {
      const analysis = await algoApi.analyzeScanner(topResults);
      setResults(prev => prev.map(r => {
        const analyzed = analysis.results.find((a: any) => a.symbol === r.symbol);
        return analyzed ? { ...r, ...analyzed } : r;
      }));
      // Check if it got auto-disabled after analysis failure
      loadSettings();
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground selection:bg-primary/30 font-display">
      <GlobalHeader />
      
      <MarketNavbar activeTab="/scanner" />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
          
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/5 blur-[120px] pointer-events-none" />
          
          <div className="px-6 py-6 border-b border-border/40 bg-background/20 backdrop-blur-sm space-y-5 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                  <Globe className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                    MARKET DISCOVERY <span className="text-primary italic">RADAR</span>
                  </h1>
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-70">Sectoral Frequency Scanner</p>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <div className="flex items-center gap-1">
                      <Fingerprint className={`w-3 h-3 ${agentEnabled ? "text-warning" : "text-destructive animate-pulse"}`} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${agentEnabled ? "text-warning/80" : "text-destructive/80"}`}>
                        {agentEnabled ? (logicProvider === 'ollama' ? 'LOCAL CORE ACTIVE' : 'AGENTIC CLAW ACTIVE') : 'AGENT LAYER SEVERED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-500 group ${
                    isSettingsOpen 
                      ? "bg-primary border-primary text-primary-foreground shadow-[0_0_25px_rgba(var(--primary),0.4)]" 
                      : "bg-muted/30 border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Settings2 className={`w-4 h-4 transition-transform duration-700 ${isSettingsOpen ? "rotate-180" : "group-hover:rotate-45"}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Hub</span>
                </button>
                
                <div className="h-8 w-px bg-border/40 mx-1" />
                
                <button 
                  onClick={runDiscovery}
                  disabled={isScanning}
                  className="relative group overflow-hidden bg-foreground text-background px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-primary translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500" />
                  <div className="relative flex items-center gap-2 group-hover:text-primary-foreground transition-colors">
                    {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    Initiate Frequency Scan
                  </div>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, y: -20 }} 
                  animate={{ height: "auto", opacity: 1, y: 0 }} 
                  exit={{ height: 0, opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="p-1 mt-2">
                    <div className="glass-panel-elevated p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent grid grid-cols-1 md:grid-cols-12 gap-8 relative overflow-hidden">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                      
                      {/* Agent Master Switch */}
                      <div className="md:col-span-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${agentEnabled ? "bg-warning/20" : "bg-destructive/20 border border-destructive/30 shadow-[0_0_10px_rgba(255,0,0,0.2)]"}`}>
                              {agentEnabled ? <Power className="w-4 h-4 text-warning" /> : <PowerOff className="w-4 h-4 text-destructive animate-pulse" />}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Agent Evolution</span>
                          </div>
                          <button 
                            onClick={() => { setAgentEnabled(!agentEnabled); updateSettings({ agent_enabled: !agentEnabled }); }}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${agentEnabled ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.4)]" : "bg-muted"}`}
                          >
                            <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${agentEnabled ? "translate-x-5" : "translate-x-1"}`} />
                          </button>
                        </div>
                        
                        <div className={`grid grid-cols-2 gap-2 bg-background/40 p-1.5 rounded-2xl border transition-all duration-700 ${agentEnabled ? "border-border/50 opacity-100" : "border-border/10 opacity-40 grayscale pointer-events-none scale-95"}`}>
                          {[
                            { id: 'ollama', icon: Server, label: 'LOCAL' },
                            { id: 'openclaw', icon: Fingerprint, label: 'AGENT' }
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setLogicProvider(p.id); updateSettings({ provider: p.id }); }}
                              className={`flex flex-col items-center justify-center gap-1 py-4 rounded-xl transition-all ${
                                logicProvider === p.id 
                                  ? "bg-secondary text-secondary-foreground shadow-lg scale-[1.05]" 
                                  : "text-muted-foreground hover:bg-muted/50"
                              }`}
                            >
                              <p.icon className="w-4 h-4" />
                              <span className="text-[9px] font-black uppercase">{p.label}</span>
                            </button>
                          ))}
                        </div>

                        {!agentEnabled && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-[8px] font-black text-destructive uppercase tracking-widest leading-none">Circuit Segregated</p>
                              <p className="text-[9px] font-bold text-destructive/80 font-mono tracking-tighter truncate max-w-[120px]" title={agentErrorReason}>
                                {agentErrorReason || "Manual Kill Switch engaged."}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Decision Mode Selection */}
                      <div className="md:col-span-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/20">
                            <Brain className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Cognitive Layer</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-background/40 p-1.5 rounded-2xl border border-border/50 backdrop-blur-xl">
                          {[
                            { id: 'ai', icon: Brain, label: 'LLM AI' },
                            { id: 'program', icon: Cpu, label: 'EXPERT' },
                            { id: 'human', icon: User, label: 'ADVISOR' }
                          ].map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setDecisionMode(m.id); updateSettings({ decision_mode: m.id }); }}
                              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl transition-all ${
                                decisionMode === m.id 
                                  ? "bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(var(--primary),0.3)] scale-[1.05]" 
                                  : "text-muted-foreground hover:bg-muted/50"
                              }`}
                            >
                              <m.icon className={`w-4 h-4 ${decisionMode === m.id ? "animate-pulse" : ""}`} />
                              <span className="text-[9px] font-black uppercase tracking-tighter">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Inference Model & Agent Status */}
                      <div className="md:col-span-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-warning/20">
                            <Hexagon className="w-4 h-4 text-warning" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Active Architecture</span>
                        </div>
                        <div className="relative group">
                          {logicProvider === 'ollama' || !agentEnabled ? (
                            <>
                              <div className="absolute inset-y-0 left-4 flex items-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                <Terminal className="w-4 h-4" />
                              </div>
                              <input 
                                type="text" 
                                value={llmModel}
                                onChange={(e) => setLlmModel(e.target.value)}
                                onBlur={(e) => updateSettings({ llm_model: e.target.value })}
                                className="w-full bg-background/40 border border-border/50 rounded-2xl pl-11 pr-4 py-4 text-xs font-mono focus:outline-none focus:border-primary/50 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                                placeholder="Local Model ID"
                              />
                            </>
                          ) : (
                            <div className="w-full bg-secondary/5 border border-secondary/30 rounded-2xl p-4 flex items-center gap-3 shadow-[0_0_15px_rgba(var(--secondary),0.1)]">
                              <Sparkles className="w-5 h-5 text-secondary animate-pulse" />
                              <div>
                                <div className="text-[10px] font-black uppercase text-secondary">OpenClaw Autonomous</div>
                                <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Multi-Agent Gateway</div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <Activity className={`w-3 h-3 ${agentEnabled ? "text-neon-green animate-pulse" : "text-muted-foreground"}`} />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 font-mono">Edge Logic {agentEnabled ? 'Enabled' : 'Bypassed'}</span>
                          </div>
                          {logicProvider === 'openclaw' && agentEnabled && (
                            <span className="text-[8px] font-black text-secondary uppercase animate-ping">Syncing soul...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-2">
              <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest pr-4 border-r border-border/40 mr-1 shrink-0">
                <Filter className="w-3 h-3" />
                Registry
              </div>
              {["NIFTY_50", "NIFTY_BANK", "NIFTY_AUTO", "NIFTY_PHARMA", "NIFTY_REALTY"].map((idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const idxType = idx as IndexType;
                    setSelectedIndices(prev => 
                      prev.includes(idxType) 
                        ? prev.filter(i => i !== idxType)
                        : [...prev, idxType]
                    );
                  }}
                  className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap transition-all duration-500 border ${
                    selectedIndices.includes(idx as IndexType) 
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_5px_15px_rgba(var(--primary),0.2)]" 
                    : "bg-muted/20 border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {idx.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 custom-scrollbar relative z-10">
            {results.length > 0 ? (
              <div className="space-y-4 max-w-6xl mx-auto">
                <div className="hidden md:grid grid-cols-12 gap-6 px-6 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-border/40 sticky top-0 bg-background/50 backdrop-blur-md -mx-6 mb-4 z-20">
                  <div className="col-span-3">Instrument Discovery</div>
                  <div className="col-span-2 text-center">Technical Conviction</div>
                  <div className="col-span-2 text-center">RSI Intensity</div>
                  <div className="col-span-4 pl-4 border-l border-border/20">Analytical System Output</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
                
                {results.map((sym, i) => (
                  <motion.div
                    key={sym.symbol}
                    initial={{ opacity: 0, rotateX: -10, y: 20 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 20 }}
                    className="glass-panel-elevated p-5 rounded-2xl border border-border/40 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="grid grid-cols-12 gap-6 items-center relative z-10">
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex items-center gap-4">
                          <div className={`w-1.5 h-10 rounded-full transition-all duration-700 ${sym.score > 70 ? "bg-neon-green shadow-[0_0_15px_rgba(0,255,100,0.4)]" : sym.score > 40 ? "bg-warning shadow-[0_0_15px_rgba(255,180,0,0.3)]" : "bg-destructive shadow-[0_0_15px_rgba(255,0,0,0.3)]"}`} />
                          <div>
                            <div className="text-sm font-black tracking-tighter group-hover:text-primary transition-colors mb-0.5">{sym.symbol}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-black text-foreground opacity-90 tracking-tight">₹{sym.price.toLocaleString()}</span>
                              <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${sym.change >= 0 ? "bg-neon-green/10 text-neon-green" : "bg-neon-red/10 text-neon-red"}`}>
                                {sym.change >= 0 ? "+" : ""}{sym.change.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-6 md:col-span-2 flex flex-col items-center">
                        <div className="text-xl font-black tracking-tighter text-foreground mb-1.5">{sym.score}%</div>
                        <div className="h-1.5 w-full max-w-[100px] bg-muted/40 rounded-full overflow-hidden border border-border/50">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${sym.score}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full ${sym.score > 70 ? "bg-neon-green shadow-[0_0_10px_rgba(0,255,100,0.4)]" : "bg-primary"}`}
                          />
                        </div>
                      </div>

                      <div className="col-span-6 md:col-span-2 text-center">
                        <div className={`inline-block px-3 py-1 rounded-lg border text-sm font-mono font-black ${
                          sym.rsi > 70 
                            ? "bg-destructive/10 border-destructive/30 text-destructive shadow-[0_0_20px_rgba(255,0,0,0.05)]" 
                            : sym.rsi < 30 
                              ? "bg-neon-green/10 border-neon-green/30 text-neon-green shadow-[0_0_20px_rgba(0,255,100,0.05)]" 
                              : "bg-muted/10 border-border/50 text-foreground"
                        }`}>
                          {sym.rsi?.toFixed(1) || "N/A"}
                        </div>
                        <div className="text-[8px] font-black uppercase text-muted-foreground mt-1 opacity-50 tracking-widest font-mono">Relative Strength Index</div>
                      </div>

                      <div className="col-span-12 md:col-span-4 xl:col-span-4">
                        <AnimatePresence mode="wait">
                          {sym.ai_reasoning ? (
                            <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                sym.provider === 'openclaw' && agentEnabled
                                  ? "bg-secondary/5 border-secondary/20 shadow-[0_0_15px_rgba(var(--secondary),0.05)]" 
                                  : "bg-foreground/5 border-border/30 group-hover:border-primary/20"
                              }`}
                            >
                              <div className="mt-1 shrink-0">
                                {sym.provider === 'openclaw' && agentEnabled ? (
                                  <div className="p-1.5 rounded-lg bg-secondary/20 text-secondary">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                  </div>
                                ) : (
                                  <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                                    <Brain className="w-3.5 h-3.5 animate-pulse" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold leading-relaxed italic text-foreground opacity-90 tracking-tight">"{sym.ai_reasoning}"</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                                    sym.provider === 'openclaw' && agentEnabled ? "bg-secondary/10 border-secondary/20 text-secondary" : "bg-primary/10 border-primary/20 text-primary"
                                  }`}>
                                    <div className={`w-1 h-1 rounded-full ${sym.provider === 'openclaw' && agentEnabled ? "bg-secondary" : "bg-primary"}`} />
                                    <span className="text-[8px] font-black uppercase tracking-tighter">Conviction: {((sym.ai_conviction || 0) * 100).toFixed(0)}%</span>
                                  </div>
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 italic font-mono">
                                    {sym.provider === 'openclaw' && agentEnabled ? 'OpenClaw Agent Core' : 'Ollama Local Core'}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {isAnalyzing ? (
                                <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-xl border border-divider dashed overflow-hidden relative group">
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                                    {logicProvider === 'openclaw' && agentEnabled ? 'Agent Consulting Knowledge Base...' : 'Synthesizing Rationalization...'}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 pl-4 border-l-2 border-border/40">Radar Standby Registry</div>
                              )}
                            </div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="col-span-12 md:col-span-1 text-right">
                        <button className="w-full md:w-auto p-3 rounded-xl bg-foreground text-background shadow-[0_10px_20px_rgba(0,0,0,0.2)] transition-all hover:scale-110 active:scale-95 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_20px_rgba(var(--primary),0.4)]">
                          <Zap className="w-4 h-4 mx-auto fill-current" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-8 py-20 relative">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse scale-150" />
                  <div className="w-24 h-24 rounded-full border border-primary/20 flex items-center justify-center relative z-10 overflow-hidden bg-background">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-t-2 border-primary/60 rounded-full"
                    />
                    <Search className="w-10 h-10 text-primary/30" />
                  </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-[0.3em] mb-2 opacity-80 italic">Radar Standby</h3>
                    <div className="h-0.5 w-16 bg-primary mx-auto rounded-full mb-4" />
                    <p className="text-[11px] text-muted-foreground max-w-[320px] mx-auto uppercase font-bold leading-[1.8] tracking-[0.1em] opacity-60">
                      Synchronize your cluster selection and initiate a frequency scan to identify high-probability alpha signals within the current volatility regime.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
                    <StatusFeature icon={!agentEnabled ? PowerOff : (logicProvider === 'ollama' ? Terminal : Sparkles)} label={!agentEnabled ? "Agent Bypassed" : (logicProvider === 'ollama' ? "Ollama Ready" : "OpenClaw Active")} color={!agentEnabled ? "text-destructive animate-pulse" : (logicProvider === 'ollama' ? "text-neon-green" : "text-secondary")} />
                    <StatusFeature icon={Shield} label="Guardrails Active" color="text-neon-emerald" />
                    <StatusFeature icon={Globe} label="Region: NSE/BSE" color="text-primary" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <RightPanel />
      </div>
    </div>
  );
}

function StatusFeature({ icon: Icon, label, color }: { icon: any, label: string, color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">{label}</span>
    </div>
  );
}

