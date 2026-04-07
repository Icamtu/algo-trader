import React from "react";
import type { LucideIcon } from "lucide-react";
import { 
  BarChart3, Shield, Search, Briefcase, 
  BookOpen, Server, Bell, GitBranch, Terminal,
  LayoutDashboard, TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface NavTabProps {
  to: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

function NavTab({ to, icon: Icon, label, active }: NavTabProps) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all relative group ${
        active
          ? "text-primary bg-primary/5 border-b-2 border-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 transition-transform duration-500 ${active ? "scale-110" : "group-hover:scale-110"}`} />
      {label}
      {active && (
        <motion.div 
          layoutId="activeTabLink"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
        />
      )}
    </Link>
  );
}

interface MarketNavbarProps {
  activeTab: string;
}

export function MarketNavbar({ activeTab }: MarketNavbarProps) {
  return (
    <nav className="flex items-center gap-1 px-4 pt-2 pb-0 border-b border-border/50 bg-background/40 backdrop-blur-md overflow-x-auto custom-scrollbar z-40 sticky top-12">
      <NavTab to="/" icon={BarChart3} label="Trading Desk" active={activeTab === "/"} />
      <NavTab to="/strategy-lab" icon={GitBranch} label="Strategy Lab" active={activeTab === "/strategy-lab"} />
      <NavTab to="/risk" icon={Shield} label="Risk Dashboard" active={activeTab === "/risk"} />
      <NavTab to="/scanner" icon={Search} label="Market Scanner" active={activeTab === "/scanner"} />
      <NavTab to="/portfolio" icon={Briefcase} label="Portfolio" active={activeTab === "/portfolio"} />
      <NavTab to="/journal" icon={BookOpen} label="Trade Journal" active={activeTab === "/journal"} />
      <NavTab to="/terminal" icon={Terminal} label="Expert Terminal" active={activeTab === "/terminal"} />
      <NavTab to="/charting" icon={TrendingUp} label="AI Charts" active={activeTab === "/charting"} />
      <NavTab to="/infrastructure" icon={Server} label="Infrastructure" active={activeTab === "/infrastructure"} />
      <NavTab to="/alerts" icon={Bell} label="Alerts" active={activeTab === "/alerts"} />
    </nav>
  );
}

