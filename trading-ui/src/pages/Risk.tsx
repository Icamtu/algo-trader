import { useState } from "react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { RiskDashboard } from "@/components/trading/RiskDashboard";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { Shield, ShieldAlert, Activity } from "lucide-react";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";

export default function Risk() {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/risk" />

      {/* Kernel Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 pb-0 z-10">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <Shield className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Risk_Shield_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">CORE_GUARDRAIL // SYSTEM_ARMED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn("px-4 py-1 border font-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-2", accentBorderClass, accentBgClass, primaryColorClass)}>
            <ShieldAlert className="w-3.5 h-3.5" /> 
            PROD_LEVEL_ENFORCEMENT
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
        <RiskDashboard />
        <RightPanel />
      </div>

      <NewOrderModal 
        isOpen={orderModalOpen} 
        onClose={() => setOrderModalOpen(false)} 
        prefilledSymbol={prefilledSymbol} 
      />
    </div>
  );
}
