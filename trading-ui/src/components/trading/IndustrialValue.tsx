import { useState, useEffect, useRef } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";

interface IndustrialValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  flashOnUpdate?: boolean;
}

/**
 * IndustrialValue: Professional telemetry display
 * - 600ms count-up animation
 * - Color flash on delta change (secondary for up, destructive for down)
 * - JetBrains Mono styling
 */
export function IndustrialValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  className = "",
  flashOnUpdate = true,
}: IndustrialValueProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevValue = useRef(value);

  // Motion Value for count-up
  const spring = useSpring(value ?? 0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const displayValue = useTransform(spring, (latest) => {
    if (isNaN(latest) || latest === null || latest === undefined) return "0.00";
    return latest.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  });

  useEffect(() => {
    const safeValue = value ?? 0;
    if (flashOnUpdate && safeValue !== prevValue.current) {
      setFlash(safeValue > prevValue.current ? "up" : "down");
      setTimeout(() => setFlash(null), 400);
    }
    spring.set(safeValue);
    prevValue.current = safeValue;
  }, [value, spring, flashOnUpdate]);

  return (
    <div className={`relative inline-flex items-center font-mono tabular-nums ${className}`}>
      {/* Background Flash Layer - Integrated with global CSS classes */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-x-[-4px] inset-y-[-2px] z-[-1] ${
              flash === "up" ? "pnl-flash-up" : "pnl-flash-down"
            }`}
          />
        )}
      </AnimatePresence>

      <span className={`flex items-center transition-colors duration-200 ${flash === "up" ? "text-secondary font-black" : flash === "down" ? "text-destructive font-black" : ""}`}>
        {prefix && <span className="opacity-40 mr-0.5">{prefix}</span>}
        <motion.span>{displayValue}</motion.span>
        {suffix && <span className="opacity-40 ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}
