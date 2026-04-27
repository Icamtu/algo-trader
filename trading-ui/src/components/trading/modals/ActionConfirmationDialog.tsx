import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  TrendingUp,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActionConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  type?: "BUY" | "SELL" | "NEUTRAL";
  metadata?: {
    symbol?: string;
    quantity?: number;
    price?: number | string;
    totalOrders?: number;
    exposure?: number;
  };
}

export const ActionConfirmationDialog: React.FC<ActionConfirmationDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  type = "NEUTRAL",
  metadata
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      setIsSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setIsSuccess(false);
        setIsConfirming(false);
      }, 1500);
    } catch (error) {
      setIsConfirming(false);
    }
  };

  const isBuy = type === "BUY";
  const isSell = type === "SELL";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-black border-white/10 p-0 overflow-hidden rounded-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,245,255,0.05),transparent)] pointer-events-none" />

        {/* Header Visual Stripe */}
        <div className={cn(
          "h-1.5 w-full",
          isBuy ? "bg-secondary" : isSell ? "bg-destructive" : "bg-primary"
        )} />

        <div className="p-8 space-y-6 relative z-10">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 border",
                isBuy ? "border-secondary/20 text-secondary" : isSell ? "border-destructive/20 text-destructive" : "border-primary/20 text-primary"
              )}>
                {isBuy ? <ArrowUp className="w-5 h-5" /> : isSell ? <ArrowDown className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-widest text-white">
                {title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-mono text-muted-foreground/60 uppercase tracking-tight leading-relaxed text-left">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Metadata Grid */}
          {metadata && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5">
              {metadata.symbol && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">Contract</span>
                  <div className="text-sm font-black font-mono text-white">{metadata.symbol}</div>
                </div>
              )}
              {metadata.quantity && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">Quantity</span>
                  <div className="text-sm font-black font-mono text-white">{metadata.quantity}</div>
                </div>
              )}
              {metadata.totalOrders && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">Batch_Size</span>
                  <div className="text-sm font-black font-mono text-white">{metadata.totalOrders} Signals</div>
                </div>
              )}
              {metadata.exposure !== undefined && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">Exposure_Est</span>
                  <div className="text-sm font-black font-mono text-secondary">₹{metadata.exposure.toLocaleString()}</div>
                </div>
              )}
            </div>
          )}

          {/* Risk Warning */}
          <div className="flex gap-4 p-4 border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Risk_Telemetry_Notice</span>
              <p className="text-[9px] font-mono text-amber-500/60 leading-tight">
                Execution will trigger direct exchange orders. Ensure margin requirements and order slippage parameters are verified.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-3 pt-4 border-t border-white/5">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-3 py-3 bg-secondary text-black font-black uppercase text-xs tracking-[0.2em] w-full"
                >
                  <ShieldCheck className="w-5 h-5 animate-bounce" />
                  Signal_Elevated
                </motion.div>
              ) : (
                <div className="flex gap-3 w-full">
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 rounded-none border border-white/10 text-muted-foreground hover:bg-white/5 uppercase font-black text-[10px] tracking-widest h-12"
                  >
                    Abort
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className={cn(
                      "flex-[2] rounded-none font-black uppercase text-[10px] tracking-widest h-12 transition-all shadow-xl",
                      isBuy ? "bg-secondary text-black hover:bg-white" : isSell ? "bg-destructive text-white hover:bg-red-400" : "bg-primary text-black"
                    )}
                  >
                    {isConfirming ? (
                      <Activity className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    {isConfirming ? "Broadcasting..." : "Verify_&_Execute"}
                  </Button>
                </div>
              )}
            </AnimatePresence>

            <div className="flex justify-between items-center opacity-20">
               <div className="flex gap-0.5">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-1.5 h-0.5 bg-white/40" />
                  ))}
               </div>
               <span className="text-[7px] font-mono font-black uppercase">SECURE_TRANSIT_MODE</span>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
