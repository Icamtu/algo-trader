import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { algoApi } from '@/features/openalgo/api/client';

interface StrategySelectionDialogProps {
  onSelect: (strategyName: string) => void;
  currentStrategy?: string;
}

export function StrategySelectionDialog({ onSelect, currentStrategy }: StrategySelectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const data = await algoApi.getStrategies();
      setStrategies(data.strategies || []);
    } catch (e) {
      toast.error("Could not load strategies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStrategies();
    }
  }, [open]);

  const filteredStrategies = strategies.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-background/50 border-white/10 hover:border-primary/50 text-xs text-muted-foreground truncate">
            {currentStrategy ? (
                <><FileCode className="w-4 h-4 text-primary" /> {currentStrategy}</>
            ) : (
                <><Search className="w-4 h-4" /> Select Base Strategy...</>
            )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            Strategy Explorer
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Select a discovered strategy from the engine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search strategies..."
                className="pl-9 bg-black/40 border-white/10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="h-[300px] pr-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Scanning strategies...</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                   Available Engines
                </div>

                {filteredStrategies.map((strat) => (
                  <Button
                    key={strat.id}
                    variant="ghost"
                    className={`w-full justify-start gap-3 h-14 ${currentStrategy === strat.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground hover:text-white'}`}
                    onClick={() => {
                      onSelect(strat.id);
                      setOpen(false);
                    }}
                  >
                    <div className="relative">
                        <FileCode className="w-5 h-5" />
                        {strat.is_active && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-black" />
                        )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{strat.name}</div>
                        <div className="text-[10px] opacity-60 truncate">{strat.description || strat.id}</div>
                    </div>
                    {strat.is_active && (
                        <div className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-black uppercase">LIVE</div>
                    )}
                  </Button>
                ))}

                {filteredStrategies.length === 0 && !loading && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No matching strategies found.
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
