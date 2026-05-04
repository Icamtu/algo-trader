import logging
from typing import Dict, List, Any
from data.historify_db import get_indicator_state

logger = logging.getLogger(__name__)

class RegimeAgent:
    """
    Analyzes market data using a hybrid approach:
    1. Quantitative technical indicators (SMA, ATR) via native DuckDB SQL. [Plain Logic]
    2. Optional LLM-based narrative analysis for deep regime context.
    """

    def __init__(self, provider: str = "ollama"):
        self.provider = provider
        # Default regime
        self.last_regime = "NEUTRAL"
        self.last_metadata = {}

    async def get_market_regime(self, symbol: str, candles: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Determines the current market regime.
        Uses SQL-native indicators for persistence (works on engine restart).

        Logic:
        - Bullish: Price > SMA(20)
        - Bearish: Price < SMA(20)
        - Volatile: ATR / AvgATR > 1.5
        """
        try:
            # 1. Fetch [Plain Logic] state from DuckDB
            # This works even if 'candles' is empty, as it queries history.
            state = get_indicator_state(symbol, interval='TICK')

            if not state:
                # If no SQL data, use the ephemeral candles if provided
                return self._get_ephemeral_quant_fallback(candles)

            last_close = state["last_close"]
            sma = state["sma"]
            atr = state["atr"]
            vol_ratio = state["volatility_ratio"]

            # 2. Categorization [Plain Logic Fallback]
            regime = "NEUTRAL"
            risk_mult = 1.0
            pos_mult = 1.0
            reasoning = f"SQL Index: C={last_close:.2f}, SMA={sma:.2f}, ATR={atr:.2f}."

            if last_close > sma * 1.005:
                regime = "BULLISH"
                pos_mult = 1.15
            elif last_close < sma * 0.995:
                regime = "BEARISH"
                risk_mult = 0.8
                pos_mult = 0.8

            if vol_ratio > 1.4:
                regime = "VOLATILE"
                risk_mult = 0.6
                pos_mult = 0.5
                reasoning += " [High Volatility Spike Detected]"

            # 3. Optional AI Enhancement (Narrative only, doesn't override logic categorization)
            # This is where we plug in the 'Agent' feel without sacrificing reliability.
            # (Omitted logic for now to keep the code-first focus, but can be added if needed)

            return {
                "regime": regime,
                "risk_mult": risk_mult,
                "pos_mult": pos_mult,
                "reasoning": reasoning,
                "source": "sql_native_quant"
            }

        except Exception:
            logger.error("Regime Agent SQL Error", exc_info=True)
            return self._get_ephemeral_quant_fallback(candles)

    def _get_ephemeral_quant_fallback(self, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Fallback logic if DuckDB is empty or failing."""
        if not candles or len(candles) < 20:
             return {"regime": "NEUTRAL", "risk_mult": 1.0, "pos_mult": 1.0, "reasoning": "Insufficent history."}

        closes = [c['close'] for c in candles]
        last_close = closes[-1]
        sma = sum(closes[-20:]) / 20

        regime = "BULLISH" if last_close > sma else "BEARISH"
        return {
            "regime": regime,
            "risk_mult": 1.0 if regime == "BULLISH" else 0.8,
            "pos_mult": 1.0,
            "reasoning": "Ephemeral Quant Fallback (Pandas-Lite)"
        }
