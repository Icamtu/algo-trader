import React, { createContext, useContext, useEffect, useState } from "react";

interface TerminalSettings {
  gridOpacity: number;
  noiseOpacity: number;
  scanlineIntensity: number;
  accentColor: "amber" | "teal" | "crimson";
  enableGlint: boolean;
  chartEngine: "recharts" | "lightweight" | "tradingview";
  perfProfile: "low" | "balanced" | "ultra";
  showWatermark: boolean;
}

interface TerminalSettingsContextValue {
  settings: TerminalSettings;
  updateSettings: (newSettings: Partial<TerminalSettings>) => void;
}

const TerminalSettingsContext = createContext<TerminalSettingsContextValue | undefined>(undefined);

const STORAGE_KEY = "algodesk_visual_settings";

const defaultSettings: TerminalSettings = {
  gridOpacity: 2,
  noiseOpacity: 3,
  scanlineIntensity: 10,
  accentColor: "amber",
  enableGlint: true,
  chartEngine: "lightweight",
  perfProfile: "balanced",
  showWatermark: true,
};

export function TerminalSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TerminalSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultSettings;
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    // Apply settings to Document Root CSS Variables
    const root = document.documentElement;
    root.style.setProperty("--visual-grid-opacity", (settings.gridOpacity / 100).toString());
    root.style.setProperty("--visual-noise-opacity", (settings.noiseOpacity / 100).toString());
    root.style.setProperty("--visual-scanline-opacity", (settings.scanlineIntensity / 100).toString());

    // Update Theme Colors
    if (settings.accentColor === "amber") {
      root.style.setProperty("--primary", "41 100% 50%");
      root.style.setProperty("--secondary", "180 100% 42%");
    } else if (settings.accentColor === "teal") {
      root.style.setProperty("--primary", "180 100% 42%");
      root.style.setProperty("--secondary", "41 100% 50%");
    } else if (settings.accentColor === "crimson") {
      root.style.setProperty("--primary", "0 84% 60%");
      root.style.setProperty("--secondary", "180 100% 42%");
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<TerminalSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <TerminalSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </TerminalSettingsContext.Provider>
  );
}

export function useTerminalSettings() {
  const ctx = useContext(TerminalSettingsContext);
  if (!ctx) throw new Error("useTerminalSettings must be used within TerminalSettingsProvider");
  return ctx;
}
