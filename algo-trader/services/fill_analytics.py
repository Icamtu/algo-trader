import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from database.trade_logger import get_trade_logger, Trade

logger = logging.getLogger(__name__)

class FillAnalyticsService:
    """
    Analyzes slippage and fill quality to optimize execution algorithms.
    """

    def __init__(self):
        self.db_logger = get_trade_logger()

    async def get_fill_quality_report(self, strategy: str = "all", limit: int = 1000) -> Dict[str, Any]:
        """
        Generates a comprehensive report on slippage and fill quality.
        """
        try:
            trades = await self.db_logger.get_all_trades_async(limit=limit)
            if strategy != "all":
                trades = [t for t in trades if t.strategy == strategy]

            if not trades:
                return {"status": "success", "message": "No trades found for analysis", "metrics": {}}

            # Convert to DataFrame for easier analysis
            df = pd.DataFrame([t.to_dict() for t in trades])

            # Filter for trades with requested_price > 0
            df = df[df['requested_price'] > 0]

            if df.empty:
                return {
                    "status": "success",
                    "message": "Slippage tracking was not enabled for these trades",
                    "metrics": {}
                }

            # Calculate absolute and percentage slippage
            # Positive slippage = unfavorable fill (paying more for BUY, getting less for SELL)
            df['slippage_abs'] = np.where(
                df['side'] == 'BUY',
                df['price'] - df['requested_price'],
                df['requested_price'] - df['price']
            )

            df['slippage_pct'] = (df['slippage_abs'] / df['requested_price']) * 100

            # Metrics by strategy
            strategy_metrics = df.groupby('strategy')['slippage_pct'].agg(['mean', 'max', 'count']).to_dict('index')

            # Metrics by symbol
            symbol_metrics = df.groupby('symbol')['slippage_pct'].agg(['mean', 'count']).to_dict('index')

            return {
                "status": "success",
                "metrics": {
                    "avg_slippage_pct": round(df['slippage_pct'].mean(), 4),
                    "max_slippage_pct": round(df['slippage_pct'].max(), 4),
                    "total_trades_analyzed": len(df),
                    "strategy_breakdown": strategy_metrics,
                    "symbol_breakdown": symbol_metrics
                },
                "recent_slippage_events": df.sort_values('slippage_abs', ascending=False).head(10)[['timestamp', 'symbol', 'side', 'slippage_pct']].to_dict('records')
            }

        except Exception as e:
            logger.error(f"Fill quality analysis failed: {e}")
            return {"status": "error", "message": str(e)}

# Singleton
fill_analytics = FillAnalyticsService()
