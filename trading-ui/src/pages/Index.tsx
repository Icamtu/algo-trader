import { useState, useEffect } from "react";
import { StrategySidebar } from "@/components/trading/StrategySidebar";
import { AnalyticsPanel } from "@/components/trading/AnalyticsPanel";
import { LiveBlotter } from "@/components/trading/LiveBlotter";
import { AICopilotOrb } from "@/components/trading/AICopilotOrb";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { SectorSentimentStrip } from "@/components/trading/SectorSentimentStrip";
import { useWebSocket } from "@/hooks/useWebSocket";

const Index = () => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const [sectorSentiments, setSectorSentiments] = useState<Record<string, any>>({});

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage?.type === "sector_update") {
      setSectorSentiments(prev => ({
        ...prev,
        [lastMessage.payload.sector]: lastMessage.payload
      }));
    }
  }, [lastMessage]);

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background selection:bg-primary/30">
      <div className="scanline" />
      <SectorSentimentStrip sentiments={sectorSentiments} />

      <div className="flex-1 flex min-h-0">
        <StrategySidebar />
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
          <div className="p-8 space-y-6">
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
