import { Database, Search, Activity, Cpu, ArrowRight, ShieldCheck, Globe, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/lib/utils'

export default function IntelligenceHubPage() {
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'
  const primaryColor = isAD ? "text-amber-500" : "text-teal-500"
  const accentBorder = isAD ? "border-amber-500/20" : "border-teal-500/20"
  const accentBg = isAD ? "bg-amber-500/5" : "bg-teal-500/5"

  const modules = [
    {
      id: 'gex',
      title: 'GEX_ALPHA_CORE',
      description: 'Institutional gamma exposure analysis and market maker positioning vectors.',
      icon: Activity,
      path: '/intelligence/gex',
      status: 'OPERATIONAL',
      metric: 'GAMMA_FLIP_DETECTED',
      color: 'text-emerald-500'
    },
    {
      id: 'historify',
      title: 'HISTORIFY_CLOUD',
      description: 'High-speed DuckDB persistence layer for deep historical strategy backfilling.',
      icon: Database,
      path: '/intelligence/historify',
      status: 'SYNCED',
      metric: '1.2M_RECORDS',
      color: primaryColor
    },
    {
      id: 'research',
      title: 'AUTORESEARCH_LAB',
      description: 'Autonomous strategy optimization using recursive neural feedback loops.',
      icon: Search,
      path: '/intelligence/research',
      status: 'IDLE',
      metric: '82_STRATS_MAPPED',
      color: 'text-blue-500'
    },
    {
      id: 'regime',
      title: 'REGIME_INTELLIGENCE',
      description: 'AI-driven market sentiment tracking and sector conviction metrics.',
      icon: Zap,
      path: '/intelligence/regime',
      status: 'OPERATIONAL',
      metric: 'BULLISH_BIAS',
      color: 'text-amber-500'
    }
  ]

  return (
    <div className="h-full flex flex-col p-8 space-y-8 bg-background overflow-hidden font-mono selection:bg-primary/30">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 border rounded-sm", accentBorder)}>
            <Cpu className={cn("h-6 w-6", primaryColor)} />
          </div>
          <h1 className={cn("text-3xl font-black tracking-[0.3em] uppercase", primaryColor)}>Intelligence_Hub</h1>
        </div>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest leading-relaxed max-w-2xl font-bold italic">
          Unified Analytics & Processing Gateway // AetherDesk_Intelligence_Module_v8.4
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {modules.map((module) => (
          <Link key={module.id} to={module.path} className="group block h-full">
            <AetherPanel className="h-full flex flex-col p-6 bg-background/20 border-border/10 hover:border-primary/40 transition-all duration-500 relative overflow-hidden group-hover:shadow-[0_0_30px_rgba(255,176,0,0.05)]">
              {/* Module Header */}
              <div className="flex items-center justify-between mb-6">
                <div className={cn("p-3 rounded-none border border-border/10 bg-background/40 group-hover:border-primary/50 transition-colors", module.color)}>
                  <module.icon className="h-6 w-6" />
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn("text-[9px] font-black uppercase tracking-widest mb-1", module.color)}>{module.status}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={cn("w-1 h-1 rounded-full", i === 1 ? module.color.replace('text', 'bg') : "bg-white/5")} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Module Info */}
              <div className="flex-1 space-y-4">
                <h3 className="text-lg font-black tracking-tighter uppercase group-hover:text-primary transition-colors">{module.title}</h3>
                <p className="text-[11px] text-muted-foreground uppercase leading-relaxed font-bold opacity-60">
                  {module.description}
                </p>
                <div className="inline-flex items-center px-2 py-1 bg-black/40 border border-white/5 text-[9px] font-black tracking-widest text-muted-foreground uppercase">
                  METRIC_SNAPSHOT:: {module.metric}
                </div>
              </div>

              {/* Action */}
              <div className="mt-8 flex items-center justify-between pt-4 border-t border-border/5">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-20 group-hover:opacity-100 transition-opacity">ACCESS_MODULE</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              </div>

              {/* Decorative scan line */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-y-full group-hover:animate-scan-line" />
            </AetherPanel>
          </Link>
        ))}
      </div>

      {/* Footer / Status Bar */}
      <div className="h-10 border-t border-white/5 flex items-center justify-between opacity-30">
        <div className="flex gap-8">
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> SYSTEM_INTEGRITY::SECURE
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase">
            <Globe className="w-3 h-3 text-blue-500" /> NODE_CLUSTER::ACTIVE
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase">
            <Zap className="w-3 h-3 text-amber-500" /> UPLINK_LATENCY::12ms
          </div>
        </div>
        <div className="text-[9px] font-black tracking-widest uppercase italic font-mono">
          AD_INTEL_G8_REL_V2
        </div>
      </div>
    </div>
  )
}
