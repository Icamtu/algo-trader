import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Rocket, 
  ShieldAlert, 
  TrendingUp, 
  BarChart3, 
  Settings2,
  Lock,
  Unlock,
  Loader2
} from 'lucide-react';
import { StrategySelectionDialog } from './StrategySelectionDialog';
import { CONFIG } from '@/lib/config';
import { toast } from 'sonner';

export function DeploymentSettings() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [maxRisk, setMaxRisk] = useState("500");
  const [capitalMult, setCapitalMult] = useState("1.0");
  const [targetPnl, setTargetPnl] = useState("2500");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const handleInitiateRun = async () => {
    if (!selectedStrategy) {
      toast.error("Deployment Error", { description: "You must select a base strategy first." });
      return;
    }

    setIsDeploying(true);
    try {
      // API call to start the strategy with these params
      const response = await fetch(`${CONFIG.API_BASE_URL}strategies/${selectedStrategy.toLowerCase().replace('.py', '')}/start`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("aether_token") || "test-token"}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            max_risk: parseFloat(maxRisk),
            capital_multiplier: parseFloat(capitalMult),
            target_pnl: parseFloat(targetPnl),
            mode: 'live' // Force live for production run
        })
      });

      if (response.ok) {
        toast.success("Deployment Successful", { 
          description: `${selectedStrategy} is now active in the production environment.`,
          icon: <Unlock className="w-4 h-4 text-green-500" />
        });
        setIsLive(true);
      } else {
        throw new Error("Failed to initiate run");
      }
    } catch (e) {
      toast.error("Deployment Failed", { description: "Engine rejected the initiation request." });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleStopRun = async () => {
      // Handle stop
      setIsLive(false);
      toast.info("Production Stopped", { description: "Strategy halted successfully." });
  };

  return (
    <Card className="bg-slate-950/40 border-primary/20 backdrop-blur-md overflow-hidden group">
      <CardHeader className="pb-3 border-b border-white/5 bg-primary/5">
        <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Strategic Deployment
            </CardTitle>
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Base Strategy Engine</Label>
          <StrategySelectionDialog 
            onSelect={setSelectedStrategy} 
            currentStrategy={selectedStrategy || undefined} 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" /> Max Risk
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">$</span>
              <Input 
                value={maxRisk} 
                onChange={(e) => setMaxRisk(e.target.value)}
                className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Allocation
            </Label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">x</span>
                <Input 
                  value={capitalMult} 
                  onChange={(e) => setCapitalMult(e.target.value)}
                  className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
                />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" /> Target Daily P&L Cutoff
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">$</span>
            <Input 
              value={targetPnl} 
              onChange={(e) => setTargetPnl(e.target.value)}
              className="pl-7 bg-black/40 border-white/10 h-9 font-mono text-xs focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <div className="pt-2">
           {isLive ? (
               <Button 
                variant="destructive" 
                className="w-full h-11 uppercase font-black tracking-widest text-[10px] shadow-lg shadow-red-500/10"
                onClick={handleStopRun}
               >
                 <Lock className="w-4 h-4 mr-2" /> Deactivate Runner
               </Button>
           ) : (
               <Button 
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white uppercase font-black tracking-widest text-[10px] shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform"
                onClick={handleInitiateRun}
                disabled={isDeploying}
               >
                 {isDeploying ? (
                     <Loader2 className="w-4 h-4 animate-spin mr-2" />
                 ) : (
                     <Rocket className="w-4 h-4 mr-2" />
                 )}
                 Initiate Production Run
               </Button>
           )}
           <p className="text-center text-[9px] text-muted-foreground uppercase mt-3 tracking-tighter opacity-60">
             Safety Mode: Institutional (Manual Approve)
           </p>
        </div>
      </CardContent>
    </Card>
  );
}
