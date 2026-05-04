import React, { useState } from "react";
import { AlertCircle, Check, Settings2 } from "lucide-react";
import { useTradingMode } from "@/features/aetherdesk/hooks/useTrading";
import { useAppModeStore } from "@/stores/appModeStore";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Mode Indicator Component
 * Displays current trading mode (SANDBOX/LIVE) and allows mode switching
 */
export function ModeIndicator() {
  const { mode: tradingMode, setMode, isPending } = useTradingMode();
  const { mode: appMode } = useAppModeStore();
  const [open, setOpen] = useState(false);

  const isLive = tradingMode === "live";
  const isSandbox = tradingMode === "sandbox";
  const isAD = appMode === "AD";

  const modeConfig = {
    sandbox: {
      label: "SANDBOX MODE",
      description: "Safe testing environment - no real capital at risk",
      icon: "🧪",
      color: "text-teal-400",
      bg: "bg-teal-950/30",
      border: "border-teal-500/30",
      badge: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    },
    live: {
      label: "LIVE MODE",
      description: "Real capital trading - DANGEROUS",
      icon: "⚡",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      badge: "bg-destructive/20 text-destructive border-destructive/30 animate-pulse",
    },
  };

  const current = modeConfig[tradingMode as keyof typeof modeConfig] || modeConfig.sandbox;

  const handleModeSwitch = (newMode: "sandbox" | "live") => {
    if (newMode === tradingMode) {
      setOpen(false);
      return;
    }

    setMode(newMode);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border rounded-sm font-mono text-[9px] font-black uppercase tracking-widest transition-all",
            current?.bg,
            current?.border,
            current?.color,
            "hover:opacity-80 cursor-pointer"
          )}
        >
          <span>{current?.icon}</span>
          <span>{current?.label}</span>
          <Settings2 className="w-3 h-3 opacity-60" />
        </button>
      </DialogTrigger>

      <DialogContent className="bg-card/95 border-border/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-black uppercase tracking-[0.2em]">
            Trading Mode Selection
          </DialogTitle>
          <DialogDescription className="text-[9px] font-mono uppercase tracking-widest mt-2">
            Current: {current.label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {/* Sandbox Option */}
          <button
            onClick={() => handleModeSwitch("sandbox")}
            disabled={isPending}
            className={cn(
              "w-full p-4 border rounded-sm transition-all text-left",
              isSandbox
                ? "bg-teal-500/20 border-teal-500/50 shadow-[0_0_12px_rgba(20,184,166,0.2)]"
                : "bg-background/50 border-border/30 hover:border-border/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🧪</span>
                  <span className="font-black text-sm uppercase tracking-wider text-foreground">
                    Sandbox Mode
                  </span>
                  {isSandbox && <Check className="w-4 h-4 text-teal-400" />}
                </div>
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                  Testing environment with paper trading
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 ml-7">
              <p className="text-[8px] font-mono text-muted-foreground/70">
                ✓ No real capital risk
              </p>
              <p className="text-[8px] font-mono text-muted-foreground/70">
                ✓ Full isolation from live
              </p>
              <p className="text-[8px] font-mono text-muted-foreground/70">
                ✓ PaperBroker execution
              </p>
            </div>
          </button>

          {/* Live Option */}
          <button
            onClick={() => handleModeSwitch("live")}
            disabled={isPending}
            className={cn(
              "w-full p-4 border rounded-sm transition-all text-left",
              isLive
                ? "bg-destructive/20 border-destructive/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                : "bg-background/50 border-border/30 hover:border-border/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⚡</span>
                  <span className="font-black text-sm uppercase tracking-wider text-destructive">
                    Live Mode
                  </span>
                  {isLive && <Check className="w-4 h-4 text-destructive" />}
                </div>
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                  Real capital trading with actual broker
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 ml-7">
              <p className="text-[8px] font-mono text-destructive/70">
                ⚠ Real capital at risk
              </p>
              <p className="text-[8px] font-mono text-destructive/70">
                ⚠ Live broker connection
              </p>
              <p className="text-[8px] font-mono text-destructive/70">
                ⚠ Production execution
              </p>
            </div>
          </button>
        </div>

        {/* Warning for Live Mode */}
        {isLive && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-mono font-black text-destructive uppercase tracking-widest mb-1">
                ⚠ Live Mode Active
              </p>
              <p className="text-[8px] font-mono text-muted-foreground/80">
                Real capital is currently at risk. All orders will be executed on live broker.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-[9px] font-mono font-black uppercase"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
