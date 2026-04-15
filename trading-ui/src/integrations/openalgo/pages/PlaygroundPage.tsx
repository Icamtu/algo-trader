import { useCallback, useEffect, useState } from 'react'
import {
  Terminal as TerminalIcon,
  Send,
  RefreshCw,
  Zap,
  Globe,
  Plus,
  X,
  Copy,
  Activity,
  Code,
  ShieldAlert,
  Save,
  Trash2,
} from 'lucide-react'
import { tradingService } from '@/services/tradingService'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAppModeStore } from '@/stores/appModeStore'
import { apiClient } from '@/integrations/openalgo/services/client'
import { cn } from '@/lib/utils'

interface Endpoint {
  name: string
  path: string
  method: 'GET' | 'POST' | 'WS'
  body?: Record<string, any>
  params?: Record<string, any>
  description?: string
}

interface OpenTab {
  id: string
  endpoint: Endpoint
  requestBody: string
}

export default function PlaygroundPage() {
  const { mode: appMode } = useAppModeStore();
  const isAD = appMode === 'AD';
  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";
  const accentBgSolidClass = isAD ? "bg-amber-500" : "bg-teal-500";

  const { toast } = useToast()
  const [endpoints, setEndpoints] = useState<Record<string, Endpoint[]>>({})
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const [response, setResponse] = useState<{
    status: number | null
    time: number | null
    data: string | null
    headers: Record<string, string>
  }>({
    status: null,
    time: null,
    data: null,
    headers: {}
  })

  useEffect(() => {
    const defaultEndpoints = {
      "execution": [
        { name: "Place Order", path: "/api/order/place", method: "POST", body: { symbol: "NSE:RELIANCE-EQ", quantity: 1, type: "LIMIT", price: 2500, transaction_type: "BUY", exchange: "NSE" } },
        { name: "Cancel Order", path: "/api/order/cancel", method: "POST", body: { order_id: "ORD_123" } },
        { name: "Order Book", path: "/api/order/book", method: "GET" }
      ],
      "telemetry": [
        { name: "OI Profile", path: "/api/oi-profile", method: "GET", params: { underlying: "NIFTY", exchange: "NFO", expiry_date: "2026-APR-28" } },
        { name: "GEX Stream", path: "/api/gex", method: "GET", params: { underlying: "NIFTY", exchange: "NFO" } },
        { name: "System Health", path: "/api/health/metrics", method: "GET" }
      ],
      "utilities": [
        { name: "Exchanges", path: "/api/config/exchanges", method: "GET" },
        { name: "Broker Config", path: "/api/config/broker", method: "GET" }
      ]
    }
    setEndpoints(defaultEndpoints as any)
    
    tradingService.getPlaygroundEndpoints().then(data => {
      if (data && typeof data === 'object') setEndpoints(data)
    }).catch(err => {
      console.error("FAULT::PLAYGROUND_ENDPOINTS", err);
    })

    tradingService.getPlaygroundApiKey().then(data => {
      if (data?.api_key) setApiKey(data.api_key)
    }).catch(() => {})
  }, [])

  const selectEndpoint = (ep: Endpoint) => {
    const tabId = `${ep.name}-${Date.now()}`
    const body = ep.method === 'POST' ? JSON.stringify(ep.body || {}, null, 2) : JSON.stringify(ep.params || {}, null, 2)
    const newTab = { id: tabId, endpoint: ep, requestBody: body }
    setOpenTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
    setResponse({ status: null, time: null, data: null, headers: {} })
  }

  const closeTab = (id: string) => {
    setOpenTabs(prev => prev.filter(t => t.id !== id))
    if (activeTabId === id) setActiveTabId(null)
  }

  const updateBody = (body: string) => {
    setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, requestBody: body } : t))
  }

  const executeRequest = async () => {
    const tab = openTabs.find(t => t.id === activeTabId)
    if (!tab) return

    setIsLoading(true)
    const startTime = Date.now()
    try {
      let fetchUrl = tab.endpoint.path
      const options: RequestInit = {
        method: tab.endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      }

      if (tab.endpoint.method === 'GET') {
        const params = JSON.parse(tab.requestBody)
        const search = new URLSearchParams()
        Object.entries(params).forEach(([k, v]) => search.append(k, String(v)))
        fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + search.toString()
        
        const res = await apiClient.get(fetchUrl)
        setResponse({
          status: res.status,
          time: Date.now() - startTime,
          data: JSON.stringify(res.data, null, 2),
          headers: res.headers as any
        })
      } else {
        const res = await apiClient.post(fetchUrl, JSON.parse(tab.requestBody))
        setResponse({
          status: res.status,
          time: Date.now() - startTime,
          data: JSON.stringify(res.data, null, 2),
          headers: res.headers as any
        })
      }
    } catch (err: any) {
      console.error("FAULT::API_PLAYGROUND", err);
      setResponse({
        status: err.response?.status || 500,
        time: Date.now() - startTime,
        data: JSON.stringify(err.response?.data || { error: err.message }, null, 2),
        headers: err.response?.headers || {}
      })
    } finally {
      setIsLoading(false)
    }
  }

  const prettify = () => {
    if (!activeTab) return
    try {
      const obj = JSON.parse(activeTab.requestBody)
      updateBody(JSON.stringify(obj, null, 2))
      toast({ title: 'SIGNAL::PRETTIFIED', description: 'Request payload formatted.' })
    } catch {
      toast({ variant: 'destructive', title: 'FAULT::JSON_PARSE', description: 'Invalid payload structure.' })
    }
  }

  const activeTab = openTabs.find(t => t.id === activeTabId)

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-background overflow-hidden font-mono">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <TerminalIcon className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-2xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Market_Playground_Kernel</h1>
            <div className="flex items-center gap-2 mt-1">
              <Zap className={cn("w-3 h-3 animate-pulse", isAD ? "text-amber-500" : "text-teal-500")} />
              <span className="text-[10px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic font-bold">ALPHA_SANDBOX // RAW_PROTOCOL_INTERFACE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => window.location.reload()} 
            className="h-10 font-mono text-[11px] font-black px-4 shadow-[0_0_15px_rgba(255,176,0,0.1)]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> 
            RE_BOOT_CONSOLE
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden border border-border/10">
        {/* Sidebar */}
        <div className="w-64 border-r border-border/10 bg-background/20 flex flex-col">
          <div className="p-3 border-b border-border/10">
             <Input placeholder="SEARCH_ENDPOINTS..." className={cn("h-8 text-[10px] bg-background border-border/10 uppercase font-black tracking-widest focus:ring-0", isAD ? "focus:border-amber-500/40" : "focus:border-teal-500/40")} />
          </div>
          <ScrollArea className="flex-1">
             <div className="p-2 space-y-4">
                {Object.entries(endpoints).map(([cat, eps]) => (
                  <div key={cat} className="space-y-1">
                     <div className="px-2 py-1 text-[9px] font-black font-mono uppercase tracking-widest text-muted-foreground/20 italic">{cat}</div>
                     {eps.map(ep => (
                        <div 
                         key={ep.name} 
                         onClick={() => selectEndpoint(ep)}
                         className={cn(
                           "px-2 py-1.5 rounded-none cursor-pointer group flex items-center justify-between transition-all",
                           isAD ? "hover:bg-amber-500/5" : "hover:bg-teal-500/5"
                         )}
                       >
                         <span className="text-[10px] font-black truncate opacity-40 group-hover:opacity-100 group-hover:pl-1 transition-all uppercase tracking-widest">{ep.name}</span>
                         <Badge variant="outline" className={cn("text-[8px] h-3 px-1 border-0 uppercase font-bold", 
                           ep.method === 'POST' ? primaryColorClass : "text-muted-foreground/30"
                         )}>{ep.method}</Badge>
                       </div>
                     ))}
                  </div>
                ))}
             </div>
          </ScrollArea>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeTab ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
               <Code className="w-16 h-16" />
               <span className="text-[12px] font-black font-mono tracking-[0.4em] uppercase">Select_Endpoint_To_Start_Session</span>
            </div>
          ) : (
            <>
               <div className="p-4 border-b border-border/10 bg-background/20 flex items-center gap-2">
                  <Badge variant="outline" className={cn("font-mono text-[10px] h-9 px-4 rounded-none transition-all", isAD ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-teal-500/10 text-teal-500 border-teal-500/20")}>
                    {activeTab.endpoint.method}
                  </Badge>
                  <Input value={activeTab.endpoint.path} readOnly className="h-9 font-mono text-[11px] bg-background border-border/10 flex-1 opacity-40 rounded-none italic" />
               </div>

              <div className="flex-1 flex divide-x divide-border/40 overflow-hidden">
                {/* Request Pane */}
                 <div className="flex-1 flex flex-col overflow-hidden">
                   <div className="bg-foreground/5 px-4 py-1.5 flex justify-between items-center border-b border-border/10">
                      <span className="text-[9px] font-black font-mono uppercase tracking-widest opacity-20">Payload_Definition</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={prettify}
                        className="h-5 px-2 text-[9px] font-black opacity-20 hover:opacity-100 italic"
                      >
                        PRETTIFY_V
                      </Button>
                   </div>
                   <textarea 
                    value={activeTab.requestBody}
                    onChange={(e) => updateBody(e.target.value)}
                    className={cn(
                      "flex-1 p-4 font-mono text-[12px] bg-background border-none outline-none resize-none placeholder:opacity-5 scrollbar-hide",
                      isAD ? "text-amber-500/80" : "text-teal-500/80"
                    )}
                    placeholder="{ ... }"
                  />
                </div>

                 {/* Response Pane */}
                 <div className="flex-1 flex flex-col overflow-hidden bg-foreground/5">
                    <div className="bg-foreground/5 px-4 py-1.5 flex justify-between items-center border-b border-border/10">
                       <span className="text-[9px] font-black font-mono uppercase tracking-widest opacity-20">Response_Output</span>
                       <div className="flex items-center gap-4">
                         {response.status !== null && (
                           <div className={cn("text-[9px] font-mono font-black border px-2 py-0.5 rounded-none", 
                             response.status >= 200 && response.status < 300 ? "text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]" : "text-rose-500 border-rose-500/20"
                           )}>
                              HTTP::{response.status} :: {response.time}ms
                           </div>
                         )}
                         <Button onClick={executeRequest} disabled={isLoading} className={cn("h-12 w-full font-mono font-black text-[10px] uppercase shadow-xl text-black", isAD ? "bg-amber-500" : "bg-teal-500")}>
                  {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Execute_Vector
               </Button>
                       </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto scrollbar-hide">
                        {response.data ? (
                         <pre className={cn(
                           "font-mono text-[11px] leading-relaxed group",
                           isAD ? "text-amber-500/70" : "text-teal-500/70"
                         )}>
                            {response.data}
                         </pre>
                       ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-10 gap-2 grayscale">
                           <Activity className="w-8 h-8" />
                           <span className="text-[10px] font-black font-mono uppercase tracking-widest">Awaiting_Transmission...</span>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

       {/* Footer Info */}
       <div className="h-8 border-t border-border/10 bg-background/50 px-4 flex items-center justify-between">
          <div className="flex gap-6 items-center">
             <div className="flex items-center gap-1.5 opacity-20">
                <ShieldAlert className={cn("w-3 h-3", isAD ? "text-primary" : "text-rose-500")} />
                <span className="text-[9px] font-black uppercase tracking-widest">MODE::SENSITIVE_EXECUTION_LOCKED</span>
             </div>
             <div className="flex items-center gap-1.5 opacity-20">
                <Globe className={cn("w-3 h-3", primaryColorClass)} />
                <span className="text-[9px] font-black uppercase tracking-widest">NODE::{window.location.hostname}</span>
             </div>
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/10 font-black uppercase tracking-widest italic pr-2">
             AETHERDESK_PLAYGROUND_KERNEL_v1.0
          </div>
       </div>
    </div>
  )
}
