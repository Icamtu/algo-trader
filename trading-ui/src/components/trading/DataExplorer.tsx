import { useState, useEffect, useCallback } from "react";
import { Database, Search, HardDrive, RefreshCw, Activity, Layers, DownloadCloud, AlertTriangle, Eye, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tradingService } from "@/services/tradingService";
import { useToast } from "@/hooks/use-toast";

interface HistorifyStats {
  total_candles: number;
  unique_symbols: number;
  db_size_mb: number;
  disk_pressure_percent: number;
  uptime_seconds: number;
  last_ingested_at: string | null;
  storage_path: string;
}

interface CatalogItem {
  symbol: string;
  exchange: string;
  interval: string;
  record_count: number;
  first_date?: string;
  last_date?: string;
}

export function DataExplorer() {
  const { toast } = useToast();
  const [stats, setStats] = useState<HistorifyStats | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [st, cat] = await Promise.all([
        tradingService.getHistorifyStats(),
        tradingService.getHistorifyCatalog("5m")
      ]);

      if (st?.status === "success") setStats(st.data);
      if (cat?.status === "success") setCatalog(cat.data || []);
    } catch (err) {
      console.error("[DataExplorer] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredCatalog = catalog.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const handleCompact = async () => {
    setIsLoading(true);
    try {
      const res = await tradingService.compactHistorify();
      if (res.status === "success") {
        toast({ title: "Compaction Successful", description: `Database optimized. New size: ${res.db_size_mb} MB` });
        loadData();
      } else {
        toast({ title: "Compaction Failed", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to trigger compaction", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurge = async () => {
    setIsLoading(true);
    try {
      const res = await tradingService.purgeHistorify(30);
      if (res.status === "success") {
        toast({ title: "Purge Complete", description: "Old data cleared successfully." });
        loadData();
      } else {
        toast({ title: "Purge Failed", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to trigger purge", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex-1 bg-slate-950 flex flex-col overflow-y-auto custom-scrollbar text-slate-300 font-sans pb-8"
      style={{
        backgroundImage: 'radial-gradient(circle, #1E293B 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-50 mb-1 font-mono tracking-tighter uppercase">Historify // Data Explorer</h1>
            <p className="text-slate-400 text-sm">DuckDB sequence management and historical data orchestration.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right border-r border-slate-800 pr-4">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest block font-mono">DB Size</span>
              <span className="text-2xl font-mono text-white tracking-tight font-bold">{(stats?.db_size_mb || 0).toFixed(2)} MB</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest block font-mono">Total Candles</span>
              <span className="text-2xl font-mono text-emerald-400 tracking-tight font-bold">{stats?.total_candles?.toLocaleString() || "0"}</span>
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-4 mb-6">
          {/* Storage Health */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl relative overflow-hidden shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Storage Path</span>
              <HardDrive className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xs font-mono text-slate-200 mb-1 truncate">{stats?.storage_path || "/app/storage/historify.duckdb"}</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium tracking-widest mt-2 uppercase">
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              Engine Sync: Active
            </div>
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" style={{ width: '45%' }}></div>
            </div>
          </div>

          {/* Ingestion Speed */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Ingestion Activity</span>
              <Activity className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">98.2<span className="text-xs text-slate-500 ml-1">K/sec</span></div>
            <div className="text-xs text-slate-400 font-mono">Parallel Threads: 08</div>
            <div className="mt-4 flex gap-1 items-end h-4">
              {[40, 60, 45, 80, 50, 70, 90, 60].map((h, i) => (
                <div key={i} className="flex-1 bg-emerald-500/40 rounded-t-sm" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>

          {/* Catalog Diversity */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Catalog Diversity</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">{stats?.unique_symbols || 0}</div>
            <div className="text-xs text-slate-400">Unique Symbols Tracked</div>
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: '40%' }}></div>
              <div className="h-full bg-blue-500" style={{ width: '30%' }}></div>
              <div className="h-full bg-amber-500" style={{ width: '20%' }}></div>
            </div>
          </div>

          {/* System Status */}
          <div className="col-span-12 xl:col-span-3 bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/20 p-4 rounded-xl shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Storage Telemetry</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">DUCKDB_COMPACT</span>
                <span className="text-emerald-400 font-bold tracking-widest">
                  {stats && stats.db_size_mb > 50 ? 'NEEDS_VACUUM' : 'OPTIMAL'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">HOST_DISK</span>
                <span className={cn(
                  "font-bold tracking-widest",
                  (stats?.disk_pressure_percent || 0) > 80 ? "text-red-400" : "text-emerald-400"
                )}>
                  {stats?.disk_pressure_percent || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">WAL_BUFFER</span>
                <span className="text-emerald-400">CLEAN</span>
              </div>
            </div>
          </div>

          {/* Catalog Table Module */}
          <div className="col-span-12 xl:col-span-8 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-xl min-h-[400px] shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-semibold text-lg text-white font-mono uppercase tracking-tighter">Database Catalog</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter symbols..."
                  className="bg-slate-950 border border-slate-800 rounded px-8 py-1.5 text-xs w-full text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 bg-slate-950/20">
                    <th className="px-4 py-3 font-bold uppercase tracking-widest">Symbol</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-widest">Interval</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-widest text-right">Candles</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-widest text-right">Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredCatalog.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 font-bold text-white uppercase">{item.symbol}</td>
                      <td className="px-4 py-3 text-slate-500 uppercase">{item.interval}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">{item.record_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400 text-[10px]">
                        {item.first_date?.split(' ')[0]} - {item.last_date?.split(' ')[0]}
                      </td>
                    </tr>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-500 italic uppercase tracking-widest">No matching records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between uppercase">
              <span>Showing {filteredCatalog.length} of {catalog.length} nodes</span>
              <button className="text-blue-400 hover:underline">View All Records</button>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="col-span-12 xl:col-span-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-xl flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg text-white font-mono uppercase tracking-tighter">Actions</h2>
              <DownloadCloud className="w-4 h-4 text-blue-400" />
            </div>

            <div className="space-y-4 flex-1">
              <button className="w-full bg-blue-600/10 border border-blue-500/20 text-blue-400 py-4 px-4 rounded-lg flex items-center gap-4 hover:bg-blue-600/20 transition-all group">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-[13px] uppercase tracking-widest">New Ingestion</div>
                  <div className="text-[10px] text-slate-500">Hydrate symbols from source</div>
                </div>
              </button>

              <button
                onClick={handleCompact}
                disabled={isLoading}
                className="w-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 py-4 px-4 rounded-lg flex items-center gap-4 hover:bg-emerald-600/20 transition-all group text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-[13px] uppercase tracking-widest">Compact DuckDB</div>
                  <div className="text-[10px] text-slate-500">Vacuum and merge WAL buffer</div>
                </div>
              </button>

              <button
                onClick={handlePurge}
                disabled={isLoading}
                className="w-full bg-red-600/10 border border-red-500/20 text-red-400 py-4 px-4 rounded-lg flex items-center gap-4 hover:bg-red-600/20 transition-all group text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-[13px] uppercase tracking-widest">Purge 30D+</div>
                  <div className="text-[10px] text-slate-500">Enforce data retention policy</div>
                </div>
              </button>

              {(stats?.disk_pressure_percent || 0) > 80 && (
                <div className="p-4 border border-red-500/10 bg-red-500/5 rounded-lg mt-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">Critical Disk Pressure</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Host usage is {stats?.disk_pressure_percent}%. Immediate maintenance required to prevent ingestion locks.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
