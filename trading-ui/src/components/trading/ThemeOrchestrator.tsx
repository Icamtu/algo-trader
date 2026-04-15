import { useEffect } from 'react';
import { useTerminalSettings } from '../../contexts/TerminalSettingsContext';
import { useAppModeStore } from '../../stores/appModeStore';

export function ThemeOrchestrator() {
  const { mode } = useAppModeStore();
  const { settings } = useTerminalSettings();

  useEffect(() => {
    const root = document.documentElement;
    
    // Mode Theme
    if (mode === 'OA') {
      root.classList.add('oa-theme');
    } else {
      root.classList.remove('oa-theme');
    }

    // Performance Profiles
    root.classList.remove('perf-low', 'perf-balanced', 'perf-ultra');
    root.classList.add(`perf-${settings.perfProfile}`);

    // Global CSS Variables from Settings
    root.style.setProperty('--grid-opacity', (settings.gridOpacity / 100).toString());
    root.style.setProperty('--scanline-intensity', (settings.scanlineIntensity / 100).toString());
    
  }, [mode, settings.perfProfile, settings.gridOpacity, settings.scanlineIntensity]);

  return null; // Side-effect only
}
