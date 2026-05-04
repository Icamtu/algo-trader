import { aetherAdapter } from '@/integrations/aetherdesk/adapter';

export const tradingService = {
  // Methods to be used by the UI components
  getOrders: (apiKey: string) => aetherAdapter.getOrderBook(apiKey),
  getTrades: (apiKey: string) => aetherAdapter.getTradeBook(apiKey),
  getPositions: (apiKey: string) => aetherAdapter.getPositionBook(apiKey),
  getHoldings: (apiKey: string) => aetherAdapter.getHoldings(apiKey),
  getSystemLogs: (page: number = 1, searchQuery: string = "") => aetherAdapter.getSystemLogs(page, searchQuery),

  // Configuration
  getApiKey: () => aetherAdapter.getApiKey(),
  regenerateApiKey: () => aetherAdapter.regenerateApiKey(),
  setOrderMode: (mode: 'auto' | 'semi_auto') => aetherAdapter.setOrderMode(mode),
  getBrokerConfig: () => aetherAdapter.getBrokerConfig(),
  getWebSocketApiKey: () => aetherAdapter.getWebSocketApiKey(),

  // Master Contract
  getMasterContractStatus: () => aetherAdapter.getMasterContractStatus(),
  downloadMasterContract: (force?: boolean) => aetherAdapter.downloadMasterContract(force),
  getCacheHealth: () => aetherAdapter.getCacheHealth(),
  reloadCache: () => aetherAdapter.reloadCache(),

  // Sandbox
  getSandboxConfigs: () => aetherAdapter.getSandboxConfigs(),
  updateSandboxConfig: (key: string, value: any) => aetherAdapter.updateSandboxConfig(key, value),
  resetSandbox: () => aetherAdapter.resetSandbox(),
  getSandboxPnLData: () => aetherAdapter.getSandboxPnLData(),

  // Analyzer
  getAnalyzerData: (start?: string, end?: string) => aetherAdapter.getAnalyzerData(start, end),

  // Action Center
  getActionCenterData: (status?: string) => aetherAdapter.getActionCenterData(status),
  approveActionCenterOrder: (id: string | number) => aetherAdapter.approveActionCenterOrder(id),
  rejectActionCenterOrder: (id: string | number, reason?: string) => aetherAdapter.rejectActionCenterOrder(id, reason),
  deleteActionCenterOrder: (id: string | number) => aetherAdapter.deleteActionCenterOrder(id),
  retryActionCenterOrder: (id: string | number) => aetherAdapter.retryActionCenterOrder(id),
  approveAllActionCenterOrders: () => aetherAdapter.approveAllActionCenterOrders(),
  approveSelectedActionCenterOrders: (ids: (string | number)[]) => aetherAdapter.approveSelectedActionCenterOrders(ids),
  rejectSelectedActionCenterOrders: (ids: (string | number)[], reason?: string) => aetherAdapter.rejectSelectedActionCenterOrders(ids, reason),
  cancelAllActionOrders: () => aetherAdapter.cancelAllActionOrders(),
  getActionCenterOrders: (pendingOnly: boolean = true) => aetherAdapter.getActionCenterData(pendingOnly ? 'pending' : 'all'),

  // Strategy Management
  getAllStrategiesStatus: () => aetherAdapter.getAllStrategiesStatus(),
  haltStrategy: (strategy: string) => aetherAdapter.haltStrategy(strategy),
  unhaltStrategy: (strategy: string) => aetherAdapter.unhaltStrategy(strategy),
  initializeStrategy: (strategy: string) => aetherAdapter.initializeStrategy(strategy),
  liquidateStrategy: (strategy: string) => aetherAdapter.liquidateStrategy(strategy),
  getStrategySafeguards: (strategy_id: string) => aetherAdapter.getStrategySafeguards(strategy_id),
  updateStrategySafeguards: (strategy_id: string, safeguards: any) => aetherAdapter.updateStrategySafeguards(strategy_id, safeguards),

  // OI Profile & Search
  getOIProfileData: (params: any) => aetherAdapter.getOIProfileData(params),
  getOIIntervals: () => aetherAdapter.getOIIntervals(),
  getUnderlyings: (exchange: string) => aetherAdapter.getUnderlyings(exchange),
  getExpiries: (exchange: string, underlying: string) => aetherAdapter.getExpiries(exchange, underlying),

  // GEX
  getGEXData: (params: any) => aetherAdapter.getGEXData(params),

  // Health
  getCurrentHealthMetrics: () => aetherAdapter.getCurrentHealthMetrics(),
  getHealthMetricsHistory: (hours?: number) => aetherAdapter.getHealthMetricsHistory(hours),
  getHealthStats: (hours?: number) => aetherAdapter.getHealthStats(hours),
  getHealthAlerts: () => aetherAdapter.getHealthAlerts(),
  acknowledgeHealthAlert: (alertId: number) => aetherAdapter.acknowledgeHealthAlert(alertId),

  // Playground
  getPlaygroundEndpoints: () => aetherAdapter.getPlaygroundEndpoints(),
  getPlaygroundApiKey: () => aetherAdapter.getPlaygroundApiKey(),

  placeOrder: (payload: any) => aetherAdapter.placeOrder(payload),
  cancelOrder: (orderId: string) => aetherAdapter.cancelOrder(orderId),
  closePosition: (symbol: string, exchange: string, product: string) =>
    aetherAdapter.closePosition(symbol, exchange, product),

  getMarketQuotes: (apiKey: string, symbol: string, exchange: string) =>
    aetherAdapter.getQuotes(apiKey, symbol, exchange),

  getMultiQuotes: (apiKey: string, symbols: Array<{ symbol: string; exchange: string }>) =>
    aetherAdapter.getMultiQuotes(apiKey, symbols),

  // OI Tracker
  getOIData: (params: any) => aetherAdapter.getOIData(params),

  // Volatility
  getVolSurfaceData: (params: any) => aetherAdapter.getVolSurfaceData(params),
  getIVSmileData: (params: any) => aetherAdapter.getIVSmileData(params),
  getIVChartData: (params: any) => aetherAdapter.getIVChartData(params),

  // Historify
  getHistorifyWatchlist: () => aetherAdapter.getHistorifyWatchlist(),
  getHistorifyCatalog: (interval?: string) => aetherAdapter.getHistorifyCatalog(interval),
  deleteCatalogEntry: (symbol: string, exchange?: string, interval?: string) =>
    aetherAdapter.deleteCatalogEntry(symbol, exchange, interval),
  getHistorifyJobs: (limit?: number) => aetherAdapter.getHistorifyJobs(limit),
  getHistorifySchedules: () => aetherAdapter.getHistorifySchedules(),
  updateHistorifyWatchlist: (action: 'add' | 'remove', exchange: string, symbol?: string, symbols?: string[]) =>
    aetherAdapter.updateHistorifyWatchlist(action, exchange, symbol, symbols),
  getHistorifyRecords: (symbol: string, exchange?: string, interval?: string, limit?: number) =>
    aetherAdapter.getHistorifyRecords(symbol, exchange, interval, limit),
  getHistorifyBreadth: (interval?: string) =>
    aetherAdapter.getHistorifyBreadth(interval),
  runHistorify: (payload: { symbol?: string; symbols?: string[]; exchange: string; from_date: string; to_date: string; interval: string; is_incremental?: boolean; operator?: string }) =>
    aetherAdapter.runHistorify(payload),
  cancelHistorifyJob: (jobId: string) =>
    aetherAdapter.cancelHistorifyJob(jobId),
  exportHistorifyData: (symbol: string, exchange?: string, interval?: string, limit?: number) =>
    aetherAdapter.exportHistorifyData(symbol, exchange, interval, limit),
  seedHistorify: () => aetherAdapter.seedHistorify(),
  getHistorifyStats: () => aetherAdapter.getHistorifyStats(),
  compactHistorify: () => aetherAdapter.compactHistorify(),
  purgeHistorify: (days?: number) => aetherAdapter.purgeHistorify(days),

  // Strategy Labs
  getMaxPainData: (params: any) => aetherAdapter.getMaxPainData(params),
  getStraddleChartData: (params: any) => aetherAdapter.getStraddleChartData(params),
  getTelemetry: () => aetherAdapter.getTelemetry(),
  getTelemetryPnL: () => aetherAdapter.getTelemetryPnL(),
  getTelemetryPerformance: () => aetherAdapter.getTelemetryPerformance(),
};
