import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { algoApi } from "@/features/openalgo/api/client";

// Helper to avoid repetitive JSON.stringify
function json_stringify(obj: any) {
  return JSON.stringify(obj);
}

interface Tick {
  symbol: string;
  ltp: number;
  timestamp: number;
  chg_pct?: string;
}

interface EngineLog {
  time: string;
  level: string;
  module: string;
  msg: string;
}

interface AetherContextType {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  ticks: Record<string, Tick>;
  telemetry: {
    regime: string;
    reasoning: string;
    pos_mult: number;
    risk_mult: number;
    active_trades_count: number;
    last_update: number;
  };
  latency: number;
  connectionStatus: "connected" | "disconnected" | "connecting" | "error";
  subscribe: (symbols: string[]) => void;
  tickerSymbols: string[];
  riskStatus: any;
  strategyMatrix: any[];
  logs: EngineLog[];
}

const AetherContext = createContext<AetherContextType | undefined>(undefined);

export function AetherProvider({ children }: { children: ReactNode }) {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [tickerSymbols, setTickerSymbols] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState({
    regime: "NEUTRAL",
    reasoning: "System initializing...",
    pos_mult: 1.0,
    risk_mult: 1.0,
    active_trades_count: 0,
    last_update: Date.now() / 1000
  });
  const [latency, setLatency] = useState(0);
  const [riskStatus, setRiskStatus] = useState<any>(null);
  const [strategyMatrix, setStrategyMatrix] = useState<any[]>([]);
  const [logs, setLogs] = useState<EngineLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting" | "error">("disconnected");

  const { session } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const lastPingTS = useRef<number>(0);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");
    // Priority: Supabase Session Token -> Aether Token -> Test Token
    const token = session?.access_token || localStorage.getItem("aether_token") || "test-token";
    const host = window.location.host;

    // Connect to the unified proxy path /algo-ws (which maps to port 5002)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${host}/algo-ws`);
    ws.current = socket;

    socket.onopen = () => {
      console.log("AetherEngine WebSocket Connected. Authenticating...");
      socket.send(json_stringify({
        type: "auth",
        token: token
      }));
    };

    socket.onmessage = (event) => {
      try {
        const rawData: string = event.data;

        // Split on newline boundaries first (newline-delimited JSON from engine),
        // then fall back to the whole frame. This handles both single and batched frames
        // without fragile brace counting.
        const messages: string[] = rawData
          .split(/\n/)
          .map((s) => s.trim())
          .filter((s) => s.startsWith("{") && s.endsWith("}"));

        if (messages.length === 0) messages.push(rawData.trim());

        messages.forEach(msg => {
          try {
            const data = JSON.parse(msg.trim());
            if (!data) return;

            if (data.type === "auth_success") {
              console.log("AetherEngine Auth Successful.");
              setConnectionStatus("connected");
            } else if (data.type === "pong") {
              const rtt = Date.now() - (data.client_ts || lastPingTS.current);
              setLatency(rtt);
            } else if (data.type === "regime_update") {
              setTelemetry(prev => ({ ...prev, ...data.payload }));
            } else if (data.type === "tick_batch") {
              setTicks((prev) => {
                const next = { ...prev };
                data.payload.forEach((tick: Tick) => {
                  next[tick.symbol] = tick;
                });
                return next;
              });
            } else if (data.type === "risk_update") {
              setRiskStatus(data.payload);
            } else if (data.type === "matrix_update") {
              setStrategyMatrix(data.payload.strategies);
            } else if (data.type === "logs") {
              setLogs(data.data);
            }
          } catch (e) {
            console.warn("Fragmented JSON chunk skipped:", msg.substring(0, 50));
          }
        });
      } catch (err) {
        console.error("Critical WS logic failure:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("AetherEngine WebSocket Error:", error);
      setConnectionStatus("error");
    };

    socket.onclose = () => {
      console.log("AetherEngine WebSocket Closed.");
      setConnectionStatus("disconnected");
      setTimeout(connect, 3000);
    };
  }, [session]);

  // Fetch tickers from backend config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await algoApi.getTickerConfig();
        if (config?.ticker_symbols) {
          const symbols = config.ticker_symbols.map((t: any) => t.symbol);
          setTickerSymbols(symbols);

          // Initial set of ticks to avoid empty UI
          const initialTicks: Record<string, Tick> = {};
          symbols.forEach((s: string) => {
            initialTicks[s] = { symbol: s, ltp: 0, timestamp: Date.now() };
          });
          setTicks(prev => ({ ...initialTicks, ...prev }));
        }
      } catch (err) {
        console.warn("TICKER_CONFIG_FAULT (falling back to defaults)", err);
        const defaults = ["NIFTY_50", "BANK_NIFTY", "RELIANCE"];
        setTickerSymbols(defaults);
      }
    };
    fetchConfig();
  }, []);

  const subscribe = useCallback((symbols: string[]) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(json_stringify({
        action: "subscribe",
        symbols: symbols
      }));
    }
  }, []);

  // Sync subscription when tickerSymbols or connection state changes
  useEffect(() => {
    if (connectionStatus === "connected" && tickerSymbols.length > 0) {
      subscribe(tickerSymbols);
    }
  }, [connectionStatus, tickerSymbols, subscribe]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        // Phase 16: Safe cleanup to avoid "closed before established" console noise
        // Nullify listeners first to prevent any logic from firing during transition
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;

        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.close();
        }
        ws.current = null;
      }
    };
  }, [connect]);

  // Periodic Heartbeat
  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        lastPingTS.current = Date.now();
        ws.current.send(JSON.stringify({ type: "ping", timestamp: lastPingTS.current }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  return (
    <AetherContext.Provider value={{
      selectedSymbol,
      setSelectedSymbol,
      ticks,
      telemetry,
      latency,
      connectionStatus,
      subscribe,
      tickerSymbols,
      riskStatus,
      strategyMatrix,
      logs
    }}>
      {children}
    </AetherContext.Provider>
  );
}

export function useAether() {
  const context = useContext(AetherContext);
  if (context === undefined) {
    throw new Error("useAether must be used within an AetherProvider");
  }
  return context;
}
