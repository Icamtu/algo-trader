/**
 * AetherDesk Institutional Indicator Factory
 * Pure JS implementations of standard technical indicators for charting engines.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorResult {
  time: number;
  value?: number;
  values?: Record<string, number>;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: Candle[], period: number = 20): IndicatorResult[] {
  if (data.length < period) return [];
  const results: IndicatorResult[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val.close, 0);
    results.push({
      time: data[i].time,
      value: sum / period
    });
  }

  return results;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: Candle[], period: number = 20): IndicatorResult[] {
  if (data.length < period) return [];
  const results: IndicatorResult[] = [];
  const k = 2 / (period + 1);

  // First EMA is SMA
  let ema = data.slice(0, period).reduce((acc, val) => acc + val.close, 0) / period;
  results.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * k + ema;
    results.push({
      time: data[i].time,
      value: ema
    });
  }

  return results;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: Candle[], period: number = 14): IndicatorResult[] {
  if (data.length < period + 1) return [];
  const results: IndicatorResult[] = [];

  let gains = 0;
  let losses = 0;

  // Initial Average Gain/Loss
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const initialRSI = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));
  results.push({ time: data[period].time, value: initialRSI });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));
    results.push({
      time: data[i].time,
      value: rsi
    });
  }

  return results;
}

/**
 * Bollinger Bands (BB)
 */
export function calculateBB(data: Candle[], period: number = 20, stdDev: number = 2): IndicatorResult[] {
  if (data.length < period) return [];
  const results: IndicatorResult[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const prices = slice.map(c => c.close);
    const sma = prices.reduce((a, b) => a + b, 0) / period;
    const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);

    results.push({
      time: data[i].time,
      values: {
        middle: sma,
        upper: sma + stdDev * sd,
        lower: sma - stdDev * sd
      }
    });
  }

  return results;
}

/**
 * MACD
 */
export function calculateMACD(
  data: Candle[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): IndicatorResult[] {
  if (data.length < slow) return [];

  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);

  // Align fast and slow
  const macdLine: {time: number, value: number}[] = [];
  const slowMap = new Map(emaSlow.map(e => [e.time, e.value!]));

  for (const f of emaFast) {
    const s = slowMap.get(f.time);
    if (s !== undefined) {
      macdLine.push({ time: f.time, value: f.value! - s });
    }
  }

  if (macdLine.length < signal) return [];

  // Signal Line (EMA of MACD Line)
  const k = 2 / (signal + 1);
  let signalVal = macdLine.slice(0, signal).reduce((a, b) => a + b.value, 0) / signal;

  const results: IndicatorResult[] = [];
  results.push({
    time: macdLine[signal - 1].time,
    values: {
      macd: macdLine[signal - 1].value,
      signal: signalVal,
      histogram: macdLine[signal - 1].value - signalVal
    }
  });

  for (let i = signal; i < macdLine.length; i++) {
    signalVal = (macdLine[i].value - signalVal) * k + signalVal;
    results.push({
      time: macdLine[i].time,
      values: {
        macd: macdLine[i].value,
        signal: signalVal,
        histogram: macdLine[i].value - signalVal
      }
    });
  }

  return results;
}
