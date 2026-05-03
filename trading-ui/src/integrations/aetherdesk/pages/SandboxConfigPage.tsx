import React, { useEffect, useState } from 'react';
import {
  Settings, Save, RotateCcw, Box, Sliders,
  ShieldAlert, BadgeInfo, Terminal, BarChart3,
  Cpu, Zap, Shield, Database, LayoutGrid,
  RefreshCw, Lock, Radio, Activity, FlaskConical
} from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAppModeStore } from '@/stores/appModeStore';
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { TelemetryOscilloscope } from "@/components/trading/TelemetryOscilloscope";

interface ConfigItem {
  value: string;
  description: string;
}

interface ConfigCategory {
  title: string;
  configs: Record<string, ConfigItem>;
}

type Configs = Record<string, ConfigCategory>;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export const SandboxConfigPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';

  const [configs, setConfigs] = useState<Configs>({});
  const [modifiedConfigs, setModifiedConfigs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchConfigs = async () => {
    try {
      const data = await tradingService.getSandboxConfigs();
      if (data.status === 'success') {
        setConfigs(data.configs || {});
      }
    } catch (error) {
      toast({ variant: "destructive", title: "FAULT::READ_FAILED", description: "Failed to establish downlink with Hypervisor." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleUpdate = (key: string, value: string) => {
    setConfigs(prev => {
      const next = { ...prev };
      for (const cat in next) {
        if (next[cat].configs[key]) {
          next[cat].configs[key] = { ...next[cat].configs[key], value };
          break;
        }
      }
      return next;
    });
    setModifiedConfigs(prev => new Set(prev).add(key));
  };

  const handleSave = async (key: string) => {
    setIsSyncing(true);
    let value = '';
    for (const cat in configs) {
       if (configs[cat].configs[key]) value = configs[cat].configs[key].value;
    }
    try {
      await tradingService.updateSandboxConfig(key, value);
      setModifiedConfigs(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast({ title: "SYNC_SUCCESS", description: `KERNEL_PARAM [${key}] SYNCHRONIZED.` });
    } catch (error) {
      toast({ variant: "destructive", title: "SYNC_FAULT", description: `Failed to commit [${key}] to kernel.` });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <Database className="w-12 h-12 text-primary animate-spin" />
          <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
        </div>
        <span className="text-[10px] font-mono font-black text-primary uppercase tracking-[0.8em] animate-pulse">Establishing_Hypervisor_Link...</span>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full flex flex-col p-10 space-y-10 bg-transparent overflow-y-auto no-scrollbar font-mono relative"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.01] blur-[150px] pointer-events-none rounded-full" />

      {/* 🔴 HEADER HUB */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-start gap-8">
           <div className="w-20 h-20 bg-black border border-primary/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,245,255,0.1)] relative group">
              <FlaskConical className="w-10 h-10 text-primary transition-transform group-hover:rotate-12 duration-500" />
              <div className="absolute inset-0 border border-primary/40 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all" />
           </div>
           <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-[0.3em] uppercase text-white">Simulation_Kernel</h1>
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    <span className="text-[10px] font-black text-secondary tracking-widest uppercase">Hypervisor_Operational</span>
                 </div>
                 <div className="h-4 w-px bg-white/10" />
                 <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.4em]">Node_Instance: VIRTUAL_01</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-widest mb-1">Last_Downlink</span>
              <span className="text-xs font-mono text-white/40 uppercase tabular-nums font-black">{new Date().toLocaleTimeString()}</span>
           </div>
           <div className="h-10 w-px bg-white/5" />
           <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={fetchConfigs}
                disabled={isSyncing}
                className="h-14 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] font-black text-[10px] uppercase tracking-[0.4em] px-8 rounded-none transition-all active:scale-95 group"
              >
                <RefreshCw className={cn("h-4 w-4 mr-3 text-primary", isSyncing && "animate-spin")} />
                RE_SYNC
              </Button>
              <Button asChild className="h-14 bg-secondary text-black font-black text-[10px] uppercase tracking-[0.4em] px-8 rounded-none hover:shadow-[0_0_30px_rgba(0,245,255,0.3)] transition-all">
                <Link to="/aetherdesk/sandbox/pnl">
                  <BarChart3 className="w-4 h-4 mr-3" />
                  ANALYSIS_HUB
                </Link>
              </Button>
           </div>
        </div>
      </div>

      {/* 🟠 CONFIG MATRIX */}
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {Object.entries(configs || {}).map(([catKey, category], catIdx) => (
            <motion.div variants={item} key={catKey}>
               <AetherPanel variant="void" className="p-10 bg-black/40 border-white/5 relative group overflow-hidden hover:border-primary/20 transition-colors">
                  {/* Icon Watermark */}
                  <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none transform group-hover:scale-110 duration-1000">
                     <Cpu className="w-64 h-64 text-white" />
                  </div>

                  <div className="flex items-center gap-6 mb-12 pb-6 border-b border-white/5 relative z-10">
                     <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-primary" />
                     </div>
                     <div className="flex flex-col">
                        <h2 className="text-sm font-black font-mono uppercase tracking-[0.5em] text-white">{category.title}</h2>
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest mt-1">SUBSYSTEM_SEC_0{catIdx + 1}</span>
                     </div>
                  </div>

                  <div className="space-y-12 relative z-10">
                     {category.configs && Object.entries(category.configs).map(([key, config]) => (
                        <div key={key} className="space-y-4 group/item">
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-muted-foreground/40 group-hover/item:text-primary transition-colors">
                                    {key.toUpperCase()}
                                 </label>
                                 <p className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-widest italic font-medium">
                                    {config.description}
                                 </p>
                              </div>
                              {modifiedConfigs.has(key) && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 mb-1">
                                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                   <span className="text-[9px] font-black text-primary uppercase tracking-widest">Modified</span>
                                </motion.div>
                              )}
                           </div>

                           <div className="flex gap-4">
                              <div className="relative flex-1">
                                 <input
                                   type="text"
                                   value={config.value}
                                   onChange={(e) => handleUpdate(key, e.target.value)}
                                   className="w-full bg-white/[0.02] border border-white/5 p-4 font-mono text-xl text-white focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-all tracking-tight"
                                 />
                                 <div className="absolute right-0 top-0 h-full w-[1px] bg-primary/20 group-hover/item:bg-primary/60 transition-colors" />
                              </div>
                              <Button
                                disabled={!modifiedConfigs.has(key) || isSyncing}
                                onClick={() => handleSave(key)}
                                className={cn(
                                  "h-auto px-8 font-black text-[10px] uppercase tracking-[0.3em] transition-all rounded-none",
                                  modifiedConfigs.has(key)
                                    ? "bg-primary text-black hover:shadow-[0_0_20px_rgba(0,245,255,0.4)]"
                                    : "bg-white/[0.02] text-white/10 border border-white/5 cursor-not-allowed"
                                )}
                              >
                                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-3" />}
                                Sync
                              </Button>
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Visual Detail */}
                  <div className="mt-12 flex justify-end">
                     <div className="flex gap-1">
                        {Array.from({ length: 12 }).map((_, i) => (
                           <div key={i} className="w-1 h-3 bg-white/5 group-hover:bg-primary/10 transition-colors duration-700" style={{ transitionDelay: `${i * 50}ms` }} />
                        ))}
                     </div>
                  </div>
               </AetherPanel>
            </motion.div>
          ))}
       </div>

      {/* 🔴 FOOTER NOTES */}
      <motion.div variants={item}>
        <AetherPanel className="p-8 border-white/5 bg-white/[0.01] flex items-start gap-8 group">
           <div className="p-4 bg-white/5 border border-white/10 group-hover:border-primary/20 transition-colors">
              <Terminal className="w-6 h-6 text-muted-foreground/30 group-hover:text-primary transition-colors" />
           </div>
           <div className="space-y-4 flex-1">
              <div className="flex items-center gap-4">
                 <h4 className="text-[10px] font-black uppercase text-white tracking-[0.6em]">System_Hypervisor_Directive</h4>
                 <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest leading-loose italic">
                 ALL_CONFIGURATION_MODIFICATIONS_RESULT_IN_IMMEDIATE_APPLICATION_STATE_MUTATION.
                 THE_SIMULATION_ENVIRONMENT_IS_STRICTLY_ISOLATED_FROM_LIVE_MARKET_BROKERAGES.
                 ENSURE_THROUGH_AUDIT_OF_LATENCY_EMULATION_VECTORS_BEFORE_STRESS_TESTING_KERNELS.
              </p>
              <div className="pt-2 w-full max-w-sm">
                 <TelemetryOscilloscope height={30} data={[10, 15, 12, 25, 30, 20, 15, 18, 22, 10]} color="#00F5FF" />
              </div>
           </div>
           <div className="flex flex-col items-end gap-2 pr-4 opacity-20">
              <span className="text-[8px] font-black uppercase tracking-widest">Protocol: AD-X-204</span>
              <span className="text-[8px] font-black uppercase tracking-widest">Kernel: 4.4.0-Aether</span>
           </div>
        </AetherPanel>
      </motion.div>
    </motion.div>
  );
};
