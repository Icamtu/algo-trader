import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { MarketDataManager, type ConnectionState } from '@/lib/MarketDataManager';

interface MarketDataState {
  isConnected: boolean;
  isAuthenticated: boolean;
  isPaused: boolean;
  isFallbackMode: boolean;
  error: string | null;
  connectionState: ConnectionState;
}

interface MarketDataContextType extends MarketDataState {
  manager: MarketDataManager;
}

const MarketDataContext = createContext<MarketDataContextType | null>(null);

export const MarketDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => MarketDataManager.getInstance(), []);
  const [state, setState] = useState<MarketDataState>({
    isConnected: false,
    isAuthenticated: false,
    isPaused: false,
    isFallbackMode: false,
    error: null,
    connectionState: 'disconnected',
  });

  useEffect(() => {
    // Subscribe to state changes from the manager
    const unsubscribe = manager.addStateListener((newState) => {
      setState({
        isConnected: newState.isConnected,
        isAuthenticated: newState.isAuthenticated,
        isPaused: newState.isPaused,
        isFallbackMode: newState.isFallbackMode,
        error: newState.error,
        connectionState: newState.connectionState,
      });
    });

    // Auto-connect if enabled
    manager.connect();

    return () => {
      unsubscribe();
      // Manager is a singleton, we don't necessarily want to disconnect on unmount
      // unless the whole app is unmounting. But standard practice for context providers
      // is to at least clean up listeners.
    };
  }, [manager]);

  const value = useMemo(() => ({
    ...state,
    manager,
  }), [state, manager]);

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketDataContext = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketDataContext must be used within a MarketDataProvider');
  }
  return context;
};

export const useMarketDataContextOptional = () => {
  return useContext(MarketDataContext);
};
