import { useState } from "react";
import { Settings2, Tag, Clock, SlidersHorizontal, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyMetadataProps {
  filename: string;
  accentColorClass: string;
}

export function StrategyMetadata({ filename, accentColorClass }: StrategyMetadataProps) {
  // Mock internal state for strategy parameters just as a visual panel implementation 
  // until we tie it natively to backend dynamic parsing
  const [params, setParams] = useState([
    { name: "LOOKBACK_PERIOD", type: "int", value: "14" },
    { name: "STOP_LOSS_PCT", type: "float", value: "2.5" },
    { name: "TAKE_PROFIT_PCT", type: "float", value: "5.0" },
    { name: "MAX_POSITIONS", type: "int", value: "3" },
  ]);

  const [metadata, setMetadata] = useState({
    name: filename.replace('.py', ''),
    asset: "NSE:NIFTY",
    timeframe: "5m",
  });

  return (
    <div className="w-64 border-l border-border bg-card/5 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-3 border-b border-border bg-card/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Settings2 className={cn("w-3.5 h-3.5", accentColorClass)} />
           <span className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground">Strat_Metadata</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-4">
        
        {/* Core Info */}
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/60"><Tag className="w-2.5 h-2.5" /> Strategy Name</span>
            <input type="text" value={metadata.name} onChange={e => setMetadata({...metadata, name: e.target.value})} className="bg-background/50 border border-border/20 px-2 py-1.5 text-[10px] font-mono font-bold text-foreground focus:ring-0 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
             <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/60"><Clock className="w-2.5 h-2.5" /> Asset</span>
                <input type="text" value={metadata.asset} onChange={e => setMetadata({...metadata, asset: e.target.value})} className="bg-background/50 border border-border/20 px-2 py-1.5 text-[9px] font-mono font-bold text-secondary focus:ring-0 outline-none uppercase" />
             </div>
             <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground/60"><Clock className="w-2.5 h-2.5" /> Timeframe</span>
                <input type="text" value={metadata.timeframe} onChange={e => setMetadata({...metadata, timeframe: e.target.value})} className="bg-background/50 border border-border/20 px-2 py-1.5 text-[9px] font-mono font-bold text-foreground focus:ring-0 outline-none" />
             </div>
          </div>
        </div>

        <div className="w-full h-px bg-border/20" />

        {/* Parameters */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
             <SlidersHorizontal className="w-3 h-3 text-muted-foreground/40" />
             <span className="text-[9px] font-mono font-black uppercase tracking-widest text-muted-foreground/60">Tuning_Params</span>
          </div>
          
          <div className="space-y-2">
            {params.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-background/20 p-2 border border-border/10">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-foreground">{p.name}</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40 uppercase">{p.type}</span>
                </div>
                <input 
                  type="text" 
                  value={p.value} 
                  onChange={(e) => {
                    const next = [...params];
                    next[i].value = e.target.value;
                    setParams(next);
                  }}
                  className={cn("w-16 bg-background/80 border border-border/30 px-1.5 py-1 text-[9px] font-mono font-black text-right focus:ring-0 outline-none", accentColorClass)}
                />
              </div>
            ))}
          </div>
          
          <button className="mt-3 w-full border border-border/20 hover:border-primary/40 bg-white/5 hover:bg-white/10 transition-all py-1.5 flex justify-center items-center gap-1.5">
             <span className="text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">+ Add_Parameter</span>
          </button>
        </div>

      </div>
      
      <div className="p-3 border-t border-border bg-card/10">
        <button className={cn("w-full py-1.5 flex items-center justify-center gap-2 border text-[9px] font-mono font-black uppercase tracking-widest transition-all", `border-${accentColorClass.split('-')[1]}-500/20`, "bg-white/5 hover:bg-primary hover:text-black", accentColorClass)}>
          <Save className="w-3 h-3" />
          Update_Config
        </button>
      </div>
    </div>
  );
}
