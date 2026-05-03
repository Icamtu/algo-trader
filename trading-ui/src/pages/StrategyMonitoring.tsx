import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { HITLSignalSidebar } from "@/components/trading/HITLSignalSidebar";
import { AuditQueuePanel } from "@/components/trading/AuditQueuePanel";
import { AnalyticsPanel } from "@/components/trading/AnalyticsPanel";
import { LiveBlotter } from "@/components/trading/LiveBlotter";
import { DeploymentSettings } from "@/components/trading/DeploymentSettings";
import { AetherAIReasoningPanel } from "@/components/trading/AetherAIReasoningPanel";
import { NeuralScanControl } from "@/components/trading/NeuralScanControl";
import {
  Activity,
  TrendingUp,
  ShieldCheck,
  Percent,
  BarChart3,
  Target,
  Zap,
  ShieldAlert,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CONFIG } from "@/lib/config";
import { algoApi } from "@/features/aetherdesk/api/client";

const MetricCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
  <Card className="bg-slate-950/40 backdrop-blur-md border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
    {/* Animated background hint */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

    <CardContent className="p-4 relative z-10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 group-hover:text-primary transition-colors">
          {title}
        </span>
        <div className="p-1.5 rounded bg-primary/5 border border-primary/10">
            <Icon className="w-3.5 h-3.5 text-primary/70" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-black tracking-tighter text-foreground tabular-nums font-mono">
          {value}
        </span>
        <div className="flex items-center gap-2 mt-1">
            <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter",
                trend === 'up' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            )}>
              {subtext}
            </span>
            <div className="flex-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: trend === 'up' ? "70%" : "30%" }}
                    className={cn("h-full", trend === 'up' ? "bg-green-500" : "bg-red-500")}
                />
            </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const StrategyMonitoring = () => {
  const { lastMessage } = useWebSocket();
  const [selectedSignal, setSelectedSignal] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [pendingApproval, setPendingApproval] = useState<any>(null);

  // Real-time Urgency Toast
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'hitl_signal' && lastMessage.payload) {
      const newSignal = lastMessage.payload;
      if (newSignal.conviction > 0.8) {
        toast("URGENT: High Conviction Signal", {
          description: `${newSignal.symbol} ${newSignal.action} @ ${newSignal.price} - Approval Required`,
          action: {
            label: "APPROVE",
            onClick: () => setPendingApproval(newSignal)
          },
          icon: <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />,
          duration: 10000,
        });
      }
    }
  }, [lastMessage]);

  const executeApproval = (signal: any) => {
    algoApi.hitlApprove(signal.id)
      .then(result => {
        if (result.status === 'success') {
          toast.success("Trade Approved");
        }
      });
  };

  const handleNeuralScan = async (symbols: string, timeframe: string) => {
    setIsScanning(true);
    setSelectedSignal(null); // Clear selection to show scan result

    try {
      const result = await algoApi.aetherAnalyze(symbols, timeframe);
      if (result.status === 'success') {
        const rawData = result.data;
        const analysisArray = Array.isArray(rawData) ? rawData : [rawData];

        setScanResults(analysisArray);

        if (analysisArray.length > 1) {
          toast.success(`Batch Scan Complete`, {
            description: `Analyzed ${analysisArray.length} symbols. See Reasoning Panel for details.`
          });
        } else if (analysisArray.length === 1) {
          const analysis = analysisArray[0];
          toast.success(`Neural Scan Complete: ${analysis.symbol}`, {
             description: `Analysis shows ${analysis.action} signal with ${(analysis.conviction * 100).toFixed(1)}% conviction.`
          });
        }
      } else {
        toast.error("Scan Failed", { description: result.message || "Engine reported an internal error." });
      }
    } catch (error) {
      toast.error("Connection Error", { description: "Failed to reach Aether Engine." });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-background relative selection:bg-primary/30">
      <div className="noise-overlay" />
      <div className="scanline" />

      <div className="flex-1 flex min-h-0 relative z-10 w-full">
        {/* Left: HITL Signal Desk */}
        <div className="w-80 border-r border-white/5">
          <HITLSignalSidebar
            selectedSignalId={selectedSignal?.id}
            onSelectSignal={(sig) => {
                setSelectedSignal(sig);
                setScanResults([]); // Clear scan when manual signal selected
            }}
          />
        </div>

        {/* Center: Main Audit Matrix & Metrics */}
        <div className="flex-1 flex flex-col min-w-0 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-black/5">

          {/* Header Strip */}
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
                   <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">HITL_Operation_Matrix</h1>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-60">System Core 01 // Monitoring Active</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[9px] px-3 border-white/10 bg-white/5">REAL_TIME_SYNC</Badge>
                <button className="p-2 bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all rounded-md group">
                   <RefreshCw className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
             </div>
          </div>

          {/* Top Metric Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Global Exposure"
              value="₹ 45.2L"
              subtext="+12.4% vs Avg"
              icon={Target}
              trend="up"
            />
            <MetricCard
              title="Neural Sharpe"
              value="2.84"
              subtext="Robust"
              icon={Cpu}
              trend="up"
            />
            <MetricCard
              title="Value at Risk"
              value="₹ 18,402"
              subtext="95% Conf"
              icon={ShieldCheck}
              trend="down"
            />
            <MetricCard
              title="Calmar Ratio"
              value="4.12"
              subtext="Institutional"
              icon={BarChart3}
              trend="up"
            />
          </div>

          {/* Audit Matrix Table */}
          <div className="flex-1 border border-white/5 rounded-xl overflow-hidden bg-slate-950/40 backdrop-blur-md relative min-h-[400px] group shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-30" />
            <AuditQueuePanel />
          </div>

          {/* Live Execution Blotter */}
          <div className="h-48 border border-white/5 rounded-xl overflow-hidden bg-slate-950/40 backdrop-blur-md shadow-xl">
             <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-secondary" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Execution_Blotter</span>
             </div>
             <LiveBlotter />
          </div>
        </div>

        {/* Right: Strategy Onboarding & Intelligence */}
        <div className="w-96 border-l border-white/5 flex flex-col overflow-hidden bg-black/20">
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-0 space-y-0">
            <div className="p-4 space-y-4">
                <DeploymentSettings />
                <NeuralScanControl onScan={handleNeuralScan} isLoading={isScanning} />
            </div>

            <div className="flex-1 min-h-[400px] p-4 pt-0">
                <AetherAIReasoningPanel
                    isLoading={isScanning}
                    data={selectedSignal ? [{
                        logic_core: selectedSignal.ai_reasoning,
                        regime: selectedSignal.metadata?.regime || "ANALYSIS_PENDING",
                        volatility: selectedSignal.metadata?.volatility || "COMPUTING",
                        vectors: selectedSignal.metadata?.vectors || [
                            { label: "Order Imbalance", value: Math.floor(selectedSignal.conviction * 100) },
                            { label: "Market Delta", value: 45 },
                            { label: "Institutional Flow", value: 30 }
                        ],
                        conviction: selectedSignal.conviction,
                        symbol: selectedSignal.symbol
                    }] : scanResults}
                />
            </div>
          </div>
        </div>
      </div>


      {/* HITL Approval Confirmation Dialog */}
      <AlertDialog open={pendingApproval !== null} onOpenChange={(open) => { if (!open) setPendingApproval(null); }}>
        <AlertDialogContent className="bg-slate-950 border-primary/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-black uppercase tracking-widest text-foreground">
              Confirm HITL Signal Approval
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs font-mono text-muted-foreground">
                {pendingApproval && (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="p-2 bg-white/5 border border-white/10">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Strategy</div>
                        <div className="text-white/80 font-black truncate">{pendingApproval.strategy || '—'}</div>
                      </div>
                      <div className="p-2 bg-white/5 border border-white/10">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Symbol</div>
                        <div className="text-white/80 font-black">{pendingApproval.symbol || '—'}</div>
                      </div>
                      <div className="p-2 bg-white/5 border border-white/10">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Action</div>
                        <div className="text-primary font-black">{pendingApproval.action || '—'}</div>
                      </div>
                      <div className="p-2 bg-white/5 border border-white/10">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Conviction</div>
                        <div className="text-white/80 font-black">{pendingApproval.conviction != null ? `${(pendingApproval.conviction * 100).toFixed(1)}%` : '—'}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingApproval(null)}
              className="rounded-none font-black uppercase text-[10px] tracking-widest"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { executeApproval(pendingApproval); setPendingApproval(null); }}
              className="rounded-none font-black uppercase text-[10px] tracking-widest bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center px-4 justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 relative z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="font-bold text-green-500/80">API_LINK: SECURE</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
             <Zap className="w-3 h-3 text-primary" />
             <span className="text-primary font-black">HITL_MODE: ACTIVE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-4 opacity-40">
             <ShieldCheck className="w-3 h-3" />
             <span>Risk_Eng_v4.2</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="opacity-40">Latency: 14ms</span>
          <span className="text-foreground font-black tracking-widest">AetherDesk_Prime <span className="text-primary">v6.0</span></span>
        </div>
      </footer>
    </div>
  );
};

export default StrategyMonitoring;
