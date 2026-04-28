import { apiClient, webClient } from './services/client';

export class OpenAlgoAdapter {
  // Trading Operations
  async getOrderBook(apiKey: string) {
    const response = await apiClient.post('/orderbook', { apikey: apiKey });
    return response.data;
  }

  async getTradeBook(apiKey: string) {
    const response = await apiClient.post('/tradebook', { apikey: apiKey });
    return response.data;
  }

  async getPositionBook(apiKey: string) {
    const response = await apiClient.post('/positionbook', { apikey: apiKey });
    return response.data;
  }

  async getHoldings(apiKey: string) {
    const response = await apiClient.post('/holdings', { apikey: apiKey });
    return response.data;
  }

  async placeOrder(payload: any) {
    const response = await apiClient.post('/placeorder', payload);
    return response.data;
  }

  async cancelOrder(orderId: string) {
    // webClient for session-based routes
    const response = await webClient.post('/cancel_order', { orderid: orderId });
    return response.data;
  }

  async closePosition(symbol: string, exchange: string, product: string) {
    const payload = { symbol, exchange, product };
    const response = await webClient.post('/close_position', payload);
    return response.data;
  }

  // Market Data
  async getQuotes(apiKey: string, symbol: string, exchange: string) {
    const response = await apiClient.post('/quotes', { apikey: apiKey, symbol, exchange });
    return response.data;
  }

  async getMultiQuotes(apiKey: string, symbols: Array<{ symbol: string; exchange: string }>) {
    const response = await apiClient.post('/multiquotes', { apikey: apiKey, symbols });
    return response.data;
  }

  // Monitoring
  async getSystemLogs(page: number = 1, searchQuery: string = "") {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (searchQuery) params.append('search', searchQuery);

    // Redirect to the unified telemetry endpoint
    const response = await webClient.get(`/api/v1/telemetry?${params.toString()}`);
    return response.data;
  }

  // Configuration & Connectivity
  async getApiKey() {
    const response = await webClient.get('/apikey');
    return response.data;
  }

  async regenerateApiKey() {
    const response = await webClient.post('/apikey');
    return response.data;
  }

  async setOrderMode(mode: 'auto' | 'semi_auto') {
    const response = await webClient.post('/apikey/mode', { mode });
    return response.data;
  }

  async getBrokerConfig() {
    const response = await webClient.get('/auth/broker-config');
    return response.data;
  }

  // Master Contract & Cache
  async getMasterContractStatus() {
    const response = await webClient.get('/api/master-contract/smart-status');
    return response.data;
  }

  async downloadMasterContract(force: boolean = false) {
    const response = await webClient.post('/api/master-contract/download', { force });
    return response.data;
  }

  async getCacheHealth() {
    const response = await webClient.get('/api/cache/health');
    return response.data;
  }

  async reloadCache() {
    const response = await webClient.post('/api/cache/reload');
    return response.data;
  }

  // Sandbox
  async getSandboxConfigs() {
    const response = await webClient.get('/sandbox/api/configs');
    return response.data;
  }

  async updateSandboxConfig(key: string, value: any) {
    const response = await webClient.post('/sandbox/update', { config_key: key, config_value: value });
    return response.data;
  }

  async resetSandbox() {
    const response = await webClient.post('/sandbox/reset');
    return response.data;
  }

  async getSandboxPnLData() {
    const response = await webClient.get('/sandbox/mypnl/api/data');
    return response.data;
  }

  // Analyzer
  async getAnalyzerData(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await webClient.get(`/analyzer/api/data?${params.toString()}`);
    return response.data;
  }

  // Action Center
  async getActionCenterData(status?: string) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    const response = await webClient.get(`/api/v1/actioncenter?${params.toString()}`);
    return response.data;
  }

  async approveActionCenterOrder(id: string | number) {
    const response = await webClient.post(`/action-center/approve/${id}`, {});
    return response.data;
  }

  async rejectActionCenterOrder(id: string | number, reason: string = 'Rejected by user') {
    const response = await webClient.post(`/action-center/reject/${id}`, { reason });
    return response.data;
  }

  async deleteActionCenterOrder(id: string | number) {
    const response = await webClient.delete(`/action-center/delete/${id}`);
    return response.data;
  }

  async retryActionCenterOrder(id: string | number) {
    const response = await webClient.post('/api/v1/actioncenter/retry', { id });
    return response.data;
  }

  async approveAllActionCenterOrders() {
    const response = await webClient.post('/action-center/approve', { batch: 'all' });
    return response.data;
  }

  async approveSelectedActionCenterOrders(ids: (string | number)[]) {
    const response = await webClient.post('/api/v1/actioncenter/approve', { ids });
    return response.data;
  }

  async rejectSelectedActionCenterOrders(ids: (string | number)[], reason: string = 'Bulk rejection') {
    const response = await webClient.post('/api/v1/actioncenter/reject', { ids, reason });
    return response.data;
  }

  async cancelAllActionOrders() {
    const response = await webClient.delete('/api/v1/actioncenter/orders/all');
    return response.data;
  }

  // Strategy Management
  async getAllStrategiesStatus() {
    const response = await webClient.get('/api/v1/strategies/status');
    return response.data;
  }

  async haltStrategy(strategy: string) {
    const response = await webClient.post('/api/v1/strategies/halt', { strategy });
    return response.data;
  }

  async unhaltStrategy(strategy: string) {
    const response = await webClient.post('/api/v1/strategies/unhalt', { strategy });
    return response.data;
  }

  async initializeStrategy(strategy: string) {
    const response = await webClient.post('/api/v1/strategies/initialize', { strategy });
    return response.data;
  }

  async liquidateStrategy(strategy: string) {
    const response = await webClient.post('/api/v1/strategies/liquidate', { strategy });
    return response.data;
  }

  async getStrategySafeguards(strategy_id: string) {
    const response = await webClient.get(`/api/v1/strategies/safeguards/${strategy_id}`);
    return response.data;
  }

  async updateStrategySafeguards(strategy_id: string, safeguards: any) {
    const response = await webClient.post(`/api/v1/strategies/safeguards/${strategy_id}`, safeguards);
    return response.data;
  }

  // OI Profile
  async getOIProfileData(params: { underlying: string; exchange: string; expiry_date: string; interval: string; days: number }) {
    const response = await webClient.post('/oiprofile/api/profile-data', params);
    return response.data;
  }

  async getOIIntervals() {
    const response = await webClient.get('/oiprofile/api/intervals');
    return response.data;
  }

  async getUnderlyings(exchange: string) {
    const response = await webClient.get(`/search/api/underlyings?exchange=${exchange}`);
    return response.data;
  }

  async getExpiries(exchange: string, underlying: string) {
    const response = await webClient.get(`/search/api/expiries?exchange=${exchange}&underlying=${underlying}`);
    return response.data;
  }

  // GEX
  async getGEXData(params: { underlying: string; exchange: string; expiry_date: string }) {
    const response = await webClient.post('/gex/api/gex-data', params);
    return response.data;
  }

  // Health
  async getCurrentHealthMetrics() {
    const response = await webClient.get('/health/api/current');
    return response.data;
  }

  async getHealthMetricsHistory(hours: number = 24) {
    const response = await webClient.get('/health/api/history', { params: { hours } });
    return response.data;
  }

  async getHealthStats(hours: number = 24) {
    const response = await webClient.get('/health/api/stats', { params: { hours } });
    return response.data;
  }

  async acknowledgeHealthAlert(alertId: number) {
    const response = await webClient.post(`/health/api/alerts/${alertId}/acknowledge`);
    return response.data;
  }

  async getHealthAlerts() {
    const response = await webClient.get('/health/api/alerts');
    return response.data;
  }

  // Playground
  async getPlaygroundEndpoints() {
    const response = await webClient.get('/playground/endpoints');
    return response.data;
  }

  async getPlaygroundApiKey() {
    const response = await webClient.get('/playground/api-key');
    return response.data;
  }

  // OI Tracker
  async getOIData(params: { underlying: string; exchange: string; expiry_date: string }) {
    const response = await webClient.get('/oi-tracker/api/data', { params });
    return response.data;
  }

  // Volatility
  async getVolSurfaceData(params: { underlying: string; exchange: string; expiry_dates: string[]; strike_count: number }) {
    const response = await webClient.post('/vol-surface/api/surface-data', params);
    return response.data;
  }

  async getIVSmileData(params: { underlying: string; exchange: string; expiry_dates: string[] }) {
    const response = await webClient.post('/iv-smile/api/smile-data', params);
    return response.data;
  }

  async getIVChartData(params: { underlying: string; exchange: string; expiry_date: string; days: number }) {
    const response = await webClient.get('/iv-chart/api/chart-data', { params });
    return response.data;
  }

  // Historify
  async getHistorifyWatchlist() {
    const response = await webClient.get('/api/v1/historify/watchlist');
    return response.data;
  }

  async getHistorifyCatalog(interval: string = '5m') {
    const response = await webClient.get('/api/v1/historify/catalog', { params: { interval } });
    return response.data;
  }

  async deleteCatalogEntry(symbol: string, exchange: string = 'NSE', interval: string = '5m') {
    const response = await webClient.delete('/api/v1/historify/catalog', { data: { symbol, exchange, interval } });
    return response.data;
  }

  async getHistorifyJobs(limit: number = 50) {
    const response = await webClient.get('/api/v1/historify/jobs', { params: { limit } });
    return response.data;
  }

  async getHistorifySchedules() {
    const response = await webClient.get('/api/v1/historify/schedules');
    return response.data;
  }

  async updateHistorifyWatchlist(action: 'add' | 'remove', exchange: string, symbol?: string, symbols?: string[]) {
    const response = await webClient.post('/api/v1/historify/watchlist', { action, exchange, symbol, symbols });
    return response.data;
  }

  async getHistorifyRecords(symbol: string, exchange: string = 'NSE', interval: string = '5m', limit: number = 1000) {
    const response = await webClient.get('/api/v1/historify/records', { params: { symbol, exchange, interval, limit } });
    return response.data;
  }

  async getHistorifyBreadth(interval: string = '5m') {
    const response = await webClient.get('/api/v1/historify/breadth', { params: { interval } });
    return response.data;
  }

  async runHistorify(payload: { symbol?: string; symbols?: string[]; exchange: string; from_date: string; to_date: string; interval: string; is_incremental?: boolean; operator?: string }) {
    const response = await webClient.post('/api/v1/historify/run-historify', payload);
    return response.data;
  }

  async cancelHistorifyJob(jobId: string) {
    const response = await webClient.delete(`/api/v1/historify/jobs/${jobId}`);
    return response.data;
  }

  async exportHistorifyData(symbol: string, exchange: string = 'NSE', interval: string = '5m', limit: number = 50000) {
    const response = await webClient.get('/api/v1/historify/export', { params: { symbol, exchange, interval, limit } });
    return response.data;
  }

  async seedHistorify() {
    const response = await webClient.post('/api/v1/historify/seed');
    return response.data;
  }

  async getHistorifyStats() {
    const response = await webClient.get('/api/v1/historify/stats');
    return response.data;
  }

  async compactHistorify() {
    const response = await webClient.post('/api/v1/historify/maintenance/compact');
    return response.data;
  }

  async purgeHistorify(days: number = 30) {
    const response = await webClient.post('/api/v1/historify/maintenance/purge', { days });
    return response.data;
  }

  // Strategy Labs
  async getMaxPainData(params: { underlying: string; exchange: string; expiry_date: string }) {
    const response = await webClient.get('/maxpain/api/data', { params });
    return response.data;
  }

  async getStraddleChartData(params: { underlying: string; exchange: string; expiry_date: string; days: number }) {
    const response = await webClient.get('/straddle-chart/api/data', { params });
    return response.data;
  }

  // Aether Unified Telemetry
  async getTelemetry() {
    const response = await webClient.get('/api/v1/telemetry');
    return response.data;
  }

  async getTelemetryPnL() {
    const response = await webClient.get('/api/v1/telemetry/pnl');
    return response.data;
  }

  async getTelemetryPerformance() {
    const response = await webClient.get('/api/v1/telemetry/performance');
    return response.data;
  }
}

export const openAlgoAdapter = new OpenAlgoAdapter();
