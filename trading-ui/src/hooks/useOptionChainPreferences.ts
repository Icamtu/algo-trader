import { useState, useCallback, useEffect } from 'react'
import {
  type OptionChainPreferences,
  DEFAULT_PREFERENCES,
  LOCALSTORAGE_KEY
} from '@/integrations/aetherdesk/types/option-chain'

export function useOptionChainPreferences() {
  const [preferences, setPreferences] = useState<OptionChainPreferences>(() => {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY)
    if (saved) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) }
      } catch (e) {
        return DEFAULT_PREFERENCES
      }
    }
    return DEFAULT_PREFERENCES
  })

  useEffect(() => {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  const updatePreferences = useCallback((updates: Partial<OptionChainPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }))
  }, [])

  return { preferences, updatePreferences }
}
