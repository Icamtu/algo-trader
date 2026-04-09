import { useState, useEffect, useCallback, useRef } from "react";
import { CONFIG } from "@/lib/config";

const WS_URL = CONFIG.WS_URL;

interface WebSocketMessage {
  t?: string;        // message type (e.g. "ltp", "quote", "depth")
  s?: string;        // symbol
  symbol?: string;   // alternate symbol key
  lp?: number;       // last price (compact format)
  ltp?: number;      // last traded price
  [key: string]: unknown;
}

export function useWebSocket(symbols: string[] = []) {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const subscribedSymbols = useRef<string[]>([]);
  const isIntentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

    isIntentionalClose.current = false;
    ws.current = new WebSocket(WS_URL);

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
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        if (data.type === "tick" && data.symbol && data.ltp !== undefined) {
          setPrices(prev => ({
            ...prev,
            [data.symbol]: data.ltp
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
  }, []); // Remove symbols from dependency to prevent flapping

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

  return { lastMessage, isConnected, prices };
}

