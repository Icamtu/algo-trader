
import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, Zap } from "lucide-react";

interface ModeSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetMode: "sandbox" | "live";
}

export function ModeSafetyModal({ isOpen, onClose, onConfirm, targetMode }: ModeSafetyModalProps) {
  const isLive = targetMode === "live";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] glass-panel border-destructive/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
        
        <DialogHeader className="relative z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 border border-destructive/20 animate-pulse">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl font-bold tracking-tight">
            Elevating to Live Trading
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground pt-2">
            You are about to switch from the Sandbox environment to the **Live Broker** connection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 relative z-10">
          <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <Zap className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <span className="font-bold text-destructive">Real Capital at Risk:</span> All orders placed in this mode will be executed on the exchange with actual funds.
              </p>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <span className="font-bold text-destructive">Execution Logic:</span> Strategies will now use live broker feeds and order types.
              </p>
            </div>
          </div>
          
          <p className="text-[10px] text-center text-muted-foreground italic">
            By proceeding, you acknowledge the risks of algorithmic execution.
          </p>
        </div>

        <DialogFooter className="relative z-10 sm:justify-center gap-2">
          <Button variant="ghost" onClick={onClose} className="hover:bg-white/5">
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-destructive hover:bg-destructive/90 text-white font-bold px-8 shadow-lg shadow-destructive/20"
          >
            CONFIRM LIVE MODE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
