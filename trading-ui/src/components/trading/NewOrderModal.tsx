import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, ArrowDownRight, Search, Tag, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { algoApi } from "@/lib/api-client";
import { ApiError } from "@/types/api";

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledSymbol?: string;
}

const orderTypes = ["MARKET", "LIMIT", "SL", "SL-M"] as const;
const strategies = ["Momentum Alpha", "Mean Reversion", "Stat Arb", "Pairs Trading", "Manual"];

export function NewOrderModal({ isOpen, onClose, prefilledSymbol = "" }: NewOrderModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    symbol: prefilledSymbol,
    side: "BUY" as "BUY" | "SELL",
    qty: "",
    orderType: "MARKET" as typeof orderTypes[number],
    price: "",
    sl: "",
    strategy: "Momentum Alpha",
    isSmartOrder: false,
  });

  useEffect(() => {
    if (prefilledSymbol) {
      setForm(prev => ({ ...prev, symbol: prefilledSymbol }));
    }
  }, [prefilledSymbol]);

  // Symbol autocomplete
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        if (e.key === "Escape") onClose();
        return;
      }
      
      switch(e.key.toLowerCase()) {
        case "b":
          setForm(prev => ({ ...prev, side: "BUY" }));
          e.preventDefault();
          break;
        case "s":
          setForm(prev => ({ ...prev, side: "SELL" }));
          e.preventDefault();
          break;
        case "escape":
          onClose();
          break;
        case "f5":
          window.location.reload();
          e.preventDefault();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (action: "place" | "cancel") => {
    if (action === "cancel") {
      onClose();
      return;
    }

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

      try {
        await algoApi.getMargins(orderPayload);
      } catch (marginError: any) {
        const msg = marginError?.body?.error || marginError?.message || "MARGIN_VALIDATION_FAILURE";
        toast({
          variant: "destructive",
          title: "MARGIN_REJECTED",
          description: `KERNEL_REJECTION::${msg}`,
        });
        setLoading(false);
        return;
      }

      if (form.isSmartOrder) {
        await algoApi.smartOrder({
          ...orderPayload,
          positionsize: parseInt(form.qty, 10)
        });
      } else {
        await algoApi.placeOrder(orderPayload);
      }

      toast({
        title: "ORDER_EXECUTED",
        description: `SIGNAL_SENT::${form.side}_${form.qty}_${form.symbol}`,
      });
      
      onClose();
      setForm({
        symbol: "",
        side: "BUY",
        qty: "",
        orderType: "MARKET",
        price: "",
        sl: "",
        strategy: "Momentum Alpha",
        isSmartOrder: false,
      });
    } catch (error: any) {
       toast({
         variant: "destructive",
         title: "WRITE_FAULT",
         description: `KERNEL_REJECTION::${error?.body?.error || "VALIDATION_FAILURE"}`,
       });
    } finally {
      setLoading(false);
    }
  };

  const qtyNum = parseInt(form.qty, 10);
  const isSymbolValid = /^[A-Z0-9_-]+$/.test(form.symbol.trim());
  const isQtyValid = form.qty !== "" && Number.isInteger(qtyNum) && qtyNum > 0;
  const isPriceValid = form.orderType === "MARKET" || (form.price !== "" && parseFloat(form.price) > 0);
  const isValid = isSymbolValid && isQtyValid && isPriceValid;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-xl z-[150] industrial-grid"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-background border-2 border-border shadow-[0_0_100px_rgba(0,0,0,0.8)] z-[160] overflow-hidden p-0"
          >
            <div className="scanline opacity-10" />
            <div className="absolute inset-0 bg-card/10 pointer-events-none" />
            
            {/* Master Header */}
            <div className="flex items-center justify-between p-5 border-b-2 border-border/60 bg-card/20 relative">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-primary animate-pulse shadow-[0_0_10px_rgba(255,176,0,0.8)]" />
                <h2 className="text-[14px] font-black font-syne uppercase tracking-[0.4em] text-foreground italic">Transaction_Gate</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground/30 hover:text-destructive transition-all hover:scale-110">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8 relative">
              {/* Asset Identifier */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40">Asset_Identifier</label>
                  <span className="text-[8px] font-mono text-muted-foreground/20 italic">REF::SEC_CORE_V4</span>
                </div>
                <div className="relative group">
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary/20 transition-all group-focus-within:bg-primary group-focus-within:h-full" />
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => handleSymbolSearch(e.target.value)}
                    placeholder="TICKER_KEY"
                    className="w-full bg-card/10 border-2 border-border/40 px-5 py-3 text-sm font-mono font-black text-foreground focus:border-primary outline-none transition-all placeholder:text-muted-foreground/10 uppercase"
                  />
                  <AnimatePresence>
                    {showSuggestions && symbolSuggestions.length > 0 && (
                       <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 right-0 mt-2 border-2 border-border bg-background z-50 shadow-2xl p-1"
                       >
                          {symbolSuggestions.map(s => (
                             <button 
                               key={s.symbol}
                               onMouseDown={() => {
                                 setForm(prev => ({ ...prev, symbol: s.symbol }));
                                 setShowSuggestions(false);
                               }}
                               className="w-full px-4 py-3 text-left hover:bg-primary/5 flex justify-between items-center group transition-all border border-transparent hover:border-primary/20"
                             >
                                <span className="text-[11px] font-mono font-black text-foreground group-hover:text-primary tracking-widest">{s.symbol}</span>
                                <span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">{s.exchange}_BUS</span>
                             </button>
                          ))}
                       </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Direction & Execution Logic */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40 px-1">Signal_Polarity</label>
                  <div className="flex border-2 border-border/40 p-1 bg-card/5">
                    <button 
                      onClick={() => setForm({...form, side: 'BUY'})}
                      className={`flex-1 py-2 text-[11px] font-mono font-black transition-all ${form.side === 'BUY' ? 'bg-secondary text-black shadow-[0_0_15px_rgba(0,245,255,0.3)]' : 'text-muted-foreground/30 hover:text-foreground'}`}
                    >
                      LONG_SIGNAL
                    </button>
                    <button 
                      onClick={() => setForm({...form, side: 'SELL'})}
                      className={`flex-1 py-2 text-[11px] font-mono font-black transition-all ${form.side === 'SELL' ? 'bg-destructive text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-muted-foreground/30 hover:text-foreground'}`}
                    >
                      SHORT_SIGNAL
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40 px-1">Execution_Kernel</label>
                  <select 
                    value={form.orderType}
                    onChange={(e) => setForm({...form, orderType: e.target.value as any})}
                    className="w-full bg-card/10 border-2 border-border/40 px-4 py-2.5 text-[11px] font-mono font-black text-foreground outline-none focus:border-primary transition-all appearance-none uppercase tracking-widest"
                  >
                    {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Volume & Threshold */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40 px-1">Instruction_Volume</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.qty}
                      onChange={(e) => setForm({...form, qty: e.target.value})}
                      placeholder="0_UNITS"
                      className="w-full bg-card/10 border-2 border-border/40 px-5 py-3 text-sm font-mono font-black text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest pointer-events-none">QTY</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40 px-1">Threshold_Price</label>
                  <div className="relative">
                    <input
                      type="number"
                      disabled={form.orderType === 'MARKET'}
                      value={form.price}
                      onChange={(e) => setForm({...form, price: e.target.value})}
                      placeholder={form.orderType === 'MARKET' ? "AUTO_PRC" : "0.00"}
                      className="w-full bg-card/10 border-2 border-border/40 px-5 py-3 text-sm font-mono font-black text-foreground outline-none focus:border-primary disabled:opacity-30 transition-all placeholder:text-muted-foreground/10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest pointer-events-none">VAL</div>
                  </div>
                </div>
              </div>

              {/* Strategy Mapping */}
              <div className="space-y-3">
                <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-primary/40 px-1">Neural_Path_Mapping</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Tag className="w-3.5 h-3.5 text-primary/40" />
                  </div>
                  <select
                    value={form.strategy}
                    onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                    className="w-full bg-card/10 border-2 border-border/40 pl-12 pr-4 py-3 text-[11px] font-mono font-black text-foreground outline-none focus:border-primary transition-all appearance-none uppercase tracking-widest"
                  >
                    {strategies.map((s) => (
                      <option key={s} value={s}>{s.replace(' ', '_').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Smart Order Toggle */}
              <div className="flex items-center gap-3 bg-card/5 border-2 border-border/40 p-3 mt-4">
                <input
                  type="checkbox"
                  id="smart-order-toggle"
                  checked={form.isSmartOrder}
                  onChange={(e) => setForm(prev => ({ ...prev, isSmartOrder: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="smart-order-toggle" className="text-[10px] cursor-pointer font-black font-mono uppercase tracking-[0.3em] flex-1 text-foreground/80">
                  Smart_Execution_Node
                  <span className="block text-[8px] text-muted-foreground/50 tracking-widest mt-0.5">ENABLE_ICEBERG_SLICING</span>
                </label>
              </div>
            </div>

            {/* Master Action Strip */}
            <div className="p-6 border-t-2 border-border/60 bg-card/20 flex gap-4">
              <button 
                onClick={onClose}
                className="px-8 py-3 text-[11px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 border-2 border-border/40 transition-all"
              >
                Abort_Seq
              </button>
              <button
                onClick={() => handleSubmit('place')}
                disabled={!isValid || loading}
                className={`flex-1 py-3 text-[11px] font-mono font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                  isValid && !loading 
                    ? "bg-primary text-black shadow-[0_0_40px_rgba(255,176,0,0.3)] hover:scale-[1.02] active:scale-98" 
                    : "bg-card border-2 border-border/20 text-muted-foreground/20 cursor-not-allowed"
                }`}
              >
                <div className="scanline" />
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? "TRANSMITTING..." : "EXECUTE_INSTRUCTION"}
              </button>
            </div>
            
            {/* System Telemetry Log */}
            <div className="p-2 px-5 bg-primary/10 flex justify-between items-center border-t border-primary/20">
               <div className="flex gap-4">
                  <span className="text-[8px] font-mono text-primary font-black uppercase tracking-[0.3em]">Latency::4.2ms</span>
                  <span className="text-[8px] font-mono text-primary/60 font-black uppercase tracking-[0.3em]">Auth::Verified</span>
               </div>
               <span className="text-[8px] font-mono text-primary/40 font-black uppercase italic tracking-widest">Aether_Desk_Command_v2.4.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}