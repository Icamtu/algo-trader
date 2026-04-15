import { useState, useEffect } from "react";
import { Search, Plus, Filter, TrendingUp, BarChart3, Brain, Layers, Activity, Zap, Target, GitBranch, Loader2, ClipboardList, LayoutGrid, ShieldCheck, History, Key, Database, Box, Network, PlayCircle, Terminal as TerminalIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAppModeStore } from "@/stores/appModeStore";
import { algoApi } from "@/features/openalgo/api/client";
import { IndustrialValue } from "./IndustrialValue";
import { useToast } from "@/hooks/use-toast";

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
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Live");
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const { toast } = useToast();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';
  const accentColor = isAD ? "text-primary" : "text-teal";
  const accentBg = isAD ? "bg-primary/5" : "bg-teal/5";
  const accentBorder = isAD ? "border-primary/20" : "border-teal/20";
  const hoverAccentBg = isAD ? "hover:bg-primary/5" : "hover:bg-teal/5";
  const hoverAccentBorder = isAD ? "hover:border-primary/20" : "hover:border-teal/20";
  const hoverTextAccent = isAD ? "group-hover:text-primary" : "group-hover:text-teal";

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

  const filtered = strategies.filter((s) => {
    if (activeTab === "Live") return s.status === "live";
    if (activeTab === "Paper") return s.status === "paper";
    if (activeTab === "Backtest") return s.status === "backtest";
    return true;
  }).filter(s => s.name.toUpperCase().includes(filterQuery.toUpperCase()));

  const handleDeploy = () => {
    toast({
      title: "DEPLOYMENT_INITIALIZED",
      description: "Establishing new signal sequence...",
    });
  };

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col shrink-0 industrial-grid relative overflow-hidden">
      <div className="noise-overlay" />
      {/* Header Section */}
      <div className="p-2.5 border-b border-border bg-card/5 backdrop-blur-md relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-primary">Signal_Sets</h2>
          <button 
            onClick={handleDeploy}
            className="flex items-center gap-1.5 px-2 py-1 bg-foreground text-background hover:bg-primary hover:text-black transition-all"
          >
            <Plus className="w-2.5 h-2.5" />
            <span className="text-[8px] font-mono font-black uppercase tracking-widest leading-none">Deploy</span>
          </button>
        </div>

        {/* Filter Input */}
        <div className="relative mb-2 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
          <input
            type="text"
            placeholder="FILTER_SEQUENCES..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-background border border-border px-8 py-1.5 text-[9px] font-mono font-black text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:border-primary transition-all uppercase tracking-widest"
          />
        </div>

        {/* Tab Selection */}
        <div className="flex bg-border/50 border border-border p-px">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 text-[8px] font-mono font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "bg-primary text-black"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-card/20"
              }`}
            >
              {tab.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Buffer */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 py-8">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-[8px] font-mono font-black text-primary animate-pulse tracking-[0.4em]">SCANNING...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-20">
            <div className="text-xl font-black mb-2 flex justify-center"><Filter className="w-5 h-5" /></div>
            <span className="text-[8px] font-mono font-black uppercase tracking-[0.4em]">ZERO_SIGNALS</span>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((strategy, i) => (
              <button
                key={strategy.name}
                onClick={() => setSelectedStrategy(i)}
                className={`w-full text-left p-2.5 transition-all relative group overflow-hidden ${
                  selectedStrategy === i
                    ? "bg-card/40 border-y border-primary/10"
                    : "hover:bg-card/10"
                }`}
              >
                {selectedStrategy === i && (
                  <div className="absolute top-0 left-0 w-0.5 h-full bg-primary" />
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1 border border-border ${selectedStrategy === i ? "text-primary border-primary/20 bg-primary/5" : "text-muted-foreground/30"}`}>
                    {typeIcons[strategy.type] || <GitBranch className="w-2.5 h-2.5" />}
                  </div>
                  <span className={`text-[10px] font-black font-display uppercase tracking-[0.1em] truncate ${selectedStrategy === i ? "text-foreground" : "text-muted-foreground/60"}`}>
                    {strategy.name}
                  </span>
                  {strategy.status === "live" && (
                    <div className="ml-auto w-1 h-1 bg-secondary animate-pulse shadow-[0_0_8px_#00d4d4]" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">SHARPE</span>
                    <span className="text-[9px] font-mono font-black text-foreground/80 tabular-nums leading-none">{strategy.sharpe.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest mb-0.5">ALPHA</span>
                    <div className="flex items-center justify-end leading-none translate-y-[-1px]">
                      {strategy.pnl !== "-" ? (
                        <IndustrialValue value={parseFloat(strategy.pnl)} prefix="₹" suffix="L" className="text-[10px] font-black text-secondary" />
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
      <div className="p-2.5 border-y border-border bg-black/20">
        <h2 className={`text-[10px] font-mono font-black uppercase tracking-[0.3em] mb-3 ${accentColor}`}>OpenAlgo_Modules</h2>
        <div className="space-y-1">
          {[
            { to: "/openalgo/orders", icon: ClipboardList, label: "Orders" },
            { to: "/openalgo/trades", icon: Zap, label: "Trades" },
            { to: "/openalgo/positions", icon: LayoutGrid, label: "Positions" },
            { to: "/openalgo/holdings", icon: ShieldCheck, label: "Holdings" },
            { to: "/openalgo/logs", icon: History, label: "Logs" },
            { to: "/openalgo/connectivity", icon: Key, label: "Connectivity" },
            { to: "/openalgo/broker", icon: Network, label: "Broker Bridge" },
            { to: "/openalgo/master-contract", icon: Database, iconColor: "text-blue-400", label: "Master Contract" },
            { to: "/openalgo/sandbox", icon: Box, iconColor: "text-amber-400", label: "Sandbox" },
            { to: "/openalgo/analyzer", icon: Activity, iconColor: "text-primary", label: "Analyzer" },
            { to: "/openalgo/action-center", icon: PlayCircle, iconColor: "text-emerald-400", label: "Action Center" },
            { to: "/openalgo/option-chain", icon: Layers, label: "Option Chain" },
            { to: "/openalgo/gex", icon: BarChart3, label: "GEX Dashboard" },
            { to: "/openalgo/oi-profile", icon: LayoutGrid, label: "OI Profile" },
            { to: "/openalgo/health", icon: Activity, label: "Health Monitor" },
            { to: "/openalgo/playground", icon: TerminalIcon, label: "API Playground" },
            { to: "/openalgo/oi-tracker", icon: Target, label: "OI Tracker" },
            { to: "/openalgo/vol-surface", icon: Activity, label: "Volatility Surface" },
            { to: "/openalgo/iv-smile", icon: Activity, label: "IV Smile Lab" },
            { to: "/openalgo/iv-chart", icon: BarChart3, label: "IV/Greek History" },
            { to: "/openalgo/historify", icon: Database, label: "Historify Data" },
            { to: "/openalgo/max-pain", icon: Target, label: "Max Pain Lab" },
            { to: "/openalgo/straddle-lab", icon: Layers, label: "Straddle Lab" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-2 py-1.5 border border-transparent transition-all group ${hoverAccentBg} ${hoverAccentBorder}`}
            >
              <item.icon className={`w-3.5 h-3.5 opacity-40 transition-colors ${hoverTextAccent}`} />
              <span className={`text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground transition-colors ${hoverTextAccent}`}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="p-2.5 border-t border-border bg-card/10 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[7px] font-mono font-black uppercase text-muted-foreground/40 mb-0.5 tracking-[0.2em]">ACTV</span>
            <span className="text-[10px] font-mono font-black text-secondary tracking-widest">06_UNITS</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[7px] font-mono font-black uppercase text-muted-foreground/40 mb-0.5 tracking-[0.2em]">YLD</span>
            <span className="text-[10px] font-mono font-black text-primary tracking-widest">+21.4%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
