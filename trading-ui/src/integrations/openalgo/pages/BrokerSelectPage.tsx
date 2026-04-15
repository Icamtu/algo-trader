import React, { useEffect, useState } from 'react';
import { Network, ExternalLink, ShieldCheck, AlertTriangle, BookOpen, Loader2, Globe, Server, Check } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tradingService } from '@/services/tradingService';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { useAuthStore } from '@/stores/authStore';

// Supported Brokers Map
const BROKERS = [
  { id: 'zerodha', name: 'Zerodha', logo: 'https://kite.trade/static/images/kite-logo.svg' },
  { id: 'upstox', name: 'Upstox', logo: 'https://upstox.com/apple-touch-icon.png' },
  { id: 'fyers', name: 'Fyers', logo: 'https://fyers.in/assets/images/logo.png' },
  { id: 'angel', name: 'Angel One', logo: 'https://www.angelone.in/static/images/logo.svg' },
  { id: 'shoonya', name: 'Shoonya', logo: 'https://shoonya.com/favicon.ico' },
  { id: 'aliceblue', name: 'Alice Blue', logo: 'https://aliceblueonline.com/wp-content/uploads/2022/08/cropped-Fav-icon-32x32.png' },
];

export const BrokerSelectPage: React.FC = () => {
  const { user } = useAuthStore();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [brokerConfig, setBrokerConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await tradingService.getBrokerConfig();
        if (data.status === 'success') {
          setBrokerConfig(data);
          setSelectedBroker(data.broker_name);
        }
      } catch (error) {
        console.error('Failed to load broker config', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleBrokerSelection = (id: string) => {
    setSelectedBroker(id);
  };

  const handleConnect = () => {
    if (!selectedBroker) return;
    setIsConnecting(true);
    
    const { broker_api_key, redirect_url } = brokerConfig || {};
    let loginUrl = '';

    switch (selectedBroker) {
      case 'zerodha':
        loginUrl = `https://kite.trade/connect/login?api_key=${broker_api_key}`;
        break;
      case 'upstox':
        loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${broker_api_key}&redirect_uri=${redirect_url}`;
        break;
      case 'fyers':
        loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${broker_api_key}&redirect_uri=${redirect_url}&response_type=code&state=openalgo_v4`;
        break;
      default:
        loginUrl = `/${selectedBroker}/callback`;
    }

    if (loginUrl) {
      window.location.href = loginUrl;
    } else {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className={cn("w-10 h-10 animate-spin", primaryColorClass)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <ShieldCheck className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Broker_Identity_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Network className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">HANDSHAKE_PROTOCOL // GATEWAY_VERIFIED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn("font-mono text-[9px] px-3", accentBorderClass, primaryColorClass)}>
            NODE_ENCRYPTED_V4
          </Badge>
        </div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           <div className="lg:col-span-4 space-y-6">
              <AetherPanel className={cn(isAD ? "border-amber-500/20 bg-background/20" : "border-teal-500/20 bg-background/20")}>
                 <div className="flex flex-col items-center py-8">
                    <div className="w-20 h-20 bg-foreground/5 border border-border/10 flex items-center justify-center mb-6 relative overflow-hidden group">
                       <Server className={cn("w-10 h-10 text-muted-foreground transition-all group-hover:text-primary", primaryColorClass)} />
                       <div className={cn("absolute inset-0 border opacity-0 group-hover:opacity-100 animate-pulse", accentBorderClass)} />
                    </div>
                    <h2 className="text-lg font-black font-mono uppercase text-foreground">{selectedBroker || 'SELECTION_REQUIRED'}</h2>
                    <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.4em] mt-1 opacity-40">ACTIVE_GATEWAY_NODE</p>
                 </div>
                 <div className="pt-6 border-t border-border/10 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                       <span className="text-muted-foreground/60 italic">User_Context</span>
                       <span className={cn("font-black", primaryColorClass)}>{user?.username || 'GUEST_USER'}</span>
                    </div>
                 </div>
              </AetherPanel>
          </div>

           <div className="lg:col-span-8">
              <AetherPanel className="h-full border-border/10 bg-background/20 p-6">
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/10">
                    <div className="micro-label flex items-center gap-2">
                       <Network className={cn("w-3.5 h-3.5", primaryColorClass)} /> Available_Endpoints
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/40 uppercase">V4_Kernel_Handshake</div>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                    {BROKERS.map((broker) => (
                      <button
                        key={broker.id}
                        onClick={() => handleBrokerSelection(broker.id)}
                        className={cn(
                          "relative group cursor-pointer border p-6 transition-all rounded-sm flex flex-col items-center gap-3",
                          selectedBroker === broker.id 
                            ? (isAD ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(255,176,0,0.1)]" : "bg-teal-500/10 border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.1)]")
                            : "bg-background/40 border-border/10 hover:border-border/40"
                        )}
                      >
                         <img src={broker.logo} alt={broker.name} className="w-8 h-8 object-contain grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                         <span className={cn("text-[9px] font-mono uppercase tracking-widest", selectedBroker === broker.id ? primaryColorClass : "text-muted-foreground")}>{broker.name}</span>
                      </button>
                    ))}
                 </div>

                 <div className="pt-8 border-t border-border/10 space-y-6">
                    <div className={cn("p-4 bg-foreground/5 border flex gap-4 transition-all", isAD ? "border-amber-500/20" : "border-teal-500/20")}>
                       <AlertTriangle className={cn("w-5 h-5 shrink-0", isAD ? "text-amber-500" : "text-teal-500")} />
                       <div className="text-[9px] font-mono text-muted-foreground/60 uppercase leading-relaxed tracking-wider">
                          ATTENTION: ESTABLISHING_BRIDGE WILL_REDIRECT_TO_SECURE_AUTH_PORTAL. 
                          ENSURE_API_KEYS_ARE_CONFIGURED_IN_CONNECTIVITY_KERNEL.
                       </div>
                    </div>

                    <Button 
                      onClick={handleConnect}
                      disabled={!selectedBroker || isConnecting}
                      className={cn(
                        "w-full h-14 font-mono font-black text-xs uppercase tracking-[0.4em] transition-all",
                        isAD ? "bg-primary hover:bg-white text-black" : "bg-teal-500 hover:bg-white text-black",
                        isConnecting && "opacity-50 pointer-events-none"
                      )}
                    >
                       {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="flex items-center gap-2 font-black">ESTABLISH_BRIDGE <ExternalLink className="w-4 h-4" /></div>}
                    </Button>
                 </div>
              </AetherPanel>
           </div>
       </div>

       <div className="mt-12 flex justify-center gap-8">
          <a href="https://docs.openalgo.in" target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 text-[9px] font-mono transition-colors uppercase tracking-widest opacity-40 hover:opacity-100", primaryColorClass)}>
             <BookOpen className="w-3.5 h-3.5" /> Documentation_Kernel
          </a>
          <div className="w-[1px] h-3 bg-foreground/10" />
          <div className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-widest italic">Protocol_v4.5.1 // Secure_Identity</div>
       </div>
    </div>
  );
};
