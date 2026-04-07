import { useState } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { RiskDashboard } from "@/components/trading/RiskDashboard";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { BarChart3, Shield, Search, Briefcase, BookOpen, Server, Bell, GitBranch } from "lucide-react";

export default function Risk() {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <GlobalHeader />
      <MarketNavbar activeTab="/risk" />

      <div className="flex-1 flex min-h-0 overflow-hidden">
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
