
import { useState, useEffect, useCallback, useRef } from "react";

const WS_URL = "ws://localhost:5002";

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

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      // Subscribe to symbols
      if (symbols.length > 0) {
        ws.current?.send(JSON.stringify({
          action: "subscribe",
          symbols: symbols.map(s => ({ symbol: s, exchange: "NSE" }))
        }));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        // Handle flattened LTP updates from the new backend relay
        if (data.type === "tick" && data.symbol && data.ltp !== undefined) {
          setPrices(prev => ({
            ...prev,
            [data.symbol]: data.ltp
          }));
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected");
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket Error", error);
      ws.current?.close();
    };
  }, [symbols]);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  return { lastMessage, isConnected, prices };
}
