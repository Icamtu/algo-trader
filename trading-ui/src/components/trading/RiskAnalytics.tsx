import { useState, useEffect } from "react";
import { Activity, TrendingUp, AlertTriangle, Wallet, Filter, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { tradingService } from "@/services/tradingService";

export function RiskAnalytics() {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const res = await tradingService.getCurrentHealthMetrics();
      if (res?.status === 'success') setHealth(res.data);
    } catch (err) {
      console.error("[RiskAnalytics] Health fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex-1 bg-slate-950 flex flex-col overflow-y-auto custom-scrollbar text-slate-300 font-sans pb-8"
      style={{
        backgroundImage: 'radial-gradient(circle, #1E293B 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <div className="p-6 pb-20">
        {/* Header / Global Stats */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-50 mb-1 font-mono uppercase tracking-tighter">Risk Analytics Dashboard</h1>
            <p className="text-slate-400 text-sm">Real-time exposure management for multi-asset institutional portfolios.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right border-r border-slate-800 pr-4">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest block font-mono">System Load</span>
              <span className="text-2xl font-mono text-white tracking-tight font-bold">{(health?.cpu_usage || 0).toFixed(1)}%</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest block font-mono">Engine Status</span>
              <span className="text-2xl font-mono text-emerald-400 tracking-tight font-bold flex items-center gap-2">
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} /> ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Bento Grid Dashboard */}
        <div className="grid grid-cols-12 gap-4 mb-6">
          {/* VaR Metric */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl relative overflow-hidden shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Value at Risk (99%)</span>
              <Activity className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">₹ 14.28 Cr</div>
            <div className="text-xs text-red-400 flex items-center gap-1 font-medium tracking-widest">
              <TrendingUp className="w-3 h-3" />
              8.2% vs Prev Day
            </div>
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 shadow-[0_0_8px_#34d399]" style={{ width: '66%' }}></div>
            </div>
          </div>

          {/* Stress Test */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Stress Exposure</span>
              <AlertTriangle className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">₹ 182.50 Cr</div>
            <div className="text-xs text-slate-400">Worst Case Scenario (Market -15%)</div>
            <div className="mt-4 grid grid-cols-6 gap-1">
              <div className="h-1 bg-emerald-400 rounded-full"></div>
              <div className="h-1 bg-emerald-400 rounded-full"></div>
              <div className="h-1 bg-emerald-400 rounded-full"></div>
              <div className="h-1 bg-amber-500 rounded-full"></div>
              <div className="h-1 bg-slate-800 rounded-full"></div>
              <div className="h-1 bg-slate-800 rounded-full"></div>
            </div>
          </div>

          {/* Margin Utilization */}
          <div className="col-span-12 xl:col-span-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 font-mono text-xs font-medium tracking-widest">Margin Utilization</span>
              <Wallet className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">62.4%</div>
            <div className="text-xs text-slate-400">Available: ₹ 314.9 Cr</div>
            <div className="mt-4 h-8 flex items-end gap-1">
              <div className="bg-slate-800 w-full h-2 rounded-t-sm"></div>
              <div className="bg-slate-800 w-full h-3 rounded-t-sm"></div>
              <div className="bg-emerald-400/40 w-full h-5 rounded-t-sm"></div>
              <div className="bg-emerald-400/60 w-full h-6 rounded-t-sm"></div>
              <div className="bg-emerald-400 w-full h-8 rounded-t-sm shadow-[0_0_8px_#34d399]"></div>
              <div className="bg-emerald-400/80 w-full h-5 rounded-t-sm"></div>
            </div>
          </div>

          {/* System Alerts */}
          <div className="col-span-12 xl:col-span-3 bg-gradient-to-br from-slate-900 to-slate-950 border border-red-500/20 p-4 rounded-xl shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-bold text-xs uppercase tracking-widest">Volatility Alerts</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">NIFTY VIX &gt; 18.5</span>
                <span className="text-red-400 font-mono font-bold tracking-widest">TRIGGERED</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">HDFCBANK IV Spike</span>
                <span className="text-amber-500 font-mono tracking-widest">WATCHING</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">RELIANCE Gap Up</span>
                <span className="text-emerald-400 font-mono tracking-widest">RESOLVED</span>
              </div>
            </div>
          </div>

          {/* Greeks Analysis Panel */}
          <div className="col-span-12 xl:col-span-8 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-xl min-h-[400px] shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-semibold text-lg text-white">Interactive Greeks Analysis</h2>
              <div className="flex bg-slate-950 border border-slate-800 rounded p-1">
                <button className="px-3 py-1 text-[11px] font-bold bg-blue-600 text-white rounded">NIFTY 50</button>
                <button className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">BANKNIFTY</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {/* Greek Cards */}
              <div className="border border-slate-800 p-4 rounded bg-slate-950/50">
                <div className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">Delta</div>
                <div className="text-xl font-bold text-emerald-400">0.642</div>
                <div className="text-[10px] text-slate-600 mt-1">Portfolio Sens.</div>
              </div>
              <div className="border border-slate-800 p-4 rounded bg-slate-950/50">
                <div className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">Gamma</div>
                <div className="text-xl font-bold text-white">0.024</div>
                <div className="text-[10px] text-slate-600 mt-1">Rate of Change</div>
              </div>
              <div className="border border-slate-800 p-4 rounded bg-slate-950/50">
                <div className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">Theta</div>
                <div className="text-xl font-bold text-red-400">-12.8k</div>
                <div className="text-[10px] text-slate-600 mt-1">Time Decay/Day</div>
              </div>
              <div className="border border-slate-800 p-4 rounded bg-slate-950/50">
                <div className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">Vega</div>
                <div className="text-xl font-bold text-amber-500">4.201</div>
                <div className="text-[10px] text-slate-600 mt-1">Volatility Sens.</div>
              </div>

              {/* Visualization Area */}
              <div className="col-span-4 h-64 relative flex items-end gap-2 border-b border-slate-800 pb-4 mt-4">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                  <div className="border-t border-slate-400 w-full"></div>
                  <div className="border-t border-slate-400 w-full"></div>
                  <div className="border-t border-slate-400 w-full"></div>
                  <div className="border-t border-slate-400 w-full"></div>
                </div>
                <div className="w-full h-full flex items-end justify-between px-4 overflow-hidden">
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[40%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[55%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[45%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[60%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[85%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[70%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[50%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[40%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[30%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[45%] rounded-t-sm"></div>
                  <div className="w-8 bg-blue-500/20 border-t-2 border-blue-400 h-[65%] rounded-t-sm"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Sector Heatmap */}
          <div className="col-span-12 xl:col-span-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-xl flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg text-white">Sector Exposure</h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Net Weighted</span>
            </div>
            <div className="grid grid-cols-2 grid-rows-3 gap-2 flex-1">
              <div className="bg-emerald-400/80 rounded p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer">
                <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">IT Services</span>
                <span className="text-xl font-black text-slate-900">42%</span>
              </div>
              <div className="bg-emerald-400/40 rounded p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Banking</span>
                <span className="text-xl font-black text-white">28%</span>
              </div>
              <div className="bg-slate-800 rounded p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Energy</span>
                <span className="text-lg font-bold text-slate-400">12%</span>
              </div>
              <div className="bg-red-400/60 rounded p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">FMCG</span>
                <span className="text-lg font-bold text-white">-8%</span>
              </div>
              <div className="col-span-2 bg-slate-900 border border-slate-800 rounded p-3 flex flex-col justify-between hover:scale-[1.01] transition-transform cursor-pointer">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Others</span>
                <span className="text-lg font-bold text-slate-300">10%</span>
              </div>
            </div>
          </div>

          {/* Detailed Drawdown Table */}
          <div className="col-span-12 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="font-semibold text-lg text-white">Drawdown & Position Monitor</h2>
              <div className="flex gap-2">
                <button className="h-8 w-8 flex items-center justify-center border border-slate-800 rounded hover:bg-slate-800 transition-colors text-slate-400">
                  <Filter className="w-4 h-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center border border-slate-800 rounded hover:bg-slate-800 transition-colors text-slate-400">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900 text-slate-500 border-b border-slate-800">
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">Symbol</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">Strategy</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">LTP (₹)</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">Current DD%</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">Peak DD%</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest">Exp. Ratio</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-bold">RELIANCE.NS</td>
                    <td className="px-6 py-4 text-slate-400 tracking-widest font-sans">Bull Call Spread</td>
                    <td className="px-6 py-4 text-slate-300">2,942.50</td>
                    <td className="px-6 py-4 text-red-400 font-bold">-1.24%</td>
                    <td className="px-6 py-4 text-slate-500">-2.80%</td>
                    <td className="px-6 py-4 text-slate-400">1.45x</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold tracking-widest">Active</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-bold">HDFCBANK.NS</td>
                    <td className="px-6 py-4 text-slate-400 tracking-widest font-sans">Iron Condor</td>
                    <td className="px-6 py-4 text-slate-300">1,482.10</td>
                    <td className="px-6 py-4 text-emerald-400 font-bold">+0.45%</td>
                    <td className="px-6 py-4 text-slate-500">-1.15%</td>
                    <td className="px-6 py-4 text-slate-400">0.82x</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold tracking-widest">Active</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-bold">INFY.NS</td>
                    <td className="px-6 py-4 text-slate-400 tracking-widest font-sans">Short Straddle</td>
                    <td className="px-6 py-4 text-slate-300">1,544.90</td>
                    <td className="px-6 py-4 text-red-400 font-bold">-4.82%</td>
                    <td className="px-6 py-4 text-slate-500">-5.20%</td>
                    <td className="px-6 py-4 text-slate-400">2.10x</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] uppercase font-bold tracking-widest">Review Req</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-bold">TCS.NS</td>
                    <td className="px-6 py-4 text-slate-400 tracking-widest font-sans">Covered Call</td>
                    <td className="px-6 py-4 text-slate-300">4,120.35</td>
                    <td className="px-6 py-4 text-emerald-400 font-bold">+1.12%</td>
                    <td className="px-6 py-4 text-slate-500">-0.40%</td>
                    <td className="px-6 py-4 text-slate-400">0.55x</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold tracking-widest">Active</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
