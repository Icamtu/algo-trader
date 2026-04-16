import pandas as pd
import numpy as np
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class PerformanceCalculator:
    """
    Computes institutional performance metrics from trade journals.
    """

    def __init__(self, trade_logs: List[Dict[str, Any]], initial_capital: float = 1000000.0):
        self.trade_logs = trade_logs
        self.initial_capital = initial_capital
        self.df = pd.DataFrame(trade_logs)

    def calculate_metrics(self) -> Dict[str, Any]:
        """
        Returns a comprehensive dictionary of performance stats.
        """
        if self.df.empty:
            return {"status": "error", "message": "No trades to analyze."}

        # 1. Basic P&L
        # Note: This logic assumes closed trades. For backtest logs, we map Buy/Sell pairs.
        # Simple approximation: Sum of (Sell_Amount - Buy_Amount)
        buys = self.df[self.df['action'] == 'BUY']
        sells = self.df[self.df['action'] == 'SELL']

        # Match by symbol (Simplification for now)
        net_profit = 0
        trade_count = len(self.df)

        # Realized P&L logic
        realized_pnl = []
        for symbol in self.df['symbol'].unique():
            sym_df = self.df[self.df['symbol'] == symbol].sort_values('time')
            pos = 0
            cost_basis = 0
            for _, row in sym_df.iterrows():
                if row['action'] == 'BUY':
                    pos += row['quantity']
                    cost_basis += row['quantity'] * row['price']
                else: # SELL
                    if pos > 0:
                        avg_buy_price = cost_basis / pos
                        pnl = (row['price'] - avg_buy_price) * row['quantity']
                        realized_pnl.append(pnl)
                        pos -= row['quantity']
                        cost_basis -= row['quantity'] * avg_buy_price

        total_realized = sum(realized_pnl)
        win_rate = len([p for p in realized_pnl if p > 0]) / len(realized_pnl) if realized_pnl else 0
        profit_factor = sum([p for p in realized_pnl if p > 0]) / abs(sum([p for p in realized_pnl if p < 0])) if len([p for p in realized_pnl if p < 0]) > 0 else float('inf')

        # 2. Equity Curve & Drawdown
        # We simulate equity curve by accumulating realized P&L
        equity = [self.initial_capital]
        current = self.initial_capital
        for p in realized_pnl:
            current += p
            equity.append(current)

        equity_series = pd.Series(equity)
        max_equity = equity_series.cummax()
        drawdowns = (max_equity - equity_series) / max_equity
        max_dd = drawdowns.max()

        # 3. Sharpe & Sortino (Standardized to daily if possible, but here using per-trade)
        returns = pd.Series(realized_pnl) / self.initial_capital
        sharpe = (returns.mean() / returns.std() * np.sqrt(252)) if not returns.empty and returns.std() != 0 else 0

        neg_returns = returns[returns < 0]
        sortino = (returns.mean() / neg_returns.std() * np.sqrt(252)) if not neg_returns.empty and neg_returns.std() != 0 else 0

        return {
            "total_trades": trade_count,
            "closed_trades": len(realized_pnl),
            "net_profit": float(total_realized),
            "net_profit_pct": float((total_realized / self.initial_capital) * 100),
            "win_rate": float(win_rate),
            "profit_factor": float(profit_factor),
            "max_drawdown_pct": float(max_dd * 100),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "equity_curve": equity_series.tolist()
        }
