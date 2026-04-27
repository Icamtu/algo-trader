import { ShieldCheck, ShieldAlert, Zap, Info, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RegimeData {
  regime: string;
  reasoning: string;
  pos_mult: number;
  risk_mult: number;
  last_update: string | number;
}

interface RegimeStatusProps {
  data: RegimeData;
  className?: string;
}

export function RegimeStatus({ data, className }: RegimeStatusProps) {
  const isBullish = data.regime === "BULLISH";
  const isBearish = data.regime === "BEARISH";
  const isVolatile = data.regime === "VOLATILE";

  const getStatusColor = () => {
    if (isBullish) return "text-secondary border-secondary/40 bg-secondary/5";
    if (isBearish) return "text-destructive border-destructive/40 bg-destructive/5";
    if (isVolatile) return "text-amber-500 border-amber-500/40 bg-amber-500/5";
    return "text-muted-foreground/60 border-border/20 bg-card/5";
  };

  const getStatusIcon = () => {
    if (isBullish) return <TrendingUp className="w-3 h-3" />;
    if (isBearish) return <TrendingDown className="w-3 h-3" />;
    if (isVolatile) return <Activity className="w-3 h-3" />;
    return <Zap className="w-3 h-3" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "flex items-center gap-2 px-3 h-7 border transition-all cursor-help relative group overflow-hidden",
              getStatusColor(),
              className
            )}
          >
            <div className="scanline opacity-10" />

            <div className="flex items-center gap-1.5 z-10">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px]",
                isBullish ? "bg-secondary shadow-secondary" :
                isBearish ? "bg-destructive shadow-destructive" :
                isVolatile ? "bg-amber-500 shadow-amber-500" : "bg-muted-foreground/30 shadow-transparent"
              )} />

              <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em]">
                {data.regime}
              </span>
            </div>

            <div className="h-3 w-[1px] bg-white/10 mx-1" />

            <div className="flex items-center gap-3 z-10">
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black opacity-30 uppercase">POS</span>
                <span className="text-[9px] font-black">{data.pos_mult}x</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black opacity-30 uppercase">RSK</span>
                <span className="text-[9px] font-black">{data.risk_mult}x</span>
              </div>
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="w-64 p-3 bg-background border-2 border-border shadow-2xl font-mono industrial-grid"
        >
          <div className="scanline opacity-10" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <Brain className="w-3 h-3" />
              AI_Regime_Context
            </span>
            <span className="text-[8px] opacity-40 uppercase font-black">
              {data.regime}::SYS_MODE
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-foreground/80 mb-3 border-l-2 border-primary/30 pl-2 italic">
            "{data.reasoning}"
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 border border-border bg-card/5 flex flex-col gap-1">
              <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50">Position_Cap</span>
              <span className={cn("text-xs font-black", data.pos_mult >= 1 ? "text-secondary" : "text-destructive")}>
                {data.pos_mult}x Neutral
              </span>
            </div>
            <div className="p-2 border border-border bg-card/5 flex flex-col gap-1">
              <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50">Risk_Exposure</span>
              <span className={cn("text-xs font-black", data.risk_mult <= 1 ? "text-secondary" : "text-destructive")}>
                {data.risk_mult}x Factor
              </span>
            </div>
          </div>
          <div className="mt-2 text-[7px] text-muted-foreground/40 text-right uppercase font-black tracking-tighter">
            Last_Update:: {typeof data.last_update === 'string' ? data.last_update : new Date(data.last_update * 1000).toLocaleTimeString()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { Brain } from "lucide-react";
