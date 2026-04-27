import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, BrainCircuit } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';

interface SectorData {
  sector: string;
  sentiment: string;
  conviction: number;
  picks: string[];
}

interface SectorBentoProps {
  sectors: SectorData[];
  className?: string;
}

export const SectorBento: React.FC<SectorBentoProps> = ({ sectors, className }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}
    >
      {sectors.map((data, idx) => (
        <motion.div key={data.sector} variants={item}>
          <AetherPanel className="group relative p-5 bg-background/40 border-border/10 hover:border-primary/30 transition-all overflow-hidden h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-none bg-primary/10 border border-primary/20">
                    <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h4 className="text-[12px] font-black uppercase tracking-widest">{data.sector}</h4>
                </div>
                <div className="text-[9px] text-muted-foreground/60 font-medium">SECTOR_SENTIMENT_ANALYSIS</div>
              </div>

              <div className={cn(
                "px-2 py-0.5 rounded-none border text-[9px] font-black tracking-widest uppercase",
                data.sentiment === "BULLISH" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                data.sentiment === "BEARISH" ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                "bg-amber-500/10 border-amber-500/20 text-amber-500"
              )}>
                {data.sentiment}
              </div>
            </div>

            <div className="space-y-4">
              {/* Conviction Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[8px] font-black tracking-widest uppercase">
                  <span className="text-muted-foreground/60">CONVICTION_STRENGTH</span>
                  <span className="text-primary">{Math.round(data.conviction * 100)}%</span>
                </div>
                <div className="h-1 w-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.conviction * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>

              {/* Picks */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase text-muted-foreground/60">
                  <Target className="w-2.5 h-2.5" /> KEY_SYMBOLS
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.picks.map(pick => (
                    <span key={pick} className="px-2 py-0.5 bg-black/40 border border-white/5 text-[9px] font-mono font-bold text-primary/80">
                      {pick}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Hover Indicator */}
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {data.sentiment === "BULLISH" ?
                <TrendingUp className="w-3 h-3 text-emerald-500" /> :
                <TrendingDown className="w-3 h-3 text-rose-500" />
              }
            </div>
          </AetherPanel>
        </motion.div>
      ))}
    </motion.div>
  );
};
