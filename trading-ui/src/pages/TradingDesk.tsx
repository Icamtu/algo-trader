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
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <GlobalHeader />

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 border-b border-border overflow-x-auto">
        <NavTab to="/" icon={BarChart3} label="Trading Desk" active={true} />
        <NavTab to="/strategy-lab" icon={GitBranch} label="Strategy Lab" />
        <NavTab to="/risk" icon={Shield} label="Risk Dashboard" />
        <NavTab to="/scanner" icon={Search} label="Market Scanner" />
        <NavTab to="/portfolio" icon={Briefcase} label="Portfolio" />
        <NavTab to="/journal" icon={BookOpen} label="Trade Journal" />
        <NavTab to="/infrastructure" icon={Server} label="Infrastructure" />
        <NavTab to="/alerts" icon={Bell} label="Alerts" />
      </div>

      {/* Page Sub-Tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 bg-background/50">
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeView === "trading" ? (
          <motion.div
            key="trading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex min-h-0"
          >
            <StrategySidebar />
            <div className="flex-1 flex flex-col min-w-0">
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
            transition={{ duration: 0.2 }}
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
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
        active
          ? "text-primary bg-primary/10 border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}