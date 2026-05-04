import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RegimeGaugeProps {
  score: number; // 0 to 1
  label?: string;
  regime?: string;
  className?: string;
}

export const RegimeGauge: React.FC<RegimeGaugeProps> = ({
  score = 0.5,
  label = "TREND_STRENGTH",
  regime = "NEUTRAL",
  className
}) => {
  const rotation = useMemo(() => (score * 180) - 90, [score]);

  const getColor = (s: number) => {
    if (s > 0.7) return "text-emerald-500";
    if (s > 0.4) return "text-amber-500";
    return "text-rose-500";
  };

  const colorClass = getColor(score);

  return (
    <div className={cn("relative flex flex-col items-center justify-center p-4 h-64", className)}>
      {/* Gauge Background */}
      <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
        {/* Track */}
        <path
          d="M20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-muted-foreground/10"
        />

        {/* Segments Indicators */}
        {[...Array(9)].map((_, i) => {
          const angle = (i * 22.5) - 180;
          const rad = (angle * Math.PI) / 180;
          const x1 = 100 + 70 * Math.cos(rad);
          const y1 = 100 + 70 * Math.sin(rad);
          const x2 = 100 + 85 * Math.cos(rad);
          const y2 = 100 + 85 * Math.sin(rad);

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/20"
            />
          );
        })}

        {/* Active Path */}
        <motion.path
          d="M20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="251.32"
          initial={{ strokeDashoffset: 251.32 }}
          animate={{ strokeDashoffset: 251.32 * (1 - score) }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={colorClass}
        />

        {/* Needle */}
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-primary"
          />
          <circle cx="100" cy="100" r="6" className="fill-background stroke-primary stroke-2" />
        </motion.g>
      </svg>

      {/* Info Overlay */}
      <div className="absolute bottom-4 flex flex-col items-center">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">
          {label}
        </div>
        <div className={cn("text-2xl font-black tracking-tighter uppercase", colorClass)}>
          {Math.round(score * 100)}%
        </div>
        <div className="mt-2 px-3 py-0.5 border border-white/5 bg-background/80 text-[9px] font-black tracking-tighter uppercase text-muted-foreground">
          MODE:: {regime}
        </div>
      </div>

      {/* Scan Lines and Noise */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('/noise.svg')]" />
    </div>
  );
};
