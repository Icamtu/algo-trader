import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, User, Sliders, BarChart3, Key, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalHeader } from '@/components/trading/GlobalHeader';
import { MarketNavbar } from '@/components/trading/MarketNavbar';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const TABS: SettingsTab[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" />, path: '/profile' },
  { id: 'preferences', label: 'Preferences', icon: <Sliders className="w-4 h-4" />, path: '/profile/preferences' },
  { id: 'charts', label: 'Charts', icon: <BarChart3 className="w-4 h-4" />, path: '/profile/charts' },
  { id: 'api-keys', label: 'API & Apps', icon: <Key className="w-4 h-4" />, path: '/profile/api-keys' },
  { id: 'backtest', label: 'Backtest Defaults', icon: <Zap className="w-4 h-4" />, path: '/profile/backtest' },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileTabsOpen, setIsMobileTabsOpen] = useState(false);

  const currentTab = TABS.find(tab => tab.path === location.pathname)?.id || 'profile';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      <GlobalHeader />
      <MarketNavbar />

      <div className="flex-1 overflow-hidden relative z-10">
        <div className="h-full flex flex-col lg:flex-row gap-0">
          {/* Desktop Left Rail: Vertical Tab Bar (≥1280px) */}
          <div className="hidden lg:flex flex-col w-64 border-r border-border/20 bg-slate-950/40 backdrop-blur-sm">
            <div className="p-6 border-b border-border/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[8px] font-mono font-black text-primary uppercase tracking-[0.2em]">Settings</span>
              </div>
              <h2 className="text-2xl font-black font-display uppercase tracking-tighter text-foreground">
                Configuration
              </h2>
            </div>

            <nav className="flex-1 overflow-auto custom-scrollbar p-4 space-y-2">
              {TABS.map((tab, idx) => (
                <motion.button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-mono font-black uppercase tracking-wider transition-all relative group',
                    currentTab === tab.id
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border-l-2 border-transparent'
                  )}
                >
                  <div className={cn(
                    'transition-colors',
                    currentTab === tab.id ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-foreground'
                  )}>
                    {tab.icon}
                  </div>
                  <span className="flex-1">{tab.label}</span>
                  {currentTab === tab.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="w-1.5 h-1.5 bg-primary rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </nav>
          </div>

          {/* Mobile/Tablet Top Tabs (≤1279px) */}
          <div className="lg:hidden flex flex-col flex-1">
            {/* Horizontal Scrollable Tabs */}
            <div className="border-b border-border/20 bg-slate-950/40 backdrop-blur-sm overflow-auto custom-scrollbar">
              <div className="flex gap-0 min-w-min px-4">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => navigate(tab.path)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-4 text-sm font-mono font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all',
                      currentTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground/60 hover:text-foreground'
                    )}
                  >
                    <span className="lg:hidden">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Back Button + Content */}
            <div className="flex-1 flex flex-col overflow-auto">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 lg:hidden">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <span className="text-[10px] font-mono font-black text-muted-foreground/50 uppercase tracking-[0.2em]">
                  {TABS.find(t => t.id === currentTab)?.label}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </div>
          </div>

          {/* Desktop Content Area (right side, ≥1280px) */}
          <div className="hidden lg:flex flex-1 overflow-auto flex-col">
            <div className="flex-1 overflow-auto p-8">
              <div className="max-w-3xl mx-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
