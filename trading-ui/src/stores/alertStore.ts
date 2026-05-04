import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ToastPosition = 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'

export interface AlertCategories {
  orders: boolean
  analyzer: boolean
  system: boolean
  actionCenter: boolean
  historify: boolean
  strategy: boolean
  positions: boolean
  chartink: boolean
  pythonStrategy: boolean
  telegram: boolean
  flow: boolean
  admin: boolean
  monitoring: boolean
  clipboard: boolean
}

interface AlertState {
  toastsEnabled: boolean
  soundEnabled: boolean
  position: ToastPosition
  maxVisibleToasts: number
  duration: number
  categories: AlertCategories

  setToastsEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setPosition: (position: ToastPosition) => void
  setCategoryEnabled: (category: keyof AlertCategories, enabled: boolean) => void
  shouldShowToast: (category?: keyof AlertCategories) => boolean
  shouldPlaySound: () => boolean
}

const DEFAULT_CATEGORIES: AlertCategories = {
  orders: true,
  analyzer: true,
  system: true,
  actionCenter: true,
  historify: true,
  strategy: true,
  positions: true,
  chartink: true,
  pythonStrategy: true,
  telegram: true,
  flow: true,
  admin: true,
  monitoring: true,
  clipboard: true,
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      toastsEnabled: true,
      soundEnabled: true,
      position: 'top-right',
      maxVisibleToasts: 3,
      duration: 3000,
      categories: DEFAULT_CATEGORIES,

      setToastsEnabled: (enabled) => set({ toastsEnabled: enabled }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setPosition: (position) => set({ position }),
      setCategoryEnabled: (category, enabled) =>
        set((state) => ({
          categories: { ...state.categories, [category]: enabled },
        })),

      shouldShowToast: (category) => {
        const state = get()
        if (!state.toastsEnabled) return false
        if (category && !state.categories[category]) return false
        return true
      },

      shouldPlaySound: () => {
        const state = get()
        return state.toastsEnabled && state.soundEnabled
      },
    }),
    {
      name: 'aetherdesk-alerts',
    }
  )
)
