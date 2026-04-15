import React from "react";
import type { LucideIcon } from "lucide-react";
import { 
  BarChart3, Shield, Search, Briefcase, 
  BookOpen, Server, Bell, GitBranch, Terminal,
  LayoutDashboard, TrendingUp, Globe, Cpu
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
      className={`flex items-center gap-2 px-4 h-full text-[10px] font-black uppercase tracking-[0.25em] transition-all relative group border-r border-border/10 ${
        active
          ? "text-primary bg-primary/5 shadow-[inset_0_0_20px_rgba(255,176,0,0.05)]"
          : "text-muted-foreground/40 hover:text-foreground hover:bg-white/5"
      }`}
    >
      <Icon className={`w-3 h-3 transition-all duration-300 ${active ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(255,176,0,0.5)]" : "text-muted-foreground/30 group-hover:text-foreground"}`} />
      <span className="font-mono tracking-widest leading-none">{label}</span>
      
      {active && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_15px_rgba(255,176,0,0.8)] z-10" />
          <motion.div 
            layoutId="nav-active-bg"
            className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" 
          />
        </>
      )}
      
      {/* Corner accents */}
      {active && (
        <div className="absolute top-0 right-0 w-1 h-1 bg-primary/40" />
      )}
    </Link>
  );
}

interface MarketNavbarProps {
  activeTab: string;
}

export function MarketNavbar({ activeTab }: MarketNavbarProps) {
  return (
    <nav className="h-10 flex items-center bg-background border-b border-border overflow-x-auto custom-scrollbar z-40 sticky top-12 industrial-grid">
      <div className="scanline opacity-5" />
      <div className="flex items-center h-full border-l border-border/10">
        <NavTab to="/" icon={BarChart3} label="Trading_Desk" active={activeTab === "/"} />
        <NavTab to="/strategy-lab" icon={GitBranch} label="Strategy_Lab" active={activeTab === "/strategy-lab"} />
        <NavTab to="/risk" icon={Shield} label="Risk_Analysis" active={activeTab === "/risk"} />
        <NavTab to="/scanner" icon={Search} label="Scanning_Array" active={activeTab === "/scanner"} />
        <NavTab to="/portfolio" icon={Briefcase} label="Asset_Vault" active={activeTab === "/portfolio"} />
        <NavTab to="/openalgo" icon={Cpu} label="Agent_Array" active={activeTab === "/openalgo"} />
        <NavTab to="/journal" icon={BookOpen} label="Registry" active={activeTab === "/journal"} />
        <NavTab to="/terminal" icon={Terminal} label="Expert_IO" active={activeTab === "/terminal"} />
        <NavTab to="/charting" icon={TrendingUp} label="Visual_Core" active={activeTab === "/charting"} />
        <NavTab to="/infrastructure" icon={Server} label="Nodes" active={activeTab === "/infrastructure"} />
        <NavTab to="/brokers" icon={Globe} label="Hub" active={activeTab === "/brokers"} />
        <NavTab to="/alerts" icon={Bell} label="Signals" active={activeTab === "/alerts"} />
      </div>
      
      <div className="flex-1 h-full border-l border-border/10 flex items-center justify-end px-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-[8px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Module_Sync_Active</span>
        </div>
      </div>
    </nav>
  );
}


