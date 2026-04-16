import { openAlgoAdapter } from '@/integrations/openalgo/adapter';

export const tradingService = {
  // Methods to be used by the UI components
  getOrders: (apiKey: string) => openAlgoAdapter.getOrderBook(apiKey),
  getTrades: (apiKey: string) => openAlgoAdapter.getTradeBook(apiKey),
  getPositions: (apiKey: string) => openAlgoAdapter.getPositionBook(apiKey),
  getHoldings: (apiKey: string) => openAlgoAdapter.getHoldings(apiKey),
  getSystemLogs: (page: number = 1, searchQuery: string = "") => openAlgoAdapter.getSystemLogs(page, searchQuery),
  
  // Configuration
  getApiKey: () => openAlgoAdapter.getApiKey(),
  regenerateApiKey: () => openAlgoAdapter.regenerateApiKey(),
  setOrderMode: (mode: 'auto' | 'semi_auto') => openAlgoAdapter.setOrderMode(mode),
  getBrokerConfig: () => openAlgoAdapter.getBrokerConfig(),

  // Master Contract
  getMasterContractStatus: () => openAlgoAdapter.getMasterContractStatus(),
  downloadMasterContract: (force?: boolean) => openAlgoAdapter.downloadMasterContract(force),
  getCacheHealth: () => openAlgoAdapter.getCacheHealth(),
  reloadCache: () => openAlgoAdapter.reloadCache(),
  
  // Sandbox
  getSandboxConfigs: () => openAlgoAdapter.getSandboxConfigs(),
  updateSandboxConfig: (key: string, value: any) => openAlgoAdapter.updateSandboxConfig(key, value),
  resetSandbox: () => openAlgoAdapter.resetSandbox(),
  getSandboxPnLData: () => openAlgoAdapter.getSandboxPnLData(),
  
  // Analyzer
  getAnalyzerData: (start?: string, end?: string) => openAlgoAdapter.getAnalyzerData(start, end),

  // Action Center
  getActionCenterData: (status?: string) => openAlgoAdapter.getActionCenterData(status),
  approveActionCenterOrder: (id: number) => openAlgoAdapter.approveActionCenterOrder(id),
  rejectActionCenterOrder: (id: number, reason?: string) => openAlgoAdapter.rejectActionCenterOrder(id, reason),
  deleteActionCenterOrder: (id: number) => openAlgoAdapter.deleteActionCenterOrder(id),
  approveAllActionCenterOrders: () => openAlgoAdapter.approveAllActionCenterOrders(),
  approveSelectedActionCenterOrders: (ids: number[]) => openAlgoAdapter.approveSelectedActionCenterOrders(ids),
  rejectSelectedActionCenterOrders: (ids: number[], reason?: string) => openAlgoAdapter.rejectSelectedActionCenterOrders(ids, reason),

  // OI Profile & Search
  getOIProfileData: (params: any) => openAlgoAdapter.getOIProfileData(params),
  getOIIntervals: () => openAlgoAdapter.getOIIntervals(),
  getUnderlyings: (exchange: string) => openAlgoAdapter.getUnderlyings(exchange),
  getExpiries: (exchange: string, underlying: string) => openAlgoAdapter.getExpiries(exchange, underlying),

  // GEX
  getGEXData: (params: any) => openAlgoAdapter.getGEXData(params),

  // Health
  getCurrentHealthMetrics: () => openAlgoAdapter.getCurrentHealthMetrics(),
  getHealthMetricsHistory: (hours?: number) => openAlgoAdapter.getHealthMetricsHistory(hours),
  getHealthStats: (hours?: number) => openAlgoAdapter.getHealthStats(hours),
  getHealthAlerts: () => openAlgoAdapter.getHealthAlerts(),
  acknowledgeHealthAlert: (alertId: number) => openAlgoAdapter.acknowledgeHealthAlert(alertId),

  // Playground
  getPlaygroundEndpoints: () => openAlgoAdapter.getPlaygroundEndpoints(),
  getPlaygroundApiKey: () => openAlgoAdapter.getPlaygroundApiKey(),
  
  placeOrder: (payload: any) => openAlgoAdapter.placeOrder(payload),
  cancelOrder: (orderId: string) => openAlgoAdapter.cancelOrder(orderId),
  closePosition: (symbol: string, exchange: string, product: string) => 
    openAlgoAdapter.closePosition(symbol, exchange, product),
  
  getMarketQuotes: (apiKey: string, symbol: string, exchange: string) => 
    openAlgoAdapter.getQuotes(apiKey, symbol, exchange),
  
  getMultiQuotes: (apiKey: string, symbols: Array<{ symbol: string; exchange: string }>) =>
    openAlgoAdapter.getMultiQuotes(apiKey, symbols),

  // OI Tracker
  getOIData: (params: any) => openAlgoAdapter.getOIData(params),

  // Volatility
  getVolSurfaceData: (params: any) => openAlgoAdapter.getVolSurfaceData(params),
  getIVSmileData: (params: any) => openAlgoAdapter.getIVSmileData(params),
  getIVChartData: (params: any) => openAlgoAdapter.getIVChartData(params),

  // Historify
  getHistorifyWatchlist: () => openAlgoAdapter.getHistorifyWatchlist(),
  getHistorifyCatalog: () => openAlgoAdapter.getHistorifyCatalog(),
  getHistorifyJobs: (limit?: number) => openAlgoAdapter.getHistorifyJobs(limit),
  getHistorifySchedules: () => openAlgoAdapter.getHistorifySchedules(),
  updateHistorifyWatchlist: (action: 'add' | 'remove', exchange: string, symbol: string) => 
    openAlgoAdapter.updateHistorifyWatchlist(action, exchange, symbol),

  // Strategy Labs
  getMaxPainData: (params: any) => openAlgoAdapter.getMaxPainData(params),
  getStraddleChartData: (params: any) => openAlgoAdapter.getStraddleChartData(params),
};
