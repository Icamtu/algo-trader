import React, { useEffect, useState } from 'react';
import { Key, Copy, RefreshCw, Eye, EyeOff, ShieldCheck, Zap, AlertCircle, Terminal, HelpCircle, Cpu, Fingerprint, Lock } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export const ConnectivityPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';

  const accentColor = isAD ? "amber" : "teal";
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  const glowClass = isAD ? "shadow-[0_0_20px_rgba(245,158,11,0.1)]" : "shadow-[0_0_20px_rgba(20,184,166,0.1)]";

  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [orderMode, setOrderMode] = useState<'auto' | 'semi_auto'>('auto');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await tradingService.getApiKey();
      if (data.api_key) {
        setApiKey(data.api_key);
        setOrderMode(data.order_mode || 'auto');
      }
    } catch (error) {
      console.error('Failed to fetch API key config', error);
      toast({ variant: "destructive", title: "FAULT::KERNEL_SYNC", description: "Failed to synchronize core handshake parameters." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: "PROTOCOL::TOKEN_COPIED", description: "Identity buffer secured in clipboard." });
  };

  const handleRegenerate = async () => {
    if (!window.confirm("CRITICAL_WARNING:: REGENERATING_KEY_WILL_INVALIDATE_ALL_ACTIVE_WEBHOOK_AND_BRIDGE_CONNECTIONS. PROCEED?")) return;

    setIsSyncing(true);
    try {
      const data = await tradingService.regenerateApiKey();
      if (data.api_key) {
        setApiKey(data.api_key);
        setShowKey(true);
      }
    } catch (error) {
      console.error('Failed to regenerate key', error);
      toast({ variant: "destructive", title: "FAULT::PROTOCOL_FAULT", description: "Failed to rotate identity token." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleMode = async (mode: 'auto' | 'semi_auto') => {
    setIsSyncing(true);
    try {
      const data = await tradingService.setOrderMode(mode);
      if (data.mode) {
        setOrderMode(data.mode);
        toast({ title: "MODE_SWITCHED", description: `Operation protocol set to ${mode.toUpperCase()}.` });
      }
    } catch (error) {
      console.error('Failed to toggle order mode', error);
      toast({ variant: "destructive", title: "FAULT::STATE_TRANSITION", description: "Terminal failed to switch operation mode." });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 font-mono bg-black">
        <Terminal className={cn("w-12 h-12 animate-pulse", primaryColorClass)} />
        <span className={cn("text-[10px] font-black uppercase tracking-[0.5em] animate-pulse", primaryColorClass)}>Handshaking_Security_Kernel...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-black overflow-hidden font-mono relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,245,255,0.02),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay" />

      {/* Header: Identity Synopsis */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="flex items-start gap-6">
          <div className="relative group">
            <div className={cn("absolute -inset-1 blur-md transition-all", isAD ? "bg-amber-500/20 group-hover:bg-amber-500/40" : "bg-teal-500/20 group-hover:bg-teal-500/40")} />
            <div className={cn("relative bg-black border p-5 flex items-center justify-center", accentBorderClass)}>
              <ShieldCheck className={cn("h-10 w-10 animate-pulse", primaryColorClass)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black tracking-[0.2em] uppercase text-white">Identity_Synopsis</h1>
              <div className={cn("flex items-center gap-2 border px-3 py-1", isAD ? "bg-amber-500/10 border-amber-500/20" : "bg-teal-500/10 border-teal-500/20")}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isAD ? "bg-amber-500" : "bg-teal-500")} />
                <span className={cn("text-[10px] font-black tracking-widest", primaryColorClass)}>SECURE_VECTOR</span>
              </div>
            </div>
            <div className="flex items-center gap-3 opacity-40">
              <Cpu className={cn("w-3.5 h-3.5", primaryColorClass)} />
              <span className="text-[10px] font-black tracking-[0.3em] uppercase">Kernel_v4.4 // Handshake_Active // AES_256_ROTATION</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end">
            <span className="text-3xl font-display font-black tracking-tighter text-white tabular-nums">
              {currentTime.toLocaleTimeString([], { hour12: false })}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/30 font-black uppercase tracking-[0.4em]">Protocol_Runtime</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 h-full overflow-hidden">
        <div className="space-y-6 flex flex-col">
          {/* API Access Panel */}
          <AetherPanel className={cn("border-l-4 flex-none", accentBorderClass, isAD ? "bg-amber-500/5 border-l-amber-500 shadow-[20px_0_40px_rgba(245,158,11,0.02)]" : "bg-teal-500/5 border-l-teal-500 shadow-[20px_0_40px_rgba(20,184,166,0.02)]")}>
            <div className="flex items-center justify-between mb-8">
              <div className={cn("text-[10px] font-black tracking-widest flex items-center gap-3 uppercase", primaryColorClass)}>
                <Fingerprint className="w-4 h-4" /> Endpoint_Authentication_Token
              </div>
              <Badge variant="outline" className={cn("text-[8px] font-black border-white/5 uppercase tracking-[0.2em] font-mono py-1 px-3", primaryColorClass)}>VAULT_LOCKED</Badge>
            </div>

            <div className="group relative bg-black/40 border border-white/5 p-6 flex items-center gap-4 transition-all hover:border-white/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="flex-1 font-mono text-[11px] tracking-[0.2em] text-muted-foreground/40 break-all select-none transition-colors group-hover:text-muted-foreground/80">
                {showKey ? apiKey : `****************${apiKey.slice(-8)}`}
              </div>
               <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-muted-foreground transition-all hover:scale-110", isAD ? "hover:text-amber-500 hover:bg-amber-500/10" : "hover:text-teal-500 hover:bg-teal-500/10")} onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-muted-foreground transition-all hover:scale-110", isAD ? "hover:text-amber-500 hover:bg-amber-500/10" : "hover:text-teal-500 hover:bg-teal-500/10")} onClick={handleCopy}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-5">
              <div className="flex items-start gap-4 p-4 bg-rose-500/5 border border-rose-500/10 italic">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-[9px] text-rose-500/60 font-black uppercase leading-relaxed tracking-wider">
                  CRITICAL_ADVISORY: REGENERATING_KEY_WILL_TERMINATE_ALL_ACTIVE_WEBHOOK_STREAMS_AND_INVALIDATE_EXTERNAL_BRIDGE_ACCESS.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full border-white/5 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-500 transition-all font-black text-[10px] uppercase tracking-[0.3em] h-12 rounded-none",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
                onClick={handleRegenerate}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("w-4 h-4 mr-3", isSyncing && "animate-spin")} />
                REGRESS_IDENTITY_BUFFER
              </Button>
            </div>
          </AetherPanel>

          {/* Execution Strategy Panel */}
          <AetherPanel className={cn("bg-black/20 border-white/5 flex-none", glowClass)}>
             <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className={cn("text-[10px] font-black tracking-widest flex items-center gap-3 uppercase text-white/40")}>
                <Zap className={cn("w-4 h-4", primaryColorClass)} /> Core_Execution_Protocol_v4
              </div>
            </div>

             <div className="space-y-6">
               <div
                 className={cn(
                   "p-6 border flex items-center justify-between transition-all duration-700 relative overflow-hidden group cursor-pointer",
                   orderMode === 'auto'
                     ? (isAD ? "bg-amber-500/5 border-amber-500/40" : "bg-teal-500/5 border-teal-500/40")
                     : "bg-black/40 border-white/5 opacity-40 hover:opacity-100"
                 )}
                 onClick={() => handleToggleMode(orderMode === 'auto' ? 'semi_auto' : 'auto')}
               >
                  {orderMode === 'auto' && (
                    <motion.div
                      layoutId="executionHighlight"
                      className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-current to-transparent opacity-5", primaryColorClass)}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  )}
                  <div className="flex items-center gap-6 relative z-10">
                     <div className={cn(
                       "p-3 rounded-none border transition-all duration-500",
                       orderMode === 'auto' ? (isAD ? "bg-amber-500/20 border-amber-500 text-amber-500" : "bg-teal-500/20 border-teal-500 text-teal-500") : "bg-white/5 border-white/10 text-white/20"
                     )}>
                        <Lock className={cn("w-6 h-6", orderMode === 'auto' && "animate-pulse")} />
                     </div>
                     <div>
                       <div className={cn("text-[12px] font-black uppercase tracking-[0.2em] transition-colors", orderMode === 'auto' ? "text-white" : "text-white/20")}>
                          AUTONOMOUS_GATE_ACTIVE
                       </div>
                       <div className="text-[9px] font-black text-white/20 uppercase mt-1 italic tracking-widest">ZERO_TOUCH_EXECUTION_KERNEL</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-5 relative z-10">
                    <Switch
                      checked={orderMode === 'auto'}
                      onCheckedChange={(checked) => handleToggleMode(checked ? 'auto' : 'semi_auto')}
                      className="scale-125"
                    />
                  </div>
               </div>

               <div className="p-5 bg-white/[0.02] border border-white/5 space-y-4">
                  <div className="flex items-center gap-4 text-white/20">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">OPERATOR_HANDLING_SPECS</span>
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground/30 uppercase leading-relaxed tracking-wider italic">
                    {orderMode === 'auto'
                      ? "CURRENT_STATE: INCOMING_SIGNALS_ARE_ROUTED_DIRECTLY_TO_OMNET_KERNEL_WITHOUT_HUMAN_INTERVENTION."
                      : "CURRENT_STATE: SIGNALS_ARE_STAGED_IN_PENDING_BUFFER_REQUIRING_EXPLICIT_OPERATOR_SIGN_OFF."
                    }
                  </p>
               </div>
            </div>
          </AetherPanel>
        </div>

        {/* Diagnostic / Playground Container */}
        <div className="flex flex-col">
          <AetherPanel className={cn("h-full bg-black/40 border border-white/5 flex flex-col p-8 relative overflow-hidden group transition-all duration-700", isAD ? "hover:border-amber-500/20" : "hover:border-teal-500/20")}>
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <Terminal className={cn("w-48 h-48", primaryColorClass)} />
             </div>

             <div className="flex items-center gap-4 mb-12">
               <div className={cn("p-4 border", accentBorderClass, isAD ? "bg-amber-500/10" : "bg-teal-500/10")}>
                  <Zap className={cn("w-6 h-6", primaryColorClass)} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Protocol_Sandbox_v2</h3>
                  <div className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mt-1.5 italic">KERNEL_ENDPOINT_STRESS_DIAGNOSTICS</div>
               </div>
             </div>

             <div className="flex-1 space-y-8 max-w-lg">
                <p className="text-[11px] font-black text-muted-foreground/40 uppercase leading-relaxed tracking-[0.15em] italic">
                   REAL-TIME_INTERACTIVE_DIAGNOSTIC_ENVIRONMENT_FOR_CORE_HANDSHAKE_VALIDATION.
                   AUDIT_SIGNAL_PAYLOADS, VERIFY_LATENCY_METRICS, AND_CALIBRATE_IDENTITY_VECTORS
                   WITHIN_A_CONTROLLED_ISOLATION_LAYER.
                </p>

                <div className="space-y-5 border-l-2 border-white/5 pl-8 py-4">
                   {[
                     { label: "REST_ENDPOINT_AUDIT", desc: "Interactive_Interface_v43" },
                     { label: "DYNAMIC_PAYLOAD_MAP", desc: "JSON_Visualizer_Active" },
                     { label: "CURL_DIAGNOSTIC_BUFF", desc: "Terminal_Ready_For_Export" },
                     { label: "AUTH_HANDSHAKE_INJECT", desc: "AES-256-GCM_Enabled" }
                   ].map((item, i) => (
                     <div key={i} className="group/item cursor-default">
                        <div className="flex items-center gap-4 mb-1">
                           <div className={cn("w-1.5 h-1.5 rounded-full transition-all group-hover/item:scale-150", isAD ? "bg-amber-500/40" : "bg-teal-500/40")} />
                           <span className="text-[10px] font-black text-white/40 tracking-widest group-hover/item:text-white/80 transition-colors uppercase">{item.label}</span>
                        </div>
                        <div className="text-[8px] font-black text-white/10 ml-5 tracking-[0.2em] uppercase">{item.desc}</div>
                     </div>
                   ))}
                </div>

                <div className="pt-8">
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full transition-all font-black text-[11px] uppercase tracking-[0.4em] h-16 rounded-none relative overflow-hidden group",
                      isAD ? "border-amber-500/20 text-amber-500 hover:bg-amber-500/10 shadow-[0_0_80px_rgba(245,158,11,0.02)]" : "border-teal-500/20 text-teal-500 hover:bg-teal-500/10 shadow-[0_0_80px_rgba(20,184,166,0.02)]"
                    )}
                  >
                     <div className="absolute inset-0 bg-white/[0.02] transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
                     INITIALISE_DIAGNOSTIC_SESSION →
                  </Button>
                </div>
             </div>

             <div className="mt-auto pt-10 flex items-center justify-center gap-4">
                <div className={cn("h-px flex-1 bg-gradient-to-r from-transparent to-white/5")} />
                <div className={cn("flex items-center gap-3 font-black text-[10px] tabular-nums italic", isAD ? "text-amber-500/20" : "text-teal-500/20")}>
                   <Terminal className="w-4 h-4" />
                   <span className="animate-pulse tracking-[0.3em]">LISTENING_ON_PORT::REST_STREAM_SYNOPSIS_V4</span>
                </div>
                <div className={cn("h-px flex-1 bg-gradient-to-l from-transparent to-white/5")} />
             </div>
          </AetherPanel>
        </div>
      </div>
    </div>
  );
};
