<script lang="ts">
  import { createChart, type IChartApi, type ISeriesApi, LineSeries } from 'lightweight-charts';
  import { onMount } from 'svelte';
  import type { PricePoint } from '$lib/types';

  export let data: PricePoint[] = [];
  export let title = 'Market Pulse';

  let container: HTMLDivElement;
  let chart: IChartApi | undefined;
  let series: ISeriesApi<'Line'> | undefined;

  function drawChart() {
    if (!container) {
      return;
    }

    chart?.remove();
    chart = createChart(container, {
      layout: {
        background: { color: '#08111f' },
        textColor: '#d9e4ff'
      },
      grid: {
        vertLines: { color: 'rgba(150, 178, 255, 0.08)' },
        horzLines: { color: 'rgba(150, 178, 255, 0.08)' }
      },
      rightPriceScale: {
        borderColor: 'rgba(150, 178, 255, 0.15)'
      },
      timeScale: {
        borderColor: 'rgba(150, 178, 255, 0.15)',
        timeVisible: true
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.15)' },
        horzLine: { color: 'rgba(255,255,255,0.15)' }
      },
      autoSize: true
    });

    series = chart.addSeries(LineSeries, {
      color: '#6cf0b0',
      lineWidth: 3,
      priceLineColor: '#f5d266',
      lastValueVisible: true
    });
    series.setData(data);
  }

  onMount(() => {
    drawChart();
    const resizeObserver = new ResizeObserver(() => drawChart());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      chart?.remove();
    };
  });

  $: if (series) {
    series.setData(data);
    chart?.timeScale().fitContent();
  }

  $: if (container && !chart) {
    drawChart();
  }
</script>

<section class="chart-shell">
  <div class="chart-header">
    <div>
      <p class="eyebrow">Live Chart</p>
      <h3>{title}</h3>
    </div>
  </div>
  <div class="chart-frame" bind:this={container}></div>
</section>

<style>
  .chart-shell {
    background: linear-gradient(180deg, rgba(10, 18, 32, 0.96), rgba(12, 22, 40, 0.88));
    border: 1px solid rgba(162, 186, 255, 0.12);
    border-radius: 26px;
    padding: 1rem;
    box-shadow: 0 26px 60px rgba(3, 9, 20, 0.35);
  }

  .chart-header h3 {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8fa8d7;
    font-size: 0.72rem;
  }

  .chart-frame {
    height: 360px;
    margin-top: 0.9rem;
  }
</style>
