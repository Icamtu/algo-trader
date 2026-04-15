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
    const response = await webClient.get(`/api/v1/system/telemetry?${params.toString()}`);
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

  async approveActionCenterOrder(id: number) {
    const response = await webClient.post(`/action-center/approve/${id}`, {});
    return response.data;
  }

  async rejectActionCenterOrder(id: number, reason: string = 'Rejected by user') {
    const response = await webClient.post(`/action-center/reject/${id}`, { reason });
    return response.data;
  }

  async deleteActionCenterOrder(id: number) {
    const response = await webClient.delete(`/action-center/delete/${id}`);
    return response.data;
  }

  async approveAllActionCenterOrders() {
    const response = await webClient.post('/action-center/approve-all', {});
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
    const response = await webClient.get('/historify/api/watchlist');
    return response.data;
  }

  async getHistorifyCatalog() {
    const response = await webClient.get('/historify/api/catalog');
    return response.data;
  }

  async getHistorifyJobs(limit: number = 50) {
    const response = await webClient.get('/historify/api/jobs', { params: { limit } });
    return response.data;
  }

  async getHistorifySchedules() {
    const response = await webClient.get('/historify/api/schedules');
    return response.data;
  }

  async updateHistorifyWatchlist(action: 'add' | 'remove', exchange: string, symbol: string) {
    const response = await webClient.post('/historify/api/watchlist', { action, exchange, symbol });
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
}

export const openAlgoAdapter = new OpenAlgoAdapter();
