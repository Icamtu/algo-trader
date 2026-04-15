import React, { useEffect, useState } from 'react';
import { Key, Copy, RefreshCw, Eye, EyeOff, ShieldCheck, Zap, AlertCircle, Terminal, HelpCircle } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useAppModeStore } from '@/stores/appModeStore';
import { useToast } from '@/hooks/use-toast';

export const ConnectivityPage: React.FC = () => {
  const { user } = useAuthStore();
  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [orderMode, setOrderMode] = useState<'auto' | 'semi_auto'>('auto');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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
    if (!window.confirm("CRITICAL_WARNING:: REGENERATING_KEY_WILL_INVALIDATE_ALL_ACTIVE_WEBHOOKS_AND_BRIDGE_CONNECTIONS. PROCEED?")) return;
    
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
      }
    } catch (error) {
      console.error('Failed to toggle order mode', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <Terminal className={cn("w-8 h-8 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <ShieldCheck className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Core_Access_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Key className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">IDENTITY_PROTOCOL // TOKEN_ENCRYPTION</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn("font-mono text-[9px] px-3", accentBorderClass, primaryColorClass)}>
            V43_ENCRYPTED_SIGNAL
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <AetherPanel className={cn("border-l-2", accentBorderClass, isAD ? "bg-primary/5 border-l-primary" : "bg-teal-500/5 border-l-teal-500")}>
            <div className="flex items-center justify-between mb-6">
              <div className={cn("micro-label flex items-center gap-2", primaryColorClass)}>
                <Key className="w-3 h-3" /> API_AUTHENTICATION_KEY
              </div>
              <Badge variant="outline" className={cn("text-[8px] opacity-40 border-white/[0.05] uppercase tracking-tighter", primaryColorClass)}>SECURE_VECTOR</Badge>
            </div>

            <div className="group relative bg-background border border-white/[0.03] p-4 flex items-center gap-4 transition-all">
              <div className="flex-1 font-mono text-[10px] tracking-widest text-muted-foreground/40 break-all group-hover:text-muted-foreground/60 transition-colors italic">
                {showKey ? apiKey : `${apiKey.slice(0, 8)}${'·'.repeat(32)}${apiKey.slice(-8)}`}
              </div>
               <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className={cn("h-7 w-7 text-muted-foreground transition-all hover:scale-110", isAD ? "hover:text-primary" : "hover:text-teal-500")} onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("h-7 w-7 text-muted-foreground transition-all hover:scale-110", isAD ? "hover:text-primary" : "hover:text-teal-500")} onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <div className="text-[9px] text-muted-foreground font-mono leading-relaxed uppercase tracking-wider opacity-20 italic">
                CRITICAL_ADVISORY: REGENERATING_KEY_WILL_INVALIDATE_ALL_ACTIVE_WEBHOOKS_AND_BRIDGE_CONNECTIONS.
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-white/[0.05] hover:border-rose-500/50 hover:bg-rose-500/5 hover:text-rose-500 transition-all font-mono text-[10px] uppercase tracking-widest h-10 rounded-none"
                onClick={handleRegenerate}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSyncing && "animate-spin")} />
                Regenerate_Encrypted_Buffer
              </Button>
            </div>
          </AetherPanel>

          <AetherPanel className={cn("bg-background", isAD ? "border-amber-500/10" : "border-emerald-500/10")}>
             <div className="flex items-center justify-between mb-6">
              <div className={cn("micro-label flex items-center gap-2", isAD ? "text-amber-500" : "text-emerald-500")}>
                <Zap className="w-3 h-3" /> ORDER_EXECUTION_PROTOCOL_v4
              </div>
            </div>

             <div className="space-y-4">
               <div 
                 className={cn(
                   "p-5 border flex items-center justify-between transition-all duration-500",
                   orderMode === 'auto' 
                     ? (isAD ? "bg-amber-500/5 border-amber-500/30 shadow-[0_4px_20px_rgba(255,176,0,0.1)]" : "bg-teal-500/5 border-teal-500/30 shadow-[0_4px_20px_rgba(20,184,166,0.1)]") 
                     : "bg-background border-border/10 opacity-60"
                 )}
               >
                  <div className="flex items-center gap-4">
                     <div className={cn(
                       "p-2 rounded-none border transition-colors",
                       orderMode === 'auto' ? (isAD ? "bg-amber-500/20 border-amber-500 text-amber-500" : "bg-teal-500/20 border-teal-500 text-teal-500") : "bg-muted/10 border-border text-muted-foreground/40"
                     )}>
                        <Zap className={cn("w-5 h-5", orderMode === 'auto' && "animate-pulse")} />
                     </div>
                     <div>
                       <div className={cn("text-[11px] font-mono font-black uppercase tracking-widest transition-colors", orderMode === 'auto' ? "text-foreground" : "text-muted-foreground/40")}>
                          AUTO_EXECUTION_MODE
                       </div>
                       <div className="text-[8px] font-mono text-muted-foreground/30 uppercase mt-0.5 italic">Direct_Engine_Handoff</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[8px] font-mono font-black transition-colors",
                      orderMode === 'semi_auto' ? (isAD ? "text-amber-500" : "text-teal-500") : "text-muted-foreground/20"
                    )}>SEMI</span>
                    <Switch 
                      checked={orderMode === 'auto'}
                      onCheckedChange={(checked) => handleToggleMode(checked ? 'auto' : 'semi_auto')}
                    />
                    <span className={cn(
                      "text-[8px] font-mono font-black transition-colors",
                      orderMode === 'auto' ? (isAD ? "text-amber-500" : "text-teal-500") : "text-muted-foreground/20"
                    )}>AUTO</span>
                  </div>
               </div>

               <div className="p-4 bg-foreground/[0.02] border border-white/[0.03] space-y-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <span className="text-[9px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest">Operator_Gate_Requirements</span>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground/40 uppercase leading-relaxed tracking-wider italic">
                    When Auto Mode is disabled, all incoming signals will require manual authorization in the Action Center.
                  </p>
               </div>
            </div>

             <div className="mt-8 p-3 bg-foreground/[0.01] border border-white/[0.03] relative overflow-hidden italic">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                   <HelpCircle className={cn("w-3 h-3", primaryColorClass)} />
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/40 uppercase leading-relaxed tracking-wider">
                   {orderMode === 'auto' 
                     ? "SYSTEM_STATUS: ALL_INCOMING_SIGNALS_WILL_EXECUTE_IMMEDIATELY_UPON_VALIDATION."
                     : "SYSTEM_STATUS: SIGNALS_WILL_BE_QUEUED_IN_ACTION_CENTER_PENDING_OPERATOR_GATE."
                   }
                </div>
             </div>
          </AetherPanel>
        </div>

         <div className="space-y-6">
            <AetherPanel className={cn("h-full bg-background", accentBorderClass)}>
               <div className="flex items-center gap-2 mb-10">
                 <div className={cn("p-3 border", accentBorderClass, isAD ? "bg-primary/5" : "bg-teal-500/5")}>
                    <Zap className={cn("w-5 h-5", primaryColorClass)} />
                 </div>
                 <div>
                    <h3 className={cn("text-xs font-black font-mono uppercase tracking-widest", primaryColorClass)}>Protocol_Playground</h3>
                    <div className="text-[8px] font-mono text-muted-foreground uppercase opacity-20 tracking-[0.2em] mt-1 italic">REST_Endpoint_Stress_Testing</div>
                 </div>
               </div>

               <div className="space-y-6 px-1">
                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase leading-relaxed tracking-widest italic opacity-40">
                     Interactive diagnostic environment for kernel-level operation verification. 
                     Simulate payloads, audit response headers, and verify latency parameters 
                     direct from your workstation.
                  </p>

                  <div className={cn("space-y-3 border-l pl-5 py-2", isAD ? "border-primary/10" : "border-teal-500/10")}>
                     {[
                       "Direct_GET/POST_Interface",
                       "Dynamic_JSON_Highlighting",
                       "cURL_Buffer_Export",
                       "Zero-Config_Auth_Injection"
                     ].map((item, i) => (
                       <div key={i} className="flex items-center gap-3">
                          <div className={cn("w-1 h-1 rounded-full", isAD ? "bg-primary/40" : "bg-teal-500/40")} />
                          <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest group-hover:text-muted-foreground/60 transition-colors uppercase">{item}</span>
                       </div>
                     ))}
                  </div>

                  <Button 
                    variant="outline" 
                    className={cn("w-full transition-all font-mono text-[10px] uppercase tracking-[0.2em] h-12 rounded-none", isAD ? "border-primary/20 text-primary hover:bg-primary/5 shadow-lg shadow-primary/5" : "border-teal-500/20 text-teal-500 hover:bg-teal-500/5 shadow-lg shadow-teal-500/5")}
                  >
                     INITIALISE_PLAYGROUND_SESSION →
                  </Button>

                  <div className={cn("mt-10 p-4 bg-foreground/[0.01] border border-white/[0.03] font-mono text-[9px] flex items-center justify-center gap-3 italic", isAD ? "text-primary/20" : "text-teal-500/20")}>
                     <Terminal className="w-3.5 h-3.5" />
                     <span className="animate-pulse tracking-[0.2em]">LISTEN_PORT::REST_STREAM_ACTIVE_V4</span>
                  </div>
               </div>
            </AetherPanel>
        </div>
      </div>
    </div>
  );
};
