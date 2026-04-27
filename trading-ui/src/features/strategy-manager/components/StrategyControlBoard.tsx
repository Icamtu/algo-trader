import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Play, Square, Pause, Save, RotateCcw, AlertTriangle, Cpu, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyControlBoardProps {
  strategy: any;
}

export const StrategyControlBoard: React.FC<StrategyControlBoardProps> = ({ strategy }) => {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<Record<string, any>>(strategy.params || {});

  const activateMutation = useMutation({
    mutationFn: () => algoApi.activateStrategy(strategy.id),
    onSuccess: () => {
      toast.success(`Strategy ${strategy.name} Activated`);
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (err: any) => toast.error(`Activation Failed: ${err.message}`),
  });

  const stopMutation = useMutation({
    mutationFn: (squareOff: boolean) => algoApi.stopStrategy(strategy.id, squareOff),
    onSuccess: () => {
      toast.success(`Strategy ${strategy.name} Halted`);
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (err: any) => toast.error(`Halt Failed: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: () => algoApi.updateStrategyParams(strategy.id, params),
    onSuccess: () => toast.success("Configuration Persisted"),
    onError: (err: any) => toast.error(`Update Failed: ${err.message}`),
  });

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  if (!strategy) return (
    <div className="h-full flex items-center justify-center text-muted-foreground/30 font-mono text-[10px] uppercase tracking-widest bg-black/20">
      SELECT_STRATEGY_FOR_CONTROL
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-primary/10 border border-primary/20">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{strategy.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("text-[9px] uppercase font-mono", strategy.is_active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30")}>
                {strategy.is_active ? "RUNNING" : "HALTED"}
              </Badge>
              <span className="text-[9px] font-mono text-muted-foreground opacity-50">ID: {strategy.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!strategy.is_active ? (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-widest text-[10px]"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              <Play className="w-3 h-3 mr-2" />
              Activate_Engine
            </Button>
          ) : (
            <div className="flex items-center gap-2">
               <Button
                size="sm"
                variant="outline"
                className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-black uppercase tracking-widest text-[10px]"
                onClick={() => stopMutation.mutate(false)}
                disabled={stopMutation.isPending}
              >
                <Pause className="w-3 h-3 mr-2" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="font-black uppercase tracking-widest text-[10px]"
                onClick={() => stopMutation.mutate(true)}
                disabled={stopMutation.isPending}
              >
                <Square className="w-3 h-3 mr-2" />
                Stop & Square
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Grid */}
      <Card className="bg-slate-950/40 border-white/5 backdrop-blur-md">
        <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            <CardTitle className="text-[10px] uppercase font-black tracking-widest opacity-60">Runtime_Parameters</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 gap-4">
          {Object.entries(params).map(([key, value]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">{key.replace(/_/g, ' ')}</Label>
              <Input
                className="h-8 bg-black/40 border-white/5 focus:border-primary/50 text-[11px] font-mono"
                value={String(value)}
                onChange={(e) => handleParamChange(key, e.target.value)}
              />
            </div>
          ))}
          {Object.keys(params).length === 0 && (
             <div className="col-span-2 py-8 flex flex-col items-center justify-center text-muted-foreground/20 italic text-[10px]">
                No dynamic parameters detected
             </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Section */}
      <div className="mt-auto p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <div>
            <span className="text-[10px] font-black uppercase text-red-500 tracking-widest block">System_Panic_Trigger</span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-tighter">Liquidates all positions immediately</span>
          </div>
        </div>
        <Button size="sm" variant="destructive" className="h-7 px-3 text-[9px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          PANIC_STOP
        </Button>
      </div>
    </div>
  );
};
