import React, { useState } from "react";
import { StrategyLibrary } from "./components/StrategyLibrary";
import { StrategyControlBoard } from "./components/StrategyControlBoard";
import { StrategyPerformance } from "./components/StrategyPerformance";
import { LiveOrdersPanel } from "./components/LiveOrdersPanel";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Shield, Zap, LayoutDashboard, Settings2, BarChart4 } from "lucide-react";

const StrategyManagerPage: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden relative selection:bg-primary/30">
      {/* Visual background elements */}
      <div className="absolute inset-0 noise-overlay opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header Bar */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <LayoutDashboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.4em] text-foreground">Aether_Command_Center</h1>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest opacity-60">System Version 6.0.4 // Multi-Broker Core</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Global_Status</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-green-500/80">CORE_SYNC_OK</span>
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/5 mx-2" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary opacity-50" />
            <span className="text-[10px] font-black uppercase text-primary tracking-tighter">Institutional_Grade</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex min-h-0 relative z-10">
        {/* Left Panel: Library */}
        <aside className="w-80 border-r border-white/5 flex flex-col bg-black/20">
          <StrategyLibrary
            selectedId={selectedStrategy?.id}
            onSelect={setSelectedStrategy}
          />
        </aside>

        {/* Center Panel: Control Board */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-950/40 overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Execution_Control_Board</span>
          </div>
          <StrategyControlBoard strategy={selectedStrategy} />
        </section>

        {/* Right Panel: Performance */}
        <aside className="w-96 border-l border-white/5 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
            <BarChart4 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Live_Analytics_Telemetry</span>
          </div>
          <StrategyPerformance strategyId={selectedStrategy?.id} />
        </aside>
      </main>

      {/* Bottom Panel: Live Orders */}
      <footer className="h-64 relative z-20">
        <LiveOrdersPanel strategyId={selectedStrategy?.id} />
      </footer>

      {/* Grid Overlay for aesthetic */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
};

export default StrategyManagerPage;
