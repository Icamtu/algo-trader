import { useState, useEffect, useMemo } from "react";
import { usePositions, useFunds } from "@/hooks/useTrading";
import { motion } from "framer-motion";
import { GlobalHeader } from "@/components/trading/GlobalHeader";
import { RightPanel } from "@/components/trading/RightPanel";
import { NewOrderModal } from "@/components/trading/NewOrderModal";
import { algoApi } from "@/lib/api-client";
import type { PnlResponse, Position } from "@/types/api";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Shield, Settings, LineChart, Radar, Search, Briefcase, BookOpen, Server, Bell, GitBranch, TrendingUp, TrendingDown, PieChart, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from "recharts";
import { MarketNavbar } from "@/components/trading/MarketNavbar";

const pageTabs = ["Overview", "Allocation", "Performance"] as const;

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<typeof pageTabs[number]>("Overview");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string>("");

  const { data: positionsData, isLoading: isLoadingPositions, error: posError } = usePositions();
  const { data: fundsData, isLoading: isLoadingFunds, error: fundsError } = useFunds();
  const [pnlData, setPnlData] = useState<PnlResponse | null>(null);

  useEffect(() => {
    algoApi.getPnl().then(setPnlData).catch(() => {});
  }, []);

  const hasError = posError || fundsError;

  const metrics = useMemo(() => {
    const totalValue = positionsData?.total_value || 0;
    return {
      totalValue,
      dayPnL: pnlData?.total_pnl || 0,
      unrealizedPnL: pnlData?.unrealized_pnl || 0,
      realizedPnL: pnlData?.realized_pnl || 0,
      pnlPct: pnlData?.pnl_percentage || 0,
    };
  }, [positionsData, fundsData, pnlData]);

  const allocation = useMemo(() => {
    if (!positionsData?.positions) return [];
    return positionsData.positions.map((p: Position, i: number) => ({
      name: p.symbol,
      value: p.current_value,
      color: `hsl(${234 + i * 40}, 89%, 64%)`
    }));
  }, [positionsData]);

  const monthlyPnL = [
    { month: "Jan", pnl: 125000 },
    { month: "Feb", pnl: -45000 },
    { month: "Mar", pnl: 189000 },
    { month: "Apr", pnl: 98000 },
    { month: "May", pnl: -72000 },
    { month: "Jun", pnl: 234000 },
    { month: "Jul", pnl: 156000 },
    { month: "Aug", pnl: -89000 },
    { month: "Sep", pnl: 178000 },
    { month: "Oct", pnl: 234000 },
    { month: "Nov", pnl: 145000 },
    { month: "Dec", pnl: 98000 },
  ];

  const handleTradeClick = (symbol: string) => {
    setPrefilledSymbol(symbol);
    setOrderModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <GlobalHeader />
      <MarketNavbar activeTab="/portfolio" />
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 bg-background/50">
        {pageTabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${activeTab === tab ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {hasError && (
            <div className="flex items-center gap-3 p-4 mb-4 bg-destructive/10 border border-destructive/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase text-destructive tracking-widest">Connection Error</div>
                <div className="text-[9px] text-muted-foreground">Unable to retrieve portfolio data. The trading engine may be offline.</div>
              </div>
            </div>
          )}
          {(isLoadingPositions || isLoadingFunds) && !hasError && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Portfolio...</span>
              </div>
            </div>
          )}
          {activeTab === "Overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Total P&L" value={`₹${(metrics.dayPnL/1000).toFixed(0)}K`} icon={TrendingUp} color={metrics.dayPnL >= 0 ? "text-neon-green" : "text-destructive"} />
                <MetricCard label="Unrealized" value={`₹${(metrics.unrealizedPnL/1000).toFixed(0)}K`} icon={TrendingUp} color={metrics.unrealizedPnL >= 0 ? "text-neon-green" : "text-destructive"} />
                <MetricCard label="Realized" value={`₹${(metrics.realizedPnL/1000).toFixed(0)}K`} icon={TrendingDown} color={metrics.realizedPnL >= 0 ? "text-neon-green" : "text-destructive"} />
                <MetricCard label="Return %" value={`${metrics.pnlPct >= 0 ? '+' : ''}${metrics.pnlPct.toFixed(1)}%`} icon={PieChart} color="text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Total Value" value={`₹${(metrics.totalValue/100000).toFixed(1)}L`} icon={PieChart} color="text-foreground" />
                <MetricCard label="Account Capital" value={`₹${((fundsData?.cash || 0)/100000).toFixed(1)}L`} icon={Briefcase} color="text-primary" />
              </div>
              <div className="glass-panel rounded-xl p-4">
                <h3 className="text-xs font-semibold text-foreground mb-4">Monthly P&L</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPnL}>
                      <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(215, 20%, 55%)" fontSize={10} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(217, 33%, 17%)', borderRadius: '8px' }} formatter={(v: number) => [`₹${(v/1000).toFixed(0)}K`, 'P&L']} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {monthlyPnL.map((entry, index) => (
                          <Cell key={index} fill={entry.pnl >= 0 ? "hsl(160, 84%, 39%)" : "hsl(0, 72%, 51%)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === "Allocation" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-4">Asset Allocation</h3>
              <div className="flex items-center gap-8">
                <div className="w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {allocation.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(217, 33%, 17%)', borderRadius: '8px' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {allocation.map((a) => (
                    <div key={a.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{a.name}</span>
                      <span className="text-xs font-semibold text-foreground">{a.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === "Performance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Total Return</div>
                  <div className="text-2xl font-bold text-neon-green">+₹78.4L</div>
                  <div className="text-xs text-muted-foreground">Since inception</div>
                </div>
                <div className="glass-panel rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Max Drawdown</div>
                  <div className="text-2xl font-bold text-neon-red">-12.4%</div>
                  <div className="text-xs text-muted-foreground">Peak to trough</div>
                </div>
                <div className="glass-panel rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Win Rate</div>
                  <div className="text-2xl font-bold text-primary">64.2%</div>
                  <div className="text-xs text-muted-foreground">Win/Loss ratio</div>
                </div>
                <div className="glass-panel rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Profit Factor</div>
                  <div className="text-2xl font-bold text-neon-cyan">2.34</div>
                  <div className="text-xs text-muted-foreground">Gross profit/loss</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
        <RightPanel />
      </div>
      <NewOrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} prefilledSymbol={prefilledSymbol} />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: LucideIcon; color: string }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function NavTab({ to, icon: Icon, label, active }: { to: string; icon: LucideIcon; label: string; active?: boolean }) {
  return <a href={to} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${active ? "text-primary bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}><Icon className="w-3.5 h-3.5" />{label}</a>;
}
