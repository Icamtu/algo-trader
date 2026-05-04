from typing import Dict, Iterable, List, Optional, Union
import numpy as np
import pandas as pd


def _to_list(values: Iterable[float]) -> List[float]:
    return [float(value) for value in values]


def sma(values: Iterable[float], period: int) -> Optional[float]:
    """Simple moving average for the latest `period` values using NumPy."""
    v = np.array(values, dtype=float)
    if period <= 0 or len(v) < period:
        return None
    return np.mean(v[-period:])


def ema(values: Iterable[float], period: int) -> Optional[float]:
    """Exponential moving average using NumPy/Pandas for speed."""
    v = np.array(values, dtype=float)
    if period <= 0 or len(v) < period:
        return None

    # Use Pandas EWM for highly optimized exponential weighting
    return pd.Series(v).ewm(span=period, adjust=False).mean().iloc[-1]


def rsi(values: Iterable[float], period: int = 14) -> Optional[float]:
    """Relative Strength Index using vectorized NumPy logic."""
    v = np.array(values, dtype=float)
    if period <= 0 or len(v) <= period:
        return None

    deltas = np.diff(v)
    seed = deltas[:period]
    up = seed[seed >= 0].sum() / period
    down = -seed[seed < 0].sum() / period
    rs = up / down if down != 0 else 100

    # Wilder's smoothing
    for d in deltas[period:]:
        u = d if d > 0 else 0
        d_val = -d if d < 0 else 0
        up = (up * (period - 1) + u) / period
        down = (down * (period - 1) + d_val) / period

    if down == 0:
        return 100.0
    rs = up / down
    return 100 - (100 / (1 + rs))


def price_change_pct(values: Iterable[float], lookback: int = 1) -> Optional[float]:
    """Percent change using vectorized pricing."""
    v = np.array(values, dtype=float)
    if lookback <= 0 or len(v) <= lookback:
        return None

    previous_price = v[-(lookback + 1)]
    current_price = v[-1]
    if previous_price == 0:
        return None
    return ((current_price - previous_price) / previous_price) * 100


def highest(values: Iterable[float], period: int) -> Optional[float]:
    series = _to_list(values)
    if period <= 0 or len(series) < period:
        return None
    return max(series[-period:])


def lowest(values: Iterable[float], period: int) -> Optional[float]:
    series = _to_list(values)
    if period <= 0 or len(series) < period:
        return None
    return min(series[-period:])


def crossed_above(previous_fast: float, current_fast: float, previous_slow: float, current_slow: float) -> bool:
    return previous_fast <= previous_slow and current_fast > current_slow


def crossed_below(previous_fast: float, current_fast: float, previous_slow: float, current_slow: float) -> bool:
    return previous_fast >= previous_slow and current_fast < current_slow


def vwap(prices: Iterable[float], volumes: Iterable[float]) -> Optional[float]:
    """Volume Weighted Average Price using vectorized NumPy logic."""
    p = np.array(prices, dtype=float)
    v = np.array(volumes, dtype=float)

    if len(p) == 0 or len(v) != len(p):
        return None

    total_v = np.sum(v)
    if total_v == 0:
        return None

    return np.sum(p * v) / total_v


def bollinger_bands(values: Iterable[float], period: int = 20, num_std: float = 2.0) -> Dict[str, Optional[float]]:
    """Bollinger Bands (Upper, Middle, Lower) using vectorized NumPy logic."""
    v = np.array(values, dtype=float)
    if len(v) < period:
        return {"upper": None, "middle": None, "lower": None}

    window = v[-period:]
    middle = np.mean(window)
    std_dev = np.std(window)

    return {
        "upper": middle + (num_std * std_dev),
        "middle": middle,
        "lower": middle - (num_std * std_dev)
    }


def macd(values: Iterable[float], fast_period: int = 12, slow_period: int = 26, signal_period: int = 9) -> Dict[str, Optional[float]]:
    """Moving Average Convergence Divergence using vectorized Pandas/EWM logic."""
    v = np.array(values, dtype=float)
    # We need enough data to compute the slow EMA, plus enough resulting MACD values for the signal EMA
    if len(v) < (slow_period + signal_period):
        return {"macd": None, "signal": None, "histogram": None}

    s = pd.Series(v)
    fast_ema = s.ewm(span=fast_period, adjust=False).mean()
    slow_ema = s.ewm(span=slow_period, adjust=False).mean()

    macd_series = fast_ema - slow_ema
    signal_series = macd_series.ewm(span=signal_period, adjust=False).mean()
    histogram_series = macd_series - signal_series

    return {
        "macd": macd_series.iloc[-1],
        "signal": signal_series.iloc[-1],
        "histogram": histogram_series.iloc[-1]
    }


def atr(highs: Iterable[float], lows: Iterable[float], closes: Iterable[float], period: int = 14) -> Optional[float]:
    """Average True Range using vectorized NumPy ops."""
    h = np.array(highs, dtype=float)
    l = np.array(lows, dtype=float)
    c = np.array(closes, dtype=float)

    if len(h) < period + 1 or len(l) < period + 1 or len(c) < period + 1:
        return None

    # True Range calculation
    tr1 = h[1:] - l[1:]
    tr2 = np.abs(h[1:] - c[:-1])
    tr3 = np.abs(l[1:] - c[:-1])
    tr = np.maximum(tr1, np.maximum(tr2, tr3))

    if len(tr) < period:
        return None

    return np.mean(tr[-period:])
