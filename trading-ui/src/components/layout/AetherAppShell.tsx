import { useState, memo, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { GlobalHeader } from "../trading/GlobalHeader";
import { MarketNavbar } from "../trading/MarketNavbar";
import { StatusFooter } from "./StatusFooter";
import { useAether } from "@/contexts/AetherContext";
import { useFunds } from "@/features/aetherdesk/hooks/useTrading";
import { IndustrialValue } from "../trading/IndustrialValue";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  ShieldAlert,
  Settings,
  Database,
  Activity,
  BarChart3,
  Cpu,
  Fingerprint,
  Beaker,
  Bell,
  BookOpen,
  ClipboardList,
  GitBranch,
  Globe,
  LayoutGrid,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Terminal,
  TrendingUp,
  Gauge,
  Wallet,
  Zap
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  collapsed: boolean;
}

const SidebarItem = ({ icon: Icon, label, to, collapsed }: SidebarItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(`${to}/`));

  return (
    <Link
      to={to}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-all duration-200 group relative min-h-[44px] border-b border-white/[0.02]",
        isActive
          ? "bg-primary/5 text-primary shadow-[inset_0_0_20px_rgba(0,245,255,0.03)]"
          : "text-white/90 hover:text-white hover:bg-white/[0.03]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 transition-transform duration-300", isActive && "scale-110 drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]")} />
      {!collapsed && <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">{label}</span>}
      {isActive && (
        <motion.div
          layoutId="active-sidebar-pill"
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary shadow-[4px_0_15px_rgba(0,245,255,0.4)]"
        />
      )}
      {collapsed && (
        <div className="absolute left-14 bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </Link>
  );
};

interface SidebarNavItem {
  icon: LucideIcon;
  label: string;
  to: string;
}

interface SidebarNavSection {
  label: string;
  items: SidebarNavItem[];
}

const sidebarSections: SidebarNavSection[] = [
  {
    label: "Command",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/" },
      { icon: Terminal, label: "Action_Center", to: "/aetherdesk/action-center" },
      { icon: TrendingUp, label: "Charting", to: "/charting" },
      { icon: Cpu, label: "Expert_Terminal", to: "/terminal" },
    ],
  },
  {
    label: "Execution",
    items: [
      { icon: Cpu, label: "Command_Center", to: "/execution/command-center" },
      { icon: Activity, label: "Strategy_Monitor", to: "/execution/registry" },
      { icon: GitBranch, label: "Strategy_Lab", to: "/strategy-lab" },
      { icon: Database, label: "Strategy_Registry", to: "/aetherdesk/strategy-registry" },
    ],
  },
  {
    label: "Market Intel",
    items: [
      { icon: Beaker, label: "Intelligence_Hub", to: "/intelligence" },
      { icon: Search, label: "Scanner", to: "/scanner" },
      { icon: Activity, label: "Regime", to: "/intelligence/regime" },
      { icon: BarChart3, label: "GEX_Analytics", to: "/intelligence/gex" },
      { icon: Database, label: "Historify", to: "/intelligence/historify" },
      { icon: Beaker, label: "Indicator_Factory", to: "/intelligence/indicator-factory" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { icon: LayoutGrid, label: "Positions", to: "/aetherdesk/positions" },
      { icon: ShieldCheck, label: "Holdings", to: "/aetherdesk/holdings" },
      { icon: ClipboardList, label: "Orders", to: "/aetherdesk/orders" },
      { icon: Zap, label: "Trades", to: "/aetherdesk/trades" },
      { icon: BarChart3, label: "PnL_Tracker", to: "/pnl-tracker" },
      { icon: BookOpen, label: "Trade_Journal", to: "/journal" },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: Shield, label: "Risk_Manager", to: "/risk" },
      { icon: Bell, label: "Alerts", to: "/alerts" },
      { icon: Server, label: "Governance", to: "/governance" },
      { icon: Activity, label: "Audit_Center", to: "/aetherdesk/audit" },
      { icon: Search, label: "Protocol_Analyzer", to: "/aetherdesk/analyzer" },
      { icon: Fingerprint, label: "Health_Monitor", to: "/aetherdesk/health" },
    ],
  },
  {
    label: "System",
    items: [
      { icon: Globe, label: "Brokers", to: "/brokers" },
      { icon: Database, label: "Contracts", to: "/aetherdesk/master-contract" },
      { icon: ShieldAlert, label: "Roles", to: "/roles" },
      { icon: Settings, label: "System_Prefs", to: "/profile" },
    ],
  },
];

const SidebarDivider = ({ label, count, collapsed }: { label: string; count: number; collapsed: boolean }) => (
  <div className="px-4 py-3 mt-2 mb-1 flex items-center gap-3">
    {!collapsed && (
      <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/40">{label}</span>
    )}
    {!collapsed && <span className="text-[7px] font-mono text-white/20">{count}</span>}
    <div className="flex-1 h-px bg-white/5" />
  </div>
);

export const AetherAppShell = memo(function AetherAppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("aether_sidebar_collapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const { telemetry, strategyMatrix } = useAether();
  const { data: fundsData } = useFunds();

  const totalCapital = fundsData?.margin_available ?? telemetry.equity ?? 0;
  const exposure = fundsData?.margin_used ?? 0;
  const exposurePercent = totalCapital > 0 ? ((exposure / totalCapital) * 100).toFixed(1) : "0.0";
  const exposureUsage = Number(exposurePercent);
  const exposureUsageWidth =
    exposureUsage >= 75 ? "w-full" : exposureUsage >= 50 ? "w-3/4" : exposureUsage >= 25 ? "w-1/2" : exposureUsage > 0 ? "w-1/4" : "w-0";

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("aether_sidebar_collapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-300 flex flex-col overflow-hidden select-none">
      <GlobalHeader />

      <main className="flex-1 flex min-h-0 relative">
        {/* Navigation Sidebar (Left) */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 64 : 220 }}
          className={cn(
            "bg-[#050505] border-r border-white/5 flex flex-col transition-all relative z-40 shadow-2xl",
            sidebarCollapsed ? "w-16" : "w-[220px]"
          )}
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/60 h-12">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-primary shadow-[0_0_8px_rgba(255,160,0,0.6)] animate-pulse" />
                <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase font-mono">Control_OS</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
              aria-expanded={!sidebarCollapsed}
              className="w-8 h-8 flex items-center justify-center rounded border border-white/5 bg-white/2 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            >
              {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex-1 flex flex-col p-0 overflow-y-auto custom-scrollbar bg-black/40">
            {sidebarSections.map((section) => (
              <div key={section.label}>
                <SidebarDivider label={section.label} count={section.items.length} collapsed={sidebarCollapsed} />
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.to}
                    icon={item.icon}
                    label={item.label}
                    to={item.to}
                    collapsed={sidebarCollapsed}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="p-5 border-t border-white/5 bg-black/60">
            {!sidebarCollapsed ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[7px] font-mono font-black text-white/80 uppercase tracking-[0.3em]">
                  <span>KERNEL_LOAD</span>
                  <span className="text-secondary drop-shadow-[0_0_8px_rgba(0,245,255,0.3)]">12.4%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-secondary shadow-[0_0_12px_rgba(0,245,255,0.5)] transition-all duration-1000" style={{ width: '12.4%' }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-1.5 h-1.5 bg-secondary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.6)]" />
              </div>
            )}
          </div>
        </motion.aside>

        {/* Content Area */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
          <MarketNavbar />
          <div className="flex-1 overflow-hidden relative z-10 flex">
            <div className="flex-1 overflow-y-auto relative custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={window.location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Global Telemetry Sidebar (Right) */}
            <AnimatePresence>
              {rightSidebarOpen && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 296, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="bg-[#050505] border-l border-white/10 flex flex-col shadow-2xl relative z-30"
                >
                  <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between bg-black/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 items-center justify-center rounded-md border border-secondary/25 bg-secondary/10 text-secondary">
                        <Activity className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white">Live Telemetry</h3>
                        <p className="text-xs text-white/40">Account, risk, and strategy pulse</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRightSidebarOpen(false)}
                      aria-label="Close telemetry panel"
                      className="size-8 flex items-center justify-center rounded-md border border-white/10 text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/70">
                          <Wallet className="size-4 text-primary" />
                          <h4 className="text-xs font-semibold">Account</h4>
                        </div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">AX-992</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-xs text-white/45">Total capital</span>
                          <IndustrialValue value={totalCapital} prefix="₹" className="text-sm font-semibold text-white" />
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-xs text-white/45">Exposure used</span>
                          <div className="text-right">
                            <IndustrialValue value={exposure} prefix="₹" className="text-sm font-semibold text-secondary" />
                            <span className="font-mono text-xs tabular-nums text-white/40">{exposurePercent}%</span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                          <div className={cn("h-full rounded-full bg-secondary", exposureUsageWidth)} />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/70">
                          <Cpu className="size-4 text-secondary" />
                          <h4 className="text-xs font-semibold">Strategies</h4>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-secondary">{strategyMatrix?.length || 0} live</span>
                      </div>
                      <div className="space-y-2">
                        {strategyMatrix && strategyMatrix.length > 0 ? (
                          strategyMatrix.slice(0, 5).map((s, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 rounded border border-white/5 bg-black/30 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={cn("size-2 rounded-full", s.status === 'active' || s.status === 'RUN' ? "bg-secondary" : "bg-white/20")} />
                                <span className="truncate text-xs font-medium text-white/80">{s.name}</span>
                              </div>
                              <IndustrialValue
                                value={s.pnl || 0}
                                className={cn("text-xs font-semibold", (s.pnl || 0) >= 0 ? "text-secondary" : "text-destructive")}
                                showPlus={true}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="rounded border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/40">No active strategies</div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-md border border-primary/15 bg-primary/5 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <Shield className="size-4" />
                          <h4 className="text-xs font-semibold">Risk state</h4>
                        </div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Nominal</span>
                      </div>
                      <p className="text-xs leading-5 text-white/55">
                        Drawdown lock is inactive. Exposure is inside configured limits.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded border border-white/5 bg-black/25 p-2">
                          <div className="flex items-center gap-1.5 text-white/45">
                            <Gauge className="size-3.5" />
                            <span className="text-xs">Usage</span>
                          </div>
                          <span className="mt-1 block font-mono text-xs tabular-nums text-white/80">{exposurePercent}%</span>
                        </div>
                        <div className="rounded border border-white/5 bg-black/25 p-2">
                          <div className="flex items-center gap-1.5 text-white/45">
                            <Activity className="size-3.5" />
                            <span className="text-xs">Pulse</span>
                          </div>
                          <span className="mt-1 block text-xs font-medium text-secondary">Stable</span>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="p-4 border-t border-white/10 bg-black/70">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/70">
                          Panic liquidate
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-white/10 bg-[#0A0A0A] text-white">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm panic liquidation</AlertDialogTitle>
                          <AlertDialogDescription>
                            This is a destructive desk action. Confirm only when you intend to flatten exposure immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Right Sidebar Toggle Button (Float) */}
      {!rightSidebarOpen && (
        <button
          onClick={() => setRightSidebarOpen(true)}
          aria-label="Open telemetry panel"
          className="fixed right-0 top-1/2 -translate-y-1/2 w-8 h-14 bg-primary/10 border border-primary/20 border-r-0 flex items-center justify-center rounded-l-md hover:bg-primary/20 transition-all z-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
        >
          <ChevronLeft className="w-3 h-3 text-primary" />
        </button>
      )}

      {/* Status Footer */}
      <StatusFooter />
    </div>
  );
});
