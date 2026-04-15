import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useTradingMode } from "@/features/openalgo/hooks/useTrading";

interface TradingModeContextValue {
  mode: "sandbox" | "live" | undefined;
  isLoading: boolean;
  isSandbox: boolean;
  isLive: boolean;
  setMode: (mode: "sandbox" | "live") => void;
  isPending: boolean;
}

const TradingModeContext = createContext<TradingModeContextValue | undefined>(undefined);

const STORAGE_KEY = "algodesk_mode";

export function TradingModeProvider({ children }: { children: React.ReactNode }) {
  const { mode, isLoading, setMode: setModeAPI, isPending } = useTradingMode();

  // Sync to localStorage whenever mode changes from API
  useEffect(() => {
    if (mode) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  // On mount, if API hasn't responded yet, read from localStorage for instant UI
  const cachedMode = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as "sandbox" | "live" | null) : null;
  const effectiveMode = mode ?? cachedMode ?? "sandbox";

  const setMode = useCallback((newMode: "sandbox" | "live") => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeAPI(newMode);
  }, [setModeAPI]);

  return (
    <TradingModeContext.Provider
      value={{
        mode: effectiveMode,
        isLoading,
        isSandbox: effectiveMode === "sandbox",
        isLive: effectiveMode === "live",
        setMode,
        isPending,
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
}

export function useTradingModeContext() {
  const ctx = useContext(TradingModeContext);
  if (!ctx) {
    throw new Error("useTradingModeContext must be used within TradingModeProvider");
  }
  return ctx;
}
