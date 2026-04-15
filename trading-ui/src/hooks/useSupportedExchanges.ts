import { useMemo } from 'react'
import { useBrokerStore } from '@/stores/brokerStore'

export interface ExchangeOption {
  value: string
  label: string
}

const UNDERLYINGS: Record<string, string[]> = {
  NFO: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'],
  BFO: ['SENSEX', 'BANKEX'],
  MCX: ['GOLDM', 'CRUDEOIL', 'SILVERM', 'NATURALGAS', 'COPPER'],
  CDS: ['USDINR', 'EURINR', 'GBPINR', 'JPYINR'],
  CRYPTO: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'],
}

const INDEX_EXCHANGES = new Set(['NSE_INDEX', 'BSE_INDEX', 'MCX_INDEX', 'CDS_INDEX'])
const FNO_CODES = new Set(['NFO', 'BFO', 'MCX', 'CDS', 'CRYPTO'])
const FALLBACK_EXCHANGES = ['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX', 'CRYPTO']

/**
 * useSupportedExchanges - Hook for list of exchanges supported by current broker.
 * Essential for populating dropdowns and filters.
 */
export function useSupportedExchanges() {
  const capabilities = useBrokerStore((s) => s.capabilities)

  return useMemo(() => {
    const supported = capabilities?.supported_exchanges ?? FALLBACK_EXCHANGES
    const isCrypto = capabilities?.broker_type === 'crypto'

    const allExchanges: ExchangeOption[] = supported.map((e) => ({ value: e, label: e }))

    const tradingExchanges: ExchangeOption[] = supported
      .filter((e) => !INDEX_EXCHANGES.has(e))
      .map((e) => ({ value: e, label: e }))

    const fnoExchanges: ExchangeOption[] = supported
      .filter((e) => FNO_CODES.has(e))
      .map((e) => ({ value: e, label: e }))

    const defaultExchange = tradingExchanges[0]?.value ?? (isCrypto ? 'CRYPTO' : 'NSE')
    const defaultFnoExchange = fnoExchanges[0]?.value ?? (isCrypto ? 'CRYPTO' : 'NFO')

    const defaultUnderlyings: Record<string, string[]> = {}
    for (const ex of fnoExchanges) {
      if (UNDERLYINGS[ex.value]) {
        defaultUnderlyings[ex.value] = UNDERLYINGS[ex.value]
      }
    }

    return {
      allExchanges,
      tradingExchanges,
      fnoExchanges,
      defaultExchange,
      defaultFnoExchange,
      defaultUnderlyings,
      isCrypto,
    }
  }, [capabilities])
}
