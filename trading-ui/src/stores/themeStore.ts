import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppMode = 'live' | 'analyzer'

interface ThemeState {
  appMode: AppMode
  isTogglingMode: boolean

  setAppMode: (mode: AppMode) => void
  toggleAppMode: () => Promise<{ success: boolean; message?: string }>
  syncAppMode: () => Promise<void>
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appMode: 'live',
      isTogglingMode: false,

      setAppMode: (appMode) => {
        set({ appMode })
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('analyzer')
          if (appMode === 'analyzer') {
            document.documentElement.classList.add('analyzer')
          }
        }
      },

      toggleAppMode: async () => {
        if (get().isTogglingMode) return { success: false, message: 'Already toggling' }
        set({ isTogglingMode: true })
        try {
          // This will be bridged via the tradingService in Phase 2
          // For now, mirroring the logic
          const response = await fetch('/auth/analyzer-toggle', { method: 'POST' })
          const data = await response.json()
          if (response.ok && data.status === 'success') {
            const newMode: AppMode = data.data.analyze_mode ? 'analyzer' : 'live'
            get().setAppMode(newMode)
            return { success: true, message: data.data.message }
          }
          return { success: false, message: data.message || 'Failed' }
        } catch (error) {
          return { success: false, message: 'Network error' }
        } finally {
          set({ isTogglingMode: false })
        }
      },

      syncAppMode: async () => {
        try {
          const response = await fetch('/auth/analyzer-mode')
          if (response.ok) {
            const data = await response.json()
            if (data.status === 'success') {
              const backendMode: AppMode = data.data.analyze_mode ? 'analyzer' : 'live'
              if (get().appMode !== backendMode) get().setAppMode(backendMode)
            }
          }
        } catch (error) {}
      },
    }),
    {
      name: 'aetherdesk-theme',
    }
  )
)
