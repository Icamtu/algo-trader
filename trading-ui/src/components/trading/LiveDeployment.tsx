import { useState, useEffect } from "react";
import { Layers, ShieldAlert, Zap, BarChart2, AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tradingService } from "@/services/tradingService";

export function LiveDeployment() {
  const [orders, setOrders] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uptime, setUptime] = useState("0H 0M");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const apiKey = await tradingService.getApiKey();
      if (apiKey) {
        const [o, t, p] = await Promise.all([
          tradingService.getOrders(apiKey),
          tradingService.getTrades(apiKey),
          tradingService.getPositions(apiKey)
        ]);
        if (o?.status === 'success') setOrders(o.data || []);
        if (t?.status === 'success') setTrades(t.data || []);
        if (p?.status === 'success') setPositions(p.data || []);
      }
    } catch (err) {
      console.error("[LiveDeployment] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalPnL = positions.reduce((acc, pos) => acc + (pos.pnl || 0), 0);

  return (
    <div
      className="flex-1 bg-slate-950 flex flex-col overflow-hidden text-slate-300 font-sans"
      style={{
        backgroundImage: 'radial-gradient(circle, #1E293B 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      {/* Global Metrics Bar */}
      <div className="bg-[#0c0e16]/80 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">NIFTY_50</span>
              <span className="text-[13px] font-mono font-bold text-slate-200">₹22,419.55 <span className="text-emerald-400 text-[10px]">+0.42%</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">BANK_NIFTY</span>
              <span className="text-[13px] font-mono font-bold text-slate-200">₹48,125.20 <span className="text-red-400 text-[10px]">-0.12%</span></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8 border-l border-slate-800 pl-8">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">ACTIVE_POSITIONS</span>
            <span className="text-[13px] font-mono font-bold text-blue-400">{positions.length} Nodes</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">TOTAL_PNL</span>
            <span className={cn("text-[13px] font-mono font-bold", totalPnL >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">ENGINE_SYNC</span>
            <span className="text-[13px] font-mono font-bold text-emerald-400 flex items-center gap-2">
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> LIVE
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-widest">NET_RTT</span>
            <span className="text-[13px] font-mono font-bold text-emerald-400">24ms</span>
          </div>
        </div>
      </div>

      {/* Bento Dashboard Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 pb-12">
        <div className="grid grid-cols-12 gap-4">

          {/* Active Strategies Module */}
          <section className="col-span-12 xl:col-span-8 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-fit shadow-xl">
            <div className="px-4 py-3 bg-slate-950/50 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-white">ACTIVE_STRATEGIES</h2>
              </div>
              <span className="text-[10px] font-mono font-medium text-slate-500 tracking-widest">THREADS_ACTIVE: 04</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-800/30 text-slate-500 font-mono border-b border-slate-800">
                    <th className="px-4 py-2 font-medium tracking-widest">STRATEGY_ID</th>
                    <th className="px-4 py-2 font-medium tracking-widest">STATUS</th>
                    <th className="px-4 py-2 font-medium text-right tracking-widest">REALIZED_PNL</th>
                    <th className="px-4 py-2 font-medium text-right tracking-widest">UNREALIZED</th>
                    <th className="px-4 py-2 font-medium text-right tracking-widest">UPTIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="hover:bg-blue-500/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 text-xs">Aether_Scalper_V4</span>
                        <span className="text-[9px] text-slate-500 font-mono tracking-widest">TAG: HFT_MOMENTUM</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold tracking-widest">ACTIVE</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-xs">+₹142,500.00</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-xs">+₹12,400.00</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">00:58:12</td>
                  </tr>
                  <tr className="hover:bg-blue-500/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 text-xs">Intraday_Trend_Alpha</span>
                        <span className="text-[9px] text-slate-500 font-mono tracking-widest">TAG: OPTION_SELLING</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold tracking-widest">ACTIVE</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-xs">+₹239,500.00</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-400 text-xs">-₹4,200.00</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">01:04:45</td>
                  </tr>
                  <tr className="hover:bg-blue-500/5 transition-colors group opacity-60">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 text-xs">Arb_Liquidity_Shield</span>
                        <span className="text-[9px] text-slate-500 font-mono tracking-widest">TAG: CASH_FUTURE</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[9px] font-bold tracking-widest">PAUSED</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-500 text-xs">₹0.00</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-500 text-xs">₹0.00</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">--:--:--</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Risk Oversight Panel */}
          <section className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col shadow-xl">
            <div className="px-4 py-3 bg-slate-950/50 flex items-center gap-2 border-b border-slate-800">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-white">RISK_OVERSIGHT</h2>
            </div>
            <div className="p-5 space-y-6">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Max Drawdown</span>
                  <span className="text-sm font-bold text-slate-200">0.82% / <span className="text-slate-500">2.5%</span></span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '32%' }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded">
                  <span className="text-[9px] text-slate-500 font-mono tracking-widest block mb-1">EXPOSURE_RATIO</span>
                  <span className="text-lg font-bold text-slate-200">1.4x</span>
                </div>
                <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded">
                  <span className="text-[9px] text-slate-500 font-mono tracking-widest block mb-1">MARGIN_USAGE</span>
                  <span className="text-lg font-bold text-slate-200">64%</span>
                </div>
              </div>
              <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">Risk Alerts</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">HDFCBANK volatility exceeding Tier-2 limits. Auto-scaling reduced to 0.7x.</p>
              </div>
            </div>
          </section>

          {/* Execution Feed */}
          <section className="col-span-12 xl:col-span-8 bg-slate-900 border border-slate-800 rounded-lg flex flex-col shadow-xl">
            <div className="px-4 py-3 bg-slate-950/50 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-white">EXECUTION_FEED</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-medium">Live Streaming</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse min-w-[600px]">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-500 font-mono">
                  <tr>
                    <th className="px-4 py-2 font-medium tracking-widest">TIMESTAMP</th>
                    <th className="px-4 py-2 font-medium tracking-widest">SYMBOL</th>
                    <th className="px-4 py-2 font-medium tracking-widest">SIDE</th>
                    <th className="px-4 py-2 text-right font-medium tracking-widest">QTY</th>
                    <th className="px-4 py-2 text-right font-medium tracking-widest">PRICE</th>
                    <th className="px-4 py-2 text-center font-medium tracking-widest">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {trades.slice(0, 10).map((trade, idx) => (
                    <tr key={idx} className={cn("hover:bg-slate-800/30 transition-colors", trade.side?.toUpperCase() === 'BUY' ? "bg-emerald-500/5" : "bg-red-500/5")}>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{trade.fill_time || trade.timestamp || "N/A"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-200 uppercase">{trade.symbol}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("font-bold", trade.side?.toUpperCase() === 'BUY' ? "text-emerald-400" : "text-red-400")}>
                          {trade.side?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{trade.quantity?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono">₹{trade.average_price?.toLocaleString() || trade.price?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-widest">FILLED</span>
                      </td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic uppercase tracking-widest font-mono">No live execution data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* System Telemetry */}
          <section className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col shadow-xl">
            <div className="px-4 py-3 bg-slate-950/50 flex items-center gap-2 border-b border-slate-800">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-white">SYSTEM_TELEMETRY</h2>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-5">
              <div>
                <div className="flex justify-between text-[10px] font-mono tracking-widest text-slate-500 mb-2">
                  <span>CPU_USAGE</span>
                  <span className="text-slate-200">24%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: '24%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono tracking-widest text-slate-500 mb-2">
                  <span>MEM_ALLOC</span>
                  <span className="text-slate-200">4.2GB / 16GB</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '28%' }}></div>
                </div>
              </div>

              {/* Mini Chart Visualization Mockup */}
              <div className="mt-4 flex-1 bg-slate-950 rounded border border-slate-800 p-4 relative overflow-hidden min-h-[100px] flex flex-col">
                <span className="absolute top-2 left-3 text-[8px] font-mono text-slate-600 uppercase tracking-widest">WS_LATENCY_MS</span>
                <div className="h-full w-full flex items-end justify-between gap-[2px] mt-4">
                  {[40, 35, 45, 30, 55, 60, 40, 70, 30].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-500/20 rounded-t-sm" style={{ height: `${h}%` }}></div>
                  ))}
                  <div className="flex-1 bg-emerald-400/80 rounded-t-sm shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ height: '25%' }}></div>
                  <div className="flex-1 bg-emerald-400/80 rounded-t-sm shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ height: '28%' }}></div>
                  <div className="flex-1 bg-emerald-400/80 rounded-t-sm shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ height: '22%' }}></div>
                  <div className="flex-1 bg-emerald-400/80 rounded-t-sm shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ height: '25%' }}></div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono tracking-widest pt-2">
                <span className="text-slate-500">API_ENDPOINT:</span>
                <span className="text-blue-400 truncate ml-2">aws-mumbai-prod-cluster-01</span>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Background Decorative Element */}
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
    </div>
  );
}
