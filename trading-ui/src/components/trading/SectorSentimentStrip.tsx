import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectorSentiment {
  sector: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  conviction: number;
  reasoning: string;
  source: string;
}

interface SectorSentimentStripProps {
  sentiments: Record<string, SectorSentiment>;
  className?: string;
}

export function SectorSentimentStrip({ sentiments, className }: SectorSentimentStripProps) {
  const sectors = Object.values(sentiments);

  if (sectors.length === 0) return null;

  return (
    <div className={cn("bg-card/30 border-b border-border/40 py-1.5 px-4 overflow-hidden relative", className)}>
      <div className="scanline opacity-[0.03]" />
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0 border-r border-border/20 pr-4">
          <Brain className="w-3 h-3 text-primary animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Sector_Intel</span>
        </div>

        <div className="flex items-center gap-8">
          {sectors.map((s) => (
            <SectorItem key={s.sector} data={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectorItem({ data }: { data: SectorSentiment }) {
  const isBullish = data.sentiment === "BULLISH";
  const isBearish = data.sentiment === "BEARISH";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-help group"
          >
            <span className="text-[10px] font-black uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors">
              {data.sector}
            </span>

            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[8px] font-bold transition-all",
              isBullish ? "bg-secondary/10 border-secondary/40 text-secondary" :
              isBearish ? "bg-destructive/10 border-destructive/40 text-destructive" :
              "bg-muted/10 border-border/40 text-muted-foreground"
            )}>
              {isBullish ? <TrendingUp className="w-2.5 h-2.5" /> :
               isBearish ? <TrendingDown className="w-2.5 h-2.5" /> :
               <Minus className="w-2.5 h-2.5" />}
              {data.sentiment}
            </div>

            <div className="flex flex-col gap-0.5">
               <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.conviction * 100}%` }}
                    className={cn(
                        "h-full",
                        isBullish ? "bg-secondary" : isBearish ? "bg-destructive" : "bg-primary"
                    )}
                  />
               </div>
               <span className="text-[7px] font-mono opacity-30 text-right uppercase">Conv {Math.round(data.conviction * 100)}%</span>
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64 p-3 font-mono industrial-grid">
           <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-primary uppercase">Reasoning_Matrix</span>
              <span className="text-[7px] opacity-40 uppercase">Source: {data.source}</span>
           </div>
           <p className="text-[10px] leading-relaxed italic text-foreground/80">
              "{data.reasoning}"
           </p>
           <div className="mt-2 pt-2 border-t border-border/20 text-[7px] text-muted-foreground uppercase">
              Impact_Level: {data.conviction > 0.7 ? "CRITICAL_BIAS" : "STANDARD_DRIFT"}
           </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
