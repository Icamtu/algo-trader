import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface AetherPanelProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  glint?: boolean;
  variant?: "glass" | "void" | "outline";
  glow?: boolean;
  showGreebles?: boolean;
  scanning?: boolean;
}

export const AetherPanel = React.forwardRef<HTMLDivElement, AetherPanelProps>(
  ({ className, children, glint = true, variant = "glass", glow = false, showGreebles = false, scanning = false, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          variant === "glass" && "bg-white/[0.02] border border-white/5 backdrop-blur-3xl",
          variant === "void" && "bg-black border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]",
          variant === "outline" && "border border-white/5 hover:border-primary/20 bg-transparent",
          glow && "shadow-[0_0_30px_rgba(var(--primary),0.05)]",
          showGreebles && "industrial-corners",
          className
        )}
        {...props}
      >
        {/* Scanning Effect Layer */}
        {scanning && <div className="scanning-layer" />}

        {/* Decorative elements for institutional feel */}
        {glint && (
          <>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-[40px] h-[40px] bg-primary/5 blur-2xl pointer-events-none" />
            <div className="absolute top-2 left-2 w-1 h-1 bg-primary/10 rounded-full pointer-events-none" />
          </>
        )}

        <div className="relative z-10 h-full">
          {children}
        </div>
      </motion.div>
    );
  }
);

AetherPanel.displayName = "AetherPanel";
