import React, { useMemo } from 'react';
import EchartsReact from 'echarts-for-react';
import { ChartCandle } from '@/hooks/useChartData';

interface EChartsKLineProps {
  data: ChartCandle[];
  chartStyle?: 'candle' | 'heikin-ashi' | 'area' | 'bar' | 'renko';
  showVolume?: boolean;
}

const computeHeikinAshi = (data: ChartCandle[]): ChartCandle[] => {
  if (data.length === 0) return [];

  return data.map((candle, idx) => {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open = idx === 0 ? candle.open : (data[idx - 1].open + data[idx - 1].close) / 2;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);

    return { time: candle.time, open, high, low, close, volume: candle.volume };
  });
};

export const EChartsKLine: React.FC<EChartsKLineProps> = ({
  data,
  chartStyle = 'candle',
  showVolume = true,
}) => {
  const chartData = useMemo(() => {
    const processedData = chartStyle === 'heikin-ashi' ? computeHeikinAshi(data) : data;

    const times = processedData.map(c => {
      const date = new Date(c.time * 1000);
      return date.toLocaleString('en-US', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    });

    const klineData = processedData.map(c => [c.open, c.close, c.low, c.high]);
    const volumeData = processedData.map((c, idx) => ({
      value: c.volume || 0,
      itemStyle: { color: c.close >= c.open ? '#26a69a' : '#ef5350' }
    }));

    return { times, klineData, volumeData };
  }, [data, chartStyle]);

  const option = useMemo(() => {
    const grids = showVolume
      ? [
          { left: '10%', right: '8%', top: '10%', height: '70%' },
          { left: '10%', right: '8%', top: '82%', height: '12%' }
        ]
      : [{ left: '10%', right: '8%', top: '10%', height: '75%' }];

    const xAxisConfigs = showVolume
      ? [
          {
            gridIndex: 0,
            type: 'category',
            data: chartData.times,
            boundaryGap: false,
            axisLabel: { show: false },
            axisTick: { show: false },
            min: 'dataMin',
            max: 'dataMax'
          },
          {
            gridIndex: 1,
            type: 'category',
            data: chartData.times,
            boundaryGap: false,
            axisLabel: {
              show: true,
              fontSize: 9,
              color: '#555555',
              hideOverlap: true,
              interval: 'auto'
            },
            min: 'dataMin',
            max: 'dataMax'
          }
        ]
      : [
          {
            gridIndex: 0,
            type: 'category',
            data: chartData.times,
            boundaryGap: false,
            axisLabel: {
              show: true,
              fontSize: 9,
              color: '#555555',
              hideOverlap: true,
              interval: 'auto'
            },
            min: 'dataMin',
            max: 'dataMax'
          }
        ];

    const yAxisConfigs = showVolume
      ? [
          { gridIndex: 0, type: 'value', scale: true, splitLine: { show: true } },
          { gridIndex: 1, type: 'value', scale: true, splitLine: { show: false } }
        ]
      : [
          { gridIndex: 0, type: 'value', scale: true, splitLine: { show: true } }
        ];

    const series: any[] = [
      {
        xAxisIndex: 0,
        yAxisIndex: 0,
        type: chartStyle === 'area' ? 'line' : 'candlestick',
        data: chartData.klineData,
        itemStyle: {
          color: '#26a69a',
          color0: '#ef5350',
          borderColor: '#26a69a',
          borderColor0: '#ef5350'
        },
        markPoint: { data: [{ type: 'max', name: 'High' }, { type: 'min', name: 'Low' }] }
      }
    ];

    if (showVolume) {
      series.push({
        xAxisIndex: 1,
        yAxisIndex: 1,
        type: 'bar',
        data: chartData.volumeData,
        itemStyle: { opacity: 0.7 }
      });
    }

    return {
      animation: false,
      backgroundColor: 'transparent',
      textStyle: { color: '#888888', fontFamily: 'IBM Plex Mono, monospace' },
      grid: grids,
      xAxis: xAxisConfigs,
      yAxis: yAxisConfigs,
      dataZoom: [
        { type: 'inside', start: 80, end: 100 },
        { type: 'slider', show: false, start: 80, end: 100 }
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(10, 10, 10, 0.8)',
        borderColor: '#00F5FF',
        textStyle: { color: '#d1d4dc' }
      },
      series
    };
  }, [chartData, chartStyle, showVolume]);

  return <EchartsReact option={option} style={{ width: '100%', height: '100%' }} />;
};
