import { useState, memo, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
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
  Beaker
} from "lucide-react";

interface SidebarItemProps {
  icon: any;
  label: string;
  to: string;
  collapsed: boolean;
}

const SidebarItem = ({ icon: Icon, label, to, collapsed }: SidebarItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

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

const SidebarDivider = ({ label, collapsed }: { label: string; collapsed: boolean }) => (
  <div className="px-4 py-3 mt-2 mb-1 flex items-center gap-3">
    {!collapsed && (
      <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/40">{label}</span>
    )}
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
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" collapsed={sidebarCollapsed} />
            <SidebarDivider label="Execution" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Cpu} label="Command_Center" to="/execution/command-center" collapsed={sidebarCollapsed} />
            <SidebarDivider label="Intelligence" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Beaker} label="Indicator_Factory" to="/intelligence/indicator-factory" collapsed={sidebarCollapsed} />
            <SidebarDivider label="Operations" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Database} label="Infrastructure" to="/governance" collapsed={sidebarCollapsed} />
            <SidebarItem icon={ShieldAlert} label="Risk_Manager" to="/risk" collapsed={sidebarCollapsed} />
            <SidebarItem icon={BarChart3} label="PnL_Tracker" to="/pnl-tracker" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Activity} label="Audit_Center" to="/audit" collapsed={sidebarCollapsed} />

            <div className="my-4 h-px bg-white/5" />

            <SidebarItem icon={BarChart3} label="Trade_Journal" to="/journal" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Fingerprint} label="Security_Ops" to="/aetherdesk/health" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Settings} label="System_Prefs" to="/profile" collapsed={sidebarCollapsed} />
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
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="bg-[#050505] border-l border-white/5 flex flex-col shadow-2xl relative z-30"
                >
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/60 h-12">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-3 bg-secondary/40 relative overflow-hidden">
                        <div className="absolute inset-x-0 bottom-0 bg-secondary animate-pulse" style={{ height: '60%' }} />
                      </div>
                      <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase font-mono">Live_Telemetry</span>
                    </div>
                    <button
                      onClick={() => setRightSidebarOpen(false)}
                      aria-label="Close telemetry panel"
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Real-time Account Summary */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.4em] font-mono">Account_Alpha</h4>
                        <span className="text-[7px] font-mono font-black text-muted-foreground/70">ID: AX-992</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 bg-white/5">
                        <div className="p-4 bg-[#080808] hover:bg-[#0c0c0c] transition-colors group/c1 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/20 group-hover/c1:bg-primary transition-colors" />
                          <span className="text-[7px] text-white/80 font-black uppercase block mb-1.5 tracking-[0.2em] font-mono">Total_Capital</span>
                          <IndustrialValue value={totalCapital} prefix="₹" className="text-base font-mono font-black text-white" />
                        </div>
                        <div className="p-4 bg-[#080808] hover:bg-[#0c0c0c] transition-colors group/c2 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-secondary/20 group-hover/c2:bg-secondary transition-colors" />
                          <span className="text-[7px] text-white/80 font-black uppercase block mb-1.5 tracking-[0.2em] font-mono">Exposure_Usage</span>
                          <div className="flex items-end justify-between">
                            <IndustrialValue value={exposure} prefix="₹" className="text-base font-mono font-black text-secondary" />
                            <span className="text-[10px] font-mono font-black text-white/80">{exposurePercent}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Strategy Matrix */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.4em] font-mono">Active_Kernels</h4>
                        <span className="text-[7px] font-mono font-black text-secondary">{strategyMatrix?.length || 0} RUNNING</span>
                      </div>
                      <div className="space-y-1 bg-white/5">
                        {strategyMatrix && strategyMatrix.length > 0 ? (
                          strategyMatrix.slice(0, 5).map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[#080808] hover:bg-white/[0.03] transition-colors relative group/strat">
                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/5 group-hover/strat:bg-secondary transition-colors" />
                              <div className="flex items-center gap-3">
                                <div className={cn("w-1.5 h-1.5", s.status === 'active' || s.status === 'RUN' ? "bg-secondary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.6)]" : "bg-white/10")} />
                                <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[120px] font-mono">{s.name}</span>
                              </div>
                              <IndustrialValue
                                value={s.pnl || 0}
                                className={cn("text-[11px] font-mono font-black", (s.pnl || 0) >= 0 ? "text-secondary" : "text-destructive")}
                                showPlus={true}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="text-[8px] font-mono text-muted-foreground/20 text-center py-8 tracking-[0.4em] bg-[#080808]">ZERO_ACTIVE_KERNELS</div>
                        )}
                      </div>
                    </div>

                    {/* Global Risk Dial */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="p-4 bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
                        <div className="text-xs font-black text-primary mb-1 tracking-widest">NOMINAL</div>
                        <div className="text-[7px] text-muted-foreground/80 uppercase tracking-widest leading-relaxed">
                          Overall system risk is within defined parameters. Drawdown lock is inactive.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/5 bg-black/60">
                    <button className="w-full py-3 bg-destructive/5 border border-destructive/20 text-destructive text-[10px] font-black uppercase tracking-[0.4em] hover:bg-destructive hover:text-white transition-all font-mono relative overflow-hidden group/panic">
                      <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/panic:translate-x-[100%] transition-transform duration-1000" />
                      PANIC_LIQUIDATE
                    </button>
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
