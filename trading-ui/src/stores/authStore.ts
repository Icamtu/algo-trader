import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useBrokerStore } from './brokerStore'

interface User {
  username: string
  broker: string | null
  isLoggedIn: boolean
  loginTime: string | null
}

interface AuthState {
  user: User | null
  apiKey: string | null
  isAuthenticated: boolean

  setUser: (user: User) => void
  setApiKey: (apiKey: string | null) => void
  login: (username: string, broker: string) => void
  logout: () => void
  checkSession: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      apiKey: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: user.isLoggedIn }),
      setApiKey: (apiKey) => set({ apiKey }),

      login: (username, broker) => {
        const user: User = {
          username,
          broker,
          isLoggedIn: true,
          loginTime: new Date().toISOString(),
        }
        set({ user, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, apiKey: null })
      },

      checkSession: () => {
        const { user } = get()
        if (!user || !user.loginTime) return false

        const capabilities = useBrokerStore.getState().capabilities
        if (capabilities?.broker_type === 'crypto') {
          return true
        }

        const now = new Date()
        const loginTime = new Date(user.loginTime)

        // Session expiry check (3 AM IST daily)
        // Convert to IST offset (UTC+5:30)
        const istOffsetMs = 5.5 * 60 * 60 * 1000
        const nowIST = new Date(now.getTime() + istOffsetMs)
        const loginIST = new Date(loginTime.getTime() + istOffsetMs)

        const todayExpiry = new Date(nowIST)
        todayExpiry.setUTCHours(3, 0, 0, 0)

        if (nowIST > todayExpiry && loginIST < todayExpiry) {
          get().logout()
          return false
        }

        return true
      },
    }),
    {
      name: 'aetherdesk-auth',
    }
  )
)
