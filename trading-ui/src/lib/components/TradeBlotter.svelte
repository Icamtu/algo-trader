<script lang="ts">
  import { fetchTrades, fetchTradesBySymbol, fetchTradesByStrategy, type Trade } from '../algo-trader-api';
  import { onMount } from 'svelte';

  let trades: Trade[] = [];
  let filteredTrades: Trade[] = [];
  let loading = false;
  let selectedSymbol = '';
  let selectedStrategy = '';
  let sortBy: 'timestamp' | 'symbol' | 'pnl' = 'timestamp';
  let sortAsc = false;

  // Load trades on mount
  onMount(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 3000); // Auto-refresh every 3 seconds
    return () => clearInterval(interval);
  });

  async function loadTrades() {
    loading = true;
    trades = await fetchTrades(100, selectedSymbol || undefined, selectedStrategy || undefined);
    applyFiltersAndSort();
    loading = false;
  }

  function applyFiltersAndSort() {
    filteredTrades = [...trades];

    // Sort
    filteredTrades.sort((a, b) => {
      let aVal: any = a.timestamp;
      let bVal: any = b.timestamp;

      if (sortBy === 'symbol') {
        aVal = a.symbol;
        bVal = b.symbol;
      } else if (sortBy === 'pnl') {
        aVal = a.pnl || 0;
        bVal = b.pnl || 0;
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function handleSymbolFilter(e: Event) {
    selectedSymbol = (e.target as HTMLSelectElement).value;
    loadTrades();
  }

  function handleStrategyFilter(e: Event) {
    selectedStrategy = (e.target as HTMLSelectElement).value;
    loadTrades();
  }

  function handleSort(field: 'timestamp' | 'symbol' | 'pnl') {
    if (sortBy === field) {
      sortAsc = !sortAsc;
    } else {
      sortBy = field;
      sortAsc = false;
    }
    applyFiltersAndSort();
  }

  function formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatPrice(price: number | undefined): string {
    if (!price) return '-';
    return price.toFixed(2);
  }

  function formatPnl(pnl: number | undefined): string {
    if (pnl === undefined || pnl === null) return '-';
    return pnl.toFixed(2);
  }

  // Get unique symbols and strategies for filters
  $: uniqueSymbols = [...new Set(trades.map(t => t.symbol))].sort();
  $: uniqueStrategies = [...new Set(trades.map(t => t.strategy))].sort();
</script>

<div class="trade-blotter">
  <div class="header">
    <h2>Trade History</h2>
    <div class="trade-count">
      {filteredTrades.length} / {trades.length} trades
    </div>
  </div>

  <div class="controls">
    <div class="filter-group">
      <label for="symbol-filter">Symbol</label>
      <select id="symbol-filter" value={selectedSymbol} on:change={handleSymbolFilter}>
        <option value="">All Symbols</option>
        {#each uniqueSymbols as symbol}
          <option value={symbol}>{symbol}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="strategy-filter">Strategy</label>
      <select id="strategy-filter" value={selectedStrategy} on:change={handleStrategyFilter}>
        <option value="">All Strategies</option>
        {#each uniqueStrategies as strategy}
          <option value={strategy}>{strategy}</option>
        {/each}
      </select>
    </div>

    {#if loading}
      <div class="loading">Loading...</div>
    {/if}
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th on:click={() => handleSort('timestamp')}>
            Time {sortBy === 'timestamp' ? (sortAsc ? '↑' : '↓') : ''}
          </th>
          <th on:click={() => handleSort('strategy')}>
            Strategy {sortBy === 'strategy' ? (sortAsc ? '↑' : '↓') : ''}
          </th>
          <th on:click={() => handleSort('symbol')}>
            Symbol {sortBy === 'symbol' ? (sortAsc ? '↑' : '↓') : ''}
          </th>
          <th>Side</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Status</th>
          <th on:click={() => handleSort('pnl')}>
            P&L {sortBy === 'pnl' ? (sortAsc ? '↑' : '↓') : ''}
          </th>
        </tr>
      </thead>
      <tbody>
        {#if filteredTrades.length === 0}
          <tr>
            <td colspan="8" class="no-data">No trades yet</td>
          </tr>
        {:else}
          {#each filteredTrades as trade (trade.id || trade.timestamp)}
            <tr>
              <td class="time">{formatTime(trade.timestamp)}</td>
              <td class="strategy">{trade.strategy}</td>
              <td class="symbol">{trade.symbol}</td>
              <td class="side" class:buy={trade.side === 'BUY'} class:sell={trade.side === 'SELL'}>
                {trade.side}
              </td>
              <td class="quantity">{trade.quantity}</td>
              <td class="price">{formatPrice(trade.price)}</td>
              <td class="status" class:filled={trade.status === 'filled'} class:pending={trade.status === 'pending'}
                class:rejected={trade.status === 'rejected'}>
                {trade.status}
              </td>
              <td class="pnl" class:positive={trade.pnl && trade.pnl > 0} class:negative={trade.pnl && trade.pnl < 0}>
                {formatPnl(trade.pnl)}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  .trade-blotter {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(0, 255, 200, 0.2);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1.5rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .header h2 {
    margin: 0;
    color: #00ffc8;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .trade-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: center;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-group label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .filter-group select {
    background: rgba(0, 255, 200, 0.05);
    border: 1px solid rgba(0, 255, 200, 0.3);
    color: #fff;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .filter-group select:hover {
    border-color: rgba(0, 255, 200, 0.5);
  }

  .filter-group select:focus {
    outline: none;
    border-color: #00ffc8;
    box-shadow: 0 0 0 2px rgba(0, 255, 200, 0.1);
  }

  .loading {
    color: #00ffc8;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid rgba(0, 255, 200, 0.1);
    border-radius: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead {
    background: rgba(0, 255, 200, 0.05);
    border-bottom: 2px solid rgba(0, 255, 200, 0.2);
  }

  th {
    padding: 0.75rem;
    text-align: left;
    color: #00ffc8;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  th:hover {
    background: rgba(0, 255, 200, 0.1);
  }

  tbody tr {
    border-bottom: 1px solid rgba(0, 255, 200, 0.05);
    transition: background 0.2s ease;
  }

  tbody tr:hover {
    background: rgba(0, 255, 200, 0.03);
  }

  td {
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .no-data {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding: 2rem !important;
    font-style: italic;
  }

  .time {
    color: rgba(255, 255, 255, 0.7);
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
  }

  .strategy {
    color: #00ffc8;
    font-weight: 500;
  }

  .symbol {
    font-weight: 600;
    color: #00ffc8;
  }

  .side {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    width: fit-content;
  }

  .side.buy {
    background: rgba(0, 255, 0, 0.15);
    color: #00ff00;
  }

  .side.sell {
    background: rgba(255, 0, 0, 0.15);
    color: #ff6b6b;
  }

  .quantity {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .price {
    color: rgba(255, 255, 255, 0.8);
    font-family: 'Courier New', monospace;
  }

  .status {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.85rem;
    font-weight: 500;
    width: fit-content;
  }

  .status.filled {
    background: rgba(0, 255, 0, 0.15);
    color: #00ff00;
  }

  .status.pending {
    background: rgba(255, 180, 0, 0.15);
    color: #ffb400;
  }

  .status.rejected {
    background: rgba(255, 0, 0, 0.15);
    color: #ff6b6b;
  }

  .pnl {
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }

  .pnl.positive {
    color: #00ff00;
  }

  .pnl.negative {
    color: #ff6b6b;
  }

  @media (max-width: 768px) {
    .trade-blotter {
      padding: 0.75rem;
    }

    table {
      font-size: 0.8rem;
    }

    th,
    td {
      padding: 0.5rem 0.25rem;
    }
  }
</style>
