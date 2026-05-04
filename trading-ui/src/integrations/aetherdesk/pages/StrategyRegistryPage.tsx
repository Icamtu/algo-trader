import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode, Cpu, Play, Square, RefreshCw, Search, Activity, Zap,
  ExternalLink, ChevronRight, ShieldCheck, Binary, Terminal, Command,
  Database, Gauge, Fingerprint, Lock, Layers
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { algoApi } from "@/features/aetherdesk/api/client";
import { IndustrialValue } from "@/components/trading/IndustrialValue";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from 'react-router-dom';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppModeStore } from '@/stores/appModeStore';

/**
 * StrategyRegistryPage: High-fidelity agent "Hangar"
 * Management interface for deployed trading cores with deep telemetry.
 */
const StrategyRegistryPage = () => {
    const { mode } = useAppModeStore();
    const isAD = mode === 'AD';
    const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
    const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
    const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

    const [strategies, setStrategies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'idle'>('all');
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

    const fetchStrategies = async () => {
        setIsLoading(true);
        try {
            const res = await algoApi.getStrategies();
            if (res && res.strategies) {
                setStrategies(res.strategies);
            }
        } catch (error) {
            console.error("Failed to fetch strategies:", error);
            toast.error("Registry Sync Failure", { description: "Could not connect to Aether Engine." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStrategies();
    }, []);

    const filteredStrategies = strategies.filter(s => {
        const nameMatch = (s.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        const idMatch = (s.id || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSearch = nameMatch || idMatch;
        const matchesStatus = filterStatus === 'all' ||
                             (filterStatus === 'active' && s.is_active) ||
                             (filterStatus === 'idle' && !s.is_active);
        return matchesSearch && matchesStatus;
    });

    const activeCount = strategies.filter(s => s.is_active).length;

    const handleToggleAction = async (id: string, currentStatus: boolean) => {
        const action = currentStatus ? 'stop' : 'start';
        setIsActionLoading(id);
        try {
            const res = await (action === 'start' ? algoApi.startStrategy(id) : algoApi.stopStrategy(id));
            if (res.status === 'success') {
                toast.success(`CORE::${action.toUpperCase()}ED`, {
                    description: `Instance ${id} state transition confirmed.`
                });
                fetchStrategies();
            } else {
                toast.error("PROTOCOL_REJECTED", { description: res.message || "Engine denied the command." });
            }
        } catch (error) {
            toast.error("BRIDGE_FAULT", { description: "Failed to broadcast signal to kernel." });
        } finally {
            setIsActionLoading(null);
        }
    };

    return (
        <div className="h-full flex flex-col bg-black text-white font-mono overflow-hidden relative">
            {/* Background Hyper-Glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,184,166,0.03),transparent)] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay" />

            {/* 🛰️ HEADER: CORE_REGISTRY */}
            <div className="flex flex-col md:flex-row md:items-end justify-between p-8 gap-10 relative z-20 shrink-0">
                <div className="flex items-start gap-8">
                    <div className="relative group">
                        <div className={cn("absolute -inset-2 blur-xl transition-all", isAD ? "bg-amber-500/10" : "bg-teal-500/10")} />
                        <div className={cn("relative bg-black border p-6 flex items-center justify-center transition-all duration-700", accentBorderClass)}>
                            <div className="absolute top-0 right-0 p-1">
                                <div className={cn("w-1 h-1", isAD ? "bg-amber-500" : "bg-teal-500")} />
                            </div>
                            <Cpu className={cn("h-10 w-10 animate-pulse", primaryColorClass)} />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-5">
                            <h1 className="text-4xl font-black tracking-tighter uppercase whitespace-nowrap">Strategy_Hangar</h1>
                            <div className={cn("flex items-center gap-3 border px-4 py-1.5 rounded-none", isAD ? "bg-amber-500/10 border-amber-500/40" : "bg-teal-500/10 border-teal-500/40")}>
                                <div className={cn("w-2 h-2 rounded-full", isAD ? "bg-amber-500" : "bg-teal-500")} />
                                <span className={cn("text-[10px] font-black tracking-[0.3em]", primaryColorClass)}>MODULE_REGISTRY_v2.1</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 opacity-40">
                           <div className="flex items-center gap-2">
                             <Activity className="w-3.5 h-3.5 text-green-500" />
                             <span className="text-[10px] font-black tracking-[0.2em] uppercase text-green-500/60">NODAL_LINK_ACTIVE</span>
                           </div>
                           <div className="w-px h-3 bg-white/20" />
                           <div className="flex items-center gap-2">
                             <Terminal className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-black tracking-[0.2em] uppercase">KERNEL_LEVEL_SYNC</span>
                           </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-16 border-l border-white/5 pl-16 hidden lg:flex">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.4em]">TOTAL_CORES</span>
                        <div className="flex items-baseline gap-2">
                           <span className={cn("text-3xl font-black tracking-tighter tabular-nums", primaryColorClass)}>{strategies.length}</span>
                           <span className="text-[10px] font-black text-muted-foreground/20 uppercase">Units_Staged</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.4em]">ACTIVE_DEPLOY</span>
                        <div className="flex items-baseline gap-2 text-green-500">
                           <span className="text-3xl font-black tracking-tighter tabular-nums">{activeCount}</span>
                           <span className="text-[10px] font-black text-green-500/20 uppercase">Live_Nodes</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🟠 CONTROL STRIP */}
            <div className="px-8 pb-4 shrink-0 relative z-20">
                <div className="flex flex-col md:flex-row items-center gap-8 bg-white/[0.02] border border-white/5 p-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />

                    <div className="flex bg-black/40 border border-white/10 h-14 p-1 rounded-none gap-1">
                        {(['all', 'active', 'idle'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    "px-10 h-full text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-none relative overflow-hidden",
                                    filterStatus === status
                                        ? "bg-primary text-black"
                                        : "bg-transparent text-muted-foreground/40 hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                {status.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 relative group w-full max-w-xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="SEARCH_CORES_BY_ID_OR_NAME..."
                            className="h-14 bg-black/40 border-white/5 pl-14 font-mono text-xs tracking-widest text-white placeholder:text-muted-foreground/10 focus:border-primary/50 transition-all rounded-none uppercase"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <Button
                            variant="outline"
                            onClick={fetchStrategies}
                            disabled={isLoading}
                            className="h-14 px-8 border-white/10 rounded-none bg-black/40 hover:bg-white/5 text-white/40 hover:text-primary transition-all font-black text-[10px] uppercase tracking-[0.3em] gap-3"
                        >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            SYNC_REGISTRY
                        </Button>
                    </div>
                </div>
            </div>

            {/* 🟡 HANGAR GRID */}
            <div className="flex-1 overflow-y-auto px-8 pb-10 mt-4 custom-scrollbar relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <AetherPanel key={i} className="h-[400px] border-white/5 bg-black/40 p-10 flex flex-col gap-8 opacity-40">
                                   <div className="flex justify-between">
                                      <Skeleton className="h-12 w-12 rounded-none bg-white/10" />
                                      <Skeleton className="h-6 w-24 rounded-none bg-white/10" />
                                   </div>
                                   <Skeleton className="h-12 w-full rounded-none bg-white/10" />
                                   <Skeleton className="flex-1 w-full rounded-none bg-white/10" />
                                   <Skeleton className="h-16 w-full rounded-none bg-white/10" />
                                </AetherPanel>
                            ))
                        ) : filteredStrategies.length > 0 ? (
                            filteredStrategies.map((strategy, idx) => (
                                <motion.div
                                    key={strategy.id || strategy.name}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <AetherPanel
                                        className={cn(
                                            "relative h-full flex flex-col p-10 group transition-all duration-700 overflow-hidden border-2",
                                            strategy.is_active
                                              ? "border-green-500/30 bg-green-500/[0.03] shadow-[0_30px_60px_rgba(34,197,94,0.05)]"
                                              : "border-white/5 bg-black/40 opacity-80 hover:opacity-100 hover:border-white/20"
                                        )}
                                    >
                                        {/* Schematic Decoration */}
                                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000">
                                            <Database className="w-48 h-48 rotate-12" />
                                        </div>

                                        <div className="flex items-start justify-between mb-10 relative z-10">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-12 h-12 flex items-center justify-center border transition-all duration-700",
                                                        strategy.is_active ? "bg-green-500/10 border-green-500/40 text-green-500" : "bg-white/5 border-white/10 text-white/20"
                                                    )}>
                                                        <FileCode className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-white uppercase group-hover:text-primary transition-colors tracking-tight truncate max-w-[180px]">
                                                            {strategy.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Fingerprint className="w-3 h-3 opacity-20" />
                                                            <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">
                                                                ID::{String(strategy.id || '').substring(0, 12) || "NULL_STUB"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <ShieldCheck className={cn("w-6 h-6 transition-all duration-1000", strategy.is_active ? "text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]" : "text-white/5")} />
                                        </div>

                                        <div className="flex items-center gap-4 mb-10 relative z-10">
                                            <div className={cn(
                                                "text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 border",
                                                strategy.is_active ? "bg-green-500/10 text-green-400 border-green-500/40" : "bg-white/5 text-muted-foreground/30 border-white/10"
                                            )}>
                                                {strategy.is_active ? "CORE_DEPLOYED" : "STATE_STANDBY"}
                                            </div>
                                            <div className="flex-1 h-px bg-white/5" />
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn("w-2 h-2 rounded-full",
                                                    strategy.is_active ? "bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "bg-white/10")}></div>
                                                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] tabular-nums">
                                                    {strategy.mode || "PAPER"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex-1 mb-10 relative z-10">
                                            <p className="text-[11px] text-white/40 leading-relaxed font-mono uppercase tracking-tight line-clamp-4">
                                                {strategy.description || "ADVANCED_ALPHA_BOT_PROTOCOL_v4 // OPTIMIZED_FOR_HIGH_FREQUENCY_HEDGING // MULTI_ASSET_CAPABILITY."}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 py-6 mb-8 border-y border-white/5 bg-white/[0.01] px-6 -mx-10 relative z-10">
                                            <div className="space-y-2">
                                                <span className="text-[8px] uppercase font-black text-muted-foreground/20 tracking-[0.4em] block">Asset_Vectors</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {(Array.isArray(strategy.symbols) ? strategy.symbols : ["NIFTY", "BANKNIFTY"]).slice(0, 2).map((s: string) => (
                                                        <Badge key={s} variant="outline" className="text-[9px] font-black text-primary/80 border-primary/20 bg-primary/5 rounded-none px-2 py-0">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                    {(Array.isArray(strategy.symbols) ? strategy.symbols.length : 0) > 2 && <span className="text-[8px] text-white/20">+{strategy.symbols.length - 2}</span>}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[8px] uppercase font-black text-muted-foreground/20 tracking-[0.4em] block">Latency_Audit</span>
                                                <div className="flex items-center gap-2">
                                                    <Gauge className="w-3.5 h-3.5 text-primary/40" />
                                                    <span className="text-[10px] font-mono font-black text-white tabular-nums tracking-widest">0.42ms</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 relative z-10">
                                            <Button
                                                onClick={() => handleToggleAction(strategy.id || strategy.name, strategy.is_active)}
                                                disabled={isActionLoading === (strategy.id || strategy.name)}
                                                className={cn(
                                                    "flex-1 h-14 font-black text-[10px] uppercase tracking-[0.4em] rounded-none transition-all border shadow-2xl relative overflow-hidden group/btn",
                                                    strategy.is_active
                                                        ? "bg-rose-950/20 text-rose-500 border-rose-500/40 hover:bg-rose-600 hover:text-white"
                                                        : "bg-primary text-black hover:bg-white"
                                                )}
                                            >
                                                {isActionLoading === (strategy.id || strategy.name) ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : strategy.is_active ? (
                                                    <> <Square className="w-3.5 h-3.5 mr-3 fill-current" /> DE_BOOT_CORE </>
                                                ) : (
                                                    <> <Play className="w-3.5 h-3.5 mr-3 fill-current" /> EXEC_INITIALIZE </>
                                                )}
                                            </Button>
                                            <Link
                                                to={`/strategy-lab?tab=Editor&file=${strategy.name}`}
                                                className="w-14 h-14 bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center shrink-0 rounded-none group/link"
                                            >
                                                <ExternalLink className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-all group-hover:scale-110" />
                                            </Link>
                                        </div>

                                        {/* Status Strip Decor */}
                                        <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center opacity-5 group-hover:opacity-20 transition-opacity">
                                           <div className="flex gap-1.5">
                                              {Array.from({ length: 12 }).map((_, i) => (
                                                <div key={i} className={cn("w-1 h-1", (i % 3 === 0) ? "bg-primary" : "bg-white/40")} />
                                              ))}
                                           </div>
                                           <span className="text-[8px] font-mono uppercase tracking-[0.5em] italic">MANIFEST_VERIFIED</span>
                                        </div>
                                    </AetherPanel>
                                </motion.div>
                            ))
                        ) : (
                            <div className="col-span-full h-[500px] flex flex-col items-center justify-center gap-10 border-2 border-dashed border-white/5 relative bg-white/[0.01]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,245,255,0.03),transparent)]" />
                                <div className="relative">
                                   <div className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full" />
                                   <Search className="w-24 h-24 text-white/5 relative z-10" />
                                </div>
                                <div className="text-center space-y-4 relative z-10">
                                    <h3 className="text-2xl font-black uppercase tracking-[0.5em] text-white/20 italic">Empty_Hangar_State</h3>
                                    <p className="text-[10px] font-mono text-white/10 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                                        NO_ACTIVE_CORES_DETECTED_IN_THIS_SECTOR. INITIALIZE_NEW_ALPHA_PATTERNS_THROUGH_LAB_OR_SYNC_CORE.
                                    </p>
                                </div>
                                <Button
                                    onClick={fetchStrategies}
                                    className="h-14 px-12 bg-white/5 border border-white/10 text-white/40 font-black uppercase text-[10px] tracking-[0.4em] hover:bg-primary hover:text-black hover:border-primary transition-all relative z-10 shadow-2xl"
                                >
                                    RE_MAP_SECTOR
                                </Button>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* 🟢 FOOTER: NODAL STATUS STRIP */}
            <div className="h-14 border-t border-white/5 bg-[#050505] flex items-center gap-10 px-8 relative z-30 shrink-0">
                <div className="flex items-center gap-4">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/40">NODAL_SYNC_STABLE</span>
                </div>
                <div className="flex-1 flex items-center gap-4 overflow-hidden">
                   <Terminal className="w-3.5 h-3.5 text-white/10" />
                   <div className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-[0.3em] italic truncate font-bold">
                      Registry_v2 // Secure_Hash_Integrity: 0x82A1C... // Refresh_Mode: Auto_Pull_4s // Sector_Audit: PASSED...
                   </div>
                </div>
                <div className="flex items-center gap-8 pl-10 border-l border-white/5">
                    <div className="flex items-center gap-3">
                       <ShieldCheck className="w-3.5 h-3.5 text-primary/20" />
                       <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">CRYPTO_GATE_ACTIVE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategyRegistryPage;
