import { useCallback, useEffect, useRef, useState } from 'react'
import type { OptionChainResponse } from '@/integrations/openalgo/types/option-chain'
import { usePageVisibility } from './usePageVisibility'
import { webClient } from '@/integrations/openalgo/services/client' // Fallback to client if direct adapter call isn't preferred

interface UseOptionChainPollingOptions {
  enabled: boolean
  refreshInterval?: number
  pauseWhenHidden?: boolean
}

interface UseOptionChainPollingState {
  data: OptionChainResponse | null
  isLoading: boolean
  isConnected: boolean
  isPaused: boolean
  error: string | null
  lastUpdate: Date | null
}

/**
 * Hook for polling option chain data from REST API.
 * Adapted for AetherDesk Industrial Telemetry.
 */
export function useOptionChainPolling(
  apiKey: string | null,
  underlying: string,
  exchange: string,
  expiryDate: string,
  strikeCount: number,
  options: UseOptionChainPollingOptions = { enabled: true, refreshInterval: 30000, pauseWhenHidden: true }
) {
  const { enabled, refreshInterval = 30000, pauseWhenHidden = true } = options
  const { isVisible } = usePageVisibility()

  const [state, setState] = useState<UseOptionChainPollingState>({
    data: null,
    isLoading: false,
    isConnected: false,
    isPaused: false,
    error: null,
    lastUpdate: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const shouldPoll = enabled && (!pauseWhenHidden || isVisible)

  const fetchData = useCallback(async () => {
    if (!apiKey || !underlying || !exchange || !expiryDate) return

    if (abortControllerRef.current) return

    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Using webClient for consistent authentication and base URL
      const response = await webClient.post<OptionChainResponse>('/api/v1/optionchain', {
        apikey: apiKey,
        underlying,
        exchange,
        expiry_date: expiryDate,
        strike_count: strikeCount,
      }, { signal: controller.signal })

      const data = response.data

      if (data.status === 'success') {
        setState((prev) => ({
          ...prev,
          data,
          isLoading: false,
          isConnected: true,
          error: null,
          lastUpdate: new Date(),
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Failed to fetch option chain',
        }))
      }
    } catch (error: any) {
      if (error.name === 'CanceledError') return
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Connection error',
        isConnected: false,
      }))
    } finally {
      abortControllerRef.current = null
    }
  }, [apiKey, underlying, exchange, expiryDate, strikeCount])

  useEffect(() => {
    if (!shouldPoll) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setState((prev) => ({ ...prev, isPaused: !enabled ? false : true }))
      return
    }

    setState((prev) => ({ ...prev, isConnected: true, isPaused: false }))
    fetchData()
    intervalRef.current = setInterval(fetchData, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [shouldPoll, fetchData, refreshInterval, enabled])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    ...state,
    refetch,
  }
}
