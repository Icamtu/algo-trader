/**
 * MarketDataManager - Singleton class for shared WebSocket connection management
 *
 * Ported from AetherDesk with Industrial Telemetry enhancements.
 * Handles single WS connection, ref-counted subscriptions, and REST fallback.
 */

import { CONFIG } from './config'

export interface DepthLevel {
  price: number
  quantity: number
  orders?: number
}

export interface MarketData {
  ltp?: number
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  change?: number
  change_percent?: number
  timestamp?: string
  bid_price?: number
  ask_price?: number
  bid_size?: number
  ask_size?: number
  depth?: {
    buy: DepthLevel[]
    sell: DepthLevel[]
  }
}

export interface SymbolData {
  symbol: string
  exchange: string
  data: MarketData
  lastUpdate?: number
}

export type SubscriptionMode = 'LTP' | 'Quote' | 'Depth'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticating' | 'authenticated' | 'paused'

export interface StateListener {
  (state: {
    connectionState: ConnectionState
    isConnected: boolean
    isAuthenticated: boolean
    isPaused: boolean
    isFallbackMode: boolean
    error: string | null
  }): void
}

export type DataCallback = (data: SymbolData) => void

interface SubscriptionEntry {
  symbol: string
  exchange: string
  mode: SubscriptionMode
  callbacks: Set<DataCallback>
  refCount: number
}

async function fetchCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/algo-api/api/v1/auth/csrf-token', { credentials: 'include' })
    if (!response.ok) return "aether-core-session-token-v1";
    const data = await response.json()
    return data.csrf_token || "aether-core-session-token-v1";
  } catch (err) {
    console.warn("WS_CSRF_HANDSHAKE_FAULT", err);
    return "aether-core-session-token-v1";
  }
}

interface QuotesApiData {
  ltp?: number
  open?: number
  high?: number
  low?: number
  prev_close?: number
  volume?: number
  bid?: number
  ask?: number
  oi?: number
}

interface MultiQuotesResult {
  symbol: string
  exchange: string
  data: QuotesApiData
}

interface MultiQuotesApiResponse {
  status: 'success' | 'error'
  results?: MultiQuotesResult[]
  message?: string
}

export class MarketDataManager {
  private static instance: MarketDataManager | null = null

  private socket: WebSocket | null = null
  private subscriptions: Map<string, SubscriptionEntry> = new Map()
  private dataCache: Map<string, SymbolData> = new Map()
  private stateListeners: Set<StateListener> = new Set()

  private connectionState: ConnectionState = 'disconnected'
  private error: string | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private autoReconnect: boolean = true
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 10
  private userDisconnected: boolean = false
  private connectAbortController: AbortController | null = null

  private fallbackMode: boolean = false
  private fallbackPollingInterval: ReturnType<typeof setInterval> | null = null
  private fallbackPollingRate: number = 5000
  private apiKey: string | null = null
  private consecutiveFailures: number = 0
  private maxConsecutiveFailures: number = 3

  private constructor() {}

  static getInstance(): MarketDataManager {
    if (!MarketDataManager.instance) {
      MarketDataManager.instance = new MarketDataManager()
    }
    return MarketDataManager.instance
  }

  static resetInstance(): void {
    if (MarketDataManager.instance) {
      MarketDataManager.instance.disconnect()
      MarketDataManager.instance = null
    }
  }

  subscribe(rawSymbol: string, rawExchange: string, mode: SubscriptionMode, callback: DataCallback): () => void {
    const symbol = rawSymbol.toUpperCase()
    const exchange = rawExchange.toUpperCase()
    const key = `${exchange}:${symbol}:${mode}`
    const dataKey = `${exchange}:${symbol}`

    let entry = this.subscriptions.get(key)

    if (entry) {
      entry.callbacks.add(callback)
      entry.refCount++
      const cached = this.dataCache.get(dataKey)
      if (cached) callback(cached)
    } else {
      entry = {
        symbol,
        exchange,
        mode,
        callbacks: new Set([callback]),
        refCount: 1,
      }
      this.subscriptions.set(key, entry)
      if (!this.dataCache.has(dataKey)) {
        this.dataCache.set(dataKey, { symbol, exchange, data: {} })
      }

      if (this.connectionState === 'authenticated') {
        this.sendSubscribe([{ symbol, exchange }], mode)
      } else if (this.fallbackMode && this.apiKey) {
        if (!this.fallbackPollingInterval) {
          this.startFallbackPolling()
        } else {
          this.fetchMarketDataViaRest()
        }
      }
    }

    return () => {
      this.unsubscribe(symbol, exchange, mode, callback)
    }
  }

  private unsubscribe(symbol: string, exchange: string, mode: SubscriptionMode, callback: DataCallback): void {
    const key = `${exchange}:${symbol}:${mode}`
    const entry = this.subscriptions.get(key)
    if (!entry) return

    entry.callbacks.delete(callback)
    entry.refCount--

    if (entry.refCount <= 0) {
      this.subscriptions.delete(key)
      const symbolStillNeeded = Array.from(this.subscriptions.values()).some(e => e.symbol === symbol && e.exchange === exchange)
      if (!symbolStillNeeded) {
        this.dataCache.delete(`${exchange}:${symbol}`)
        if (this.connectionState === 'authenticated') {
          this.sendUnsubscribe([{ symbol, exchange }])
        }
      }
      if (this.subscriptions.size === 0 && this.fallbackMode) {
        this.stopFallbackPolling()
      }
    }
  }

  addStateListener(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    listener(this.getState())
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  getState() {
    return {
      connectionState: this.connectionState,
      isConnected: ['connected', 'authenticating', 'authenticated'].includes(this.connectionState),
      isAuthenticated: this.connectionState === 'authenticated',
      isPaused: this.connectionState === 'paused',
      isFallbackMode: this.fallbackMode,
      error: this.error,
    }
  }

  getCachedData(symbol: string, exchange: string): SymbolData | undefined {
    return this.dataCache.get(`${exchange.toUpperCase()}:${symbol.toUpperCase()}`)
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled
  }

  async connect(): Promise<void> {
    if (this.socket || ['connecting', 'connected', 'authenticating', 'authenticated'].includes(this.connectionState)) return

    this.userDisconnected = false
    this.connectAbortController?.abort()
    this.connectAbortController = new AbortController()
    const abortSignal = this.connectAbortController.signal

    this.setConnectionState('connecting')
    this.error = null

    try {
      const csrfToken = await fetchCSRFToken()
      if (this.userDisconnected || abortSignal.aborted) return

      console.log("[MarketDataManager] Fetching WS config from:", '/algo-api/api/websocket/config');
      const configResponse = await fetch('/algo-api/api/websocket/config', {
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
        signal: abortSignal,
      })
      const configData = await configResponse.json()
      console.log("[MarketDataManager] WS Config Received:", configData);
      if (configData.status !== 'success') throw new Error('Failed to get WebSocket configuration')

      const socket = new WebSocket(configData.websocket_url)
      socket.onopen = async () => {
        if (this.userDisconnected) {
          socket.close(1000)
          return
        }
        this.setConnectionState('connected')
        this.reconnectAttempts = 0
        try {
          const authCsrfToken = await fetchCSRFToken()
          // Get session token from Supabase
          const { supabase } = await import('@/integrations/supabase/client')
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token

          console.log("[MarketDataManager] Fetching API key from:", '/algo-api/api/websocket/apikey');
          const apiKeyResponse = await fetch('/algo-api/api/websocket/apikey', {
            method: 'POST',
            headers: {
              'X-CSRFToken': authCsrfToken,
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
          })
          const apiKeyData = await apiKeyResponse.json()
          console.log("[MarketDataManager] API Key Received:", apiKeyData.status);

          if (apiKeyData.status === 'success' && apiKeyData.api_key) {
            this.setConnectionState('authenticating')
            console.log("[MarketDataManager] Sending authenticate message...");
            socket.send(JSON.stringify({ action: 'authenticate', api_key: apiKeyData.api_key }))
          } else {
            this.setError('No API key found')
            console.error("[MarketDataManager] No API key in response:", apiKeyData);
          }
        } catch (err) {
          this.setError(`Authentication error: ${err}`)
        }
      }

      socket.onclose = (event) => {
        this.socket = null
        if (this.connectionState !== 'paused') this.setConnectionState('disconnected')
        if (!event.wasClean) this.consecutiveFailures++

        if (this.autoReconnect && !event.wasClean && this.connectionState !== 'paused' && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)
          this.reconnectTimeout = setTimeout(() => this.connect(), delay)
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts || this.consecutiveFailures >= this.maxConsecutiveFailures) {
          this.enableFallbackMode()
        }
      }

      socket.onerror = () => {
        this.consecutiveFailures++
        this.setError('WebSocket connection error')
      }

      socket.onmessage = (event) => this.handleMessage(event)
      this.socket = socket
    } catch (err) {
      this.consecutiveFailures++
      this.setError(`Connection failed: ${err}`)
      this.setConnectionState('disconnected')
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) this.enableFallbackMode()
    }
  }

  disconnect(): void {
    this.userDisconnected = true
    this.connectAbortController?.abort()
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
    if (this.socket) {
      this.socket.close(1000)
      this.socket = null
    }
    this.stopFallbackPolling()
    this.fallbackMode = false
    this.consecutiveFailures = 0
    this.apiKey = null
    this.setConnectionState('disconnected')
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)
      const { type } = data

      if (CONFIG.DEBUG) console.debug("[MarketDataManager] RX:", type, data);
      const typeStr = (type || data.status) as string

      switch (typeStr) {
        case 'auth':
          if (data.status === 'success') {
            this.setConnectionState('authenticated')
            this.error = null
            this.consecutiveFailures = 0
            this.disableFallbackMode()
            this.resubscribeAll()
          } else {
            this.setError(`Authentication failed: ${data.message}`)
          }
          break

        case 'market_data':
        case 'market_data_batch': {
          const ticks = typeStr === 'market_data_batch' ? (data.data as any[]) : [data]

          ticks.forEach(tick => {
            const symbol = (tick.symbol as string).toUpperCase()
            const exchange = (tick.exchange as string).toUpperCase()
            const marketDataPayload = (tick.data || {}) as MarketData
            const dataKey = `${exchange}:${symbol}`

            const existing = this.dataCache.get(dataKey) || { symbol, exchange, data: {} }
            const newData = { ...existing.data }

            Object.assign(newData, {
              ltp: marketDataPayload.ltp ?? newData.ltp,
              open: marketDataPayload.open ?? newData.open,
              high: marketDataPayload.high ?? newData.high,
              low: marketDataPayload.low ?? newData.low,
              close: marketDataPayload.close ?? newData.close,
              volume: marketDataPayload.volume ?? newData.volume,
              change: marketDataPayload.change ?? newData.change,
              change_percent: marketDataPayload.change_percent ?? newData.change_percent,
              timestamp: marketDataPayload.timestamp ?? newData.timestamp,
              bid_price: marketDataPayload.bid_price ?? newData.bid_price,
              ask_price: marketDataPayload.ask_price ?? newData.ask_price,
              bid_size: marketDataPayload.bid_size ?? newData.bid_size,
              ask_size: marketDataPayload.ask_size ?? newData.ask_size,
              depth: marketDataPayload.depth ?? newData.depth,
            })

            const updatedSymbolData: SymbolData = { ...existing, data: newData, lastUpdate: Date.now() }
            this.dataCache.set(dataKey, updatedSymbolData)

            this.subscriptions.forEach((entry) => {
              if (entry.symbol === symbol && entry.exchange === exchange) {
                entry.callbacks.forEach(cb => cb(updatedSymbolData))
              }
            })
          })
          break
        }
      }
    } catch {}
  }

  private sendSubscribe(symbols: Array<{ symbol: string; exchange: string }>, mode: SubscriptionMode): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: 'subscribe', symbols, mode }))
    }
  }

  private sendUnsubscribe(symbols: Array<{ symbol: string; exchange: string }>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: 'unsubscribe', symbols }))
    }
  }

  private resubscribeAll(): void {
    const byMode = new Map<SubscriptionMode, Array<{ symbol: string; exchange: string }>>()
    this.subscriptions.forEach((entry) => {
      const list = byMode.get(entry.mode) || []
      list.push({ symbol: entry.symbol, exchange: entry.exchange })
      byMode.set(entry.mode, list)
    })
    byMode.forEach((symbols, mode) => this.sendSubscribe(symbols, mode))
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.notifyStateListeners()
  }

  private setError(error: string): void {
    this.error = error
    this.notifyStateListeners()
  }

  private notifyStateListeners(): void {
    const state = this.getState()
    this.stateListeners.forEach(l => l(state))
  }

  private async enableFallbackMode(): Promise<void> {
    if (this.fallbackMode) return
    this.fallbackMode = true
    this.notifyStateListeners()
    await this.fetchApiKeyForFallback()
    if (this.subscriptions.size > 0 && this.apiKey) this.startFallbackPolling()
  }

  private disableFallbackMode(): void {
    if (!this.fallbackMode) return
    this.fallbackMode = false
    this.stopFallbackPolling()
    this.consecutiveFailures = 0
    this.notifyStateListeners()
  }

  private async fetchApiKeyForFallback(): Promise<void> {
    try {
      const csrfToken = await fetchCSRFToken()
      // Fix: Use correct institutional path (root-level analytics router)
      const response = await fetch('/algo-api/api/websocket/apikey', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include'
      })
      const data = await response.json()
      if (data.status === 'success') this.apiKey = data.api_key
    } catch (err) {
      console.warn("[MarketDataManager] Fallback API key fetch failed:", err);
    }
  }

  private startFallbackPolling(): void {
    if (this.fallbackPollingInterval) return
    this.fetchMarketDataViaRest()
    this.fallbackPollingInterval = setInterval(() => this.fetchMarketDataViaRest(), this.fallbackPollingRate)
  }

  private stopFallbackPolling(): void {
    if (this.fallbackPollingInterval) {
      clearInterval(this.fallbackPollingInterval)
      this.fallbackPollingInterval = null
    }
  }

  private async fetchMarketDataViaRest(): Promise<void> {
    if (!this.apiKey || this.subscriptions.size === 0) return
    try {
      const symbols = Array.from(new Set(Array.from(this.subscriptions.values()).map(e => `${e.exchange}:${e.symbol}`)))
        .map(s => ({ exchange: s.split(':')[0], symbol: s.split(':')[1] }))

      const response = await fetch('/algo-api/api/v1/multiquotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apikey: this.apiKey, symbols }),
      })
      const data = await response.json() as MultiQuotesApiResponse
      if (data.status === 'success' && data.results) {
        data.results.forEach(res => {
          const symbolData: SymbolData = {
            symbol: res.symbol.toUpperCase(),
            exchange: res.exchange.toUpperCase(),
            data: {
              ltp: res.data.ltp,
              open: res.data.open,
              high: res.data.high,
              low: res.data.low,
              close: res.data.prev_close,
              volume: res.data.volume,
              bid_price: res.data.bid,
              ask_price: res.data.ask,
            },
            lastUpdate: Date.now()
          }
          this.dataCache.set(`${symbolData.exchange}:${symbolData.symbol}`, symbolData)
          this.subscriptions.forEach(entry => {
            if (entry.symbol === symbolData.symbol && entry.exchange === symbolData.exchange) {
              entry.callbacks.forEach(cb => cb(symbolData))
            }
          })
        })
      }
    } catch {}
  }
}
