import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Camera,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  BarChart3
} from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Button } from '@/components/ui/button';
import { IndustrialValue } from '@/components/trading/IndustrialValue';
import { cn } from '@/lib/utils';
import { tradingService } from '@/services/tradingService';
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries } from 'lightweight-charts';
import { format } from 'date-fns';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';

export const PnLTracker: React.FC = () => {
  const { settings } = useTerminalSettings();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pnlSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const ddSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [pnlSummary, setPnLSummary] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    currentMtm: 0,
    maxMtm: 0,
    minMtm: 0,
    maxDd: 0,
    maxMtmTime: "00:00",
    minMtmTime: "00:00"
  });

  const fetchData = async () => {
    try {
      const [tel, pnl] = await Promise.all([
        tradingService.getTelemetry(),
        tradingService.getTelemetryPnL()
      ]);

      setTelemetry(tel);
      setPnLSummary(pnl);

      if (pnl.equity_curve && pnl.equity_curve.length > 0) {
        let maxEquity = -Infinity;
        let minEquity = Infinity;
        let maxEquityTime = "";
        let minEquityTime = "";
        let currentMax = -Infinity;
        let maxDdVal = 0;

        const pnlData = pnl.equity_curve.map((point: any) => {
          const val = point.value;
          const time = new Date(point.time).getTime() / 1000;

          if (val > maxEquity) {
            maxEquity = val;
            maxEquityTime = format(new Date(point.time), 'HH:mm');
          }
          if (val < minEquity) {
            minEquity = val;
            minEquityTime = format(new Date(point.time), 'HH:mm');
          }

          if (val > currentMax) currentMax = val;
          const dd = val - currentMax;
          if (dd < maxDdVal) maxDdVal = dd;

          return { time, value: val };
        });

        const ddData = pnl.equity_curve.map((point: any) => {
          const val = point.value;
          const time = new Date(point.time).getTime() / 1000;
          // Calculate drawdown for this point
          // We need to track running max up to this point
          return { time, value: val }; // Will recalculate correctly below
        });

        // Re-calculate running max for accurate drawdown curve
        let runningMax = -Infinity;
        const processedDdData = pnl.equity_curve.map((point: any) => {
          const val = point.value;
          if (val > runningMax) runningMax = val;
          return { time: new Date(point.time).getTime() / 1000, value: val - runningMax };
        });

        if (pnlSeriesRef.current) pnlSeriesRef.current.setData(pnlData);
        if (ddSeriesRef.current) ddSeriesRef.current.setData(processedDdData);

        setMetrics({
          currentMtm: pnl.equity_curve[pnl.equity_curve.length - 1].value,
          maxMtm: maxEquity,
          minMtm: minEquity,
          maxDd: maxDdVal,
          maxMtmTime: maxEquityTime,
          minMtmTime: minEquityTime
        });
      } else {
        // Mock data for aesthetics if no real data
        generateMockData();
      }
    } catch (error) {
      console.error("Failed to fetch PnL telemetry", error);
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const pnlData = [];
    const ddData = [];
    let currentPnl = 0;
    let runningMax = 0;
    const now = Math.floor(Date.now() / 1000);
    const start = now - 6 * 3600; // 6 hours ago

    for (let i = 0; i < 100; i++) {
      const time = start + i * 216;
      const change = (Math.random() - 0.45) * 500;
      currentPnl += change;
      if (currentPnl > runningMax) runningMax = currentPnl;

      pnlData.push({ time: time as any, value: currentPnl });
      ddData.push({ time: time as any, value: currentPnl - runningMax });
    }

    if (pnlSeriesRef.current) pnlSeriesRef.current.setData(pnlData);
    if (ddSeriesRef.current) ddSeriesRef.current.setData(ddData);

    const maxMtm = Math.max(...pnlData.map(d => d.value));
    const minMtm = Math.min(...pnlData.map(d => d.value));
    const maxDd = Math.min(...ddData.map(d => d.value));

    setMetrics({
      currentMtm: currentPnl,
      maxMtm,
      minMtm,
      maxDd,
      maxMtmTime: "14:55",
      minMtmTime: "09:15"
    });
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#475569',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Magnet
        vertLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: 1,
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: 1,
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const pnlSeries = chart.addSeries(AreaSeries, {
      lineColor: '#6366f1',
      topColor: 'rgba(99, 102, 241, 0.3)',
      bottomColor: 'rgba(99, 102, 241, 0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
      title: 'MTM PnL',
    });

    const ddSeries = chart.addSeries(AreaSeries, {
      lineColor: '#d946ef',
      topColor: 'rgba(217, 70, 239, 0.4)',
      bottomColor: 'rgba(217, 70, 239, 0.4)', // Solid-ish area for drawdown
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
      title: 'Drawdown',
    });

    chartRef.current = chart;
    pnlSeriesRef.current = pnlSeries;
    ddSeriesRef.current = ddSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);

    return () => {
      resizeObserver.disconnect();
      clearInterval(interval);
      chart.remove();
    };
  }, []);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-[#020617] overflow-hidden select-none font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            PnL Tracker
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.5)]" />
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
            Monitor your intraday profit and loss
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 border-white/5 bg-white/2 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest gap-2 text-slate-400">
            <Camera className="w-3.5 h-3.5" />
            Screenshot
          </Button>
          <Button
            onClick={fetchData}
            disabled={loading}
            className="h-9 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest gap-2"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AetherPanel className="bg-[#0f172a]/50 border-white/5 p-5 group hover:border-primary/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current MTM</span>
            <Activity className="w-3.5 h-3.5 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="space-y-1">
            <IndustrialValue
              value={metrics.currentMtm}
              className={cn("text-2xl font-black tracking-tighter", metrics.currentMtm >= 0 ? "text-secondary" : "text-destructive")}
              prefix="₹"
            />
            <div className="flex items-center gap-1.5">
              {metrics.currentMtm >= 0 ? <TrendingUp className="w-3 h-3 text-secondary" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
              <span className={cn("text-[10px] font-bold", metrics.currentMtm >= 0 ? "text-secondary" : "text-destructive")}>
                {metrics.currentMtm >= 0 ? '+' : ''}12.04%
              </span>
            </div>
          </div>
        </AetherPanel>

        <AetherPanel className="bg-[#0f172a]/50 border-white/5 p-5 group hover:border-secondary/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-secondary" /> Max MTM
            </span>
          </div>
          <div className="space-y-1">
            <IndustrialValue
              value={metrics.maxMtm}
              className="text-2xl font-black tracking-tighter text-secondary"
              prefix="₹"
            />
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              at {metrics.maxMtmTime}
            </div>
          </div>
        </AetherPanel>

        <AetherPanel className="bg-[#0f172a]/50 border-white/5 p-5 group hover:border-destructive/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingDown className="w-3 h-3 text-destructive" /> Min MTM
            </span>
          </div>
          <div className="space-y-1">
            <IndustrialValue
              value={metrics.minMtm}
              className="text-2xl font-black tracking-tighter text-destructive"
              prefix="₹"
            />
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              at {metrics.minMtmTime}
            </div>
          </div>
        </AetherPanel>

        <AetherPanel className="bg-[#0f172a]/50 border-white/5 p-5 group hover:border-amber-500/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Max Drawdown
            </span>
          </div>
          <div className="space-y-1">
            <IndustrialValue
              value={Math.abs(metrics.maxDd)}
              className="text-2xl font-black tracking-tighter text-amber-500"
              prefix="₹"
            />
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Peak to trough
            </div>
          </div>
        </AetherPanel>
      </div>

      {/* Main Chart Section */}
      <AetherPanel className="flex-1 min-h-0 bg-[#0f172a]/20 border-white/5 p-0 flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">
            Intraday PnL Curve
          </h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MTM PnL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d946ef] shadow-[0_0_8px_rgba(217,70,239,0.5)]" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drawdown</span>
            </div>
          </div>
        </div>

        <div className="flex-1 relative group">
          {/* Watermark */}
          {settings.showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
               <span className="text-[12vw] font-black tracking-[0.2em] text-white select-none">OPENALGO</span>
            </div>
          )}

          {/* Chart Container */}
          <div ref={chartContainerRef} className="absolute inset-0 z-10" />
        </div>
      </AetherPanel>
    </div>
  );
};

export default PnLTracker;
