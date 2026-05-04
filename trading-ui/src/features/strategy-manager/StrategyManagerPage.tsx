import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/aetherdesk/api/client";
import { StrategyLibrary } from "./components/StrategyLibrary";
import { StrategyControlBoard } from "./components/StrategyControlBoard";
import { StrategyPerformance } from "./components/StrategyPerformance";
import { LiveOrdersPanel } from "./components/LiveOrdersPanel";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ShieldCheck, Cpu, Terminal, LayoutDashboard, Settings, Globe } from "lucide-react";

const StrategyManagerPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch strategies here to share with children for better sync
  const { data: strategiesData } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => algoApi.getStrategies(),
    refetchInterval: 5000,
  });

  const strategies = Array.isArray(strategiesData?.data?.strategies)
    ? strategiesData.data.strategies
    : (Array.isArray(strategiesData?.strategies) ? strategiesData.strategies : []);
  const selectedStrategy = strategies.find((s: any) => s.id === selectedId);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative selection:bg-primary/30">
      {/* Neural Background Aesthetics */}
      <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none z-0" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2 z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-error/5 blur-[100px] rounded-full pointer-events-none -translate-x-1/2 translate-y-1/2 z-0" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] z-0" />
      <div className="absolute inset-0 pointer-events-none scanline-overlay opacity-20 z-0" />

      <div className="flex-1 flex overflow-hidden p-2 gap-2 relative z-10 min-h-0">
        {/* Panel A: Strategy Library */}
        <section className="w-1/4 flex flex-col min-w-0">
          <StrategyLibrary
            selectedId={selectedId}
            onSelect={(s) => setSelectedId(s.id)}
            strategies={strategiesData?.strategies}
          />
        </section>

        {/* Panel B: Active Strategy Control */}
        <section className="w-2/5 flex flex-col min-w-0">
          <StrategyControlBoard strategy={selectedStrategy} />
        </section>

        {/* Panel C: Performance Dashboard */}
        <section className="flex-1 flex flex-col min-w-0">
          <StrategyPerformance
            strategyId={selectedId}
            capitalAllocation={selectedStrategy?.params?.capital}
          />
        </section>
      </div>

      {/* Bottom Panel: Live Order Table */}
      <section className="h-56 shrink-0 relative z-20">
        <LiveOrdersPanel strategyId={selectedId} />
      </section>
    </div>
  );
};

export default StrategyManagerPage;
