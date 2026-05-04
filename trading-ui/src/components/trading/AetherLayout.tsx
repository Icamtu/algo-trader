import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { GlobalHeader } from "./GlobalHeader";
import { MarketNavbar } from "./MarketNavbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Zap,
  LayoutGrid,
  ShieldCheck,
  History,
  LayoutDashboard,
  PlayCircle,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAppModeStore } from "@/stores/appModeStore";

const subTabs = [
  { to: "/aetherdesk", icon: LayoutDashboard, label: "Hub_Index" },
  { to: "/aetherdesk/orders", icon: ClipboardList, label: "Orders" },
  { to: "/aetherdesk/trades", icon: Zap, label: "Trades" },
  { to: "/aetherdesk/positions", icon: LayoutGrid, label: "Positions" },
  { to: "/aetherdesk/holdings", icon: ShieldCheck, label: "Holdings" },
  { to: "/aetherdesk/action-center", icon: PlayCircle, label: "Action_Center" },
  { to: "/aetherdesk/analyzer", icon: Activity, label: "Analyzer" },
  { to: "/aetherdesk/logs", icon: History, label: "System_Log" },
];

export function AetherLayout() {
  const location = useLocation();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const accentColor = isAD ? "text-primary" : "text-teal";
  const accentBg = isAD ? "bg-primary/5" : "bg-teal/5";
  const indicatorBg = isAD ? "bg-primary" : "bg-teal";

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Sub-Navbar for AetherDesk Feature Set */}
      <div className="h-9 flex items-center bg-black/40 border-b border-white/5 px-4 z-30 backdrop-blur-md">
        <div className="flex h-full">
          {subTabs.map((tab) => {
            const isActive = location.pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex items-center gap-2 px-4 h-full text-[9px] font-mono font-black uppercase tracking-widest transition-all relative border-r border-border/5 pro-max-glow ${
                  isActive ? cn(accentColor, accentBg) : "text-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <tab.icon className={`w-3 h-3 ${isActive ? accentColor : "text-muted-foreground/20"}`} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="sub-nav-active"
                    className={cn("absolute bottom-0 left-0 right-0 h-[2px] shadow-[0_0_10px_rgba(34,197,94,0.5)]", indicatorBg)}
                  />
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-[0.3em]">
          Agent_Array_v4.2 // Isolated_Module
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="h-full w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
