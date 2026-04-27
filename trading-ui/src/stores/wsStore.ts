import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'

interface WsState {
  // Connection Status
  eventsConnected: boolean
  marketDataConnected: boolean

  // Data
  prices: Map<string, { ltp: number; change?: number }>

  // Socket References
  eventSocket: WebSocket | null
  marketSocket: WebSocket | null

  // Internal Buffer for Debouncing (Phase 37)
  _priceBuffer: Map<string, { ltp: number; change?: number }>
  _batchTimer: number | null

  // Actions
  initializeEvents: (url: string) => Promise<void>
  initializeMarketData: (url: string) => void
  setPrice: (symbol: string, ltp: number, change?: number) => void
  flushPrices: () => void
  cleanup: () => void
}

export const useWsStore = create<WsState>((set, get) => ({
  eventsConnected: false,
  marketDataConnected: false,
  prices: new Map(),
  eventSocket: null,
  marketSocket: null,

  _priceBuffer: new Map(),
  _batchTimer: null,

  setPrice: (symbol, ltp, change) => {
    // Add to buffer instead of immediate state update
    get()._priceBuffer.set(symbol, { ltp, change })

    // Start batch timer if not already running (250ms debounce)
    if (!get()._batchTimer) {
      const timer = window.setInterval(() => {
        get().flushPrices()
      }, 250) as unknown as number
      set({ _batchTimer: timer })
    }
  },

  flushPrices: () => {
    const buffer = get()._priceBuffer
    if (buffer.size === 0) return

    set((state) => {
      const updated = new Map(state.prices)
      buffer.forEach((val, key) => {
        updated.set(key, val)
      })
      // Clear buffer after sync
      buffer.clear()
      return { prices: updated }
    })
  },

  initializeEvents: async (url) => {
    if (get().eventSocket) return

    // Convert http/https to ws/wss if needed
    const wsUrl = url.replace(/^http/, 'ws')
    const socket = new WebSocket(wsUrl)

    socket.onopen = async () => {
      console.info("[WS] Event socket connected, authenticating...")
      const { data: { session } } = await supabase.auth.getSession()
      socket.send(JSON.stringify({
        type: 'auth',
        token: session?.access_token || ""
      }))
      set({ eventsConnected: true })
    }

    socket.onclose = () => {
      console.warn("[WS] Event socket closed")
      set({ eventsConnected: false, eventSocket: null })
    }

    socket.onerror = (err) => {
      console.error("[WS] Event socket error:", err)
      socket.close()
    }

    set({ eventSocket: socket })
  },

  initializeMarketData: (url) => {
    if (get().marketSocket) return

    const wsUrl = url.replace(/^http/, 'ws')
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => set({ marketDataConnected: true })
    socket.onclose = () => set({ marketDataConnected: false, marketSocket: null })
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Standardize: LP (Legacy) -> LTP (Native)
        const symbol = data.symbol || data.s
        const ltp = data.ltp !== undefined ? data.ltp : data.lp
        if (symbol && ltp !== undefined) {
          get().setPrice(symbol, ltp, data.change)
        }
      } catch (e) {}
    }

    set({ marketSocket: socket })
  },

  cleanup: () => {
    const { eventSocket, marketSocket, _batchTimer } = get()

    // Helper to safely close WebSockets during any state
    const safeClose = (ws: WebSocket | null) => {
      if (!ws) return
      // Phase 16: Silent cleanup
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null

      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }

    safeClose(eventSocket)
    safeClose(marketSocket)

    if (_batchTimer) clearInterval(_batchTimer)
    set({
      eventSocket: null,
      marketSocket: null,
      eventsConnected: false,
      marketDataConnected: false,
      _batchTimer: null
    })
  }
}))
