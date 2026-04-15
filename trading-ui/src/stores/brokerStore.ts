import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BrokerCapabilities {
  broker_type: string
  [key: string]: any
}

interface BrokerState {
  capabilities: BrokerCapabilities | null
  setCapabilities: (capabilities: BrokerCapabilities | null) => void
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set) => ({
      capabilities: null,
      setCapabilities: (capabilities) => set({ capabilities }),
    }),
    {
      name: 'aetherdesk-broker',
    }
  )
)
