import React from "react";
import { useQuery } from "@tanstack/react-query";
import { algoApi } from "@/features/openalgo/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Library, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StrategyLibraryProps {
  onSelect: (strategy: any) => void;
  selectedId?: string;
}

export const StrategyLibrary: React.FC<StrategyLibraryProps> = ({ onSelect, selectedId }) => {
  const { data: strategies, isLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => algoApi.getStrategies(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full bg-white/5 animate-pulse rounded-lg border border-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/20">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Strategy_Library</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono opacity-50">
          {strategies?.length || 0} DEPLOYED
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-2">
          {strategies?.map((strat: any) => (
            <Card
              key={strat.id}
              className={cn(
                "cursor-pointer transition-all border border-white/5 hover:border-primary/30 group relative overflow-hidden",
                selectedId === strat.id ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(0,229,255,0.1)]" : "bg-white/5 hover:bg-white/[0.08]"
              )}
              onClick={() => onSelect(strat)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-foreground truncate max-w-[140px]">
                    {strat.name.toUpperCase()}
                  </span>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    strat.is_active ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-slate-500"
                  )} />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[8px] h-4 bg-black/40 border-white/10 font-mono text-muted-foreground">
                    {strat.mode || "SANDBOX"}
                  </Badge>
                  <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Zap className="w-2.5 h-2.5" />
                    <span className="text-[8px] font-mono">{strat.symbols?.[0] || "N/A"}</span>
                  </div>
                </div>

                {selectedId === strat.id && (
                  <motion.div
                    layoutId="library-active-glow"
                    className="absolute left-0 top-0 w-[2px] h-full bg-primary"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
