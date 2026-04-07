import { useState, useRef, useEffect } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { ShieldAlert, ArrowRight } from "lucide-react";

interface SlideToConfirmProps {
  onConfirm: () => void;
  label: string;
  className?: string;
}

export function SlideToConfirm({ onConfirm, label, className }: SlideToConfirmProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate the drag limit based on container width
  const dragLimit = 220; // Default limit
  
  const opacity = useTransform(x, [0, dragLimit], [1, 0.2]);
  const color = useTransform(x, [0, dragLimit], ["rgba(239, 68, 68, 1)", "rgba(34, 197, 94, 1)"]);
  const backgroundColor = useTransform(x, [0, dragLimit], ["rgba(239, 68, 68, 0.1)", "rgba(34, 197, 94, 0.2)"]);

  const onDragEnd = () => {
    if (x.get() >= dragLimit - 20) {
      setIsConfirmed(true);
      onConfirm();
      controls.start({ x: dragLimit, transition: { type: "spring", stiffness: 500, damping: 30 } });
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative h-14 bg-muted/30 border border-border/50 rounded-2xl overflow-hidden group select-none ${className}`}
    >
      <motion.div 
        style={{ backgroundColor, width: "100%", height: "100%" }}
        className="absolute inset-0" 
      />
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.span 
          style={{ opacity }}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60"
        >
          {label}
        </motion.span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: dragLimit }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        animate={controls}
        style={{ x }}
        className="absolute left-1.5 top-1.5 bottom-1.5 w-20 bg-destructive rounded-xl shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <div className="flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-white" />
            <ArrowRight className="w-3.5 h-3.5 text-white/50 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
      
      {isConfirmed && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-neon-green flex items-center justify-center z-20"
        >
          <span className="text-white text-[10px] font-black uppercase tracking-widest animate-pulse">PROTOCOL EXECUTED</span>
        </motion.div>
      )}
    </div>
  );
}
