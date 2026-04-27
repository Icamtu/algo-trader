import { Activity, BarChart3, Database, Layers, Shield, Zap, TrendingUp, Target, BarChart, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AetherPanel } from '@/components/ui/AetherPanel'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/appModeStore'

const INTELLIGENCE_TOOLS = [
  {
    title: 'Alpha_Gamma_GEX',
    description: 'Real-time Institutional Gamma Exposure & Market Liquidity Profile.',
    path: '/intelligence/gex',
    icon: Activity,
    status: 'LIVE',
    color: 'text-rose-500',
    tags: ['Gamma', 'Exposure', 'Liquidity']
  },
  {
    title: 'Historify_Vault',
    description: 'Cloud-native historical data logging and DuckDB analysis engine.',
    path: '/intelligence/historify',
    icon: Database,
    status: 'OPTIMIZED',
    color: 'text-amber-500',
    tags: ['Storage', 'DuckDB', 'History']
  },
  {
    title: 'OI_Profile_Kernel',
    description: 'Intra-interval Open Interest evolution and price-level analysis.',
    path: '/intelligence/oi-profile',
    icon: Layers,
    status: 'STABLE',
    color: 'text-emerald-500',
    tags: ['OI', 'Intervals', 'Price']
  },
  {
    title: 'Max_Pain_Theory',
    description: 'Option Pain analysis and institutional settlement forecasting.',
    path: '/intelligence/max-pain',
    icon: Target,
    status: 'LIVE',
    color: 'text-sky-500',
    tags: ['Settlement', 'Options', 'Theory']
  },
  {
    title: 'Vol_Surface_Alpha',
    description: 'Implied Volatility Surface and Smile Kernel visualization.',
    path: '/intelligence/vol-surface',
    icon: TrendingUp,
    status: 'STABLE',
    color: 'text-purple-500',
    tags: ['Volatility', 'Surface', 'IV']
  }
]

export default function IntelligenceHubPage() {
  const { mode } = useAppModeStore()
  const isAD = mode === 'AD'

  return (
    <div className="h-full flex flex-col p-8 space-y-8 font-mono overflow-y-auto custom-scrollbar">
      {/* Header section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 border border-primary/20 rounded-sm">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-[0.4em] uppercase text-foreground">
              Intelligence_Center
            </h1>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest opacity-60 flex items-center gap-2">
              <Shield className="w-3 h-3 text-green-500" />
              Institutional_Analytics_Cluster // V3.5
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {INTELLIGENCE_TOOLS.map((tool) => (
          <Link key={tool.path} to={tool.path}>
            <AetherPanel className="p-0 border-white/5 bg-slate-950/40 hover:bg-slate-900/60 transition-all cursor-pointer group h-full">
              <div className="p-6 flex flex-col h-full space-y-4">
                <div className="flex justify-between items-start">
                  <div className={cn("p-3 rounded-sm bg-white/5 border border-white/10 group-hover:border-primary/20", tool.color)}>
                    <tool.icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-[8px] border-white/10 opacity-60 font-black tracking-widest uppercase">
                    {tool.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-black tracking-wider group-hover:text-primary transition-colors uppercase">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-4 mt-auto flex flex-wrap gap-2">
                  {tool.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-2 py-0.5 bg-black/40 border border-white/5 text-muted-foreground/60 uppercase font-bold tracking-tighter">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-1 w-0 group-hover:w-full bg-primary transition-all duration-300" />
            </AetherPanel>
          </Link>
        ))}
      </div>

      <div className="mt-auto pt-12 flex justify-between items-center border-t border-white/5">
         <div className="flex gap-12">
            <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-widest">SYSTEM_STATUS</span>
                <span className="text-xs font-black text-green-500 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    ALL_SYSTEMS_NOMINAL
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-widest">SYNC_NODE</span>
                <span className="text-xs font-black text-primary uppercase">Alpha_Claw_Relay</span>
            </div>
         </div>
         <div className={cn("text-[10px] font-black uppercase tracking-[0.2em] italic", isAD ? "text-amber-500/40" : "text-teal-500/40")}>
            AetherDesk_Institutional_Suite // {new Date().getFullYear()}
         </div>
      </div>
    </div>
  )
}
