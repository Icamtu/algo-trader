import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Activity, ShieldCheck, Info, RefreshCcw } from 'lucide-react';
import { RegimeGauge } from '@/features/intelligence/components/RegimeGauge';
import { SectorBento } from '@/features/intelligence/components/SectorBento';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { useAether } from '@/contexts/AetherContext';
import { useAppModeStore } from '@/stores/appModeStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketRegimeData {
  market_regime: string;
  trend_strength: number;
  bias: string;
  sector_sentiment: Record<string, {
    sentiment: string;
    conviction: number;
    picks: string[];
  }>;
  reasoning: string;
}

export default function MarketRegimePage() {
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColor = isAD ? "text-amber-500" : "text-teal-500";
  const [data, setData] = useState<MarketRegimeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRegimeData = async () => {
    try {
      setLoading(true);
      // Using the unified port 18788 for engine API
      const response = await fetch('http://100.66.171.30:18788/api/v1/market_regime', {
        headers: {
          'apikey': import.meta.env.VITE_OPENALGO_API_KEY
        }
      });
      const result = await response.json();
      if (result.status === "success") {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch regime data:", error);
      toast.error("NETWORK_FAILURE::INTELLIGENCE_UPLINK_OFFLINE");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegimeData();
    const interval = setInterval(fetchRegimeData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const formattedSectors = data ? Object.entries(data.sector_sentiment).map(([sector, details]) => ({
    sector,
    ...details
  })) : [];

  return (
    <div className="h-full flex flex-col p-8 space-y-8 bg-background overflow-y-auto custom-scrollbar font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 border rounded-sm", isAD ? "border-amber-500/20 bg-amber-500/5" : "border-teal-500/20 bg-teal-500/5")}>
              <Brain className={cn("h-6 w-6", primaryColor)} />
            </div>
            <div>
              <h1 className={cn("text-3xl font-black tracking-[0.3em] uppercase", primaryColor)}>REGIME_INTEL</h1>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                Unified Sector Biometrics & Trend Vectors // v1.0.4
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchRegimeData}
          disabled={loading}
          className="p-3 border border-border/10 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading && !data ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Activity className="h-8 w-8 text-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Synchronizing_Neural_Layer...</span>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full"
          >
            {/* Left Column: Market Gauge & Reasoning */}
            <div className="lg:col-span-4 space-y-8">
              <AetherPanel className="p-8 bg-background/20 border-border/10">
                <h3 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> MARKET_TREND_VECTOR
                </h3>
                <RegimeGauge
                  score={data?.trend_strength || 0.5}
                  label="STRENGTH_INDEX"
                  regime={data?.market_regime || "ANALYZING"}
                />

                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase">
                    <span className="text-muted-foreground/60">PRIMARY_BIAS::</span>
                    <span className={cn(
                      data?.bias === "BULLISH" ? "text-emerald-500" :
                      data?.bias === "BEARISH" ? "text-rose-500" :
                      "text-amber-500"
                    )}>{data?.bias}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase">
                    <span className="text-muted-foreground/60">SYSTEM_MODE::</span>
                    <span className="text-primary">AUTONOMOUS</span>
                  </div>
                </div>
              </AetherPanel>

              <AetherPanel className="p-6 border-primary/10 bg-primary/2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> AETHER_SECURITY_AUDIT
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed italic font-bold">
                  "Regime detected as {data?.market_regime}. Bias is currently {data?.bias}.
                  Execution engines are optimized for high-conviction sector plays in {formattedSectors.find(s => s.sentiment === 'BULLISH')?.sector || 'NIFTY BANK'}."
                </p>
              </AetherPanel>
            </div>

            {/* Right Column: Sector Bento & Narrative */}
            <div className="lg:col-span-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> SECTOR_CONVICTION_MAP
                  </h2>
                  <div className="text-[9px] font-black p-1 bg-black/40 border border-white/5 uppercase tracking-widest text-muted-foreground">
                    MODELS:: LLM_CLAW_AUTO_REASONER
                  </div>
                </div>
                <SectorBento sectors={formattedSectors} />
              </div>

              <AetherPanel className="p-8 bg-background/20 border-border/10 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <Info className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest">NARRATIVE_REASONING</h3>
                </div>
                <div className="text-[12px] text-muted-foreground leading-relaxed font-bold uppercase space-y-4 whitespace-pre-wrap">
                  {data?.reasoning || "NO_NARRATIVE_DATA_DETECTED_IN_THIS_INFRA_SESSION_..."}
                </div>

                {/* Decorative pulse */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                </div>
              </AetherPanel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
