<script lang="ts">
  import type { BacktestResult } from '$lib/algo-trader-api';

  export let backtests: BacktestResult[] = [];
</script>

<div class="card-panel">
  <div class="section-head">
    <h2>Backtest Results</h2>
    <span>{backtests.length} completed</span>
  </div>
  {#if backtests.length > 0}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Win Rate</th>
            <th>Net PnL</th>
            <th>Max Drawdown</th>
          </tr>
        </thead>
        <tbody>
          {#each backtests as backtest}
            <tr>
              <td>{backtest.strategy_name}</td>
              <td>{backtest.symbol}</td>
              <td>{backtest.total_trades}</td>
              <td>{backtest.win_rate.toFixed(2)}%</td>
              <td>{backtest.net_pnl.toFixed(2)}</td>
              <td>{backtest.max_drawdown.toFixed(2)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p>No backtest results found.</p>
  {/if}
</div>

<style>
  .card-panel {
    margin-top: 1.1rem;
    padding: 1rem;
    border-radius: 24px;
    background: rgba(10, 19, 35, 0.88);
    border: 1px solid rgba(160, 184, 255, 0.1);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.85rem;
  }

  .section-head h2 {
    margin: 0;
  }

  .section-head span {
    color: #8ca6d6;
    font-size: 0.86rem;
  }
  
  .table-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }

  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid rgba(160, 184, 255, 0.1);
  }

  th {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
    color: #8ca6d6;
  }
</style>
