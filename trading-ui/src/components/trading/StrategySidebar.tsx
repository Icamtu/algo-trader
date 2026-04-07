import { useState, useEffect } from "react";
import { Search, Plus, Sparkles, Filter, TrendingUp, BarChart3, Brain, Layers, Activity, Zap, Target, GitBranch, Loader2 } from "lucide-react";
import { algoApi } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

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
  "Momentum": <TrendingUp className="w-3.5 h-3.5" />,
  "Mean Reversion": <Activity className="w-3.5 h-3.5" />,
  "Statistical Arb": <BarChart3 className="w-3.5 h-3.5" />,
  "Pairs Trading": <GitBranch className="w-3.5 h-3.5" />,
  "Machine Learning": <Brain className="w-3.5 h-3.5" />,
  "Options": <Layers className="w-3.5 h-3.5" />,
  "Trend": <TrendingUp className="w-3.5 h-3.5" />,
  "Breakout": <Zap className="w-3.5 h-3.5" />,
  "Volatility": <Activity className="w-3.5 h-3.5" />,
  "Execution": <Target className="w-3.5 h-3.5" />,
  "Rotation": <BarChart3 className="w-3.5 h-3.5" />,
};

export function StrategySidebar() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Live");
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        const data = await algoApi.getStrategies();
        const mapped = data.strategies.map((s: any) => ({
          name: s.name,
          type: s.mode || "Trend", // Default type fallback
          sharpe: 1.5 + Math.random() * 2, // Mock for now
          dd: -(Math.random() * 15).toFixed(1), // Mock for now
          status: s.is_active ? "live" : "backtest",
          pnl: s.is_active ? `+₹${(Math.random() * 5).toFixed(1)}L` : "-"
        }));
        setStrategies(mapped);
      } catch (e) {
        console.error("Failed to fetch strategies", e);
        // Fallback to minimal data or show error
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
  });

  return (
    <aside className="w-64 glass-panel border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Strategies</h2>
          <button className="glow-button rounded-md px-2 py-1 flex items-center gap-1">
            <Plus className="w-3 h-3 text-primary-foreground" />
            <span className="text-[10px] font-semibold text-primary-foreground">New</span>
            <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search strategies..."
            className="w-full bg-muted/50 border border-border rounded-md pl-7 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2">
            <Filter className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mt-2.5 bg-muted/30 rounded-md p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${
                activeTab === tab
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <span className="text-[10px] text-muted-foreground uppercase">No strategies found</span>
          </div>
        ) : (
          filtered.map((strategy, i) => (
            <button
              key={strategy.name}
              onClick={() => setSelectedStrategy(i)}
              className={`w-full text-left p-2.5 rounded-md transition-all group ${
                selectedStrategy === i
                  ? "glass-panel-elevated neon-border-cyan"
                  : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`${selectedStrategy === i ? "text-primary" : "text-muted-foreground"} transition-colors`}>
                  {typeIcons[strategy.type] || <BarChart3 className="w-3.5 h-3.5" />}
                </span>
                <span className="text-xs font-medium text-foreground truncate">{strategy.name}</span>
                {strategy.status === "live" && <span className="status-dot-live ml-auto shrink-0" />}
              </div>
              <div className="flex items-center gap-3 ml-5.5">
                <span className="text-[10px] text-muted-foreground">{strategy.type}</span>
                <span className="text-[10px] text-muted-foreground">S: {strategy.sharpe.toFixed(2)}</span>
                <span className="text-[10px] text-neon-red">DD: {strategy.dd}%</span>
                {strategy.pnl !== "-" && (
                  <span className="text-[10px] text-neon-green ml-auto">{strategy.pnl}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="metric-label">Active</div>
            <div className="metric-value text-neon-green">6</div>
          </div>
          <div>
            <div className="metric-label">Paper</div>
            <div className="metric-value text-neon-orange">3</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
