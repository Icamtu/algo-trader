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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "n") {
        setOrderModalOpen(true);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="min-h-full flex flex-col bg-background selection:bg-primary/30">
      <div className="scanline" />
      <SectorSentimentStrip sentiments={sectorSentiments} />

      <div className="flex-1 flex min-h-0">
        <StrategySidebar />
        <div className="min-h-full flex flex-col bg-background relative">
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
