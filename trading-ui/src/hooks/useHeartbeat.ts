import { useState, useEffect, useCallback } from "react";
import { CONFIG } from "@/lib/config";

type HeartbeatStatus = "online" | "offline" | "checking";

interface HeartbeatState {
  status: HeartbeatStatus;
  latencyMs: number | null;
  lastCheck: Date | null;
}

export function useHeartbeat(url = CONFIG.API_BASE_URL + "/", intervalMs = 2000) {
  const [state, setState] = useState<HeartbeatState>({
    status: "checking",
    latencyMs: null,
    lastCheck: null,
  });

  const check = useCallback(async () => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      await fetch(url, { mode: "no-cors", signal: controller.signal });
      clearTimeout(timeout);
      const latency = Math.round(performance.now() - start);
      setState({ status: "online", latencyMs: latency, lastCheck: new Date() });
    } catch {
      setState((prev) => ({ ...prev, status: "offline", lastCheck: new Date() }));
    }
  }, [url]);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return state;
}
