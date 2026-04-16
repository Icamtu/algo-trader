import React from 'react';
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { ShieldAlert, UserCheck, Shield, Key, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const Roles = () => {
  const roles = [
    { name: "Super Admin", level: "LVL_4", identity: "System Root", access: "Full Control", status: "Active" },
    { name: "Risk Manager", level: "LVL_3", identity: "Capital Oversight", access: "Risk/Limits Only", status: "Active" },
    { name: "Algo Execution", level: "LVL_2", identity: "Strategy Operator", access: "Execution Only", status: "Read-Only" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/roles" />

      <div className="flex-1 overflow-auto p-8 relative z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between border-b border-border/20 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black font-display uppercase tracking-widest text-foreground">ROLE_AUTHORITY_MATRIX</h1>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Internal_AetherDesk_Permissions</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {roles.map((role, idx) => (
              <motion.div 
                key={role.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group border border-white/5 bg-slate-950/40 backdrop-blur-md p-6 hover:border-amber-500/30 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-5">
                   <Shield className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <span className="text-[9px] font-mono font-black text-amber-500/40 uppercase block mb-1">Level</span>
                      <span className="text-xl font-black font-mono text-amber-500">{role.level}</span>
                    </div>
                    <div className="h-10 w-[1px] bg-white/5" />
                    <div>
                      <h3 className="text-lg font-black font-display uppercase text-foreground group-hover:text-amber-500 transition-colors">{role.name}</h3>
                      <p className="text-[10px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest">{role.identity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-12 text-right">
                    <div>
                      <span className="text-[9px] font-mono font-black text-muted-foreground/20 uppercase block mb-1">Access_Scope</span>
                      <span className="text-[11px] font-mono font-black text-foreground uppercase">{role.access}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-mono font-black text-muted-foreground/20 uppercase block mb-1">Registry_Status</span>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono font-black text-green-500 uppercase">{role.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="p-6 bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
            <Lock className="w-5 h-5 text-blue-400 mt-1" />
            <div>
               <p className="text-[11px] font-mono font-black text-blue-400 uppercase tracking-widest mb-2">Protocol_Notice:</p>
               <p className="text-[10px] font-mono text-muted-foreground leading-relaxed uppercase opacity-70">
                 All role assignments are cryptographically signed and logged at the kernel level. 
                 Any unauthorized privilege escalation will trigger an immediate system-wide termination sequence.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;
