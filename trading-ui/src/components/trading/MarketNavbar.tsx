import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Shield, Search, Briefcase,
  BookOpen, Server, Bell, GitBranch, Terminal,
  LayoutDashboard, TrendingUp, Globe, Cpu, ClipboardList, LayoutGrid, Zap, ShieldCheck,
  Activity, Database, ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface NavUmbrellaProps {
  label: string;
  icon: LucideIcon;
  items: { to: string; icon: LucideIcon; label: string }[];
  active?: boolean;
}

function NavUmbrella({ label, icon: Icon, items, active }: NavUmbrellaProps) {
  const location = useLocation();
  const isAnyChildActive = items.some(item => location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to)));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 px-4 h-full text-[9.5px] font-black uppercase tracking-[0.2em] transition-all relative group border-r border-white/5 outline-none",
            isAnyChildActive
              ? "text-cyan-400 bg-cyan-400/[0.03]"
              : "text-muted-foreground/20 hover:text-foreground hover:bg-white/[0.02]"
          )}
        >
          <div className="relative">
            <Icon className={cn(
              "w-3 h-3 transition-all duration-300",
              isAnyChildActive ? "text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]" : "text-muted-foreground/10 group-hover:text-foreground/40"
            )} />
          </div>
          <span className={cn("font-mono tracking-widest leading-none translate-y-[0.5px]", isAnyChildActive ? "opacity-100" : "opacity-60")}>{label}</span>
          <ChevronDown className={cn("w-2.5 h-2.5 opacity-20 transition-transform group-hover:opacity-40", isAnyChildActive && "opacity-40")} />

          {isAnyChildActive && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-500/80 z-10" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-[#0A0A0A] border-white/5 shadow-2xl p-1 min-w-[180px]">
        {items.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
          return (
            <DropdownMenuItem key={item.to} asChild>
              <Link
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-widest transition-colors rounded-sm",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className={cn("w-3.5 h-3.5", isActive ? "text-cyan-400" : "text-slate-500")} />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketNavbar({ className }: { className?: string }) {
  const location = useLocation();

  const groups = [
    {
      label: "TERMINAL",
      icon: Terminal,
      items: [
        { to: "/execution/command-center", icon: Terminal, label: "Command_Center" },
        { to: "/openalgo/positions", icon: LayoutGrid, label: "Matrix" },
        { to: "/terminal", icon: Terminal, label: "IO_Expert" },
        { to: "/charting", icon: TrendingUp, label: "Visual" },
      ]
    },
    {
      label: "STRATEGY",
      icon: GitBranch,
      items: [
        { to: "/execution/registry", icon: Cpu, label: "Strategies" },
        { to: "/execution/command-center", icon: LayoutGrid, label: "Strategy_Management" },
        { to: "/strategy-lab", icon: GitBranch, label: "Strategy_Lab" },
        { to: "/intelligence", icon: Activity, label: "Intelligence" },
        { to: "/scanner", icon: Search, label: "Scanning_Node" },
        { to: "/alerts", icon: Bell, label: "Signals" },
      ]
    },
    {
      label: "REGISTRY",
      icon: ClipboardList,
      items: [
        { to: "/openalgo/orders", icon: ClipboardList, label: "Order_Log" },
        { to: "/openalgo/trades", icon: Zap, label: "Exec_Log" },
        { to: "/openalgo/holdings", icon: ShieldCheck, label: "Vault" },
        { to: "/journal", icon: BookOpen, label: "Ledger" },
      ]
    },
    {
      label: "SEC_OPS",
      icon: ShieldCheck,
      items: [
        { to: "/audit", icon: ShieldCheck, label: "Audit_Center" },
        { to: "/governance", icon: Server, label: "Governance" },
        { to: "/risk", icon: Shield, label: "Risk_Array" },
        { to: "/brokers", icon: Globe, label: "Hub" },
      ]
    }
  ];

  return (
    <nav className={cn(
      "h-9 flex items-center bg-[#070707] border-b border-white/5 z-40 sticky top-0 no-scrollbar items-stretch shrink-0",
      className
    )}>
      <div className="noise-overlay opacity-[0.015] pointer-events-none" />

      <div className="flex items-center h-full border-l border-white/5">
        <NavTab
          to="/"
          icon={LayoutDashboard}
          label="Dashboard"
          active={location.pathname === "/"}
        />

        {groups.map((group) => (
          <NavUmbrella
            key={group.label}
            label={group.label}
            icon={group.icon}
            items={group.items}
          />
        ))}
      </div>

      <div className="flex-1 h-full border-l border-white/5 flex items-center justify-end px-5 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[7px] font-mono font-black text-muted-foreground/10 uppercase tracking-[0.2em]">Umbrella_Sync</span>
            <span className="text-[8px] font-mono font-black text-secondary/40 uppercase tracking-[0.1em]">ACTIVE</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-secondary/20 animate-pulse border border-secondary/40" />
        </div>
      </div>
    </nav>
  );
}
