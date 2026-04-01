<script lang="ts">
  import type { Strategy } from '$lib/algo-trader-api';

  export let strategy: Strategy;
  export let selected = false;
  export let onStart: (() => void) | undefined = undefined;
  export let onStop: (() => void) | undefined = undefined;
  export let isStarting = false;
  export let isStopping = false;

  const signalTone = {
    BUY: 'buy',
    SELL: 'sell',
    HOLD: 'hold'
  };

  const modeIcon = {
    'Scalping': '⚡',
    'Trend Capture': '📈',
    'Position': '🎯',
    'Custom': '⚙️'
  };
</script>

<article class:selected class="card">
  <div class="top-row">
    <div>
      <p class="mode">{modeIcon[strategy.mode as keyof typeof modeIcon] || '📊'} {strategy.mode}</p>
      <h3>{strategy.name}</h3>
      <p class="description">{strategy.description}</p>
    </div>
    <div class="status-badge">
      <span class={`status ${strategy.is_active ? 'active' : 'inactive'}`}>
        {strategy.is_active ? '▶' : '⏸'}
      </span>
    </div>
  </div>

  <div class="stats">
    <div>
      <span class="label">Symbols</span>
      <strong>{strategy.symbols.join(', ')}</strong>
    </div>
    <div>
      <span class="label">Status</span>
      <strong class={strategy.is_active ? 'running' : 'stopped'}>
        {strategy.is_active ? 'Running' : 'Stopped'}
      </strong>
    </div>
  </div>

  <div class="actions">
    {#if strategy.is_active}
      <button
        class="btn btn-stop"
        disabled={isStopping}
        on:click={() => onStop?.()}
      >
        {isStopping ? 'Stopping...' : 'Stop'}
      </button>
    {:else}
      <button
        class="btn btn-start"
        disabled={isStarting}
        on:click={() => onStart?.()}
      >
        {isStarting ? 'Starting...' : 'Start'}
      </button>
    {/if}
  </div>
</article>

<style>
  .card {
    padding: 1rem;
    border-radius: 22px;
    background: rgba(12, 20, 36, 0.85);
    border: 1px solid rgba(162, 186, 255, 0.1);
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .card:hover,
  .selected {
    transform: translateY(-2px);
    border-color: rgba(114, 164, 255, 0.4);
    box-shadow: 0 18px 34px rgba(3, 8, 17, 0.3);
  }

  .top-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .status-badge {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status {
    font-size: 1.5rem;
    display: inline-block;
  }

  .status.active {
    color: #84efb4;
    animation: pulse 2s infinite;
  }

  .status.inactive {
    color: #ff8c42;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .mode,
  .label {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
    color: #8ba6d6;
  }

  h3 {
    margin: 0.4rem 0 0.2rem;
  }

  .description {
    margin: 0;
    color: #a8badf;
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  .stats > div {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stats strong {
    color: #f7fbff;
    font-weight: 600;
  }

  .stats strong.running {
    color: #84efb4;
  }

  .stats strong.stopped {
    color: #ff8c42;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1rem;
  }

  .btn {
    flex: 1;
    padding: 0.6rem;
    border: none;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms ease;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-start {
    background: rgba(80, 214, 152, 0.2);
    color: #84efb4;
    border: 1px solid rgba(80, 214, 152, 0.4);
  }

  .btn-start:hover:not(:disabled) {
    background: rgba(80, 214, 152, 0.35);
    border-color: #84efb4;
  }

  .btn-stop {
    background: rgba(255, 106, 106, 0.2);
    color: #ff6a6a;
    border: 1px solid rgba(255, 106, 106, 0.4);
  }

  .btn-stop:hover:not(:disabled) {
    background: rgba(255, 106, 106, 0.35);
    border-color: #ff6a6a;
  }
</style>
