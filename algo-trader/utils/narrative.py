# algo-trader/utils/narrative.py
import pandas as pd
from typing import Dict, Any, List

def generate_sector_narrative(symbol: str, candles: List[Dict[str, Any]]) -> str:
    """
    Converts raw candle data into a narrative summary for AI sentiment analysis.

    Returns:
        str: A human-readable summary of price action and technical state.
    """
    if not candles or len(candles) < 10:
        return f"{symbol} context is insufficient for deep narrative generation."

    try:
        df = pd.DataFrame(candles)
        last_price = df['close'].iloc[-1]

        # Calculate returns
        start_price = df['close'].iloc[0]
        total_ret = ((last_price - start_price) / start_price) * 100

        # Short-term momentum (last 5 units)
        st_start = df['close'].iloc[-min(5, len(df))]
        st_ret = ((last_price - st_start) / st_start) * 100

        # SMAs
        sma20 = df['close'].rolling(window=min(20, len(df))).mean().iloc[-1]

        # Volatility / ATR proxy
        hi_lo_avg = (df['high'] - df['low']).mean()
        last_hi_lo = df['high'].iloc[-1] - df['low'].iloc[-1]
        vol_status = "expanding" if last_hi_lo > hi_lo_avg * 1.2 else "stable"

        # Trend classification
        if last_price > sma20 * 1.01:
            bias = "Bullish momentum"
        elif last_price < sma20 * 0.99:
            bias = "Bearish distribution"
        else:
            bias = "Consolidating/Neutral"

        narrative = (
            f"The {symbol} index is currently in a {bias} phase. "
            f"LTP is {last_price:.2f}, showing a {total_ret:+.2f}% change over the session. "
            f"Short-term momentum is {st_ret:+.2f}%. "
            f"Technically, the index is {'above' if last_price > sma20 else 'below'} its 20-unit average. "
            f"Intraday volatility appears to be {vol_status}."
        )

        return narrative

    except Exception as e:
        return f"Narrative generation failed for {symbol}: {str(e)}"

def get_macro_placeholder() -> str:
    """
    Stub for future integration of news/FII data.
    """
    return "Institutional flows appearing balanced; global cues remain steady."
