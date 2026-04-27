import { useState, useEffect } from "react";
import {
  X, Wifi, ShieldCheck,
  Activity, Clock, RefreshCw, Eye, EyeOff, Settings2,
  CheckCircle2, AlertTriangle, XCircle, Zap, BarChart3, Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { algoApi } from "@/features/openalgo/api/client";

type BrokerStatus = "connected" | "degraded" | "disconnected";

interface BrokerConfig {
  id: string;
  name: string;
  description: string;
  status: BrokerStatus;
  latency: number;
  uptime: number;
  ordersToday: number;
  lastHeartbeat: string;
  fields: { key: string; label: string; type: "text" | "password"; placeholder: string; value: string }[];
  features: string[];
}

const initialBrokers: BrokerConfig[] = [
  {
    id: "shoonya",
    name: "Shoonya (Finvasia)",
    description: "Zero-brokerage Indian broker. NorenRestApi for equities, F&O, and currency.",
    status: "disconnected",
    latency: 0,
    uptime: 0,
    ordersToday: 0,
    lastHeartbeat: "Never",
    fields: [
      { key: "user", label: "User ID", type: "text", placeholder: "FA12345", value: "" },
      { key: "password", label: "Password", type: "password", placeholder: "Enter password", value: "" },
      { key: "totp_key", label: "TOTP Secret", type: "password", placeholder: "Enter TOTP key", value: "" },
      { key: "vendor_code", label: "Vendor Code", type: "text", placeholder: "FA12345_U", value: "" },
      { key: "api_key", label: "API Key", type: "password", placeholder: "Enter API key", value: "" },
      { key: "imei", label: "IMEI", type: "text", placeholder: "abc1234", value: "" },
    ],
    features: ["Equities", "F&O", "Currency", "Commodities", "Zero Brokerage"],
  },
  {
    id: "zerodha",
    name: "Zerodha (Kite)",
    description: "India's largest retail broker. Kite Connect API for equities, F&O, and commodities.",
    status: "disconnected",
    latency: 0,
    uptime: 0,
    ordersToday: 0,
    lastHeartbeat: "N/A",
    fields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "kite_api_xxxxxxxxx", value: "" },
      { key: "api_secret", label: "API Secret", type: "password", placeholder: "Enter API secret", value: "" },
    ],
    features: ["Equities", "F&O", "WebSocket"],
  }
];

const statusConfig: Record<BrokerStatus, { icon: typeof CheckCircle2; color: string; label: string; dotClass: string }> = {
  connected: { icon: CheckCircle2, color: "text-neon-emerald", label: "Connected", dotClass: "status-dot-live" },
  degraded: { icon: AlertTriangle, color: "text-neon-orange", label: "Degraded", dotClass: "status-dot-warning" },
  disconnected: { icon: XCircle, color: "text-neon-red", label: "Disconnected", dotClass: "status-dot-error" },
};

export function BrokerManagementPanel({ isOpen, onClose, isEmbedded = false }: { isOpen?: boolean; onClose?: () => void; isEmbedded?: boolean }) {
  const [brokers, setBrokers] = useState<BrokerConfig[]>(initialBrokers);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await algoApi.getBrokerHealth();
        if (res.status === "success" && res.data) {
          setBrokers(prev => prev.map(b =>
            b.id === "shoonya" ? {
              ...b,
              status: res.data.status,
              latency: res.data.latency,
              ordersToday: res.data.ordersToday,
              lastHeartbeat: res.data.lastHeartbeat
            } : b
          ));
        }
      } catch (err) {
        console.error("Failed to fetch broker health", err);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 20000);
    return () => clearInterval(interval);
  }, []);
  const [selectedBroker, setSelectedBroker] = useState<string>("shoonya");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configModified, setConfigModified] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load existing values from DB if any
    const loadConfig = async () => {
      const { data, error } = await supabase
        .from("broker_configs")
        .select("*")
        .eq("broker_name", selectedBroker)
        .maybeSingle();

      if (data) {
        setFieldValues({
          user: data.broker_user_id || "",
          password: data.enc_password || "",
          totp_key: data.enc_totp || "",
          vendor_code: data.vendor_code || "",
          api_key: data.enc_api_key || "",
          imei: data.imei || ""
        });
      } else {
        // Reset fields if no config found
        setFieldValues({});
      }
    };
    loadConfig();
  }, [selectedBroker]);

  if (!isEmbedded && !isOpen) return null;

  const broker = brokers.find((b) => b.id === selectedBroker)!;
  const sc = statusConfig[broker.status];
  const StatusIcon = sc.icon;

  const toggleSecret = (fieldKey: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        broker_name: selectedBroker,
        broker_user_id: fieldValues.user,
        enc_password: fieldValues.password,
        enc_totp: fieldValues.totp_key,
        enc_api_key: fieldValues.api_key,
        vendor_code: fieldValues.vendor_code,
        imei: fieldValues.imei,
        updated_at: new Date().toISOString()
      };

      console.log("Saving broker configuration:", payload);

      const { error } = await supabase
        .from("broker_configs")
        .upsert(payload, { onConflict: "user_id,broker_name" });

      if (error) throw error;
      toast.success("Configuration saved to database");
      setConfigModified(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    if (authorizing) return;
    setAuthorizing(true);
    const toastId = toast.loading("SYNCHRONIZING_CORE_SESSION", {
      description: "Launching high-speed programmatic handshake. Estimated window: <5s.",
    });

    try {
      const result = await algoApi.authorizeBroker(selectedBroker, {
        user_id: fieldValues.user || fieldValues.user_id,
        password: fieldValues.password,
        totp_secret: fieldValues.totp_key,
        api_key: fieldValues.api_key,
        api_secret: fieldValues.api_secret
      });

      if (result.status === "success" || result.status === "Ok") {
        toast.success("CORE_SESSION_SYNCHRONIZED", {
          id: toastId,
          description: "Shoonya heartbeat detected. Session injected into OpenAlgo DB.",
        });
      } else {
        throw new Error(result.message || "Authorization failed");
      }
    } catch (err: any) {
      toast.error("AUTH_PROTOCOL_FAULT", {
        id: toastId,
        description: err.message || "Programmatic login failed. Check system logs.",
      });
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSyncToEngine = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-broker-config", {
        body: { broker_id: selectedBroker },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Configuration pushed to algo engine");
        setConfigModified(false);
      } else {
        toast.warning(data?.message || "Engine not reachable");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync configuration");
    } finally {
      setSyncing(false);
    }
  };

  const content = (
    <div className={`flex flex-1 min-h-0 ${isEmbedded ? "flex-col overflow-y-auto" : ""}`}>
      {/* Broker List */}
      <div className={`${isEmbedded ? "w-full border-b" : "w-56 border-r"} border-border p-2 space-y-1 overflow-y-auto shrink-0 ${isEmbedded ? "max-h-40" : ""}`}>
        {brokers.map((b) => {
          const bsc = statusConfig[b.status];
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBroker(b.id)}
              className={`w-full text-left p-2.5 rounded-lg transition-all ${
                selectedBroker === b.id
                  ? "glass-panel-elevated neon-border-indigo"
                  : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={bsc.dotClass} />
                <span className="text-xs font-medium text-foreground truncate">{b.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="data-cell text-muted-foreground">{b.latency}ms</span>
                <span className="text-[9px] text-muted-foreground">•</span>
                <span className="data-cell text-muted-foreground">{b.ordersToday} orders</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Broker Detail */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Banner */}
        <div className={`glass-panel rounded-lg p-3 flex items-center gap-3 border-l-2 ${
          broker.status === "connected" ? "border-l-neon-emerald" :
          broker.status === "degraded" ? "border-l-neon-orange" : "border-l-neon-red"
        }`}>
          <StatusIcon className={`w-5 h-5 ${sc.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{broker.name}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                broker.status === "connected" ? "bg-neon-emerald/10 text-neon-emerald" :
                broker.status === "degraded" ? "bg-neon-orange/10 text-neon-orange" :
                "bg-neon-red/10 text-neon-red"
              }`}>{sc.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{broker.description}</p>
          </div>
          <div className="flex gap-1.5">
            <button className="p-1.5 rounded-md glass-panel hover:bg-muted/50 transition-colors" title="Reconnect">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-md glass-panel hover:bg-muted/50 transition-colors" title="Settings">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Health Metrics */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Health Monitoring</h3>
          <div className={`grid ${isEmbedded ? "grid-cols-2" : "grid-cols-4"} gap-2`}>
            <HealthCard icon={Zap} label="Latency" value={`${broker.latency}ms`} sub={broker.latency < 30 ? "Excellent" : broker.latency < 60 ? "Good" : "Slow"} color={broker.latency < 30 ? "text-neon-emerald" : broker.latency < 60 ? "text-primary" : "text-neon-orange"} />
            <HealthCard icon={Activity} label="Uptime" value={`${broker.uptime}%`} sub="30-day" color={broker.uptime > 99.9 ? "text-neon-emerald" : "text-neon-orange"} />
            <HealthCard icon={BarChart3} label="Orders Today" value={broker.ordersToday.toString()} sub="Executed" color="text-primary" />
            <HealthCard icon={Clock} label="Heartbeat" value={broker.lastHeartbeat} sub="Last ping" color="text-neon-emerald" />
          </div>
        </div>

        {/* Latency Sparkline */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Latency (24h)</h3>
          <div className="glass-panel rounded-lg p-3">
            <div className="h-12 flex items-end gap-px">
              {Array.from({ length: 48 }).map((_, i) => {
                const base = broker.latency;
                const jitter = Math.sin(i * 0.5) * base * 0.3 + Math.random() * base * 0.2;
                const val = Math.max(5, base + jitter);
                const maxVal = base * 1.8;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${Math.min((val / maxVal) * 100, 100)}%`,
                      background: val > base * 1.5
                        ? "hsl(var(--neon-orange) / 0.7)"
                        : "hsl(var(--primary) / 0.4)",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[8px] text-muted-foreground">24h ago</span>
              <span className="text-[8px] text-muted-foreground">Now</span>
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">API Credentials</h3>
            <ShieldCheck className="w-3 h-3 text-neon-emerald" />
            <span className="text-[9px] text-neon-emerald">Encrypted</span>
          </div>
          <div className="space-y-2">
            {broker.fields.map((field) => (
              <div key={field.key} className="glass-panel rounded-md p-2.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type={field.type === "password" && !showSecrets[`${broker.id}-${field.key}`] ? "password" : "text"}
                    value={fieldValues[field.key] || ""}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                      setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }));
                      setConfigModified(true);
                    }}
                    className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                  {field.type === "password" && (
                    <button
                      onClick={() => toggleSecret(`${broker.id}-${field.key}`)}
                      className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      {showSecrets[`${broker.id}-${field.key}`] ? (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Features */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Supported Markets</h3>
          <div className="flex flex-wrap gap-1.5">
            {broker.features.map((f) => (
              <span
                key={f}
                className="px-2 py-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-md"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Actions - Refactored for small screens */}
        <div className={`flex flex-wrap items-center gap-2 pt-4 border-t border-border mt-auto`}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-w-[100px] glow-button rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? "Saving..." : "COMMIT_CONF"}
          </button>

          {selectedBroker === 'shoonya' && (
            <button
              onClick={handleAuthorize}
              disabled={authorizing}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50 ${
                authorizing ? "animate-glitch-fast bg-destructive" : "btn-industrial-secondary"
              }`}
              style={{
                background: authorizing ? undefined : "linear-gradient(135deg, hsl(var(--neon-emerald)/0.2), hsl(var(--neon-emerald)/0.4))",
                border: "1px solid hsla(var(--neon-emerald), 0.3)"
              }}
            >
              {authorizing ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-3 h-3 text-neon-emerald" />
              )}
              {authorizing ? "SYNC_ACTIVE" : "AUTHORIZE_CORE"}
            </button>
          )}

          <button
            onClick={handleSyncToEngine}
            disabled={syncing}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground transition-all disabled:opacity-50 ${
              configModified ? "sync-glow" : ""
            }`}
            style={{
              background: "linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--primary)))",
            }}
          >
            {syncing ? (
              <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            PUSH_ENGINE
          </button>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[900px] max-h-[80vh] glass-panel-elevated rounded-xl neon-border-indigo overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Wifi className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Broker Management</h2>
              <p className="text-[10px] text-muted-foreground">Configure connections, API keys & health monitoring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Zap; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="glass-panel rounded-lg p-2.5 text-center">
      <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
      <div className={`metric-value ${color}`}>{value}</div>
      <div className="metric-label">{label}</div>
      <div className="text-[8px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
