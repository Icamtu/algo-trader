import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { StrategySidebar } from "@/components/trading/StrategySidebar";
import { BacktestCanvas } from "@/components/trading/BacktestCanvas";
import { AnalyticsPanel } from "@/components/trading/AnalyticsPanel";
import { LiveBlotter } from "@/components/trading/LiveBlotter";
import { AICopilotOrb } from "@/components/trading/AICopilotOrb";
import { RiskDashboard } from "@/components/trading/RiskDashboard";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { BarChart3, Shield, Settings, LineChart, Radar, Search, Briefcase, BookOpen, Server, Bell, GitBranch } from "lucide-react";

const views = [
  { id: "trading", label: "Trading Desk", icon: BarChart3 },
  { id: "risk", label: "Risk Dashboard", icon: Shield },
] as const;

const pageTabs = ["Backtest", "Walk-Forward", "Monte Carlo", "Optimize"] as const;

type PageTab = typeof pageTabs[number];

export default function TradingDesk() {
  const [activeView, setActiveView] = useState<typeof views[number]["id"]>("trading");
  const [activeTab, setActiveTab] = useState<PageTab>("Backtest");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />

      {/* Main Terminal Navigation */}
      <div className="flex items-center gap-0 border-b border-border bg-card/5 overflow-x-auto custom-scrollbar relative z-20">
        <NavTab to="/" icon={BarChart3} label="Console" active={true} />
        <NavTab to="/strategy-lab" icon={GitBranch} label="Lab" />
        <NavTab to="/risk" icon={Shield} label="Risk" />
        <NavTab to="/scanner" icon={Search} label="Scanner" />
        <NavTab to="/portfolio" icon={Briefcase} label="Vault" />
        <NavTab to="/infrastructure" icon={Server} label="Kernel" />
      </div>

      {/* Task Sub-Tabs */}
      <div className="flex items-center px-4 bg-background/80 border-b border-border/50 relative z-10">
        <div className="flex gap-4">
          {pageTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-1 text-[9px] font-mono font-black uppercase tracking-[0.2em] transition-all relative ${
                activeTab === tab
                  ? "text-secondary"
                  : "text-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeSubTab"
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-secondary shadow-[0_0_8px_rgba(0,212,212,0.4)]" 
                />
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
            <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">LTNCY::12ms</span>
            <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === "trading" ? (
          <motion.div
            key="trading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex min-h-0"
          >
            <StrategySidebar />
            <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
              <div className="flex-1 flex min-h-0">
                <BacktestCanvas />
                <AnalyticsPanel />
              </div>
              <LiveBlotter onTradeClick={handleTradeClick} />
            </div>
            <RightPanel />
          </motion.div>
        ) : (
          <motion.div
            key="risk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex min-h-0"
          >
            <StrategySidebar />
            <RiskDashboard />
            <RightPanel />
          </motion.div>
        )}
      </AnimatePresence>

      <AICopilotOrb />
      
      <NewOrderModal 
        isOpen={orderModalOpen} 
        onClose={() => setOrderModalOpen(false)} 
        prefilledSymbol={prefilledSymbol}
      />
    </div>
  );
}

function NavTab({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active?: boolean }) {
  return (
    <a
      href={to}
      className={`group relative flex items-center gap-2 px-4 py-2.5 transition-all border-r border-border/30 ${
        active
          ? "bg-primary/5 text-primary"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-card/5"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-primary'}`} />
      <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em]">
        {label}
      </span>
      {active && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
      )}
    </a>
  );
}