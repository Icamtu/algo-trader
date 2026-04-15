import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'

interface WsState {
  // Connection Status
  eventsConnected: boolean
  marketDataConnected: boolean
  
  // Data
  prices: Map<string, { ltp: number; change?: number }>
  
  // Socket References
  eventSocket: Socket | null
  marketSocket: WebSocket | null
  
  // Actions
  initializeEvents: (url: string) => void
  initializeMarketData: (url: string) => void
  setPrice: (symbol: string, ltp: number, change?: number) => void
  cleanup: () => void
}

export const useWsStore = create<WsState>((set, get) => ({
  eventsConnected: false,
  marketDataConnected: false,
  prices: new Map(),
  eventSocket: null,
  marketSocket: null,

  setPrice: (symbol, ltp, change) => set((state) => {
    const updated = new Map(state.prices)
    updated.set(symbol, { ltp, change })
    return { prices: updated }
  }),

  initializeEvents: (url) => {
    if (get().eventSocket) return
    
    const socket = io(url, {
      transports: ['polling'],
      upgrade: false,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => set({ eventsConnected: true }))
    socket.on('disconnect', () => set({ eventsConnected: false }))
    
    set({ eventSocket: socket })
  },

  initializeMarketData: (url) => {
    if (get().marketSocket) return

    const socket = new WebSocket(url)
    
    socket.onopen = () => set({ marketDataConnected: true })
    socket.onclose = () => set({ marketDataConnected: false })
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Handle OpenAlgo binary/json price feed
        if (data.symbol && data.ltp) {
          get().setPrice(data.symbol, data.ltp, data.change)
        }
      } catch (e) {}
    }

    set({ marketSocket: socket })
  },

  cleanup: () => {
    const { eventSocket, marketSocket } = get()
    eventSocket?.disconnect()
    marketSocket?.close()
    set({ eventSocket: null, marketSocket: null, eventsConnected: false, marketDataConnected: false })
  }
}))
