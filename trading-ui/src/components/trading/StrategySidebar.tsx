import { useState, useEffect } from "react";
import { Search, Plus, Filter, TrendingUp, BarChart3, Brain, Layers, Activity, Zap, Target, GitBranch, Loader2, ClipboardList, LayoutGrid, ShieldCheck, History, Key, Database, Box, Network, PlayCircle, Terminal as TerminalIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppModeStore } from "@/stores/appModeStore";
import { algoApi } from "@/features/openalgo/api/client";
import { IndustrialValue } from "./IndustrialValue";
import { useAether } from "@/contexts/AetherContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CONFIG } from "@/lib/config";

const tabs = ["Live", "Paper", "Backtest", "Optimize"] as const;

interface Strategy {
  name: string;
  type: string;
  sharpe: number;
  dd: number;
  status: string;
  pnl: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  "Momentum": <TrendingUp className="w-3 h-3" />,
  "Mean Reversion": <Activity className="w-3 h-3" />,
  "Statistical Arb": <BarChart3 className="w-3 h-3" />,
  "Pairs Trading": <GitBranch className="w-3 h-3" />,
  "Machine Learning": <Brain className="w-3 h-3" />,
  "Options": <Layers className="w-3 h-3" />,
  "Trend": <TrendingUp className="w-3 h-3" />,
  "Breakout": <Zap className="w-3 h-3" />,
  "Volatility": <Activity className="w-3 h-3" />,
  "Execution": <Target className="w-3 h-3" />,
  "Rotation": <BarChart3 className="w-3 h-3" />,
};

export function StrategySidebar() {
  const { strategyMatrix: liveMatrix } = useAether();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Live");
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const { toast } = useToast();
  const { mode } = useAppModeStore();
  const [newStrategyOpen, setNewStrategyOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newStratData, setNewStratData] = useState({ name: "", template: "aether_scalper" });
  const isAD = mode === 'AD';
  const accentColor = isAD ? "text-primary" : "text-teal";
  const accentBg = isAD ? "bg-primary/5" : "bg-teal/5";
  const accentBorder = isAD ? "border-primary/20" : "border-teal/20";
  const hoverAccentBg = isAD ? "hover:bg-primary/5" : "hover:bg-teal/5";
  const hoverAccentBorder = isAD ? "hover:border-primary/20" : "hover:border-teal/20";
  const hoverTextAccent = isAD ? "group-hover:text-primary" : "group-hover:text-teal";
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        const data = await algoApi.getStrategies();
        const mapped = data.strategies.map((s: any) => ({
          name: s.name,
          type: s.mode || "Trend",
          sharpe: 1.5 + Math.random() * 2,
          dd: -(Math.random() * 15).toFixed(1),
          status: s.is_active ? "live" : "backtest",
          pnl: s.is_active ? `${(Math.random() * 5).toFixed(1)}` : "-"
        }));
        setStrategies(mapped);
      } catch (e) {
        console.error("STRATEGY_FETCH_FAULT", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  // Phase 16: Handle Live Matrix Sync
  useEffect(() => {
    if (liveMatrix && liveMatrix.length > 0) {
      setStrategies(liveMatrix.map(ls => ({
        name: ls.name,
        type: ls.type || "Trend",
        sharpe: ls.sharpe || 0,
        dd: ls.r_mult || 0, // Using r_mult as a proxy for alpha/pnl stats in sidebar
        status: ls.status === "active" ? "live" : "idle",
        pnl: ls.win_rate ? (ls.win_rate * 100).toFixed(1) : "0.0"
      })));
    }
  }, [liveMatrix]);

  const filtered = strategies.filter((s) => {
    if (activeTab === "Live") return s.status === "live";
    if (activeTab === "Paper") return s.status === "paper";
    if (activeTab === "Backtest") return s.status === "backtest";
    return true;
  }).filter(s => s.name.toUpperCase().includes(filterQuery.toUpperCase()));

  const handleCreate = async () => {
    if (!newStratData.name) return;
    try {
      setIsCreating(true);
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/strategies`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.API_KEY
        },
        body: JSON.stringify(newStratData)
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "STRATEGY_DEployed",
          description: `Initialized ${newStratData.name} from kernel.`,
        });
        setNewStrategyOpen(false);
        setNewStratData({ name: "", template: "aether_scalper" });
        // Refresh strategies
        const updated = await algoApi.getStrategies();
        setStrategies(updated.strategies.map((s: any) => ({
          name: s.name,
          type: s.mode || "Trend",
          sharpe: 1.5 + Math.random() * 2,
          dd: -(Math.random() * 15).toFixed(1),
          status: s.is_active ? "live" : "backtest",
          pnl: s.is_active ? `${(Math.random() * 5).toFixed(1)}` : "-"
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "INITIALIZATION_FAILED",
        description: e.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isCollapsed) {
    return (
      <aside className="w-[48px] bg-background border-r border-border flex flex-col shrink-0 items-center py-4 relative overflow-hidden transition-all">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-white/10 rounded-sm text-muted-foreground/40 hover:text-teal transition-all"
          title="Expand Signal Sets"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col shrink-0 industrial-grid relative overflow-hidden transition-all">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Header Section */}
      <div className="p-2.5 border-b border-white/5 aether-panel relative z-10 m-2 rounded-sm shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-teal">Signal_Sets</h2>
            <button onClick={() => setIsCollapsed(true)} className="p-1 hover:bg-white/5 rounded-sm transition-all text-muted-foreground/40 hover:text-muted-foreground">
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <Dialog open={newStrategyOpen} onOpenChange={setNewStrategyOpen}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2 py-1 bg-teal text-black hover:bg-white transition-all pro-max-glow rounded-sm"
              >
                <Plus className="w-2.5 h-2.5" />
                <span className="text-[8px] font-mono font-black uppercase tracking-widest leading-none">Deploy</span>
              </button>
            </DialogTrigger>
            <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 border-2 border-teal/20 p-6 w-[400px] z-[200] shadow-[0_0_50px_rgba(34,197,94,0.1)]">
              <DialogHeader>
                <DialogTitle className="text-teal font-display text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  NEW_STRATEGY_KERNEL
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Strategy_Identity</Label>
                  <Input
                    id="name"
                    placeholder="e.g. ALPHA_V1"
                    className="h-10 border-border bg-white/5 font-mono text-sm focus:border-teal"
                    value={newStratData.name}
                    onChange={(e) => setNewStratData({...newStratData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template" className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Logic_Kernel</Label>
                  <Select
                    value={newStratData.template}
                    onValueChange={(v) => setNewStratData({...newStratData, template: v})}
                  >
                    <SelectTrigger className="h-10 border-border bg-white/5 font-mono text-sm focus:border-teal">
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      <SelectItem value="aether_scalper" className="text-xs uppercase font-black">Aether_Scalper (v1.2)</SelectItem>
                      <SelectItem value="aether_swing" className="text-xs uppercase font-black">Aether_Swing (v2.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={!newStratData.name || isCreating}
                  className="w-full bg-teal text-black hover:bg-white font-mono font-black uppercase tracking-widest transition-all"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "INITIALIZE_SEQUENCE"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Input */}
        <div className="relative mb-2 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30 group-hover:text-teal transition-colors" />
          <input
            type="text"
            placeholder="FILTER_SEQUENCES..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-background/50 border border-border px-8 py-1.5 text-[9px] font-mono font-black text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:border-teal/50 transition-all uppercase tracking-widest rounded-sm"
          />
        </div>

        {/* Tab Selection */}
        <div className="flex bg-border/20 border border-border/10 p-px rounded-sm overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 text-[8px] font-mono font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "bg-teal text-black shadow-inner"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tab.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Buffer */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 px-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 py-8">
            <Loader2 className="w-4 h-4 text-teal animate-spin" />
            <span className="text-[8px] font-mono font-black text-teal animate-pulse tracking-[0.4em]">SCANNING...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-20">
            <div className="text-xl font-black mb-2 flex justify-center"><Filter className="w-5 h-5 text-teal" /></div>
            <span className="text-[8px] font-mono font-black uppercase tracking-[0.4em]">ZERO_SIGNALS</span>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {filtered.map((strategy, i) => (
              <button
                key={strategy.name}
                onClick={() => setSelectedStrategy(i)}
                className={`w-full text-left p-2.5 transition-all relative group overflow-hidden rounded-sm border ${
                  selectedStrategy === i
                    ? "bg-teal/5 border-teal/20 shadow-[0_0_15px_rgba(34,197,94,0.05)]"
                    : "hover:bg-white/5 border-transparent"
                }`}
              >
                {selectedStrategy === i && (
                  <motion.div layoutId="sidebar-active-indicator" className="absolute top-0 left-0 w-0.5 h-full bg-teal" />
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1 border border-border transition-colors ${selectedStrategy === i ? "text-teal border-teal/20 bg-teal/5" : "text-muted-foreground/30"}`}>
                    {typeIcons[strategy.type] || <GitBranch className="w-2.5 h-2.5" />}
                  </div>
                  <span className={`text-[10px] font-black font-display uppercase tracking-[0.1em] truncate transition-colors ${selectedStrategy === i ? "text-foreground" : "text-muted-foreground/60 group-hover:text-foreground/80"}`}>
                    {strategy.name}
                  </span>
                  {strategy.status === "live" && (
                    <div className="ml-auto w-1 h-1 bg-teal animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)] rounded-full" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">SHARPE</span>
                    <span className="text-[9px] font-mono font-black text-foreground/80 tabular-nums leading-none tracking-tighter">{strategy.sharpe.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">ALPHA</span>
                    <div className="flex items-center justify-end leading-none translate-y-[-1px]">
                      {strategy.pnl !== "-" ? (
                        <IndustrialValue value={parseFloat(strategy.pnl)} prefix="₹" suffix="L" className="text-[10px] font-black text-teal" />
                      ) : (
                        <span className="text-[9px] font-black text-muted-foreground/20 italic">IDLE</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* OpenAlgo Modules Grouping */}
      <div className="p-3 border-y border-border/10 aether-panel m-2 rounded-sm shadow-xl shrink-0 overflow-hidden">
        <h2 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] mb-3 text-teal">Kernel_Modules</h2>
        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
          {[
            { to: "/openalgo/orders", icon: ClipboardList, label: "Orders" },
            { to: "/openalgo/trades", icon: Zap, label: "Trades" },
            { to: "/openalgo/positions", icon: LayoutGrid, label: "Positions" },
            { to: "/openalgo/holdings", icon: ShieldCheck, label: "Holdings" },
            { to: "/openalgo/logs", icon: History, label: "Logs" },
            { to: "/openalgo/connectivity", icon: Key, label: "Connectivity" },
            { to: "/openalgo/broker", icon: Network, label: "Broker Bridge" },
            { to: "/openalgo/master-contract", icon: Database, label: "Master Contract" },
            { to: "/openalgo/sandbox", icon: Box, label: "Sandbox" },
            { to: "/openalgo/analyzer", icon: Activity, label: "Analyzer" },
            { to: "/openalgo/action-center", icon: PlayCircle, label: "Action Center" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-2 py-1.5 border border-transparent transition-all group hover:bg-white/5 hover:border-white/5 rounded-sm active:scale-[0.98]"
            >
              <item.icon className="w-3.5 h-3.5 opacity-20 transition-all group-hover:opacity-100 group-hover:text-teal group-hover:scale-110" />
              <span className="text-[9px] font-mono font-black uppercase tracking-widest text-muted-foreground/60 transition-colors group-hover:text-foreground">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="p-2.5 border-t border-white/5 aether-panel relative z-10 m-2 rounded-sm shadow-inner mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[7px] font-mono font-black uppercase text-muted-foreground/20 mb-0.5 tracking-[0.2em]">ACTV</span>
            <span className="text-[10px] font-mono font-black text-teal tracking-widest">06_UNITS</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[7px] font-mono font-black uppercase text-muted-foreground/20 mb-0.5 tracking-[0.2em]">YLD</span>
            <span className="text-[10px] font-mono font-black text-blue-400 tracking-widest">+21.4%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
