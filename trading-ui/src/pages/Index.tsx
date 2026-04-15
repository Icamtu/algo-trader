import { useState } from "react";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { StrategySidebar } from "@/components/trading/StrategySidebar";
import { AnalyticsPanel } from "@/components/trading/AnalyticsPanel";
import { LiveBlotter } from "@/components/trading/LiveBlotter";
import { AICopilotOrb } from "@/components/trading/AICopilotOrb";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { MarketNavbar } from "@/components/trading/MarketNavbar";

const Index = () => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid selection:bg-primary/30">
      <div className="scanline" />
      <GlobalHeader />

      <MarketNavbar activeTab="/" />

      <div className="flex-1 flex min-h-0">
        <StrategySidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex min-h-0">
            <AnalyticsPanel />
          </div>
          <LiveBlotter onTradeClick={handleTradeClick} />
        </div>
        <RightPanel />
      </div>

      <AICopilotOrb />
      
      <NewOrderModal 
        isOpen={orderModalOpen} 
        onClose={() => setOrderModalOpen(false)} 
        prefilledSymbol={prefilledSymbol}
      />
    </div>
  );
};

export default Index;
