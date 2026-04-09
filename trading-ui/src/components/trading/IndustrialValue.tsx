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
 * - 400ms ease-out count-up animation
 * - Color flash on delta change (teal for up, red for down)
 * - IBM Plex Mono styling
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
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const displayValue = useTransform(spring, (latest) => 
    latest.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  );

  useEffect(() => {
    if (flashOnUpdate && value !== prevValue.current) {
      setFlash(value > prevValue.current ? "up" : "down");
      setTimeout(() => setFlash(null), 400);
    }
    spring.set(value);
    prevValue.current = value;
  }, [value, spring, flashOnUpdate]);

  return (
    <div className={`relative inline-flex items-center font-mono tabular-nums ${className}`}>
      {/* Background Flash Layer */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`absolute inset-x-[-4px] inset-y-[-2px] z-[-1] ${
              flash === "up" ? "bg-secondary" : "bg-destructive"
            }`}
          />
        )}
      </AnimatePresence>

      <span className="flex items-center">
        {prefix && <span className="opacity-40 mr-0.5">{prefix}</span>}
        <motion.span>{displayValue}</motion.span>
        {suffix && <span className="opacity-40 ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}
