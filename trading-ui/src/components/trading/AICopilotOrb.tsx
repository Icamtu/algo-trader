import { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AICopilotOrb() {
   const [isOpen, setIsOpen] = useState(false);
   const [input, setInput] = useState("");
   const [messages, setMessages] = useState([
     { role: "system", content: "MOMENTUM_ALPHA_CORE: 2.3σ DEVIATION DETECTED. HIGH VOL REGIME CONFIRMED. REDUCE SCALE BY 15% FOR ENGINE STABILITY.", time: "12:04:22" },
     { role: "user", content: "EXEC::OPTIMIZE_REBALANCE_FREQ --TARGET=SHARPE_MAX", time: "12:05:01" },
     { role: "system", content: "MONTE_CARLO (10K_PATHS): WEEKLY=2.41 SHARPE. DAILY=2.34. GAS_DRAIN REDUCED BY 38%. PREREQUISITE_STATUS::READY.", time: "12:05:03" },
   ]);

   const handleExecute = () => {
     if (!input.trim()) return;
     const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
     setMessages([...messages, { role: "user", content: input, time: now }]);
     setInput("");
     // Simulate response
     setTimeout(() => {
        setMessages(prev => [...prev, { role: "system", content: `RECEIVING_INSTRUCTION::${input.toUpperCase()} // ATTEMPTING_KERNEL_SYNC...`, time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
     }, 1000);
   };

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
                  <span className="text-[12px] font-display font-black uppercase tracking-[0.3em] text-foreground">Neural_IO_Buffer</span>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground/30 uppercase mt-1 tracking-widest pl-5">Status::Stream_Operational_24ms</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono font-black text-secondary uppercase tracking-widest">Aether_v4.2</span>
                <span className="text-[7px] font-mono text-muted-foreground/20 uppercase">Enc::AES-256-GCM</span>
              </div>
            </div>

            {/* Message Feed */}
            <div className="relative z-10 h-96 p-6 overflow-y-auto space-y-6 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col gap-2 max-w-[95%] ${m.role === 'user' ? 'ml-auto items-end' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-[8px] font-mono font-black uppercase px-1.5 py-0.5 ${m.role === 'user' ? 'text-secondary bg-secondary/10' : 'text-primary bg-primary/10'}`}>
                      {m.role === 'user' ? '[USR_CMD]' : '[SYSTEM_IO]'}
                    </span>
                    <span className="text-[7px] font-mono text-muted-foreground/40">{m.time}</span>
                  </div>
                  <div className={`${m.role === 'user' ? 'bg-secondary/5 border border-secondary/20 p-3 text-right' : 'bg-card/30 border border-border/40 p-3 leading-relaxed'}`}>
                    <p className={`text-[11px] font-mono tracking-tight ${m.role === 'user' ? 'text-secondary italic' : 'text-foreground/80 uppercase'}`}>
                      {m.role === 'system' && <span className="text-secondary opacity-60 mr-2">{">>"}</span>}
                      {m.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Station */}
            <div className="relative z-10 p-4 border-t-2 border-border/40 bg-card/30">
              <div className="flex items-center gap-3 bg-background border border-border/40 px-4 py-3 group focus-within:border-primary/40 transition-all">
                <span className="text-primary font-mono text-xs font-black animate-pulse">{">"}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
                  placeholder="INPUT_INSTRUCTION..."
                  className="flex-1 bg-transparent border-none text-[11px] font-mono font-black text-foreground placeholder:text-muted-foreground/20 focus:outline-none uppercase"
                />
                <button
                  onClick={handleExecute}
                  className="flex items-center gap-2 bg-primary px-3 py-1 font-mono font-black text-[10px] text-black hover:opacity-90 active:scale-95 transition-all"
                >
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
