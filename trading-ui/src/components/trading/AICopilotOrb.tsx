import { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AICopilotOrb() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Neural Core Hub */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-8 right-8 z-[100] w-14 h-14 bg-background transition-all duration-700 flex items-center justify-center group ${
          isOpen ? 'shadow-[0_0_50px_rgba(0,245,255,0.4)]' : 'shadow-[0_0_30px_rgba(255,176,0,0.15)]'
        }`}
      >
        <div className={`absolute inset-0 border-2 transition-all duration-700 ${
          isOpen ? 'border-secondary rotate-180 scale-110' : 'border-primary/40 rotate-45 group-hover:rotate-90 group-hover:scale-105'
        }`} />
        
        {/* Core Pulsar */}
        <div className={`relative z-10 w-full h-full flex items-center justify-center transition-all duration-700 ${isOpen ? 'rotate-[-180deg]' : ''}`}>
           {isOpen ? (
             <X className="w-6 h-6 text-secondary animate-pulse" />
           ) : (
             <motion.div
               animate={{ rotate: 360 }}
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
               className="relative"
             >
               <Sparkles className="w-6 h-6 text-primary" />
               <div className="absolute inset-0 bg-primary/20 blur-lg animate-pulse" />
             </motion.div>
           )}
        </div>

        {/* Dynamic Telemetry Corners */}
        <div className={`absolute top-0 left-0 w-2 h-0.5 bg-primary/60 transition-all ${isOpen ? 'bg-secondary' : ''}`} />
        <div className={`absolute top-0 left-0 w-0.5 h-2 bg-primary/60 transition-all ${isOpen ? 'bg-secondary' : ''}`} />
        <div className={`absolute bottom-0 right-0 w-2 h-0.5 bg-primary/60 transition-all ${isOpen ? 'bg-secondary' : ''}`} />
        <div className={`absolute bottom-0 right-0 w-0.5 h-2 bg-primary/60 transition-all ${isOpen ? 'bg-secondary' : ''}`} />
      </button>

      {/* Terminal Interface */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className="fixed bottom-28 right-8 z-[90] w-96 bg-background border-2 border-border/60 shadow-[40px_40px_80px_rgba(0,0,0,0.7)] overflow-hidden industrial-grid"
          >
            <div className="scanline opacity-10" />
            <div className="absolute inset-0 bg-card/40 backdrop-blur-xl" />

            {/* Terminal Header */}
            <div className="relative z-10 p-4 border-b-2 border-border/40 flex items-center justify-between bg-card/20">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-secondary animate-pulse" />
                  <span className="text-[12px] font-syne font-black uppercase tracking-[0.3em] text-foreground">Neural_IO_Buffer</span>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground/30 uppercase mt-1 tracking-widest pl-5">Status::Stream_Operational_24ms</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono font-black text-secondary uppercase tracking-widest">Aether_v4.2</span>
                <span className="text-[7px] font-mono text-muted-foreground/20 uppercase">Enc::AES-256-GCM</span>
              </div>
            </div>

            {/* Message Feed */}
            <div className="relative z-10 h-96 p-6 overflow-y-auto space-y-6 no-scrollbar">
              <div className="flex flex-col gap-2 max-w-[95%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-mono font-black text-primary uppercase bg-primary/10 px-1.5 py-0.5">[SYSTEM_IO]</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40">12:04:22.41</span>
                </div>
                <div className="bg-card/30 border border-border/40 p-3 leading-relaxed">
                  <p className="text-[11px] font-mono text-foreground/80 uppercase tracking-tight">
                    <span className="text-secondary opacity-60">{">>"}</span> MOMENTUM_ALPHA_CORE: 2.3σ DEVIATION DETECTED. HIGH VOL REGIME CONFIRMED. REDUCE SCALE BY 15% FOR ENGINE STABILITY.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-w-[95%] ml-auto items-end">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[7px] font-mono text-muted-foreground/40">12:05:01.12</span>
                  <span className="text-[8px] font-mono font-black text-secondary uppercase bg-secondary/10 px-1.5 py-0.5">[USR_CMD]</span>
                </div>
                <div className="bg-secondary/5 border border-secondary/20 p-3 text-right">
                  <p className="text-[11px] font-mono text-secondary italic tracking-wider">
                    EXEC::OPTIMIZE_REBALANCE_FREQ --TARGET=SHARPE_MAX
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-w-[95%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-mono font-black text-primary uppercase bg-primary/10 px-1.5 py-0.5">[SYSTEM_IO]</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40">12:05:03.88</span>
                </div>
                <div className="bg-card/30 border border-border/40 p-3 leading-relaxed">
                  <p className="text-[11px] font-mono text-foreground/80 uppercase tracking-tight">
                    <span className="text-primary opacity-60">{">>"}</span> MONTE_CARLO (10K_PATHS): WEEKLY=2.41 SHARPE. DAILY=2.34. GAS_DRAIN REDUCED BY 38%. PREREQUISITE_STATUS::READY.
                  </p>
                </div>
              </div>
            </div>

            {/* Input Station */}
            <div className="relative z-10 p-4 border-t-2 border-border/40 bg-card/30">
              <div className="flex items-center gap-3 bg-background border border-border/40 px-4 py-3 group focus-within:border-primary/40 transition-all">
                <span className="text-primary font-mono text-xs font-black animate-pulse">{">"}</span>
                <input
                  type="text"
                  placeholder="INPUT_INSTRUCTION..."
                  className="flex-1 bg-transparent border-none text-[11px] font-mono font-black text-foreground placeholder:text-muted-foreground/20 focus:outline-none uppercase"
                />
                <button className="flex items-center gap-2 bg-primary px-3 py-1 font-mono font-black text-[10px] text-black hover:opacity-90 active:scale-95 transition-all">
                  <Send className="w-3 h-3" />
                  <span>[EXEC]</span>
                </button>
              </div>
              
              <div className="mt-3 flex items-center justify-between px-1">
                 <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 bg-primary/20" />
                    <div className="w-1.5 h-1.5 bg-primary/20" />
                    <div className="w-1.5 h-1.5 bg-primary/20" />
                 </div>
                 <span className="text-[8px] font-mono text-muted-foreground/20 font-black uppercase tracking-[0.4em]">NEURAL_CORE_LINK_STABLE</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
