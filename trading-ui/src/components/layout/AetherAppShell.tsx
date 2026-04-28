import { useState, memo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { GlobalHeader } from "../trading/GlobalHeader";
import { MarketNavbar } from "../trading/MarketNavbar";
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

const SidebarItem = ({ icon: Icon, label, to, collapsed }: { icon: any, label: string, to: string, collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 group relative min-h-[40px]",
        isActive
          ? "bg-primary/10 text-primary shadow-[inset_0_0_10px_rgba(0,245,255,0.05)]"
          : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 transition-transform duration-300", isActive && "scale-110")} />
      {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>}
      {isActive && (
        <motion.div
          layoutId="active-sidebar-pill"
          className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-primary shadow-[0_0_8px_rgba(0,245,255,0.5)]"
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

export const AetherAppShell = memo(function AetherAppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

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
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">Control_OS</span>
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

          <div className="flex-1 flex flex-col p-3 gap-1 overflow-y-auto custom-scrollbar">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Cpu} label="Command_Center" to="/execution/command-center" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Database} label="Infrastructure" to="/governance" collapsed={sidebarCollapsed} />
            <SidebarItem icon={ShieldAlert} label="Risk_Manager" to="/risk" collapsed={sidebarCollapsed} />
            <SidebarItem icon={BarChart3} label="PnL_Tracker" to="/pnl-tracker" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Activity} label="Audit_Center" to="/audit" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Beaker} label="Indicator_Factory" to="/intelligence/indicator-factory" collapsed={sidebarCollapsed} />

            <div className="my-4 h-px bg-white/5" />

            <SidebarItem icon={BarChart3} label="Trade_Journal" to="/journal" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Fingerprint} label="Security_Ops" to="/openalgo/health" collapsed={sidebarCollapsed} />
            <SidebarItem icon={Settings} label="System_Prefs" to="/profile" collapsed={sidebarCollapsed} />
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40">
            {!sidebarCollapsed ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 uppercase">
                  <span>Kernel_Load</span>
                  <span className="text-secondary">12.4%</span>
                </div>
                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full w-[12.4%] bg-secondary shadow-[0_0_8px_rgba(var(--secondary),0.4)]" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-2 h-2 rounded-full border border-secondary/40 flex items-center justify-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-secondary" />
                </div>
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
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3 h-3 text-secondary" />
                      <span className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">Live_Telemetry</span>
                    </div>
                    <button
                      onClick={() => setRightSidebarOpen(false)}
                      aria-label="Close telemetry panel"
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-400 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Real-time Account Summary */}
                    <div className="space-y-4">
                      <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Account_Alpha</h4>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                          <span className="text-[7px] text-slate-500 uppercase block mb-1">Total_Capital</span>
                          <span className="text-sm font-mono font-black text-slate-200">₹4,25,000.00</span>
                        </div>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                          <span className="text-[7px] text-slate-500 uppercase block mb-1">Exposure_Usage</span>
                          <div className="flex items-end justify-between">
                            <span className="text-sm font-mono font-black text-secondary">₹1,12,450.00</span>
                            <span className="text-[9px] font-mono text-slate-500">26.4%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Strategy Matrix */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Active_Kernels</h4>
                      <div className="space-y-2">
                        {[
                          { name: "AetherScalper", pnl: 4250.20, status: "RUN" },
                          { name: "SwingCore_V2", pnl: -1240.00, status: "RUN" },
                          { name: "Neutral_Grid", pnl: 890.50, status: "IDLE" },
                        ].map((s, i) => (
                          <div key={i} className="flex items-center justify-between p-2 hover:bg-white/2 transition-colors rounded border border-transparent hover:border-white/5">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-1 h-1 rounded-full", s.status === 'RUN' ? "bg-secondary animate-pulse" : "bg-slate-700")} />
                              <span className="text-[10px] font-black tracking-tight">{s.name}</span>
                            </div>
                            <span className={cn("text-[10px] font-mono font-bold", s.pnl >= 0 ? "text-secondary" : "text-error")}>
                              {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Global Risk Dial */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Risk_Vitals</h4>
                      <div className="p-4 bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
                        <div className="text-xs font-black text-primary mb-1">NOMINAL</div>
                        <div className="text-[7px] text-slate-500 uppercase tracking-widest leading-relaxed">
                          Overall system risk is within defined parameters. Drawdown lock is inactive.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/5 bg-black/40">
                    <button className="w-full py-2 bg-error/10 border border-error/20 text-error text-[8px] font-black uppercase tracking-[0.3em] hover:bg-error hover:text-white transition-all">
                      PANIC_LIQUIDATE_ALL
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

      {/* Status Bar */}
      <footer className="h-6 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] text-slate-500 font-mono relative z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" />
            <span>SERVER: MUM-DC-12 (4ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
             <span>BROKER: SHOONYA (CONNECTED)</span>
          </div>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-widest">
          <span className="opacity-40">AlgoDesk STRAT_OS v6.0.4</span>
          <div className="h-3 w-[1px] bg-slate-800 mx-2" />
          <span className="text-cyan-600 font-bold">Strategy Aware Environment Enabled</span>
        </div>
      </footer>
    </div>
  );
});
