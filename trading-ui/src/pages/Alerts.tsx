import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { Plus, Trash2, BellRing, Mail, MessageSquare, Smartphone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiErrorBoundary } from "@/components/ui/ApiErrorBoundary";
import { algoApi } from "@/lib/api-client";

const pageTabs = ["Feed", "Create"] as const;

// Alert channels
const channels = [
  { id: "email", name: "Email", icon: Mail, enabled: true },
  { id: "telegram", name: "Telegram", icon: MessageSquare, enabled: true },
  { id: "push", name: "Push Notification", icon: Smartphone, enabled: false },
];

// Alert types
const alertTypes = [
  { id: "price", name: "Price Alert", icon: "₹" },
  { id: "risk", name: "Risk Alert", icon: "⚠" },
  { id: "signal", name: "Signal Alert", icon: "📊" },
  { id: "order", name: "Order Alert", icon: "📋" },
];

// Conditions per type
const conditions = {
  price: ["Above", "Below", "Crosses"],
  risk: ["VaR > ", "VaR < ", "Loss > ", "Exposure > "],
  signal: ["RSI > ", "RSI < ", "MACD Cross", "Volume Spike"],
  order: ["Filled", "Rejected", "Cancelled"],
};

interface Alert {
  id: number;
  type: string;
  symbol: string;
  condition: string;
  value: number;
  message: string;
  channel: string;
  created_at?: string;
  is_active?: number;
  read?: boolean;
}

export default function Alerts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Feed");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  // Create alert form
  const [newAlert, setNewAlert] = useState({
    type: "price",
    symbol: "",
    condition: "Above",
    value: "",
    channel: "telegram",
  });

  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await algoApi.getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
      setFetchError("Cannot load alerts. Ensure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  const markAsRead = (id: number) => {
    setReadIds(prev => new Set(prev).add(id));
  };

  const deleteAlert = async (id: number) => {
    try {
      await algoApi.deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast({ title: "Alert deleted", variant: "default" });
    } catch (err) {
      toast({ title: "Failed to delete alert", description: String(err), variant: "destructive" });
    }
  };

  const createAlert = async () => {
    if (!newAlert.symbol || !newAlert.value) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      await algoApi.createAlert({
        type: newAlert.type,
        symbol: newAlert.symbol.toUpperCase(),
        condition: newAlert.condition,
        value: parseFloat(newAlert.value),
        channel: newAlert.channel,
        message: `${newAlert.symbol.toUpperCase()} ${newAlert.condition} ${newAlert.value}`,
      });
      toast({ title: "Alert created successfully", variant: "default" });
      setNewAlert({ type: "price", symbol: "", condition: "Above", value: "", channel: "telegram" });
      setActiveTab("Feed");
      fetchAlerts(); // Refresh from backend
    } catch (err) {
      toast({ title: "Failed to create alert", description: String(err), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const unreadCount = alerts.filter(a => !readIds.has(a.id)).length;

  const formatTime = (createdAt?: string) => {
    if (!createdAt) return "";
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <GlobalHeader />
      <MarketNavbar activeTab="/alerts" />
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 bg-background/50">
        {pageTabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${activeTab === tab ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"}`}>
            {tab} {tab === "Feed" && unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-[8px] bg-neon-red rounded-full">{unreadCount}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "Feed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Alert Feed</h3>
                  <span className="text-[10px] text-muted-foreground">{alerts.length} alerts</span>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <BellRing className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No alerts yet. Create one to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {alerts.map((alert) => {
                      const isRead = readIds.has(alert.id);
                      return (
                        <div key={alert.id} onClick={() => markAsRead(alert.id)} className={`p-3 hover:bg-muted/10 transition-colors cursor-pointer ${!isRead ? "bg-primary/5" : ""}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alert.type === "price" ? "bg-neon-green/20 text-neon-green" : alert.type === "risk" ? "bg-neon-red/20 text-neon-red" : alert.type === "signal" ? "bg-neon-cyan/20 text-neon-cyan" : "bg-primary/20 text-primary"}`}>
                              <BellRing className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-foreground">{alert.symbol}</span>
                                <span className="text-[10px] text-muted-foreground">{formatTime(alert.created_at)}</span>
                                {!isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                              </div>
                              <p className="text-xs text-muted-foreground">{alert.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{alert.channel}</span>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteAlert(alert.id); }} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === "Create" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-semibold text-foreground">Create New Alert</h3>
              
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Alert Type</label>
                <div className="flex gap-2">
                  {alertTypes.map(type => (
                    <button key={type.id} onClick={() => setNewAlert({ ...newAlert, type: type.id, condition: conditions[type.id as keyof typeof conditions][0] })} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newAlert.type === type.id ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/30 text-muted-foreground"}`}>
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Symbol</label>
                  <input type="text" value={newAlert.symbol} onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })} placeholder="NIFTY, RELIANCE" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Condition</label>
                  <select value={newAlert.condition} onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50">
                    {conditions[newAlert.type as keyof typeof conditions].map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Value</label>
                <input type="number" value={newAlert.value} onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })} placeholder={newAlert.type === "order" ? "N/A" : "Enter value"} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Notification Channel</label>
                <div className="flex gap-2">
                  {channels.map(ch => (
                    <button key={ch.id} onClick={() => setNewAlert({ ...newAlert, channel: ch.id })} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${newAlert.channel === ch.id ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/30 text-muted-foreground"}`}>
                      <ch.icon className="w-3.5 h-3.5" />
                      {ch.name}
                    </button>
                  ))}
                </div>
              </div>

              <button disabled={isCreating} onClick={createAlert} className="w-full py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isCreating ? "Creating..." : "Create Alert"}
              </button>
            </motion.div>
          )}
        </div>
        <RightPanel />
      </div>
      <NewOrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} prefilledSymbol={prefilledSymbol} />
    </div>
  );
}
