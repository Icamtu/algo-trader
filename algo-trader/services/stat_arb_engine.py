import logging
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.stattools import coint
from typing import List, Dict, Any, Optional, Tuple
from services.historify_service import historify_service

logger = logging.getLogger(__name__)

class StatArbEngine:
    """
    Advanced Statistical Arbitrage Engine.
    Handles cointegration analysis, z-score calculations, and pairs discovery.
    """

    def __init__(self):
        pass

    async def get_aligned_data(self, symbol1: str, symbol2: str, interval: str, limit: int) -> Optional[pd.DataFrame]:
        """Fetch and align price data for two symbols."""
        try:
            r1 = historify_service.get_records(symbol1, interval=interval, limit=limit)
            r2 = historify_service.get_records(symbol2, interval=interval, limit=limit)

            if not r1 or not r2:
                return None

            df1 = pd.DataFrame(r1).set_index('time')[['close']].rename(columns={'close': symbol1})
            df2 = pd.DataFrame(r2).set_index('time')[['close']].rename(columns={'close': symbol2})

            # Inner join to ensure alignment
            df = df1.join(df2, how='inner').dropna()
            return df
        except Exception:
            logger.error("Data alignment failed for %s-%s", symbol1, symbol2, exc_info=True)
            return None

    async def check_cointegration(self, symbol1: str, symbol2: str, interval: str = "1h", limit: int = 500) -> Dict[str, Any]:
        """
        Runs the Engle-Granger cointegration test.
        Returns p-value and cointegration status.
        """
        df = await self.get_aligned_data(symbol1, symbol2, interval, limit)
        if df is None or len(df) < 50:
            return {"status": "error", "message": "Insufficient data for cointegration test"}

        try:
            # coint() returns (t-statistic, p-value, critical_values)
            score, pvalue, _ = coint(df[symbol1], df[symbol2])

            # Calculate hedge ratio (beta) via OLS
            y = df[symbol1]
            x = sm.add_constant(df[symbol2])
            model = sm.OLS(y, x).fit()
            beta = model.params[symbol2]
            alpha = model.params['const']

            is_cointegrated = pvalue < 0.05

            return {
                "status": "success",
                "symbol1": symbol1,
                "symbol2": symbol2,
                "p_value": round(pvalue, 4),
                "is_cointegrated": is_cointegrated,
                "hedge_ratio": round(beta, 4),
                "alpha": round(alpha, 4),
                "data_points": len(df)
            }
        except Exception:
            logger.error("Cointegration test failed for %s-%s", symbol1, symbol2, exc_info=True)
            return {"status": "error", "message": "Internal service error"}

    async def calculate_current_zscore(self, symbol1: str, symbol2: str, window: int = 20, interval: str = "1h") -> Dict[str, Any]:
        """
        Calculates the current Z-score of the spread for two symbols.
        """
        # Fetch enough data for the window + hedge ratio estimation
        df = await self.get_aligned_data(symbol1, symbol2, interval, limit=window * 5)
        if df is None or len(df) < window:
            return {"status": "error", "message": "Insufficient data for Z-score"}

        try:
            # Re-estimate hedge ratio over the lookback window
            y = df[symbol1]
            x = sm.add_constant(df[symbol2])
            model = sm.OLS(y, x).fit()
            beta = model.params[symbol2]

            # Spread = Symbol1 - (Beta * Symbol2)
            df['spread'] = df[symbol1] - (beta * df[symbol2])

            # Z-Score calculation
            mean = df['spread'].rolling(window=window).mean()
            std = df['spread'].rolling(window=window).std()
            df['zscore'] = (df['spread'] - mean) / std

            current_z = df['zscore'].iloc[-1]

            return {
                "status": "success",
                "symbol1": symbol1,
                "symbol2": symbol2,
                "zscore": round(current_z, 4),
                "hedge_ratio": round(beta, 4),
                "last_price1": df[symbol1].iloc[-1],
                "last_price2": df[symbol2].iloc[-1]
            }
        except Exception:
            logger.error("Z-score calculation failed for %s-%s", symbol1, symbol2, exc_info=True)
            return {"status": "error", "message": "Internal service error"}

    async def scan_market_for_pairs(self, universe: List[str], interval: str = "1h") -> Dict[str, Any]:
        """
        Scans a list of symbols for potentially cointegrated pairs.
        Caution: This can be compute intensive (O(N^2)).
        """
        pairs = []
        n = len(universe)
        logger.info("Scanning %s symbols for cointegrated pairs...", n)

        for i in range(n):
            for j in range(i + 1, n):
                s1, s2 = universe[i], universe[j]
                res = await self.check_cointegration(s1, s2, interval=interval)
                if res.get("status") == "success" and res.get("is_cointegrated"):
                    pairs.append(res)

        # Sort by best p-value
        pairs.sort(key=lambda x: x['p_value'])

        return {
            "status": "success",
            "pairs_found": len(pairs),
            "results": pairs
        }

# Singleton
stat_arb_engine = StatArbEngine()
