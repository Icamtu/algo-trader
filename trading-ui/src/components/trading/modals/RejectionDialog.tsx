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
import { Input } from "@/components/ui/input";
import {
  Trash2,
  XSquare,
  ZapOff,
  AlertCircle,
  Hash,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface RejectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  title?: string;
  description?: string;
  batchCount?: number;
}

const QUICK_REASONS = [
  "MANUAL_OVERRIDE",
  "VOLATILITY_LOCK",
  "SLIPPAGE_PROTECT",
  "STRATEGY_MALFUNCTION",
  "RISK_LIMIT_BREACH",
  "FAT_FINGER_VOID"
];

export const RejectionDialog: React.FC<RejectionDialogProps> = ({
  isOpen,
  onOpenChange,
  onConfirm,
  title = "PURGE_SIGNAL_PROTOCOL",
  description = "Execution will permanently suppress the selected signals. This action is recorded in the system audit logs.",
  batchCount
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(reason || "UNSPECIFIED_PURGE");
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error("Rejection submission failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-black border-destructive/20 p-0 overflow-hidden rounded-none shadow-[0_0_50px_rgba(255,0,0,0.05)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.05),transparent)] pointer-events-none" />

        {/* Header Visual Stripe */}
        <div className="h-1.5 w-full bg-destructive" />

        <div className="p-8 space-y-6 relative z-10">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 border border-destructive/20 text-destructive bg-destructive/5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2">
                  {title}
                  {batchCount && batchCount > 1 && (
                    <span className="text-secondary text-sm font-mono tracking-tighter ml-2 bg-secondary/10 px-2">x{batchCount}</span>
                  )}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs font-mono text-muted-foreground/60 uppercase tracking-tight leading-relaxed text-left">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Quick Reasons Grid */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
              <Hash className="w-3 h-3" /> Quick_Classification
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_REASONS.map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  size="sm"
                  onClick={() => setReason(r)}
                  className={cn(
                    "text-[9px] h-9 font-black tracking-widest uppercase border-white/5 bg-white/[0.02] hover:bg-destructive hover:text-white transition-all rounded-none",
                    reason === r && "border-destructive text-destructive bg-destructive/5"
                  )}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Reason Input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
              <MessageSquare className="w-3 h-3" /> Audit_Commentary
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value.toUpperCase().replace(/\s/g, '_'))}
              placeholder="ENTER_VOID_REASON..."
              className="bg-white/[0.03] border-white/10 text-xs font-mono tracking-widest uppercase rounded-none h-12 focus:border-destructive/50 transition-all placeholder:text-muted-foreground/10"
            />
          </div>

          <DialogFooter className="pt-4 border-t border-white/5 flex gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-none border border-white/10 text-muted-foreground hover:bg-white/5 uppercase font-black text-[10px] tracking-widest h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] rounded-none bg-destructive text-white hover:bg-red-400 font-black uppercase text-[10px] tracking-widest h-12 shadow-xl shadow-destructive/10"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <ZapOff className="w-4 h-4 animate-spin" /> Purging...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XSquare className="w-4 h-4" /> Purge_Signals
                </div>
              )}
            </Button>
          </DialogFooter>
        </div>

        {/* Terminal Effect Decoration */}
        <div className="px-8 pb-4 opacity-5 flex justify-between items-center pointer-events-none">
           <div className="flex gap-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-destructive rounded-full" />
              ))}
           </div>
           <span className="text-[7px] font-mono font-black text-destructive italic">ROOT_VOID_PROTOCOL_ACTIVE</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
