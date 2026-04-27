import { useState, useEffect, useCallback, useRef } from "react";
import { CONFIG } from "@/lib/config";

const WS_URL = CONFIG.WS_URL;

interface WebSocketMessage {
  t?: string;        // message type (e.g. "ltp", "quote", "depth")
  s?: string;        // symbol
  symbol?: string;   // alternate symbol key
  lp?: number;       // last price (compact format)
  ltp?: number;      // last traded price
  type?: string;     // event type (tick, signal, trade, etc)
  payload?: any;     // structured data for events
  timestamp?: number;
  [key: string]: unknown;
}
import { supabase } from "@/integrations/supabase/client";

export function useWebSocket(symbols: string[] = []) {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [latency, setLatency] = useState<number>(0);
  const lastPingTS = useRef<number>(0);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedSymbols = useRef<string[]>([]);
  const isIntentionalClose = useRef(false);

    const connect = useCallback(async () => {
        if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

        isIntentionalClose.current = false;

        // Fetch auth token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";

        // Connect WITHOUT token in query param as we follow the message-based auth protocol
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.info("WS Connected, sending auth packet...");
            // Protocol: Send auth message FIRST
            ws.current?.send(JSON.stringify({
                type: "auth",
                token: token
            }));
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle Handshake Success
                if (data.type === "auth_success") {
                    console.info("WS Auth Successful");
                    setIsAuthenticated(true);

                    // Now safe to subscribe
                    if (symbols.length > 0) {
                        ws.current?.send(JSON.stringify({
                            action: "subscribe",
                            symbols: symbols.map(s => ({ symbol: s, exchange: "NSE" }))
                        }));
                        subscribedSymbols.current = [...symbols];
                    }

                    // Initial ping
                    lastPingTS.current = Date.now();
                    ws.current?.send(JSON.stringify({ type: "ping", timestamp: lastPingTS.current }));
                    return;
                }

        // Handle Sector Updates (Phase 12)
        if (data.type === "sector_update" && data.payload) {
             setLastMessage(data);
             return;
        }

        setLastMessage(data);

                // Handle Pong
                if (data.type === "pong") {
          const rtt = Date.now() - (data.client_ts || lastPingTS.current);
          setLatency(rtt);
          return;
        }

        // Handle Batched Ticks
        if (data.type === "tick_batch" && Array.isArray(data.payload)) {
          const newPrices: Record<string, number> = {};
          data.payload.forEach((tick: any) => {
             const sym = tick.symbol || tick.s;
             const price = tick.ltp !== undefined ? tick.ltp : tick.lp;
             if (sym && price !== undefined) {
               newPrices[sym] = price;
             }
          });
          setPrices(prev => ({ ...prev, ...newPrices }));
          return;
        }

        // Normalize keys (handle both native and legacy/compact formats)
        const symbol = data.symbol || data.s;
        const ltp = data.ltp !== undefined ? data.ltp : data.lp;

        if (symbol && ltp !== undefined) {
          setPrices(prev => ({
            ...prev,
            [symbol]: ltp
          }));
        }
      } catch (err) {}
    };

    ws.current.onclose = () => {
      setIsAuthenticated(false);
      ws.current = null;
      if (!isIntentionalClose.current) {
        reconnectTimeout.current = setTimeout(connect, 3000);
      }
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, []);

  const sendMessage = useCallback((msg: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  // Manage connection lifecycle
  useEffect(() => {
    connect();
    return () => {
      isIntentionalClose.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current?.readyState === WebSocket.OPEN) {
        if (subscribedSymbols.current.length > 0) {
          ws.current.send(JSON.stringify({
            action: "unsubscribe",
            symbols: subscribedSymbols.current.map(s => ({ symbol: s, exchange: "NSE" }))
          }));
        }
        ws.current.close();
      }
    };
  }, [connect]);

  // Manage subscriptions independently of connection
  useEffect(() => {
    if (!isAuthenticated || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    const current = subscribedSymbols.current;

    // Unsubscribe old
    if (current.length > 0) {
      ws.current.send(JSON.stringify({
        action: "unsubscribe",
        symbols: current.map(s => ({ symbol: s, exchange: "NSE" }))
      }));
    }

    // Subscribe new
    if (symbols.length > 0) {
      ws.current.send(JSON.stringify({
        action: "subscribe",
        symbols: symbols.map(s => ({ symbol: s, exchange: "NSE" }))
      }));
    }

    subscribedSymbols.current = [...symbols];
  }, [symbols, isAuthenticated]);

  // Periodic Heatbeat/Latency Check
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
        lastPingTS.current = Date.now();
        sendMessage({ type: "ping", timestamp: lastPingTS.current });
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, sendMessage]);

  return { lastMessage, isConnected: isAuthenticated, prices, latency, sendMessage };
}
