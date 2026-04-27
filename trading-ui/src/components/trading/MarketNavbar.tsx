import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Shield, Search, Briefcase,
  BookOpen, Server, Bell, GitBranch, Terminal,
  LayoutDashboard, TrendingUp, Globe, Cpu, ClipboardList, LayoutGrid, Zap, ShieldCheck,
  Activity, Database
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

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
      className={cn(
        "flex items-center gap-2.5 px-4 h-full text-[9.5px] font-black uppercase tracking-[0.2em] transition-all relative group border-r border-white/5",
        active
          ? "text-primary bg-primary/[0.03] shadow-[inset_0_0_20px_rgba(255,176,0,0.02)]"
          : "text-muted-foreground/20 hover:text-foreground hover:bg-white/[0.02]"
      )}
    >
      <div className="relative">
        <Icon className={cn(
          "w-3 h-3 transition-all duration-300",
          active ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(255,176,0,0.3)]" : "text-muted-foreground/10 group-hover:text-foreground/40"
        )} />
      </div>
      <span className={cn("font-mono tracking-widest leading-none translate-y-[0.5px]", active ? "opacity-100" : "opacity-60")}>{label}</span>

      {active && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/80 z-10" />
          <motion.div
            layoutId="nav-active-bg"
            className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] to-transparent pointer-events-none"
          />
        </>
      )}
    </Link>
  );
}

interface MarketNavbarProps {
  activeTab?: string;
  className?: string;
}

export function MarketNavbar({ className }: MarketNavbarProps) {
  const location = useLocation();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/audit", icon: ShieldCheck, label: "Audit_Center" },
    { to: "/execution/registry", icon: Cpu, label: "Strategies" },
    { to: "/intelligence", icon: Activity, label: "Intelligence" },
    { to: "/governance", icon: Server, label: "Governance" },
    { to: "/strategy-lab", icon: GitBranch, label: "Strategy_Lab" },
    { to: "/risk", icon: Shield, label: "Risk_Array" },
    { to: "/scanner", icon: Search, label: "Scanning_Node" },
    { to: "/openalgo/orders", icon: ClipboardList, label: "Order_Log" },
    { to: "/openalgo/positions", icon: LayoutGrid, label: "Matrix" },
    { to: "/openalgo/trades", icon: Zap, label: "Exec_Log" },
    { to: "/openalgo/holdings", icon: ShieldCheck, label: "Vault" },
    { to: "/journal", icon: BookOpen, label: "Ledger" },
    { to: "/terminal", icon: Terminal, label: "IO_Expert" },
    { to: "/charting", icon: TrendingUp, label: "Visual" },
    { to: "/brokers", icon: Globe, label: "Hub" },
    { to: "/alerts", icon: Bell, label: "Signals" },
  ];

  return (
    <nav className={cn(
      "h-9 flex items-center bg-[#070707] border-b border-white/5 overflow-x-auto custom-scrollbar z-40 sticky top-0 no-scrollbar items-stretch",
      className
    )}>
      <div className="noise-overlay opacity-[0.015] pointer-events-none" />
      <div className="flex items-center h-full border-l border-white/5">
        {navItems.map((item) => (
          <NavTab
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            active={location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))}
          />
        ))}
      </div>

      <div className="flex-1 h-full border-l border-white/5 flex items-center justify-end px-5 bg-black/40">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase tracking-[0.2em]">Module_Sync</span>
            <span className="text-[8px] font-mono font-black text-secondary/40 uppercase tracking-[0.1em]">ACTIVE</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-secondary/20 animate-pulse border border-secondary/40" />
        </div>
      </div>
    </nav>
  );
}
