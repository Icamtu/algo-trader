import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Zap,
  Clock,
  Brain,
  Cpu,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NeuralScanControlProps {
  onScan: (symbol: string, timeframe: string) => void;
  isLoading?: boolean;
}

export function NeuralScanControl({ onScan, isLoading }: NeuralScanControlProps) {
  const [symbols, setSymbols] = useState("NIFTY");
  const [timeframe, setTimeframe] = useState("5m");

  const quickSymbols = ["NIFTY", "BANKNIFTY", "RELIANCE", "HDFCBANK", "TCS"];
  const timeframes = ["1m", "5m", "15m", "1h", "1d"];

  const handleStartScan = () => {
    if (!symbols.trim()) return;
    onScan(symbols.toUpperCase(), timeframe);
  };

  return (
    <Card className="bg-slate-950/40 border-primary/20 backdrop-blur-md overflow-hidden relative group">
      {/* Visual Accents */}
      <div className="absolute top-0 right-0 p-1 opacity-20">
        <Cpu className="w-8 h-8 text-primary" />
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Neural_Scan_Trigger</h3>
        </div>

        <div className="space-y-3">
          {/* Symbol Input */}
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground opacity-70">Asset Group (CSV)</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. NIFTY, BANKNIFTY, RELIANCE"
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                className="bg-black/40 border-primary/20 text-[10px] font-mono h-8 uppercase"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartScan}
                disabled={isLoading || !symbols}
                className="h-8 px-3 border-primary/40 bg-primary/10 hover:bg-primary/20 group"
              >
                <Zap className={cn("w-3.5 h-3.5 mr-1.5", isLoading ? "animate-pulse" : "group-hover:text-primary")} />
                <span className="text-[9px] font-black uppercase">{isLoading ? "ANALYZING..." : "INIT_SCAN"}</span>
              </Button>
            </div>
          </div>

          {/* Quick Stats / Symbols */}
          <div className="flex flex-wrap gap-1.5">
            {quickSymbols.map(s => (
              <Badge
                key={s}
                variant="outline"
                className={cn(
                  "text-[8px] cursor-pointer transition-all hover:bg-primary/20 border-white/5",
                  symbols.toUpperCase().includes(s) ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground/60"
                )}
                onClick={() => setSymbols(prev => prev ? `${prev}, ${s}` : s)}
              >
                {s}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            {/* Timeframe Select */}
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest px-1">Window</Label>
              <div className="flex bg-black/40 rounded-md border border-white/10 p-0.5">
                {timeframes.slice(0, 3).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      "flex-1 py-1 text-[9px] font-mono font-bold rounded transition-all",
                      timeframe === tf ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <Button
              className={cn(
                "h-9 bg-primary hover:bg-white text-black font-black uppercase tracking-widest text-[9px] shadow-lg shadow-primary/10 transition-all",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleStartScan}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
              ) : (
                <Zap className="w-3 h-3 mr-1.5 fill-current" />
              )}
              {isLoading ? "ANALYZING..." : "INIT_SCAN"}
              <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
            </Button>
          </div>
        </div>

        {/* Status Line */}
        <div className="pt-1 flex items-center justify-between">
           <div className="flex items-center gap-1.5">
             <Clock className="w-3 h-3 text-muted-foreground/40" />
             <span className="text-[8px] font-mono text-muted-foreground/30 uppercase">Latency Priority: ULTRA</span>
           </div>
           <Badge variant="outline" className="text-[7px] border-primary/10 text-primary/40 h-3 px-1 leading-none uppercase">
             Ready
           </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
