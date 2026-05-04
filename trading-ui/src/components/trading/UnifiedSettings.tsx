import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings, Shield, Palette, Cpu, Brain, Lock,
  Terminal, Activity, Monitor, Layers, Zap,
  Gauge, Boxes
} from "lucide-react";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { useTerminalSettings } from "@/contexts/TerminalSettingsContext";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

export function UnifiedSettings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useTerminalSettings();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:w-[420px] p-0 bg-black/95 border-l border-primary/20 industrial-grid overflow-hidden flex flex-col">
        <div className="scanline opacity-10" />

        <SheetHeader className="p-6 border-b border-white/10 bg-card/20 relative">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 border border-primary/20 relative group">
              <div className="absolute inset-0 bg-primary/20 blur-sm group-hover:blur-md transition-all" />
              <Settings className="w-6 h-6 text-primary animate-spin-slow relative z-10" />
            </div>
            <div>
              <SheetTitle className="text-[14px] font-black tracking-[0.4em] uppercase text-foreground">Terminal_Command</SheetTitle>
              <SheetDescription className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Architecture Sync Layer v2.5
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="engine" className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-black/40 border-b border-white/5 h-12 w-full rounded-none p-1 gap-1">
            <TabsTrigger value="engine" className="flex-1 text-[8px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black">
              <Cpu className="w-3.5 h-3.5 mr-2" />ENGINE
            </TabsTrigger>
            <TabsTrigger value="visuals" className="flex-1 text-[8px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black">
              <Palette className="w-3.5 h-3.5 mr-2" />GEAR
            </TabsTrigger>
            <TabsTrigger value="brokers" className="flex-1 text-[8px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black">
              <Shield className="w-3.5 h-3.5 mr-2" />CONN
            </TabsTrigger>
            <TabsTrigger value="intel" className="flex-1 text-[8px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black">
              <Brain className="w-3.5 h-3.5 mr-2" />NEURAL
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {/* Engine Select Tab */}
              <TabsContent value="engine" className="m-0 p-6 space-y-8">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4 border-l-4 border-primary pl-3">
                      <Monitor className="w-4 h-4 text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Core_Visualization_Engine</h3>
                    </div>

                    <RadioGroup
                      value={settings.chartEngine}
                      onValueChange={(val: any) => updateSettings({ chartEngine: val })}
                      className="grid grid-cols-1 gap-3"
                    >
                      {[
                        { id: 'recharts', label: 'RECHARTS // BALANCED', desc: 'Default system engine. Low resource usage.', icon: Gauge },
                        { id: 'lightweight', label: 'LIGHTWEIGHT // PERFORMANCE', desc: 'High-speed tick engine. Optimal for day trading.', icon: Zap },
                        { id: 'tradingview', label: 'TRADINGVIEW // ADVANCED', desc: 'Full institutional suite via external bridge.', icon: Boxes }
                      ].map((item) => (
                        <div
                          key={item.id}
                          className={`group p-4 border transition-all cursor-pointer relative overflow-hidden ${
                            settings.chartEngine === item.id
                              ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(255,176,0,0.1)]'
                              : 'bg-card/50 border-white/5 hover:border-white/20'
                          }`}
                          onClick={() => updateSettings({ chartEngine: item.id as any })}
                        >
                          <RadioGroupItem value={item.id} id={item.id} className="sr-only" />
                          <div className="flex items-center gap-4 relative z-10">
                            <item.icon className={`w-5 h-5 ${settings.chartEngine === item.id ? 'text-primary' : 'text-muted-foreground/40'}`} />
                            <div className="space-y-1">
                              <Label htmlFor={item.id} className="text-[10px] font-black uppercase tracking-widest block cursor-pointer">
                                {item.label}
                              </Label>
                              <p className="text-[8px] text-muted-foreground uppercase opacity-60 leading-tight">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                          {settings.chartEngine === item.id && (
                            <motion.div layoutId="engine-glow" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  </section>

                  <section className="space-y-6 mt-10">
                    <div className="flex items-center gap-2 mb-4 border-l-4 border-secondary pl-3">
                      <Activity className="w-4 h-4 text-secondary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Execution_Profile</h3>
                    </div>
                    <RadioGroup
                      value={settings.perfProfile}
                      onValueChange={(val: any) => updateSettings({ perfProfile: val })}
                      className="grid grid-cols-3 gap-2"
                    >
                      {['low', 'balanced', 'ultra'].map((p) => (
                        <div
                          key={p}
                          className={`p-3 border text-center transition-all cursor-pointer ${
                            settings.perfProfile === p ? 'bg-secondary/20 border-secondary' : 'bg-card/50 border-white/5'
                          }`}
                          onClick={() => updateSettings({ perfProfile: p as any })}
                        >
                          <RadioGroupItem value={p} id={p} className="sr-only" />
                          <Label htmlFor={p} className="text-[8px] font-black uppercase tracking-widest cursor-pointer">
                            {p}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </section>
                </motion.div>
              </TabsContent>

              {/* Visuals Tab */}
              <TabsContent value="visuals" className="m-0 p-6 space-y-8">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <section className="space-y-8">
                    <div className="flex items-center gap-2 mb-4 border-l-4 border-primary pl-3">
                      <Layers className="w-4 h-4 text-primary" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Optics_Config</h3>
                    </div>

                    {[
                      { key: 'gridOpacity', label: 'Grid_Density', icon: Gauge, max: 10 },
                      { key: 'noiseOpacity', label: 'ATMOS_Saturation', icon: Activity, max: 10 },
                      { key: 'scanlineIntensity', label: 'CRT_Interlace', icon: Terminal, max: 40 }
                    ].map((s) => (
                      <div key={s.key} className="space-y-4 p-4 bg-card/20 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <Label className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">{s.label}</Label>
                          </div>
                          <span className="text-[9px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">{(settings as any)[s.key]}%</span>
                        </div>
                        <Slider value={[(settings as any)[s.key]]} max={s.max} step={1} onValueChange={([val]) => updateSettings({ [s.key]: val })} />
                      </div>
                    ))}

                    <div className="flex items-center justify-between p-4 bg-card/20 border border-white/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-widest">Global_Watermark</Label>
                        <p className="text-[7px] text-muted-foreground uppercase">Show "AETHERDESK" on charts</p>
                      </div>
                      <Switch checked={settings.showWatermark} onCheckedChange={(val) => updateSettings({ showWatermark: val })} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-card/20 border border-white/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-widest">Telemetry_Glint</Label>
                        <p className="text-[7px] text-muted-foreground uppercase">Real-time update flashes</p>
                      </div>
                      <Switch checked={settings.enableGlint} onCheckedChange={(val) => updateSettings({ enableGlint: val })} />
                    </div>
                  </section>
                </motion.div>
              </TabsContent>

              <TabsContent value="brokers" className="m-0 p-4 space-y-4">
                <BrokerManagementPanel isEmbedded={true} />
              </TabsContent>

              <TabsContent value="intel" className="m-0 p-6 space-y-6">
                 {/* Existing intel content but styled cleaner */}
                 <div className="p-4 border border-primary/20 bg-primary/5 text-[10px] font-mono uppercase tracking-widest leading-relaxed">
                   NEURAL_STATE::SYNCED
                   <br/>
                   <span className="opacity-40 text-[8px]">LLM_MODEL: mistral-v0.3</span>
                 </div>
              </TabsContent>
            </AnimatePresence>
          </div>

          <div className="p-6 border-t border-white/10 bg-black/40 mt-auto">
            <button
              onClick={onClose}
              className="w-full h-12 bg-primary hover:bg-black hover:text-primary border border-primary transition-all flex items-center justify-center gap-3 text-black font-black font-mono tracking-[0.4em] uppercase shadow-[0_0_30px_rgba(255,176,0,0.1)]"
            >
              <Lock className="w-4 h-4" />
              STOW_AND_DEPLOY
            </button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
