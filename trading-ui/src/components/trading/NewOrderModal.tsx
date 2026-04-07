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

  const handleSubmit = async (action: "place" | "cancel") => {
    if (action === "cancel") {
      onClose();
      return;
    }

    setLoading(true);
    
    try {
      const result = await algoApi.placeOrder({
        symbol: form.symbol.trim().toUpperCase(),
        action: form.side,
        quantity: parseInt(form.qty, 10),
        order_type: form.orderType,
        price: form.price ? parseFloat(form.price) : undefined,
        strategy: form.strategy,
      });

      toast({
        title: "Order Placed Successfully",
        description: `${form.side} ${form.qty || "-"} ${form.symbol || "-"} @ ${form.orderType}`,
        variant: "default",
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
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.isServiceUnavailable) {
          toast({ variant: "destructive", title: "Service Unavailable", description: "Trading engine is still starting up. Try again shortly." });
        } else if (error.isValidationError) {
          toast({ variant: "destructive", title: "Validation Error", description: error.message });
        } else {
          toast({ variant: "destructive", title: `Order Failed (${error.status})`, description: error.message });
        }
      } else {
        toast({ variant: "destructive", title: "Order Failed", description: "An unexpected network error occurred." });
      }
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] glass-panel-elevated rounded-xl border border-border shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">New Order</h2>
                  <p className="text-[10px] text-muted-foreground">Place a new trading order</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
              {/* Symbol */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Symbol</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => handleSymbolSearch(e.target.value)}
                    onFocus={() => symbolSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="e.g., NIFTY, RELIANCE, BTC"
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  {showSuggestions && symbolSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-xl z-50 max-h-40 overflow-auto">
                      {symbolSuggestions.map((s) => (
                        <button
                          key={s.symbol}
                          type="button"
                          onMouseDown={() => {
                            setForm(prev => ({ ...prev, symbol: s.symbol }));
                            setShowSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-primary/10 flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold text-foreground">{s.symbol}</span>
                          <span className="text-[9px] text-muted-foreground">{s.exchange}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Side Toggle */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Side</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm({ ...form, side: "BUY" })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      form.side === "BUY"
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                        : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    BUY
                  </button>
                  <button
                    onClick={() => setForm({ ...form, side: "SELL" })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      form.side === "SELL"
                        ? "bg-neon-red/20 text-neon-red border border-neon-red/30"
                        : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    SELL
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Quantity</label>
                <input
                  type="number"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  placeholder="Enter quantity"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Order Type */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Order Type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {orderTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, orderType: type })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        form.orderType === type
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (for Limit/SL orders) */}
              {(form.orderType === "LIMIT" || form.orderType === "SL" || form.orderType === "SL-M") && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Price</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Limit price"
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}

              {/* Stop Loss */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Stop Loss</label>
                <input
                  type="number"
                  value={form.sl}
                  onChange={(e) => setForm({ ...form, sl: e.target.value })}
                  placeholder="Stop loss price (optional)"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Strategy Tag */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  Strategy Tag
                </label>
                <select
                  value={form.strategy}
                  onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  {strategies.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Validation Warning */}
              {!isValid && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-neon-orange/10 border border-neon-orange/20">
                  <AlertCircle className="w-4 h-4 text-neon-orange shrink-0" />
                  <span className="text-[10px] text-neon-orange">Please fill in symbol, quantity, and price (for limit orders)</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 p-4 border-t border-border bg-muted/20">
              <button
                onClick={() => handleSubmit("cancel")}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit("place")}
                disabled={!isValid || loading}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isValid && !loading
                    ? "bg-neon-green text-black hover:bg-neon-green/90 glow-button"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Placing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}