import { useEffect, useMemo, useRef, useState } from 'react'
import type { OptionChainResponse, OptionStrike } from '@/integrations/openalgo/types/option-chain'
import { useOptionChainPolling } from './useOptionChainPolling'
import { useMarketData } from './useMarketData'

const NSE_INDEX_SYMBOLS = new Set([
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY',
  'NIFTYNXT50', 'NIFTYIT', 'NIFTYPHARMA', 'NIFTYBANK',
])
const BSE_INDEX_SYMBOLS = new Set(['SENSEX', 'BANKEX', 'SENSEX50'])

function getUnderlyingExchange(symbol: string, optionExchange: string): string {
  const normalizedExchange = optionExchange.toUpperCase()
  if (NSE_INDEX_SYMBOLS.has(symbol)) return 'NSE_INDEX'
  if (BSE_INDEX_SYMBOLS.has(symbol)) return 'BSE_INDEX'
  if (normalizedExchange === 'CRYPTO') return 'CRYPTO'
  if (normalizedExchange === 'BFO') return 'BSE'
  if (normalizedExchange === 'NFO') return 'NSE'
  return normalizedExchange
}

function roundToTickSize(price: number | undefined, tickSize: number | undefined): number | undefined {
  if (price === undefined || price === null) return undefined
  if (!tickSize || tickSize <= 0) return price
  return Number((Math.round(price / tickSize) * tickSize).toFixed(2))
}

interface UseOptionChainLiveOptions {
  enabled: boolean
  oiRefreshInterval?: number
  pauseWhenHidden?: boolean
}

/**
 * Hook for real-time option chain data using hybrid approach.
 */
export function useOptionChainLive(
  apiKey: string | null,
  underlying: string,
  exchange: string,
  optionExchange: string,
  expiryDate: string,
  strikeCount: number,
  options: UseOptionChainLiveOptions = { enabled: true, oiRefreshInterval: 30000, pauseWhenHidden: true }
) {
  const { enabled, oiRefreshInterval = 30000, pauseWhenHidden = true } = options

  const [mergedData, setMergedData] = useState<OptionChainResponse | null>(null)
  const [lastLtpUpdate, setLastLtpUpdate] = useState<Date | null>(null)

  const {
    data: polledData,
    isLoading,
    isConnected: isPollingConnected,
    isPaused: isPollingPaused,
    error,
    lastUpdate: lastPollUpdate,
    refetch,
  } = useOptionChainPolling(apiKey, underlying, exchange, expiryDate, strikeCount, {
    enabled,
    refreshInterval: oiRefreshInterval,
    pauseWhenHidden,
  })

  const wsSymbols = useMemo(() => {
    const symbols: Array<{ symbol: string; exchange: string }> = []
    const underlyingExch = getUnderlyingExchange(underlying, optionExchange)
    
    if (underlyingExch === 'CRYPTO') {
      symbols.push({ symbol: `${underlying}USDFUT`, exchange: underlyingExch })
    } else {
      symbols.push({ symbol: underlying, exchange: underlyingExch })
    }

    if (polledData?.chain) {
      for (const strike of polledData.chain) {
        if (strike.ce?.symbol) symbols.push({ symbol: strike.ce.symbol, exchange: optionExchange })
        if (strike.pe?.symbol) symbols.push({ symbol: strike.pe.symbol, exchange: optionExchange })
      }
    }
    return symbols
  }, [polledData?.chain, optionExchange, underlying])

  const {
    data: wsData,
    isConnected: isWsConnected,
    isAuthenticated: isWsAuthenticated,
    isPaused: isWsPaused,
  } = useMarketData({
    symbols: wsSymbols,
    mode: 'Depth',
    enabled: enabled && wsSymbols.length > 0,
  })

  const lastLtpUpdateRef = useRef<number>(0)

  useEffect(() => {
    if (!polledData) {
      setMergedData(null)
      return
    }

    if (wsData.size === 0) {
      setMergedData(polledData)
      return
    }

    const mergedChain: OptionStrike[] = polledData.chain.map((strike) => {
      const newStrike = { ...strike }
      
      const updateLeg = (leg: 'ce' | 'pe') => {
        const item = strike[leg]
        if (item?.symbol) {
          const wsKey = `${optionExchange}:${item.symbol.toUpperCase()}`
          const wsSymbolData = wsData.get(wsKey)
          if (wsSymbolData?.data) {
            const depthBuy = wsSymbolData.data.depth?.buy?.[0]
            const depthSell = wsSymbolData.data.depth?.sell?.[0]
            const tickSize = item.tick_size
            newStrike[leg] = {
              ...item,
              ltp: roundToTickSize(wsSymbolData.data.ltp, tickSize) ?? item.ltp,
              bid: roundToTickSize(depthBuy?.price ?? wsSymbolData.data.bid_price, tickSize) ?? item.bid,
              ask: roundToTickSize(depthSell?.price ?? wsSymbolData.data.ask_price, tickSize) ?? item.ask,
              bid_qty: depthBuy?.quantity ?? wsSymbolData.data.bid_size ?? item.bid_qty ?? 0,
              ask_qty: depthSell?.quantity ?? wsSymbolData.data.ask_size ?? item.ask_qty ?? 0,
            }
          }
        }
      }

      updateLeg('ce')
      updateLeg('pe')
      return newStrike
    })

    let hasLtpUpdate = false
    for (const [, symbolData] of wsData) {
      if (symbolData.lastUpdate && symbolData.lastUpdate > lastLtpUpdateRef.current) {
        hasLtpUpdate = true
        lastLtpUpdateRef.current = symbolData.lastUpdate
        break
      }
    }

    if (hasLtpUpdate) setLastLtpUpdate(new Date())

    const underlyingExch = getUnderlyingExchange(underlying, optionExchange)
    const underlyingKey = `${underlyingExch}:${underlying.toUpperCase()}`
    const underlyingWsData = wsData.get(underlyingKey)
    const underlyingLtp = underlyingWsData?.data?.ltp ?? polledData.underlying_ltp

    setMergedData({
      ...polledData,
      underlying_ltp: underlyingLtp,
      chain: mergedChain,
    })
  }, [polledData, wsData, optionExchange, underlying])

  const isStreaming = isWsConnected && isWsAuthenticated && wsSymbols.length > 0
  const isPaused = isPollingPaused || isWsPaused

  const lastUpdate = useMemo(() => {
    if (!lastPollUpdate && !lastLtpUpdate) return null
    if (!lastPollUpdate) return lastLtpUpdate
    if (!lastLtpUpdate) return lastPollUpdate
    return lastLtpUpdate > lastPollUpdate ? lastLtpUpdate : lastPollUpdate
  }, [lastPollUpdate, lastLtpUpdate])

  return {
    data: mergedData,
    isLoading,
    isConnected: isPollingConnected,
    isStreaming,
    isPaused,
    error,
    lastUpdate,
    streamingSymbols: wsSymbols.length,
    refetch,
  }
}
