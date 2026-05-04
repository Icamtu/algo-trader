import React from "react";

export type BrokerId =
  | "shoonya" | "zerodha" | "angel" | "upstox" | "aliceblue"
  | "fyers" | "dhan" | "fivepaisa" | "flattrade" | "kotak"
  | "paytm" | "icicidirect" | "iifl" | "motilal" | "groww"
  | "mstock" | "samco" | "zebu" | "jainamxts" | "finvasia"
  | "compositedge" | "definedge" | "deltaexchange" | "firstock"
  | "tradelab" | "wisdom" | "pocketful" | "rmoney" | "tradejini"
  | "ibkr" | "alpaca" | "binance" | "bybit" | "okx";

interface BrokerLogoProps {
  id: BrokerId | string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

/**
 * High-fidelity Broker Logo component.
 * Uses a combination of stylized initials and brand-accurate colors
 * for an Industrial Precision aesthetic.
 */
export function BrokerLogo({ id, className = "", size = "md" }: BrokerLogoProps) {
  const normalizedId = id.toLowerCase();

  // Mapping of broker IDs to brand colors (Amber/Industrial theme compatible)
  const colorMap: Record<string, string> = {
    shoonya: "#FFB000", // Aether Amber
    zerodha: "#387ed1", // Blue
    angel: "#0052cc",   // Deep Blue
    upstox: "#3f2d87",  // Purple
    aliceblue: "#0066cc",
    fyers: "#00a144",   // Green
    dhan: "#ffcc00",
    fivepaisa: "#00b259",
    flattrade: "#003b71",
    kotak: "#ed1c24",
    paytm: "#00baf2",
    ibkr: "#cc0000",
    alpaca: "#ffcc00",
    mstock: "#f37021",
    groww: "#00d09c",
  };

  const brandColor = colorMap[normalizedId] || "currentColor";
  const initials = normalizedId.slice(0, 2).toUpperCase();

  // For now, we use high-end stylized SVG avatars.
  // In a real production environment, these would be local SVG assets or CDN links.
  return (
    <div
      className={`relative flex items-center justify-center rounded-lg border border-white/10 bg-black/40 overflow-hidden ${sizeMap[size]} ${className}`}
      style={{ boxShadow: `0 0 10px ${brandColor}22` }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none industrial-grid" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      {/* Dynamic Placeholder with brand flavor */}
      <span
        className="font-display font-black text-[35%] tracking-tighter"
        style={{ color: brandColor }}
      >
        {initials}
      </span>

      {/* Industrial Accents */}
      <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-white/20" />
      <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-white/20" />
    </div>
  );
}
