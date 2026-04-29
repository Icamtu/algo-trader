import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Save, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalSettings } from '@/contexts/TerminalSettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PreferencesState {
  defaultLandingPage: 'dashboard' | 'portfolio' | 'pnl-tracker' | 'intelligence';
  sidebarCollapsedDefault: boolean;
  density: 'comfortable' | 'compact';
  tableRowHeight: number;
  numberFormat: '₹' | '$' | '€';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  prefersReducedMotion: boolean;
  locale: 'en-IN' | 'en-US' | 'en-GB';
  timezone: string;
}

export default function Preferences() {
  const { toast } = useToast();
  const { settings, updateSettings } = useTerminalSettings();
  const [prefs, setPrefs] = useState<PreferencesState>({
    defaultLandingPage: 'dashboard',
    sidebarCollapsedDefault: false,
    density: 'comfortable',
    tableRowHeight: 40,
    numberFormat: '₹',
    dateFormat: 'DD/MM/YYYY',
    prefersReducedMotion: false,
    locale: 'en-IN',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    advanced: false,
  });

  // Debounced autosave
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (saveStatus === 'idle') return;

      setSaveStatus('saving');
      try {
        // Simulate API call - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setSaveStatus('saved');
        setLastSaveTime(new Date());

        // Reset to idle after 2 seconds
        const resetTimer = setTimeout(() => setSaveStatus('idle'), 2000);
        return () => clearTimeout(resetTimer);
      } catch (e) {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Could not save preferences. Please try again.',
        });
        setSaveStatus('idle');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [saveStatus]);

  const handleChange = (key: keyof PreferencesState, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setSaveStatus('saving');
  };

  const formatSaveTime = () => {
    if (!lastSaveTime) return 'Saved · just now';
    const seconds = Math.floor((Date.now() - lastSaveTime.getTime()) / 1000);
    if (seconds < 60) return `Saved · ${seconds}s ago`;
    return `Saved · ${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-6">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
            Preferences
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-2">
            Customize your AetherDesk experience
          </p>
        </div>
        <div className="text-right">
          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono font-black uppercase tracking-wider transition-all',
            saveStatus === 'saved' ? 'bg-green-500/10 text-green-400' :
            saveStatus === 'saving' ? 'bg-amber-500/10 text-amber-400' :
            'text-muted-foreground/40'
          )}>
            {saveStatus === 'saved' && <Check className="w-3 h-3" />}
            {saveStatus === 'saved' ? formatSaveTime() : 'Saving...'}
          </div>
        </div>
      </div>

      {/* Default Landing Page */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Default Landing Page
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Page displayed when you sign in
          </p>
        </div>
        <select
          value={prefs.defaultLandingPage}
          onChange={(e) => handleChange('defaultLandingPage', e.target.value)}
          className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
        >
          <option value="dashboard">Dashboard</option>
          <option value="portfolio">Portfolio</option>
          <option value="pnl-tracker">PnL Tracker</option>
          <option value="intelligence">Intelligence Hub</option>
        </select>
      </motion.div>

      {/* Sidebar Collapsed Default */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg flex items-center justify-between"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider cursor-pointer">
            Sidebar Collapsed by Default
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Start with sidebar hidden to maximize canvas space
          </p>
        </div>
        <button
          onClick={() => handleChange('sidebarCollapsedDefault', !prefs.sidebarCollapsedDefault)}
          className={cn(
            'w-12 h-6 rounded-full p-1 transition-all flex-shrink-0',
            prefs.sidebarCollapsedDefault ? 'bg-primary' : 'bg-white/10'
          )}
        >
          <motion.div
            layout
            className={cn(
              'w-4 h-4 bg-white rounded-full transition-all',
              prefs.sidebarCollapsedDefault ? 'ml-6' : 'ml-0'
            )}
          />
        </button>
      </motion.div>

      {/* Density */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Display Density
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Adjust spacing and padding throughout the interface
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['comfortable', 'compact'].map((density) => (
            <button
              key={density}
              onClick={() => handleChange('density', density)}
              className={cn(
                'p-3 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                prefs.density === density
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
              )}
            >
              {density.charAt(0).toUpperCase() + density.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table Row Height */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
              Table Row Height
            </label>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Compact to spacious, {prefs.tableRowHeight}px
            </p>
          </div>
          <span className="text-sm font-mono text-primary font-black">{prefs.tableRowHeight}px</span>
        </div>
        <input
          type="range"
          min="32"
          max="48"
          value={prefs.tableRowHeight}
          onChange={(e) => handleChange('tableRowHeight', parseInt(e.target.value))}
          className="w-full h-2 bg-white/10 border border-border/20 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[8px] text-muted-foreground/40 font-mono uppercase">
          <span>Compact (32px)</span>
          <span>Spacious (48px)</span>
        </div>
      </motion.div>

      {/* Number Format */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Number Format (Currency)
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Default currency symbol for P&L and values
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['₹', '$', '€'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleChange('numberFormat', fmt)}
              className={cn(
                'p-3 border rounded-lg text-[12px] font-black uppercase tracking-wider transition-all',
                prefs.numberFormat === fmt
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
              )}
            >
              {fmt === '₹' ? 'INR' : fmt === '$' ? 'USD' : 'EUR'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Date Format */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Date Format
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            How dates are displayed throughout the platform
          </p>
        </div>
        <div className="space-y-2">
          {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleChange('dateFormat', fmt)}
              className={cn(
                'w-full p-3 border rounded-lg text-left text-[10px] font-mono transition-all',
                prefs.dateFormat === fmt
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
              )}
            >
              <span className="font-black uppercase tracking-wider">{fmt}</span>
              <span className="text-muted-foreground/40 ml-3">
                {new Date().toLocaleDateString(
                  fmt === 'DD/MM/YYYY' ? 'en-GB' : fmt === 'MM/DD/YYYY' ? 'en-US' : 'sv-SE'
                )}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Reduce Motion Override */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg flex items-center justify-between"
      >
        <div>
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider cursor-pointer">
            Disable Animations
          </label>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Override system preference for testing or accessibility
          </p>
        </div>
        <button
          onClick={() => handleChange('prefersReducedMotion', !prefs.prefersReducedMotion)}
          className={cn(
            'w-12 h-6 rounded-full p-1 transition-all flex-shrink-0',
            prefs.prefersReducedMotion ? 'bg-primary' : 'bg-white/10'
          )}
        >
          <motion.div
            layout
            className={cn(
              'w-4 h-4 bg-white rounded-full transition-all',
              prefs.prefersReducedMotion ? 'ml-6' : 'ml-0'
            )}
          />
        </button>
      </motion.div>

      {/* Advanced Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Collapsible
          open={expandedSections.advanced}
          onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, advanced: open }))}
        >
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg hover:border-primary/40 transition-colors">
            <div>
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                Advanced Settings
              </h3>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                Locale, timezone, and experimental options
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground/60 transition-transform',
              expandedSections.advanced && 'rotate-180'
            )} />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 pl-6 border-l border-primary/20">
            {/* Locale */}
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Locale
              </label>
              <select
                value={prefs.locale}
                onChange={(e) => handleChange('locale', e.target.value)}
                className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/60 transition-all"
              >
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </div>

            {/* Timezone */}
            <div className="space-y-3 p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg">
              <label className="text-[10px] font-black text-foreground uppercase tracking-wider">
                Timezone
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={prefs.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="flex-1 bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[9px] font-mono text-foreground focus:outline-none focus:border-primary/60 transition-all max-h-48"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
              <p className="text-[8px] text-muted-foreground/40 font-mono">
                Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </div>
  );
}
