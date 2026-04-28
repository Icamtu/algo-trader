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
  approveActionCenterOrder: (id: string | number) => openAlgoAdapter.approveActionCenterOrder(id),
  rejectActionCenterOrder: (id: string | number, reason?: string) => openAlgoAdapter.rejectActionCenterOrder(id, reason),
  deleteActionCenterOrder: (id: string | number) => openAlgoAdapter.deleteActionCenterOrder(id),
  retryActionCenterOrder: (id: string | number) => openAlgoAdapter.retryActionCenterOrder(id),
  approveAllActionCenterOrders: () => openAlgoAdapter.approveAllActionCenterOrders(),
  approveSelectedActionCenterOrders: (ids: (string | number)[]) => openAlgoAdapter.approveSelectedActionCenterOrders(ids),
  rejectSelectedActionCenterOrders: (ids: (string | number)[], reason?: string) => openAlgoAdapter.rejectSelectedActionCenterOrders(ids, reason),
  cancelAllActionOrders: () => openAlgoAdapter.cancelAllActionOrders(),
  getActionCenterOrders: (pendingOnly: boolean = true) => openAlgoAdapter.getActionCenterData(pendingOnly ? 'pending' : 'all'),

  // Strategy Management
  getAllStrategiesStatus: () => openAlgoAdapter.getAllStrategiesStatus(),
  haltStrategy: (strategy: string) => openAlgoAdapter.haltStrategy(strategy),
  unhaltStrategy: (strategy: string) => openAlgoAdapter.unhaltStrategy(strategy),
  initializeStrategy: (strategy: string) => openAlgoAdapter.initializeStrategy(strategy),
  liquidateStrategy: (strategy: string) => openAlgoAdapter.liquidateStrategy(strategy),
  getStrategySafeguards: (strategy_id: string) => openAlgoAdapter.getStrategySafeguards(strategy_id),
  updateStrategySafeguards: (strategy_id: string, safeguards: any) => openAlgoAdapter.updateStrategySafeguards(strategy_id, safeguards),

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
  getHistorifyCatalog: (interval?: string) => openAlgoAdapter.getHistorifyCatalog(interval),
  deleteCatalogEntry: (symbol: string, exchange?: string, interval?: string) =>
    openAlgoAdapter.deleteCatalogEntry(symbol, exchange, interval),
  getHistorifyJobs: (limit?: number) => openAlgoAdapter.getHistorifyJobs(limit),
  getHistorifySchedules: () => openAlgoAdapter.getHistorifySchedules(),
  updateHistorifyWatchlist: (action: 'add' | 'remove', exchange: string, symbol?: string, symbols?: string[]) =>
    openAlgoAdapter.updateHistorifyWatchlist(action, exchange, symbol, symbols),
  getHistorifyRecords: (symbol: string, exchange?: string, interval?: string, limit?: number) =>
    openAlgoAdapter.getHistorifyRecords(symbol, exchange, interval, limit),
  getHistorifyBreadth: (interval?: string) =>
    openAlgoAdapter.getHistorifyBreadth(interval),
  runHistorify: (payload: { symbol?: string; symbols?: string[]; exchange: string; from_date: string; to_date: string; interval: string; is_incremental?: boolean; operator?: string }) =>
    openAlgoAdapter.runHistorify(payload),
  cancelHistorifyJob: (jobId: string) =>
    openAlgoAdapter.cancelHistorifyJob(jobId),
  exportHistorifyData: (symbol: string, exchange?: string, interval?: string, limit?: number) =>
    openAlgoAdapter.exportHistorifyData(symbol, exchange, interval, limit),
  seedHistorify: () => openAlgoAdapter.seedHistorify(),
  getHistorifyStats: () => openAlgoAdapter.getHistorifyStats(),
  compactHistorify: () => openAlgoAdapter.compactHistorify(),
  purgeHistorify: (days?: number) => openAlgoAdapter.purgeHistorify(days),

  // Strategy Labs
  getMaxPainData: (params: any) => openAlgoAdapter.getMaxPainData(params),
  getStraddleChartData: (params: any) => openAlgoAdapter.getStraddleChartData(params),
  getTelemetry: () => openAlgoAdapter.getTelemetry(),
  getTelemetryPnL: () => openAlgoAdapter.getTelemetryPnL(),
  getTelemetryPerformance: () => openAlgoAdapter.getTelemetryPerformance(),
};
