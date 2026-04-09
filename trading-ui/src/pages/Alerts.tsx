import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { MarketNavbar } from "@/components/trading/MarketNavbar";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { Plus, Trash2, BellRing, Mail, MessageSquare, Smartphone, Loader2, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { algoApi } from "@/lib/api-client";
import { IndustrialValue } from "@/components/trading/IndustrialValue";

const pageTabs = ["Feed", "Create"] as const;

const channels = [
  { id: "email", name: "Email", icon: Mail },
  { id: "telegram", name: "Telegram", icon: MessageSquare },
  { id: "push", name: "Push", icon: Smartphone },
];

const alertTypes = [
  { id: "price", name: "Price", icon: "₹" },
  { id: "risk", name: "Risk", icon: "⚠" },
  { id: "signal", name: "Signal", icon: "📊" },
  { id: "order", name: "Order", icon: "📋" },
];

const conditions: Record<string, string[]> = {
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
}

export default function Alerts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Feed");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [newAlert, setNewAlert] = useState({
    type: "price",
    symbol: "",
    condition: "Above",
    value: "",
    channel: "telegram",
  });

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await algoApi.getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {} finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = async () => {
    if (!newAlert.symbol || !newAlert.value) return;
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
      toast({ title: "SIGNAL_REGISTERED", description: "NEW_ALERT_COMMITTED" });
      setNewAlert({ type: "price", symbol: "", condition: "Above", value: "", channel: "telegram" });
      setActiveTab("Feed");
      fetchAlerts();
    } finally {
      setIsCreating(false);
    }
  };

  const deleteAlert = async (id: number) => {
    try {
      await algoApi.deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast({ title: "SIGNAL_PURGED", description: "ALERT_REMOVED" });
    } catch (e) {}
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background industrial-grid relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />
      <GlobalHeader />
      <MarketNavbar activeTab="/alerts" />
      
      {/* Industrial Sub-Tabs */}
      <div className="flex px-4 bg-card/5 border-b border-border/20 relative z-10">
        <div className="flex items-center gap-3 pr-4 mr-4 border-r border-border/20">
            <BellRing className="w-3 h-3 text-primary animate-pulse" />
            <div className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.2em]">Signal_Hub_v4</div>
        </div>
        {pageTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === tab ? "text-primary bg-primary/5" : "text-muted-foreground/30 hover:text-foreground/60"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeAlertTab" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        <div className="flex-1 overflow-auto p-4 no-scrollbar">
          {activeTab === "Feed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center opacity-20 filter grayscale">
                   <BellRing className="w-8 h-8 mb-4" />
                   <span className="text-[9px] font-mono font-black uppercase tracking-[0.4em]">Signal_Registry_Empty</span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="border border-border/10 bg-card/5 p-4 hover:bg-card/10 transition-all group relative">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 border border-border/20 ${alert.type === 'risk' ? 'text-destructive bg-destructive/5' : 'text-primary bg-primary/5'}`}>
                         <Radio className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-3">
                              <span className="text-sm font-black font-syne uppercase text-foreground">{alert.symbol}</span>
                              <div className="px-1.5 py-0.5 border border-border/20 bg-background text-[7px] font-mono font-black uppercase text-muted-foreground/40">{alert.type}</div>
                           </div>
                           <button onClick={() => deleteAlert(alert.id)} className="text-muted-foreground/20 hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                        <p className="text-[10px] font-mono font-black text-foreground/60 uppercase tracking-widest leading-relaxed">{alert.message}</p>
                        <div className="mt-3 flex items-center gap-3">
                           <div className="px-2 py-0.5 border border-border/20 text-[8px] font-mono font-black text-primary uppercase">{alert.channel}</div>
                           <div className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase">ID_{alert.id}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "Create" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-4">
              <div className="border border-border/20 bg-card/5 p-6">
                <h3 className="text-xl font-black font-syne uppercase tracking-widest mb-6">Set_Signal</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="text-[8px] font-mono font-black text-primary uppercase tracking-[0.3em] mb-2">Signal_Type</div>
                    <div className="grid grid-cols-4 gap-2">
                      {alertTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setNewAlert({ ...newAlert, type: type.id, condition: conditions[type.id][0] })}
                          className={`py-3 flex flex-col items-center justify-center gap-2 border transition-all ${
                            newAlert.type === type.id ? "bg-primary border-primary text-black" : "border-border/30 text-muted-foreground/30 hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <span className="text-lg">{type.icon}</span>
                          <span className="text-[7px] font-mono font-black uppercase">{type.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[8px] font-mono font-black text-primary uppercase tracking-[0.3em] mb-2">Symbol</div>
                      <input 
                        value={newAlert.symbol} 
                        onChange={e => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })} 
                        className="w-full bg-background border border-border/40 p-2 text-[10px] font-mono font-black text-foreground focus:outline-none focus:border-primary" 
                      />
                    </div>
                    <div>
                      <div className="text-[8px] font-mono font-black text-primary uppercase tracking-[0.3em] mb-2">Logic</div>
                      <select 
                        value={newAlert.condition} 
                        onChange={e => setNewAlert({ ...newAlert, condition: e.target.value })} 
                        className="w-full bg-background border border-border/40 p-2 text-[10px] font-mono font-black text-foreground focus:outline-none focus:border-primary uppercase"
                      >
                        {conditions[newAlert.type].map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="text-[8px] font-mono font-black text-primary uppercase tracking-[0.3em] mb-2">Value</div>
                    <IndustrialValue value={parseFloat(newAlert.value) || 0} className="hidden" />
                    <input 
                      type="number"
                      value={newAlert.value} 
                      onChange={e => setNewAlert({ ...newAlert, value: e.target.value })} 
                      className="w-full bg-background border border-border/40 p-2 text-[10px] font-mono font-black text-foreground focus:outline-none focus:border-primary" 
                    />
                  </div>

                  <button
                    disabled={isCreating}
                    onClick={createAlert}
                    className="w-full py-3 bg-primary text-black font-mono font-black text-[10px] uppercase tracking-[0.4em] hover:bg-black hover:text-primary transition-all flex items-center justify-center gap-3"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    INIT_SIGNAL
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
        <RightPanel />
      </div>
      <NewOrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} prefilledSymbol="" />
    </div>
  );
}
