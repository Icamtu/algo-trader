import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Settings2, Globe, RefreshCw, Radio
} from "lucide-react";
import { algoApi } from "@/features/openalgo/api/client";
import { BrokerLogo } from "@/components/trading/BrokerLogo";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { useToast } from "@/hooks/use-toast";

interface Broker {
  id: string;
  name: string;
  version: string;
  supported_exchanges: string[];
  type: string;
  description: string;
  active: boolean;
  status?: "CONNECTED" | "DISCONNECTED" | "ERROR" | "INITIALIZING";
  latency?: number;
}

export default function BrokerRegistry() {
  const { toast } = useToast();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedBroker) return;
    setIsSaving(true);
    try {
      await algoApi.client(`/api/v1/brokers/${selectedBroker.id}/credentials`, {
        method: "POST",
        body: JSON.stringify(config)
      });
      toast({ title: "CONFIGURATION_SYNCED", description: `NODE_${selectedBroker.id.toUpperCase()}_UPDATED_SUCCESSFULLY` });
      setSelectedBroker(null);
    } catch (e) {
      toast({ variant: "destructive", title: "SYNC_FAILURE", description: "FAILED_TO_UPDATE_REMOTE_NODE" });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        const data = await algoApi.client("/api/v1/brokers");
        // Enrich data with statuses from system health if available
        const health = await algoApi.getSystemStatus();

        setBrokers(data.brokers.map((b: any) => ({
          ...b,
          status: b.active ? "CONNECTED" : "DISCONNECTED",
          latency: b.active ? (health?.broker?.latency || 0) : 0
        })));
      } catch (e) {
        toast({ variant: "destructive", title: "REGISTRY_LNK_ERR", description: "FAILED_TO_FETCH_BROKER_MAP" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBrokers();
  }, []);

  const filteredBrokers = brokers.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "ALL" || b.type.toUpperCase() === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Industrial Sub-Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-primary/5 border-b border-border/20 relative z-10">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <div className="border-l-4 border-primary pl-4">
             <div className="flex items-center gap-2 mb-1">
                <Globe className="w-3 h-3 text-primary" />
                <span className="text-[8px] font-mono font-black uppercase tracking-[0.2em] text-primary">Protocol_Registry_v43</span>
             </div>
             <h1 className="text-3xl font-black font-display tracking-tighter uppercase leading-none">
               BROKER_<span className="text-primary font-display italic">COMMAND_CENTER</span>
             </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="FILTER_NODES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-border/40 py-2 pl-9 pr-4 text-[9px] font-mono text-primary placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/40 focus:bg-black/60 transition-all uppercase"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value.toUpperCase())}
            className="bg-black/40 border border-border/40 p-2 text-[9px] font-mono text-primary appearance-none px-4 hover:border-primary/20 transition-all cursor-pointer focus:outline-none"
          >
            <option value="ALL">ALL_TYPES</option>
            <option value="IN_STOCK">INDIAN_STOCK</option>
            <option value="CRYPTO">CRYPTO_ASSET</option>
            <option value="GLOBAL">GLOBAL_MARKET</option>
          </select>

          <button className="p-2 border border-primary/20 bg-primary/5 hover:bg-primary hover:text-black transition-all group">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid Registry */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar relative z-10 industrial-grid">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {filteredBrokers.map((broker) => (
                <BrokerCard
                  key={broker.id}
                  broker={broker}
                  onClick={() => setSelectedBroker(broker)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Config Overlay (Sidebar) */}
      <AnimatePresence>
        {selectedBroker && (
          <>
            <motion.div
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
               onClick={() => setSelectedBroker(null)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[450px] bg-background border-l border-primary/20 p-6 z-[101] shadow-[-10px_0_40px_rgba(0,0,0,0.5)] flex flex-col industrial-grid"
            >
              <div className="scanline opacity-10" />
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <BrokerLogo id={selectedBroker.id} size="lg" className="border-primary/40" />
                  <div>
                    <h2 className="text-2xl font-black font-display uppercase tracking-tighter leading-none">{selectedBroker.name}</h2>
                    <p className="text-[8px] font-mono text-muted-foreground tracking-widest mt-1 uppercase">NODE_ID: {selectedBroker.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBroker(null)} className="p-1 hover:text-primary transition-colors">
                  <Settings2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar space-y-6">
                <div>
                   <h3 className="text-[10px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.3em] mb-4 border-b border-border/10 pb-1">PROTOCOL_SPECS</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <SpecItem label="INTERFACE_VER" value={selectedBroker.version} />
                      <SpecItem label="HANDSHAKE" value="ENCRYPTED_AES" />
                      <SpecItem label="POOLING" value="WEBSOCKET_ENABLED" />
                      <SpecItem label="BRIDGE" value="OPENALGO_REST" />
                   </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.3em] mb-4 border-b border-border/10 pb-1">MARKET_CONNECTIVITY</h3>
                   <div className="flex flex-wrap gap-1.5">
                     {selectedBroker.supported_exchanges.map(ex => (
                       <span key={ex} className="px-2 py-0.5 border border-primary/20 bg-primary/5 text-[9px] font-mono font-black text-primary uppercase">{ex}</span>
                     ))}
                   </div>
                </div>

                <div className="glass-panel p-4 border border-primary/10">
                   <h3 className="text-[10px] font-mono font-black text-muted-foreground/60 uppercase tracking-[0.3em] mb-4">CREDENTIAL_CONFIGURATION</h3>
                   <div className="space-y-4">
                      <ConfigInput
                        label="API_KEY"
                        placeholder="REDACTED_SECURE_TOKEN"
                        value={config.api_key || ""}
                        onChange={(v) => setConfig(prev => ({...prev, api_key: v}))}
                      />
                      <ConfigInput
                        label="API_SECRET"
                        placeholder="••••••••••••••••"
                        type="password"
                        value={config.api_secret || ""}
                        onChange={(v) => setConfig(prev => ({...prev, api_secret: v}))}
                      />
                      <ConfigInput
                        label="TOTP_KEY"
                        placeholder="ENTER_TOTP_SECRET"
                        value={config.totp_key || ""}
                        onChange={(v) => setConfig(prev => ({...prev, totp_key: v}))}
                      />
                      <ConfigInput label="REDIRECT_HOST" value={`https://aetherdesk.app/${selectedBroker.id}/callback`} readOnly />
                   </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border/10 flex gap-2">
                 <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-primary text-black font-mono font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(255,176,0,0.3)] disabled:opacity-50"
                 >
                   {isSaving ? "SYNCING_NODE..." : "UPDATE_NODE"}
                 </button>
                 <button className="px-6 border border-primary/20 hover:bg-primary/5 transition-all text-primary">
                    <Radio className="w-4 h-4" />
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrokerCard({ broker, onClick }: { broker: Broker, onClick: () => void }) {
  const isConnected = broker.status === "CONNECTED";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className={`relative group cursor-pointer border border-border/40 bg-card/5 p-4 overflow-hidden transition-all hover:border-primary/40 hover:bg-primary/5`}
    >
      <div className="absolute top-0 right-0 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Globe className="w-full h-full text-foreground" />
      </div>

      <div className="flex items-start justify-between mb-4">
        <BrokerLogo id={broker.id} size="md" className="group-hover:border-primary/40 transition-colors" />
        <div className={`px-2 py-0.5 border font-mono font-black text-[7px] uppercase tracking-widest ${isConnected ? "border-secondary/20 text-secondary" : "border-muted-foreground/10 text-muted-foreground/40"}`}>
          {broker.status}
        </div>
      </div>

      <h3 className="text-sm font-black font-display uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">{broker.name}</h3>
      <p className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-4">PROTOCOL_ID: {broker.id}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-mono font-black text-muted-foreground/40 uppercase">LATENCY_IF</span>
          <IndustrialValue value={broker.latency || 0} suffix="MS" className={`text-[9px] font-black ${isConnected ? "text-secondary" : "text-muted-foreground/20"}`} />
        </div>
        <div className="w-full h-[1px] bg-border/20 relative">
          {isConnected && <motion.div layoutId={`active_${broker.id}`} className="absolute inset-0 bg-primary shadow-[0_0_5px_rgba(255,176,0,0.5)]" />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        {broker.supported_exchanges.slice(0, 3).map(ex => (
           <span key={ex} className="px-1 py-0.5 border border-white/5 text-[6px] font-mono font-bold text-muted-foreground uppercase">{ex}</span>
        ))}
        {broker.supported_exchanges.length > 3 && (
           <span className="px-1 py-0.5 text-[6px] font-mono font-bold text-muted-foreground/40 text-center">+</span>
        )}
      </div>

      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
         <Settings2 className="w-3 h-3 text-primary" />
      </div>
    </motion.div>
  );
}

function SpecItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col">
       <span className="text-[7px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest mb-0.5">{label}</span>
       <span className="text-[9px] font-mono font-black text-foreground">{value}</span>
    </div>
  );
}

function ConfigInput({ label, placeholder, type = "text", value, readOnly, onChange }: { label: string, placeholder?: string, type?: string, value?: string, readOnly?: boolean, onChange?: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
       <label className="text-[8px] font-mono font-black text-primary uppercase tracking-widest ml-1">{label}_NODE</label>
       <input
         type={type}
         placeholder={placeholder}
         value={value}
         readOnly={readOnly}
         onChange={(e) => onChange?.(e.target.value)}
         className={`bg-black/60 border border-border/40 p-2.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:border-primary/40 transition-all ${readOnly ? "opacity-30 cursor-not-allowed" : ""}`}
       />
    </div>
  );
}
