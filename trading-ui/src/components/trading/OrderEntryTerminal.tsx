import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Tag,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { algoApi } from "@/features/openalgo/api/client";
import { cn } from "@/lib/utils";

const orderTypes = ["MARKET", "LIMIT", "SL", "SL-M"] as const;
const strategies = ["Momentum Alpha", "Mean Reversion", "Stat Arb", "Pairs Trading", "Manual"];

interface OrderEntryTerminalProps {
  selectedSymbol?: string;
  onClose?: () => void;
}

export function OrderEntryTerminal({ selectedSymbol = "", onClose }: OrderEntryTerminalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    symbol: selectedSymbol,
    side: "BUY" as "BUY" | "SELL",
    qty: "",
    orderType: "MARKET" as typeof orderTypes[number],
    price: "",
    sl: "",
    strategy: "Momentum Alpha",
    isSmartOrder: false,
  });

  useEffect(() => {
    if (selectedSymbol) {
      setForm(prev => ({ ...prev, symbol: selectedSymbol.toUpperCase() }));
    }
  }, [selectedSymbol]);

  const [symbolSuggestions, setSymbolSuggestions] = useState<{ symbol: string; exchange: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSymbolSearch = useCallback((query: string) => {
    setForm(prev => ({ ...prev, symbol: query.toUpperCase() }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSymbolSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await algoApi.searchSymbols(query);
        setSymbolSuggestions(res.results || []);
        setShowSuggestions(true);
      } catch {
        setSymbolSuggestions([]);
      }
    }, 300);
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const orderPayload = {
        symbol: form.symbol.trim().toUpperCase(),
        action: form.side,
        quantity: parseInt(form.qty, 10),
        order_type: form.orderType,
        price: form.price ? parseFloat(form.price) : undefined,
        strategy: form.strategy,
      };

      // Margin Check
      try {
        await algoApi.getMargins(orderPayload);
      } catch (marginError: any) {
        toast({
          variant: "destructive",
          title: "MARGIN_REJECTED",
          description: marginError?.body?.error || "INSUFFICIENT_FUNDS",
        });
        setLoading(false);
        return;
      }

      await algoApi.placeOrder(orderPayload);

      toast({
        title: "ORDER_EXECUTED",
        description: `SIGNAL_SENT::${form.side}_${form.qty}_${form.symbol}`,
      });

    } catch (error: any) {
       toast({
         variant: "destructive",
         title: "WRITE_FAULT",
         description: error?.body?.error || "VALIDATION_FAILURE",
       });
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.symbol && form.qty && (form.orderType === 'MARKET' || form.price);

  return (
    <div className="flex flex-col h-full bg-card/5 select-none">
      <div className="scanline opacity-[0.02]" />

      {/* Side Selector */}
      <div className="flex p-1 gap-1 border-b border-border bg-muted/10">
        <button
          onClick={() => setForm(f => ({ ...f, side: "BUY" }))}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border",
            form.side === "BUY" ? "bg-secondary/10 border-secondary/40 text-secondary" : "border-transparent text-muted-foreground/40 hover:text-muted-foreground"
          )}
        >
          LONG
        </button>
        <button
          onClick={() => setForm(f => ({ ...f, side: "SELL" }))}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border",
            form.side === "SELL" ? "bg-destructive/10 border-destructive/40 text-destructive" : "border-transparent text-muted-foreground/40 hover:text-muted-foreground"
          )}
        >
          SHORT
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Symbol Entry */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            <span>Asset_Ticker</span>
            <span>NSE/BSE</span>
          </div>
          <div className="relative">
            <input
              value={form.symbol}
              onChange={(e) => handleSymbolSearch(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-xs font-mono font-bold uppercase focus:border-secondary outline-none transition-all"
              placeholder="SYMBOL_ID"
            />
            <AnimatePresence>
              {showSuggestions && symbolSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  className="absolute top-full left-0 right-0 z-50 bg-background border border-border shadow-2xl origin-top"
                >
                  {symbolSuggestions.slice(0, 5).map(s => (
                    <button
                      key={s.symbol}
                      onMouseDown={() => {
                        setForm(f => ({ ...f, symbol: s.symbol }));
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-[10px] font-mono hover:bg-muted border-b border-border last:border-0 flex justify-between uppercase"
                    >
                      <span className="font-bold">{s.symbol}</span>
                      <span className="text-[8px] text-muted-foreground">{s.exchange}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Qty & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
             <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Quantity</label>
             <input
              type="number"
              value={form.qty}
              onChange={(e) => setForm(f => ({ ...f, qty: e.target.value }))}
              className="w-full bg-background border border-border px-3 py-2 text-xs font-mono font-bold focus:border-secondary outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
             <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Price</label>
             <input
              type="number"
              disabled={form.orderType === 'MARKET'}
              value={form.price}
              onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
              className="w-full bg-background border border-border px-3 py-2 text-xs font-mono font-bold focus:border-secondary outline-none transition-all disabled:opacity-30"
              placeholder={form.orderType === 'MARKET' ? "MARKET" : "0.00"}
            />
          </div>
        </div>

        {/* Order Type Selector */}
        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Order_Type</label>
          <div className="grid grid-cols-4 gap-1">
            {orderTypes.map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, orderType: t }))}
                className={cn(
                  "py-1 text-[8px] font-black border transition-all",
                  form.orderType === t ? "bg-muted border-border text-foreground" : "border-transparent text-muted-foreground/30 hover:text-muted-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Strategy_Kernel</label>
          <select
             value={form.strategy}
             onChange={(e) => setForm(f => ({ ...f, strategy: e.target.value }))}
             className="w-full bg-background border border-border px-2 py-2 text-[10px] font-mono font-bold uppercase focus:border-secondary outline-none appearance-none cursor-pointer"
          >
            {strategies.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Execution Settings */}
        <div className="pt-2">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setForm(f => ({ ...f, isSmartOrder: !f.isSmartOrder }))}>
             <div className={cn(
                "w-3 h-3 border border-border flex items-center justify-center transition-all",
                form.isSmartOrder ? "bg-secondary border-secondary" : "bg-background"
             )}>
                {form.isSmartOrder && <CheckCircle className="w-2.5 h-2.5 text-black" />}
             </div>
             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">Smart_Order_Execution</span>
          </div>
          <p className="text-[8px] text-muted-foreground/40 font-mono mt-1 uppercase pl-5">Enables iceberg slicing and anti-slippage.</p>
        </div>
      </div>

      {/* Terminal Footer Action */}
      <div className="mt-auto p-4 border-t border-border bg-muted/5 space-y-3">
        <div className="flex justify-between items-center text-[8px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">
           <span>Est_Margin: ₹0.00</span>
           <span>Latency: 4ms</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className={cn(
            "w-full py-3 text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2",
            isValid && !loading
              ? form.side === 'BUY'
                ? "bg-secondary text-secondary-foreground shadow-[0_0_20px_rgba(0,245,255,0.2)]"
                : "bg-destructive text-destructive-foreground shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              : "bg-muted text-muted-foreground/30 border border-border/10 cursor-not-allowed"
          )}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "EXECUTE_SEQ"}
        </button>
      </div>
    </div>
  );
}
