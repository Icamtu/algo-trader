import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from services.historify_service import historify_service

logger = logging.getLogger(__name__)

class CorrelationEngine:
    """
    Analyzes correlations between assets and signals across different timeframes.
    Essential for trend confirmation and portfolio diversification.
    """

    def __init__(self):
        pass

    async def get_asset_correlation_matrix(
        self,
        symbols: List[str],
        interval: str = "D",
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculates a correlation matrix for a list of symbols based on historical returns.
        """
        if not symbols:
            return {"status": "error", "message": "No symbols provided"}

        try:
            symbol_returns = {}
            for symbol in symbols:
                records = historify_service.get_records(symbol, interval=interval, limit=days+1)
                if not records or len(records) < 5:
                    continue

                df = pd.DataFrame(records)
                df['returns'] = df['close'].pct_change().fillna(0)
                # Use 'time' as index for alignment
                symbol_returns[symbol] = df.set_index('time')['returns']

            if not symbol_returns:
                return {"status": "error", "message": "Insufficient data for correlation analysis"}

            returns_df = pd.DataFrame(symbol_returns).dropna()
            if returns_df.empty:
                 return {"status": "error", "message": "No overlapping date range found for symbols"}

            corr_matrix = returns_df.corr()

            return {
                "status": "success",
                "matrix": corr_matrix.to_dict(),
                "symbols": list(corr_matrix.columns),
                "data_points": len(returns_df)
            }

        except Exception:
            logger.error("Asset correlation calculation failed", exc_info=True)
            return {"status": "error", "message": "Internal service error"}

    def analyze_signal_convergence(self, multi_tf_signals: Dict[str, str]) -> Dict[str, Any]:
        """
        Determines the strength of a signal by analyzing convergence across timeframes.
        Example multi_tf_signals: {"1m": "BUY", "5m": "BUY", "15m": "NEUTRAL"}
        """
        if not multi_tf_signals:
            return {"status": "error", "message": "No signals provided"}

        buy_count = sum(1 for s in multi_tf_signals.values() if s == "BUY")
        sell_count = sum(1 for s in multi_tf_signals.values() if s == "SELL")
        total = len(multi_tf_signals)

        convergence_score = 0
        consensus = "NEUTRAL"

        if buy_count > sell_count:
            convergence_score = buy_count / total
            consensus = "BUY" if convergence_score > 0.6 else "WEAK_BUY"
        elif sell_count > buy_count:
            convergence_score = sell_count / total
            consensus = "SELL" if convergence_score > 0.6 else "WEAK_SELL"

        return {
            "status": "success",
            "consensus": consensus,
            "convergence_score": round(convergence_score, 2),
            "breakdown": multi_tf_signals
        }

# Singleton
correlation_engine = CorrelationEngine()
