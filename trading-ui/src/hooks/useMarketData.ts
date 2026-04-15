import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketDataContextOptional } from '@/contexts/MarketDataContext'
import { MarketDataManager, type SymbolData, type SubscriptionMode } from '@/lib/MarketDataManager'

export type { DepthLevel, MarketData, SymbolData } from '@/lib/MarketDataManager'

interface UseMarketDataOptions {
  symbols: Array<{ symbol: string; exchange: string }>
  mode?: SubscriptionMode
  enabled?: boolean
  autoReconnect?: boolean
}

interface UseMarketDataReturn {
  data: Map<string, SymbolData>
  isConnected: boolean
  isAuthenticated: boolean
  isConnecting: boolean
  isPaused: boolean
  isFallbackMode: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

/**
 * useMarketData - High-level hook for real-time market data
 * Subscribes to symbols and returns reactive data map.
 */
export function useMarketData({
  symbols,
  mode = 'LTP',
  enabled = true,
  autoReconnect = true,
}: UseMarketDataOptions): UseMarketDataReturn {
  const context = useMarketDataContextOptional()
  const managerRef = useRef<MarketDataManager>(context?.manager ?? MarketDataManager.getInstance())

  const [marketData, setMarketData] = useState<Map<string, SymbolData>>(new Map())
  const [connectionState, setConnectionState] = useState({
    isConnected: context?.isConnected ?? false,
    isAuthenticated: context?.isAuthenticated ?? false,
    isPaused: context?.isPaused ?? false,
    isFallbackMode: context?.isFallbackMode ?? false,
    error: context?.error ?? null,
  })

  const [isConnecting, setIsConnecting] = useState(false)

  const symbolsKey = useMemo(
    () => symbols.map((s) => `${s.exchange}:${s.symbol}`).sort().join(','),
    [symbols]
  )

  useEffect(() => {
    managerRef.current.setAutoReconnect(autoReconnect)
  }, [autoReconnect])

  useEffect(() => {
    const manager = managerRef.current
    const unsubscribe = manager.addStateListener((state) => {
      setConnectionState({
        isConnected: state.isConnected,
        isAuthenticated: state.isAuthenticated,
        isPaused: state.isPaused,
        isFallbackMode: state.isFallbackMode,
        error: state.error,
      })
      setIsConnecting(state.connectionState === 'connecting' || state.connectionState === 'authenticating')
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setMarketData(new Map())
      return
    }

    const manager = managerRef.current
    if (!connectionState.isConnected && !connectionState.isPaused) {
      manager.connect()
    }

    const unsubscribes: Array<() => void> = []

    for (const { symbol, exchange } of symbols) {
      const unsubscribe = manager.subscribe(symbol, exchange, mode, (data: SymbolData) => {
        setMarketData((prev) => {
          const key = `${data.exchange.toUpperCase()}:${data.symbol.toUpperCase()}`
          const updated = new Map(prev)
          updated.set(key, data)
          return updated
        })
      })
      unsubscribes.push(unsubscribe)

      const cached = manager.getCachedData(symbol, exchange)
      if (cached) {
        const key = `${exchange.toUpperCase()}:${symbol.toUpperCase()}`
        setMarketData((prev) => {
          const updated = new Map(prev)
          updated.set(key, cached)
          return updated
        })
      }
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [enabled, symbolsKey, mode, connectionState.isConnected, connectionState.isPaused])

  const connect = useCallback(async () => {
    await managerRef.current.connect()
  }, [])

  const disconnect = useCallback(() => {
    managerRef.current.disconnect()
  }, [])

  return {
    data: marketData,
    isConnected: connectionState.isConnected,
    isAuthenticated: connectionState.isAuthenticated,
    isConnecting,
    isPaused: connectionState.isPaused,
    isFallbackMode: connectionState.isFallbackMode,
    error: connectionState.error,
    connect,
    disconnect,
  }
}
