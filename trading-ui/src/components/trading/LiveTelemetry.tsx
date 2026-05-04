import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Zap, ShieldCheck, ShieldAlert, Cpu, Radio, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface TelemetryEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export function LiveTelemetry() {
  const { lastMessage } = useWebSocket();
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMessage || !lastMessage.type) return;

    // Filter for non-tick events
    if (["signal", "trade_filled", "order_rejected", "heartbeat"].includes(lastMessage.type)) {
      const newEvent: TelemetryEvent = {
        id: Math.random().toString(36).substr(2, 9),
        type: lastMessage.type,
        payload: lastMessage.payload,
        timestamp: lastMessage.timestamp || Date.now() / 1000,
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "trade_filled": return <Zap className="w-3 h-3 text-secondary" />;
      case "order_rejected": return <ShieldAlert className="w-3 h-3 text-destructive" />;
      case "signal": return <Activity className="w-3 h-3 text-primary" />;
      case "heartbeat": return <Cpu className="w-3 h-3 text-muted-foreground/40" />;
      default: return <Radio className="w-3 h-3" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "trade_filled": return "border-secondary/30 bg-secondary/5 text-secondary";
      case "order_rejected": return "border-destructive/30 bg-destructive/5 text-destructive";
      case "signal": return "border-primary/30 bg-primary/5 text-primary";
      case "heartbeat": return "border-border/10 bg-card/5 text-muted-foreground/60";
      default: return "border-border/10 bg-card/5 text-foreground/40";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/5 border border-border overflow-hidden industrial-grid relative">
      <div className="scanline opacity-10" />

      {/* Header */}
      <div className="p-3 border-b border-border bg-card/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            <h3 className="text-[10px] font-black font-display uppercase tracking-[0.2em] text-foreground">Live_Telemetry_Feed</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 border border-primary/20 bg-primary/5">
            <span className="text-[7px] font-mono font-black text-primary uppercase animate-pulse">Socket_Active</span>
        </div>
      </div>

      {/* Feed Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 font-mono"
      >
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
              <Radio className="w-8 h-8 mb-4 animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em]">Listening_for_telemetry...</span>
            </div>
          ) : (
            events.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2 border group transition-all relative overflow-hidden ${getEventColor(event.type)}`}
              >
                <div className="flex items-start gap-3 relative z-10">
                  <div className="mt-0.5 shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{event.type}</span>
                      <span className="text-[7px] opacity-30">{format(event.timestamp * 1000, "HH:mm:ss.SS")}</span>
                    </div>

                    {event.type === "heartbeat" && (
                      <div className="text-[9px] font-black leading-tight flex items-center gap-2">
                        <span className="text-foreground/80">{event.payload.strategy}</span>
                        <ChevronRight className="w-2.5 h-2.5 opacity-20" />
                        <span className="text-primary">{event.payload.symbol}</span>
                        <span className="text-foreground/40">@{event.payload.ltp}</span>
                      </div>
                    )}

                    {event.type === "signal" && (
                      <div className="text-[9px] font-black leading-tight text-foreground/90">
                        {event.payload.message}
                      </div>
                    )}

                    {event.type === "trade_filled" && (
                      <div className="text-[9px] font-black leading-tight space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1 py-0 border ${event.payload.action === 'BUY' ? 'border-secondary/40 text-secondary' : 'border-destructive/40 text-destructive'}`}>
                            {event.payload.action}
                          </span>
                          <span className="text-foreground">{event.payload.quantity} {event.payload.symbol}</span>
                        </div>
                        <div className="text-foreground/40 text-[8px]">EXE_PRICE: ₹{event.payload.price.toFixed(2)}</div>
                      </div>
                    )}

                    {event.type === "order_rejected" && (
                      <div className="text-[9px] font-black leading-tight text-destructive italic">
                        REASON: {event.payload.reason}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Stats */}
      <div className="p-2 border-t border-border bg-card/5 flex items-center justify-between shrink-0 font-mono">
        <span className="text-[7px] font-black text-muted-foreground/30 uppercase tracking-widest">Buffer::{events.length}/50</span>
        <div className="flex items-center gap-2 opacity-50">
           <Zap className="w-2 h-2 text-secondary" />
           <span className="text-[7px] font-black text-foreground uppercase">HFX_Stream</span>
        </div>
      </div>
    </div>
  );
}
