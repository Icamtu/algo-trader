import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Shield, Palette, Cpu, Grid, Monitor, Sliders, Save, Terminal } from "lucide-react";
import { BrokerManagementPanel } from "./BrokerManagementPanel";
import { useTerminalSettings } from "@/contexts/TerminalSettingsContext";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function UnifiedSettings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useTerminalSettings();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden glass-panel border-primary/20">
        <DialogHeader className="p-6 pb-2 border-b border-border bg-card/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black tracking-[0.3em] uppercase">Terminal_Central_Config</DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                Unified system architecture & visual telemetry management
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="brokers" className="p-0 h-[600px] flex">
          <TabsList className="flex flex-col h-full w-48 bg-card/20 border-r border-border rounded-none p-2 gap-1">
            <TabsTrigger 
              value="brokers" 
              className="w-full justify-start gap-3 h-10 px-4 text-[10px] font-black tracking-widest uppercase transition-all data-[state=active]:bg-primary data-[state=active]:text-black"
            >
              <Shield className="w-3.5 h-3.5" />
              Connectivity
            </TabsTrigger>
            <TabsTrigger 
              value="visuals" 
              className="w-full justify-start gap-3 h-10 px-4 text-[10px] font-black tracking-widest uppercase transition-all data-[state=active]:bg-primary data-[state=active]:text-black"
            >
              <Palette className="w-3.5 h-3.5" />
              Aesthetics
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className="w-full justify-start gap-3 h-10 px-4 text-[10px] font-black tracking-widest uppercase transition-all data-[state=active]:bg-primary data-[state=active]:text-black"
            >
              <Cpu className="w-3.5 h-3.5" />
              Engineering
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="brokers" className="m-0 p-6 h-full border-none">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <Terminal className="w-4 h-4 text-primary" />
                  <h3 className="text-[11px] font-black tracking-[0.2em] uppercase">Broker_Node_Gateways</h3>
                </div>
                {/* Embed the modified Broker panel content here or call the component */}
                <BrokerManagementPanel isEmbedded={true} />
              </div>
            </TabsContent>

            <TabsContent value="visuals" className="m-0 p-8 space-y-8 h-full border-none bg-background/20">
              <div className="space-y-8 max-w-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Grid_Density</Label>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 leading-none py-1 border border-primary/20">{settings.gridOpacity}%</span>
                  </div>
                  <Slider 
                    value={[settings.gridOpacity]} 
                    max={10} 
                    step={1} 
                    onValueChange={([val]) => updateSettings({ gridOpacity: val })}
                    className="cursor-pointer"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Atmospheric_Noise</Label>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 leading-none py-1 border border-primary/20">{settings.noiseOpacity}%</span>
                  </div>
                  <Slider 
                    value={[settings.noiseOpacity]} 
                    max={10} 
                    step={1} 
                    onValueChange={([val]) => updateSettings({ noiseOpacity: val })}
                    className="cursor-pointer"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Scanline_Intensity</Label>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 leading-none py-1 border border-primary/20">{settings.scanlineIntensity}%</span>
                  </div>
                  <Slider 
                    value={[settings.scanlineIntensity]} 
                    max={40} 
                    step={1} 
                    onValueChange={([val]) => updateSettings({ scanlineIntensity: val })}
                    className="cursor-pointer"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <Label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-4 block">System_Accent_Color</Label>
                  <RadioGroup 
                    value={settings.accentColor} 
                    onValueChange={(val: any) => updateSettings({ accentColor: val })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="amber" id="amber" className="border-primary" />
                      <Label htmlFor="amber" className="text-[9px] font-bold tracking-widest uppercase cursor-pointer">Industrial_Amber</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="teal" id="teal" className="border-secondary" />
                      <Label htmlFor="teal" className="text-[9px] font-bold tracking-widest uppercase cursor-pointer">Oceanic_Teal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="crimson" id="crimson" className="border-destructive" />
                      <Label htmlFor="crimson" className="text-[9px] font-bold tracking-widest uppercase cursor-pointer">Combat_Crimson</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="system" className="m-0 p-8 space-y-6 h-full border-none">
              <div className="bg-destructive/5 border border-destructive/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-destructive">Critical_Notice</span>
                </div>
                <p className="text-[9px] text-destructive/80 leading-relaxed tracking-wide">
                  SYSTEM ENGINEERING CHANGES TAKE IMMEDIATE EFFECT. ENSURE ENGINE CONNECTIVITY BEFORE MODIFYING EXECUTION PARAMETERS.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-card/20 border border-border space-y-2 hover:border-primary/20 transition-all">
                  <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Health_Poll_Interval</div>
                  <div className="text-lg font-mono font-bold">5000<span className="text-[10px] text-muted-foreground lowercase ml-1">ms</span></div>
                </div>
                <div className="p-4 bg-card/20 border border-border space-y-2 hover:border-primary/20 transition-all">
                  <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Latency_Threshold</div>
                  <div className="text-lg font-mono font-bold">150<span className="text-[10px] text-muted-foreground lowercase ml-1">ms</span></div>
                </div>
              </div>

              <button className="flex items-center justify-center gap-2 w-full mt-8 h-10 bg-primary text-black font-black font-mono text-[10px] uppercase tracking-[0.3em] hover:brightness-110 transition-all">
                <Save className="w-4 h-4" />
                Commit_Global_Changes
              </button>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
