import React from 'react';
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, User, Mail, Fingerprint, Calendar, ShieldCheck, BarChart3, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTerminalSettings } from "@/contexts/TerminalSettingsContext";
import { cn } from "@/lib/utils";

const Profile = () => {
  const { user } = useAuth();
  const { settings, updateSettings } = useTerminalSettings();

  const stats = [
    { label: "Login_Vector", value: user?.app_metadata?.provider || "Supabase_Auth" },
    { label: "Account_Age", value: new Date(user?.created_at || "").toLocaleDateString() },
    { label: "Identity_Hash", value: user?.id?.slice(0, 12) + "..." },
    { label: "Security_Clearance", value: "Verified_Terminal" }
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar />

      <div className="flex-1 overflow-auto p-8 relative z-10">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="border border-white/5 bg-slate-950/40 backdrop-blur-md p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <Fingerprint className="w-32 h-32 text-primary" />
            </div>

            <div className="flex items-center gap-8 relative z-10">
               <div className="w-24 h-24 bg-primary flex items-center justify-center font-mono text-4xl font-black text-black">
                 {user?.email?.[0].toUpperCase()}
               </div>
               <div className="space-y-1">
                  <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
                    {user?.email?.split('@')[0]}
                  </h1>
                  <div className="flex items-center gap-3">
                     <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                     <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                     <div className="px-2 py-0.5 bg-primary/20 border border-primary/30 text-[8px] font-mono font-black text-primary uppercase">Identity_Verified</div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-12">
               {stats.map((s) => (
                 <div key={s.label} className="p-4 border border-white/5 bg-white/5">
                    <span className="text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em] block mb-2">{s.label}</span>
                    <span className="text-sm font-black font-mono text-foreground uppercase">{s.value}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
             <div className="p-6 border border-white/5 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-primary/10 border border-primary/20">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                   </div>
                   <div>
                      <h4 className="text-[11px] font-black uppercase text-foreground">System_MFA_Protocol</h4>
                      <p className="text-[9px] font-mono text-muted-foreground uppercase mt-1">Status: Operational // TOTP_Link_Active</p>
                   </div>
                </div>
                <button className="px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all">Re-Verify</button>
             </div>

             <div className="p-8 border border-white/5 bg-slate-950/40 backdrop-blur-md space-y-6">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                   <div className="p-2 bg-primary/10 border border-primary/20">
                      <Settings2 className="w-5 h-5 text-primary" />
                   </div>
                   <div>
                      <h4 className="text-[11px] font-black uppercase text-foreground">Chart_System_Vector</h4>
                      <p className="text-[9px] font-mono text-muted-foreground uppercase mt-1">Configure global visualization parameters</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">Default_Engine</label>
                      <div className="grid grid-cols-3 gap-2">
                         {[
                            { id: 'lightweight', label: 'Lightweight' },
                            { id: 'recharts', label: 'Recharts' },
                            { id: 'tradingview', label: 'TradingView' }
                         ].map((engine) => (
                            <button
                               key={engine.id}
                               onClick={() => updateSettings({ chartEngine: engine.id as any })}
                               className={cn(
                                  "py-2 px-3 border text-[10px] font-black uppercase tracking-tighter transition-all",
                                  settings.chartEngine === engine.id
                                     ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_rgba(0,245,255,0.1)]"
                                     : "border-white/5 bg-white/5 text-muted-foreground/40 hover:border-white/20"
                               )}
                            >
                               {engine.label}
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="flex items-center justify-between py-4 border-t border-white/5">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase text-foreground">Global_Watermark</span>
                         <span className="text-[8px] font-mono text-muted-foreground uppercase">Show "OPENALGO" label on charts</span>
                      </div>
                      <button
                         onClick={() => updateSettings({ showWatermark: !settings.showWatermark })}
                         className={cn(
                            "w-12 h-6 rounded-full p-1 transition-all",
                            settings.showWatermark ? "bg-primary" : "bg-white/10"
                         )}
                      >
                         <div className={cn(
                            "w-4 h-4 bg-white rounded-full transition-all",
                            settings.showWatermark ? "ml-6" : "ml-0"
                         )} />
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
