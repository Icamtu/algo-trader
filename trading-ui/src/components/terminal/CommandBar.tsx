import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Search, Zap, Command, CornerDownLeft, AlertCircle } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface CommandBarProps {
  onCommandExecuted?: (response: any) => void;
}

const COMMAND_SUGGESTIONS = [
  { cmd: "/BUY", desc: "Open long position", example: "/BUY NIFTY 50" },
  { cmd: "/SELL", desc: "Open short position", example: "/SELL NIFTY 50" },
  { cmd: "/CHAIN", desc: "View option chain", example: "/CHAIN NIFTY" },
  { cmd: "/EXIT", desc: "Close specific position", example: "/EXIT SBIN" },
  { cmd: "/PANIC", desc: "EMERGENCY: Close All", example: "/PANIC NOW" },
];

export function CommandBar({ onCommandExecuted }: CommandBarProps) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof COMMAND_SUGGESTIONS>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.startsWith("/")) {
      const filtered = COMMAND_SUGGESTIONS.filter(s => 
        s.cmd.toLowerCase().startsWith(input.split(" ")[0].toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
    setSelectedIndex(0);
  }, [input]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (suggestions.length > 0 && selectedIndex >= 0 && input.split(" ").length === 1) {
        setInput(suggestions[selectedIndex].cmd + " ");
        setSuggestions([]);
      } else {
        executeCommand();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const executeCommand = async () => {
    if (!input.trim()) return;

    if (input.trim().toUpperCase() === "/PANIC NOW") {
        try {
            await algoApi.triggerPanic();
            toast({
                title: "PANIC PROTOCOL EXECUTED",
                description: "All positions squared off successfully.",
                variant: "destructive"
            });
            setInput("");
            return;
        } catch (e) {
            toast({ title: "Panic Failed", description: String(e), variant: "destructive" });
        }
    }

    try {
      const res = await algoApi.sendTerminalCommand(input);
      toast({
        title: "Command Executed",
        description: input.toUpperCase(),
      });
      if (onCommandExecuted) onCommandExecuted(res);
      setInput("");
    } catch (error) {
      toast({
        title: "Execution Error",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative group w-full max-w-2xl mx-auto">
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300
        ${isFocused 
          ? "bg-muted/80 border-primary shadow-[0_0_20px_rgba(var(--primary),0.15)] backdrop-blur-xl" 
          : "bg-muted/40 border-border/50 hover:border-border backdrop-blur-md"}
      `}>
        <Terminal className={`w-5 h-5 ${isFocused ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Command... (Type / for suggestions)"
          className="bg-transparent border-none outline-none flex-1 text-sm font-medium placeholder:text-muted-foreground/50 uppercase tracking-wider"
        />
        <div className="flex items-center gap-2">
            <kbd className="hidden md:flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
            </kbd>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CornerDownLeft className="w-4 h-4" />
            </div>
        </div>
      </div>

      <AnimatePresence>
        {isFocused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-muted border border-border shadow-2xl backdrop-blur-xl z-[100] max-h-60 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border/50 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Global Command Suggestions</span>
            </div>
            {suggestions.map((s, i) => (
              <div
                key={s.cmd}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => {
                  setInput(s.cmd + " ");
                  inputRef.current?.focus();
                }}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all
                  ${i === selectedIndex ? "bg-primary text-primary-foreground translate-x-1" : "hover:bg-muted-foreground/10"}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${i === selectedIndex ? "bg-white/20" : "bg-muted-foreground/10"}`}>
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-widest">{s.cmd}</span>
                    <span className={`text-[10px] opacity-70 ${i === selectedIndex ? "text-primary-foreground" : "text-muted-foreground"}`}>{s.desc}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-mono opacity-50 ${i === selectedIndex ? "hidden" : "block"}`}>{s.example}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
