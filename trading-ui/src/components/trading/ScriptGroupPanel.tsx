import { useState, useRef, useCallback, useEffect } from "react";
import { algoApi } from "@/features/openalgo/api/client";
import { X, Plus, GripVertical, Clock, GitBranch, ChevronRight, ChevronDown, Layers, Play, Pause, Trash2, Copy, Tag, History, CheckCircle2, Circle, ArrowUpDown, Search, MoreHorizontal, Sparkles } from "lucide-react";

// --- Types ---
interface Script {
  id: string;
  name: string;
  language: "Python" | "Pine" | "MQL";
  version: string;
  lastModified: string;
  status: "active" | "paused" | "draft";
  assignedStrategies: string[];
}

interface ScriptGroup {
  id: string;
  name: string;
  color: string;
  scripts: Script[];
  collapsed: boolean;
}

interface VersionEntry {
  version: string;
  date: string;
  author: string;
  changes: string;
  status: "deployed" | "testing" | "archived";
}

// --- Mock Data ---
const initialGroups: ScriptGroup[] = [
  {
    id: "g1",
    name: "Momentum Suite",
    color: "var(--neon-cyan)",
    collapsed: false,
    scripts: [
      { id: "s1", name: "momentum_entry.py", language: "Python", version: "v3.2.1", lastModified: "2h ago", status: "active", assignedStrategies: ["Momentum Alpha", "Trend Following"] },
      { id: "s2", name: "momentum_exit.py", language: "Python", version: "v2.8.0", lastModified: "1d ago", status: "active", assignedStrategies: ["Momentum Alpha"] },
      { id: "s3", name: "momentum_sizing.py", language: "Python", version: "v1.4.2", lastModified: "3d ago", status: "paused", assignedStrategies: ["Momentum Alpha", "Crypto Momentum"] },
    ],
  },
  {
    id: "g2",
    name: "Mean Reversion",
    color: "hsl(272 87% 53%)",
    collapsed: false,
    scripts: [
      { id: "s4", name: "mean_rev_signal.py", language: "Python", version: "v5.1.0", lastModified: "4h ago", status: "active", assignedStrategies: ["Mean Rev Nifty"] },
      { id: "s5", name: "zscore_calc.pine", language: "Pine", version: "v1.0.3", lastModified: "1w ago", status: "draft", assignedStrategies: [] },
    ],
  },
  {
    id: "g3",
    name: "Risk Management",
    color: "hsl(142 71% 45%)",
    collapsed: true,
    scripts: [
      { id: "s6", name: "portfolio_hedge.py", language: "Python", version: "v2.0.0", lastModified: "6h ago", status: "active", assignedStrategies: ["Stat Arb Pairs", "Options Greeks"] },
      { id: "s7", name: "var_calculator.py", language: "Python", version: "v3.1.1", lastModified: "2d ago", status: "active", assignedStrategies: ["Stat Arb Pairs"] },
      { id: "s8", name: "drawdown_guard.py", language: "Python", version: "v1.2.0", lastModified: "5d ago", status: "paused", assignedStrategies: ["ML Regime"] },
    ],
  },
  {
    id: "g4",
    name: "Execution Algos",
    color: "hsl(38 92% 50%)",
    collapsed: true,
    scripts: [
      { id: "s9", name: "vwap_slicer.py", language: "Python", version: "v4.0.2", lastModified: "12h ago", status: "active", assignedStrategies: ["VWAP Execution"] },
      { id: "s10", name: "iceberg_order.mql", language: "MQL", version: "v1.1.0", lastModified: "3d ago", status: "draft", assignedStrategies: [] },
    ],
  },
];

const versionHistory: VersionEntry[] = [
  { version: "v3.2.1", date: "2026-04-04 14:32", author: "AK", changes: "Fixed edge case in RSI divergence detection", status: "deployed" },
  { version: "v3.2.0", date: "2026-04-03 09:15", author: "AK", changes: "Added multi-timeframe confirmation logic", status: "deployed" },
  { version: "v3.1.0", date: "2026-04-01 18:44", author: "RJ", changes: "Refactored signal pipeline for lower latency", status: "deployed" },
  { version: "v3.0.0", date: "2026-03-28 11:20", author: "AK", changes: "Major rewrite: switched to vectorized backtest engine", status: "deployed" },
  { version: "v2.9.0", date: "2026-03-25 16:30", author: "RJ", changes: "Added Bollinger squeeze filter", status: "archived" },
  { version: "v2.8.0", date: "2026-03-20 08:00", author: "AK", changes: "Performance optimization on tick processing", status: "archived" },
];

const universeSymbols = [
  "NIFTY 50", "NIFTY BANK", "RELIANCE", "HDFCBANK", "INFY", "TCS", 
  "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT"
];

const langColors: Record<string, string> = {
  Python: "text-primary",
  Pine: "text-neon-green",
  MQL: "text-neon-orange",
};

// --- Component ---
export function ScriptGroupPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState<ScriptGroup[]>(initialGroups);
  const [selectedScript, setSelectedScript] = useState<Script | null>(initialGroups[0].scripts[0]);
  const [activeView, setActiveView] = useState<"scripts" | "versions" | "assign">("scripts");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    algoApi.getStrategies()
      .then(res => {
        if (res.strategies && res.strategies.length > 0) {
          const loadedGroup: ScriptGroup = {
            id: 'backend-core',
            name: 'Algo-Engine Live Core',
            color: 'var(--primary)',
            collapsed: false,
            scripts: res.strategies.map((s: any) => ({
              id: s.id,
              name: `${s.id}.py`,
              language: "Python",
              version: "v1.0.0",
              lastModified: "Synced",
              status: s.is_active ? "active" : "paused",
              assignedStrategies: s.symbols || []
            }))
          };
          setGroups([loadedGroup]);
          setSelectedScript(loadedGroup.scripts[0]);
        }
      })
      .catch(console.error);
  }, []);

  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const dragItem = useRef<{ scriptId: string; groupId: string } | null>(null);

  const toggleGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
  };

  const handleDragStart = (scriptId: string, groupId: string) => {
    dragItem.current = { scriptId, groupId };
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverGroup(groupId);
  };

  const handleDrop = useCallback((targetGroupId: string) => {
    if (!dragItem.current || dragItem.current.groupId === targetGroupId) {
      setDragOverGroup(null);
      return;
    }
    setGroups(prev => {
      const sourceGroup = prev.find(g => g.id === dragItem.current!.groupId);
      const script = sourceGroup?.scripts.find(s => s.id === dragItem.current!.scriptId);
      if (!script) return prev;
      return prev.map(g => {
        if (g.id === dragItem.current!.groupId) return { ...g, scripts: g.scripts.filter(s => s.id !== dragItem.current!.scriptId) };
        if (g.id === targetGroupId) return { ...g, scripts: [...g.scripts, script], collapsed: false };
        return g;
      });
    });
    setDragOverGroup(null);
    dragItem.current = null;
  }, []);

  const toggleStrategyAssignment = (scriptId: string, strategy: string) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      scripts: g.scripts.map(s => {
        if (s.id !== scriptId) return s;
        const has = s.assignedStrategies.includes(strategy);
        return { ...s, assignedStrategies: has ? s.assignedStrategies.filter(st => st !== strategy) : [...s.assignedStrategies, strategy] };
      })
    })));
    if (selectedScript?.id === scriptId) {
      setSelectedScript(prev => {
        if (!prev) return prev;
        const has = prev.assignedStrategies.includes(strategy);
        return { ...prev, assignedStrategies: has ? prev.assignedStrategies.filter(st => st !== strategy) : [...prev.assignedStrategies, strategy] };
      });
    }
  };

  const statusIcon = (status: string) => {
    if (status === "active") return <Play className="w-3 h-3 text-neon-green" />;
    if (status === "paused") return <Pause className="w-3 h-3 text-neon-orange" />;
    return <Circle className="w-3 h-3 text-muted-foreground" />;
  };

  const filteredGroups = groups.map(g => ({
    ...g,
    scripts: searchQuery ? g.scripts.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())) : g.scripts,
  })).filter(g => g.scripts.length > 0 || !searchQuery);

  const totalScripts = groups.reduce((acc, g) => acc + g.scripts.length, 0);
  const activeScripts = groups.reduce((acc, g) => acc + g.scripts.filter(s => s.status === "active").length, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[1100px] max-w-[95vw] h-[700px] max-h-[90vh] glass-panel-elevated rounded-xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Strategy Core Vault</h2>
              <p className="text-[10px] text-muted-foreground">{groups.length} partitions · {totalScripts} strategies · {activeScripts} live</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="glow-button rounded-md px-3 py-1.5 flex items-center gap-1.5">
              <Plus className="w-3 h-3 text-primary-foreground" />
              <span className="text-xs font-semibold text-primary-foreground">New Partition</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Left: Group Tree */}
          <div className="w-[340px] border-r border-border flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search strategies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-md pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            {/* Group List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  onDragOver={(e) => handleDragOver(e, group.id)}
                  onDragLeave={() => setDragOverGroup(null)}
                  onDrop={() => handleDrop(group.id)}
                  className={`rounded-lg transition-all ${dragOverGroup === group.id ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    {group.collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: group.color }} />
                    <span className="text-xs font-medium text-foreground flex-1 text-left">{group.name}</span>
                    <span className="text-[10px] text-muted-foreground">{group.scripts.length}</span>
                  </button>

                  {/* Scripts */}
                  {!group.collapsed && (
                    <div className="ml-4 space-y-0.5 pb-1">
                      {group.scripts.map((script) => (
                        <div
                          key={script.id}
                          draggable
                          onDragStart={() => handleDragStart(script.id, group.id)}
                          onClick={() => { setSelectedScript(script); setActiveView("scripts"); }}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all group ${
                            selectedScript?.id === script.id ? "glass-panel-elevated neon-border-cyan" : "hover:bg-muted/20"
                          }`}
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                          {statusIcon(script.status)}
                          <span className="text-[11px] text-foreground truncate flex-1 mono-text">{script.name}</span>
                          <span className={`text-[9px] ${langColors[script.language]}`}>{script.language}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedScript ? (
              <>
                {/* Script Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(selectedScript.status)}
                      <h3 className="text-sm font-semibold text-foreground mono-text">{selectedScript.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${langColors[selectedScript.language]} bg-muted/50`}>{selectedScript.language}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors" title="Duplicate">
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><GitBranch className="w-3 h-3" />{selectedScript.version}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{selectedScript.lastModified}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" />{selectedScript.assignedStrategies.length} symbols</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 p-3 pb-0">
                  {(["scripts", "versions", "assign"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveView(tab)}
                      className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                        activeView === tab
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      {tab === "scripts" ? "Overview" : tab === "versions" ? "Version History" : "Symbol Assignment"}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeView === "scripts" && (
                    <div className="space-y-4">
                      {/* Metrics */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "Version", value: selectedScript.version, color: "text-primary" },
                          { label: "State", value: selectedScript.status, color: selectedScript.status === "active" ? "text-neon-green" : selectedScript.status === "paused" ? "text-neon-orange" : "text-muted-foreground" },
                          { label: "Symbols", value: String(selectedScript.assignedStrategies.length), color: "text-foreground" },
                          { label: "Last Sync", value: selectedScript.lastModified, color: "text-foreground" },
                        ].map((m) => (
                          <div key={m.label} className="glass-panel rounded-lg p-3">
                            <div className="metric-label mb-1">{m.label}</div>
                            <div className={`metric-value ${m.color} capitalize`}>{m.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Assigned Symbols */}
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Assigned Symbols</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedScript.assignedStrategies.length > 0 ? selectedScript.assignedStrategies.map((s) => (
                            <span key={s} className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">{s}</span>
                          )) : (
                            <span className="text-[10px] text-muted-foreground italic">No symbols assigned</span>
                          )}
                        </div>
                      </div>

                      {/* Code Preview Placeholder */}
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Code Preview</h4>
                        <div className="glass-panel rounded-lg p-4 mono-text text-[11px] text-muted-foreground leading-relaxed">
                          <div className="text-primary/60"># {selectedScript.name}</div>
                          <div className="text-muted-foreground/50">import numpy as np</div>
                          <div className="text-muted-foreground/50">import pandas as pd</div>
                          <div className="text-muted-foreground/50">from engine import Signal, Position</div>
                          <div className="mt-2 text-neon-purple/70">class</div>
                          <span className="text-foreground/80"> MomentumStrategy</span>
                          <span className="text-muted-foreground/50">(BaseStrategy):</span>
                          <div className="text-muted-foreground/40 ml-4">def generate_signals(self, data):</div>
                          <div className="text-muted-foreground/30 ml-8">...</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeView === "versions" && (
                    <div className="space-y-1">
                      {versionHistory.map((v, i) => (
                        <div key={v.version} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${i === 0 ? "glass-panel-elevated neon-border-cyan" : "hover:bg-muted/20"}`}>
                          <div className="mt-0.5">
                            {v.status === "deployed" ? <CheckCircle2 className="w-4 h-4 text-neon-green" /> : v.status === "testing" ? <Play className="w-4 h-4 text-neon-orange" /> : <History className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground mono-text">{v.version}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                v.status === "deployed" ? "bg-neon-green/10 text-neon-green" : v.status === "testing" ? "bg-neon-orange/10 text-neon-orange" : "bg-muted/50 text-muted-foreground"
                              }`}>{v.status}</span>
                              {i === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">latest</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{v.changes}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[9px] text-muted-foreground/60">{v.date}</span>
                              <span className="text-[9px] text-muted-foreground/60">by {v.author}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-muted/50 transition-colors" title="Rollback">
                              <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 rounded hover:bg-muted/50 transition-colors" title="Compare">
                              <GitBranch className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeView === "assign" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">Universe Assignment</h4>
                        <div className="flex bg-muted/30 p-0.5 rounded-md">
                          <button className="px-3 py-1 text-[10px] font-bold rounded bg-primary/20 text-primary">MANUAL ENTRY</button>
                          <button className="px-3 py-1 text-[10px] font-bold rounded text-muted-foreground hover:text-foreground">PRESET INDEX</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {universeSymbols.map((sym) => {
                          const isAssigned = selectedScript.assignedStrategies.includes(sym);
                          return (
                            <button
                              key={sym}
                              onClick={() => toggleStrategyAssignment(selectedScript.id, sym)}
                              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                                isAssigned ? "glass-panel-elevated border border-primary/30 bg-primary/[0.02]" : "hover:bg-muted/20 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {isAssigned ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                                <span className={`text-xs ${isAssigned ? "text-foreground font-bold tracking-tight uppercase" : "text-muted-foreground font-medium uppercase tracking-tight"}`}>{sym}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* Empty state visual when few items selected */}
                      {selectedScript.assignedStrategies.length === 0 && (
                        <div className="mt-8 text-center p-8 border border-dashed border-border/50 rounded-xl">
                          <Layers className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-[11px] text-muted-foreground">Universe is empty. Select symbols or indices above.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Select a strategy to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
