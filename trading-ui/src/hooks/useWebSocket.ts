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
  const [isConnected, setIsConnected] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [latency, setLatency] = useState<number>(0);
  const lastPingTS = useRef<number>(0);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const subscribedSymbols = useRef<string[]>([]);
  const isIntentionalClose = useRef(false);

  const connect = useCallback(async () => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

    isIntentionalClose.current = false;
    
    // Fetch auth token for secure websocket connection
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const wsUrlWithAuth = token ? `${WS_URL}?token=${token}` : WS_URL;
    
    ws.current = new WebSocket(wsUrlWithAuth);

    ws.current.onopen = () => {
      setIsConnected(true);
      // Subscribe to symbols
      if (symbols.length > 0) {
        ws.current?.send(JSON.stringify({
          action: "subscribe",
          symbols: symbols.map(s => ({ symbol: s, exchange: "NSE" }))
        }));
        subscribedSymbols.current = [...symbols];
      }
      
      // Send initial ping
      lastPingTS.current = Date.now();
      ws.current?.send(JSON.stringify({ type: "ping", timestamp: lastPingTS.current }));
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
      setIsConnected(false);
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
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    
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
  }, [symbols, isConnected]);

  // Periodic Heatbeat/Latency Check
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
        lastPingTS.current = Date.now();
        sendMessage({ type: "ping", timestamp: lastPingTS.current });
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return { lastMessage, isConnected, prices, latency, sendMessage };
}

