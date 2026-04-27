import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Activity,
  PieChart,
  Layers,
  Terminal,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { algoApi } from "@/features/openalgo/api/client";
import { GlobalHeader } from "../trading/GlobalHeader";
import { MarketNavbar } from "../trading/MarketNavbar";
import { OrderEntryTerminal } from "../trading/OrderEntryTerminal";
import { useAether } from "@/contexts/AetherContext";
import { useAuth } from "@/contexts/AuthContext";

export function AetherAppShell() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";
  const { selectedSymbol, setSelectedSymbol, ticks, tickerSymbols } = useAether();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const displaySymbols = tickerSymbols.map(sym => {
    const live = ticks[sym];
    const current_ltp = live?.ltp || 0;
    const current_chg = parseFloat(live?.chg_pct || "0");
    return {
      s: sym,
      p: current_ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      c: live?.chg_pct ? `${live.chg_pct}%` : "0.00%",
      up: current_chg >= 0
    };
  });

  // Auto-open right panel when a symbol is selected
  useEffect(() => {
    if (selectedSymbol) {
      setRightOpen(true);
    }
  }, [selectedSymbol]);

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden font-sans selection:bg-primary/30 relative">
      {/* Global Aesthetics */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] neural-flow-bg opacity-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] neural-flow-bg opacity-10 pointer-events-none rotate-180" />
      <div className="noise-overlay pointer-events-none" />
      <div className="scanline-overlay pointer-events-none" />

      <GlobalHeader />
      <MarketNavbar />

      <main className="flex-1 flex overflow-hidden relative z-10">
        {/* LEFT COLUMN: MarketWatch */}
        <motion.aside
          initial={false}
          animate={{ width: leftOpen ? 300 : 0, opacity: leftOpen ? 1 : 0 }}
          className={cn(
            "h-full border-r border-white/5 bg-white/[0.01] backdrop-blur-3xl z-30 transition-all overflow-hidden relative flex flex-col",
            !leftOpen && "border-none"
          )}
        >
          <div className="w-[300px] p-6 flex flex-col h-full bg-gradient-to-b from-white/[0.02] to-transparent">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.4)]" />
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-foreground">Market_Watch</h3>
                </div>
                <div className="flex gap-1.5">
                   {[1, 2, 3].map(i => (
                     <div key={i} className={cn(
                        "w-6 h-6 border border-white/10 flex items-center justify-center text-[10px] font-mono cursor-pointer hover:bg-white/5 transition-all hover:border-primary/40",
                        i === 1 ? "bg-primary text-black border-primary" : "text-muted-foreground/30"
                     )}>
                        {i}
                     </div>
                   ))}
                </div>
             </div>

             <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20" />
                <input
                   placeholder="SEARCH_SYMBOLS..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-white/[0.03] border border-white/10 px-10 py-2.5 text-[10px] uppercase font-mono tracking-widest outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-all rounded-sm placeholder:text-muted-foreground/10"
                />
             </div>

             <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {displaySymbols.filter(i => i.s.toLowerCase().includes(searchQuery.toLowerCase())).map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedSymbol(item.s)}
                    className={cn(
                      "p-4 border transition-all flex items-center justify-between group cursor-pointer relative overflow-hidden",
                      selectedSymbol === item.s ? "bg-primary/10 border-primary/40" : "bg-white/[0.02] border-white/5 hover:border-white/20 active:scale-[0.98]"
                    )}
                  >
                    <div className="flex flex-col relative z-10">
                       <span className="text-xs font-black uppercase tracking-tight group-hover:text-primary transition-colors">{item.s}</span>
                       <span className="text-[8px] text-muted-foreground/20 font-mono uppercase tracking-widest mt-1">NSE:EQ // LOT: 1</span>
                    </div>
                    <div className="text-right relative z-10">
                       <div className="text-xs font-mono font-bold tabular-nums text-foreground group-hover:text-primary transition-colors">{item.p}</div>
                       <div className={cn("text-[9px] font-mono font-black mt-1 flex items-center justify-end gap-1",
                         item.up ? "text-secondary" : "text-destructive")}>
                          {item.up ? "▲" : "▼"} {item.c}
                       </div>
                    </div>
                    {selectedSymbol === item.s && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                    )}
                  </motion.div>
                ))}
             </div>
          </div>
        </motion.aside>

        {/* TOGGLE BUTTONS */}
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 w-4 h-16 flex items-center justify-center bg-black border border-white/5 border-l-0 hover:bg-white/5 hover:border-primary/40 transition-all rounded-r-sm group"
        >
          {leftOpen ? <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-primary" />}
        </button>

        {/* CENTER COLUMN: Main Workspace */}
        <section className="flex-1 overflow-y-auto custom-scrollbar relative industrial-grid bg-background/50 backdrop-blur-sm">
           <Outlet />
        </section>

        {/* RIGHT COLUMN: Order Terminal */}
        <button
          onClick={() => setRightOpen(!rightOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 w-4 h-16 flex items-center justify-center bg-black border border-white/5 border-r-0 hover:bg-white/5 hover:border-primary/40 transition-all rounded-l-sm group"
        >
          {rightOpen ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary" /> : <ChevronLeft className="w-3.5 h-3.5 text-primary" />}
        </button>

        <motion.aside
          initial={false}
          animate={{ width: rightOpen ? 320 : 0, opacity: rightOpen ? 1 : 0 }}
          className={cn(
            "h-full border-l border-white/5 bg-white/[0.01] backdrop-blur-3xl z-30 transition-all overflow-hidden relative flex flex-col",
            !rightOpen && "border-none"
          )}
        >
          <div className="w-[320px] flex flex-col h-full bg-gradient-to-b from-white/[0.02] to-transparent">
             <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-primary" />
                   </div>
                   <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Aether_Gate</h3>
                      <span className="text-[8px] font-black font-mono text-muted-foreground/20 uppercase">Core_Execution // v4.0.0</span>
                   </div>
                </div>
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar">
                <OrderEntryTerminal selectedSymbol={selectedSymbol} />
             </div>

             {/* Intelligence Feed snippet at bottom of sidebar */}
             <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-4">
                   <Activity className="w-3.5 h-3.5 text-secondary" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Neural_Advisory</span>
                </div>
                <p className="text-[11px] font-mono leading-relaxed text-foreground/70 uppercase">
                   <span className="text-primary opacity-50">#SENSE_LOG:</span> System detecting strong mean-reversion signature. Adjusting risk weights to <span className="text-secondary">0.85x</span>.
                </p>
             </div>
          </div>
        </motion.aside>
      </main>

      {/* FOOTER BAR */}
      <footer className="h-9 bg-black border-t border-white/5 flex items-center justify-between px-6 z-40 backdrop-blur-md">
         <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
               <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(0,245,255,0.4)] animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 underline decoration-primary/20 underline-offset-4">ORD:CONNECTED</span>
            </div>
            <div className="flex items-center gap-2.5">
               <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,245,255,0.4)] animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">TICK:LIVE_42MS</span>
            </div>
            <div className="h-4 w-[1px] bg-white/5" />
            <div className="flex items-center gap-2.5">
               <div className="w-2 h-2 rounded-full bg-white/5" />
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/20 italic">SIM:STANDBY</span>
            </div>
         </div>

         <div className="flex items-center h-full">
            <div className="flex items-center gap-8 px-8 border-x border-white/5 h-full">
               <div className="flex items-center gap-2.5 cursor-pointer hover:text-primary transition-all text-muted-foreground/40 group">
                  <LayoutGrid className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest">DSK::NODE_01</span>
               </div>
               <div className="flex items-center gap-2.5 cursor-pointer hover:text-primary transition-all text-muted-foreground/40 group">
                  <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest">LAYER_VIEW</span>
               </div>
            </div>
            <div className="pl-8 flex items-center gap-4">
               <div className="px-5 py-1.5 border border-primary/20 bg-primary/5 rounded-sm">
                  <span className="text-[10px] font-black font-mono text-primary tracking-[0.3em]">AETHER::PRIME_KERNEL_ACTIVE</span>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}
