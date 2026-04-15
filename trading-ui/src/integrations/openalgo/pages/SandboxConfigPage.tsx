import React, { useEffect, useState } from 'react';
import { Settings, Save, RotateCcw, Box, Sliders, ShieldAlert, BadgeInfo, Terminal, BarChart3 } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAppModeStore } from '@/stores/appModeStore';

interface ConfigItem {
  value: string;
  description: string;
}

interface ConfigCategory {
  title: string;
  configs: Record<string, ConfigItem>;
}

type Configs = Record<string, ConfigCategory>;

export const SandboxConfigPage: React.FC = () => {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
   const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
   const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
   const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const [configs, setConfigs] = useState<Configs>({});
  const [modifiedConfigs, setModifiedConfigs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchConfigs = async () => {
    try {
      const data = await tradingService.getSandboxConfigs();
      if (data.status === 'success') {
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('Failed to load sandbox configs', error);
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
    } catch (error) {
      console.error('Failed to save config', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('SYSTEM_RESET_CONFIRMATION: THIS_WILL_PURGE_ALL_SIMULATION_DATA. PROCEDE?')) return;
    setIsSyncing(true);
    try {
      await tradingService.resetSandbox();
      fetchConfigs();
    } catch (error) {
      console.error('Reset failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center opacity-20">
        <Box className={cn("w-10 h-10 animate-pulse", primaryColorClass)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Settings className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Sandbox_Hypervisor_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Sliders className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">SIMULATION_STATION // HYPER_PARAM_AUDIT</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={fetchConfigs} 
            disabled={isSyncing}
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            <RotateCcw className={cn("h-3.5 w-3.5 mr-2", isSyncing && "animate-spin")} /> 
            RE_SET_ENV
          </Button>
          <Button asChild variant="outline" className="h-10 border-border/10 font-mono text-[10px] uppercase tracking-widest bg-background/40">
            <Link to="/openalgo/sandbox/pnl">
              <BarChart3 className="w-4 h-4 mr-2" />
              VIEW_RESULTS
            </Link>
          </Button>
        </div>
      </div>

       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {Object.entries(configs).map(([catKey, category]) => (
           <AetherPanel key={catKey} className="border-border/10 bg-background/20">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/10">
                 <div className={cn("p-1.5 border", isAD ? "bg-primary/10 border-primary/20" : "bg-teal-500/10 border-teal-500/20")}>
                    <Settings className={cn("w-3.5 h-3.5", primaryColorClass)} />
                 </div>
                 <h2 className="text-xs font-black font-mono uppercase tracking-[0.2em] text-foreground">{category.title}</h2>
              </div>

               <div className="grid grid-cols-1 gap-8">
                  {Object.entries(category.configs).map(([key, config]) => (
                    <div key={key} className="space-y-3 group">
                        <div className="flex justify-between items-center">
                           <Label className={cn("text-[10px] font-mono font-black uppercase tracking-widest text-muted-foreground transition-colors", isAD ? "group-hover:text-primary" : "group-hover:text-teal-500")}>
                              {key.replace(/_/g, ' ')}
                           </Label>
                           {modifiedConfigs.has(key) && (
                             <BadgeInfo className={cn("w-3.5 h-3.5 animate-pulse", isAD ? "text-primary" : "text-teal-500")} />
                           )}
                        </div>

                       <div className="flex gap-2">
                           <div className="relative flex-1">
                              <input 
                                type="text"
                                value={config.value}
                                onChange={(e) => handleUpdate(key, e.target.value)}
                                className={cn("w-full bg-background/60 border border-border/10 p-3 font-mono text-[11px] text-foreground focus:outline-none transition-all", isAD ? "focus:border-primary/40" : "focus:border-teal-500/40")}
                              />
                              <div className={cn("absolute right-0 top-0 h-full w-[1px] transition-colors", isAD ? "bg-primary/20 group-hover:bg-primary/50" : "bg-teal-500/20 group-hover:bg-teal-500/50")} />
                           </div>
                                                    <Button 
                             disabled={!modifiedConfigs.has(key) || isSyncing}
                             onClick={() => handleSave(key)}
                             className={cn(
                               "h-12 px-4 font-mono text-[10px] uppercase tracking-widest transition-all",
                               modifiedConfigs.has(key) 
                                 ? (isAD ? "bg-primary text-black" : "bg-teal-500 text-black") 
                                 : "bg-background/40 text-muted-foreground/30 border border-border/10"
                             )}
                           >
                             <Save className="w-4 h-4 mr-2" />
                             Sync
                          </Button>
                       </div>
                       
                       <p className="text-[9px] font-mono text-muted-foreground/40 uppercase leading-relaxed tracking-wider ml-1">
                          {config.description}
                       </p>
                    </div>
                  ))}
               </div>
            </AetherPanel>
          ))}
       </div>

        <div className="mt-12 p-6 border border-border/10 bg-background/40 flex items-center gap-6">
           <Terminal className={cn("w-5 h-5", primaryColorClass, "opacity-20")} />
           <div className="flex-1 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-relaxed italic">
              HYPERVISOR_NOTES: ALL_CONFIGURATION_MODIFICATIONS_RESULT_IN_IMMEDIATE_APPLICATION_STATE_MUTATION. 
              ENVIRONMENT_IS_STRICTLY_ISOLATED_FROM_LIVE_MARKET_BROKERAGES.
           </div>
        </div>
    </div>
  );
};
