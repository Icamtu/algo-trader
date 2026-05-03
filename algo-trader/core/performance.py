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

    def __init__(self, trade_logs: List[Dict[str, Any]], initial_capital: float = 1000000.0, price_history: Dict[float, Dict[str, float]] = None, benchmark_symbol: str = "NIFTY 50"):
        self.trade_logs = trade_logs
        self.initial_capital = initial_capital
        self.price_history = price_history or {} # {timestamp: {symbol: price}}
        self.benchmark_symbol = benchmark_symbol
        cleaned_logs = []
        for t in trade_logs:
            # Handle both dicts and objects with as_dict/to_dict methods
            t_dict = {}
            if isinstance(t, dict):
                t_dict = t
            elif hasattr(t, 'as_dict'):
                t_dict = t.as_dict()
            elif hasattr(t, 'to_dict'):
                t_dict = t.to_dict()

            if t_dict:
                # Flatten only primitive types to avoid pandas 2.2+ "Mixing dicts with non-Series" error
                cleaned_t = {k: v for k, v in t_dict.items() if isinstance(v, (str, int, float, bool)) or v is None}
                cleaned_logs.append(cleaned_t)

        try:
            if cleaned_logs:
                self.df = pd.DataFrame.from_records(cleaned_logs)
            else:
                self.df = pd.DataFrame()
        except Exception:
            logger.error("PerformanceCalculator DataFrame creation failed", exc_info=True)
            self.df = pd.DataFrame()

    def calculate_metrics(self) -> Dict[str, Any]:
        """
        Returns a comprehensive dictionary of performance stats.
        """
        if self.df.empty:
            return {"status": "error", "message": "No trades to analyze."}

        # 1. P&L Matching (Realized)
        realized_pnl = []
        trade_count = len(self.df)

        # Track open positions for MTM
        open_pos = {} # {symbol: {'qty': 0, 'cost': 0}}

        # To calculate accurate equity curve with MTM
        equity_curve = []
        timestamps = sorted(list(self.price_history.keys()))

        # If no price history, we fallback to realized-only curve
        if not timestamps:
            current_capital = self.initial_capital
            equity_curve.append(current_capital)
            for _, row in self.df.sort_values('time').iterrows():
                # Naive realized P&L step logic
                pass # Already handled below in fallback

        # 2. Main Logic
        total_charges = self.df['charges'].sum() if 'charges' in self.df.columns else 0.0

        # Realized P&L logic
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
                        qty_to_match = min(pos, row['quantity'])
                        avg_buy_price = cost_basis / pos
                        pnl = (row['price'] - avg_buy_price) * qty_to_match
                        realized_pnl.append(pnl)
                        pos -= qty_to_match
                        cost_basis -= qty_to_match * avg_buy_price

        total_realized_gross = sum(realized_pnl)
        total_realized_net = total_realized_gross - total_charges

        win_rate = len([p for p in realized_pnl if p > 0]) / len(realized_pnl) if realized_pnl else 0

        # 3. High-Fidelity Equity Curve (MTM) - Vectorized
        if timestamps:
            # Convert price history to a DataFrame for vectorized ops
            price_df = pd.DataFrame.from_dict(self.price_history, orient='index')
            price_df.index.name = 'time'
            price_df = price_df.sort_index()

            # Process trades into cash and quantity impacts
            trade_df = self.df.copy()
            trade_df['cash_impact'] = np.where(
                trade_df['action'] == 'BUY',
                -(trade_df['quantity'] * trade_df['price'] + trade_df.get('charges', 0)),
                (trade_df['quantity'] * trade_df['price'] - trade_df.get('charges', 0))
            )
            trade_df['qty_impact'] = np.where(
                trade_df['action'] == 'BUY',
                trade_df['quantity'],
                -trade_df['quantity']
            )

            # Aggregate impacts by timestamp and symbol
            trade_impacts = trade_df.groupby(['time', 'symbol'])[['cash_impact', 'qty_impact']].sum().reset_index()

            # Pivot qty impacts to align with price_df
            qty_changes = trade_impacts.pivot(index='time', columns='symbol', values='qty_impact').fillna(0)
            cash_changes = trade_impacts.groupby('time')['cash_impact'].sum()

            # Reindex to match price_df timestamps and forward fill
            all_ts = price_df.index.union(qty_changes.index).unique()
            qty_changes = qty_changes.reindex(all_ts).fillna(0).cumsum()
            cash_changes = cash_changes.reindex(all_ts).fillna(0).cumsum() + self.initial_capital

            # Match quantity timestamps to price timestamps
            qty_at_price_ts = qty_changes.reindex(price_df.index).ffill().fillna(0)
            cash_at_price_ts = cash_changes.reindex(price_df.index).ffill().fillna(self.initial_capital)

            # Ensure symbols match between qty and prices
            common_symbols = qty_at_price_ts.columns.intersection(price_df.columns)

            # Vectorized MTM: Cash + sum(qty * price)
            mtm_value = (qty_at_price_ts[common_symbols] * price_df[common_symbols]).sum(axis=1)
            equity_series = cash_at_price_ts + mtm_value
            equity_curve = equity_series.tolist()
        else:
            # Fallback realized curve
            eq = self.initial_capital
            equity_curve = [eq]
            for p in realized_pnl:
                eq += p
                equity_curve.append(eq)

        # 4. Metrics
        equity_series = pd.Series(equity_curve)
        if equity_series.empty: equity_series = pd.Series([self.initial_capital])

        # Returns for ratios
        returns = equity_series.pct_change().dropna()

        max_equity = equity_series.cummax()
        drawdowns = (max_equity - equity_series) / max_equity
        max_dd_pct = drawdowns.max() * 100
        absolute_max_dd = (max_equity - equity_series).max()

        # Max DD Duration
        # Check consecutive periods where drawdown > 0
        is_in_dd = drawdowns > 0
        dd_runs = is_in_dd.groupby((~is_in_dd).cumsum()).sum()
        max_dd_duration = dd_runs.max() if not dd_runs.empty else 0

        # CAGR
        days = (timestamps[-1] - timestamps[0]) / (24*3600) if len(timestamps) > 1 else max(1, len(realized_pnl))
        return_multiplier = equity_series.iloc[-1] / self.initial_capital
        total_return_pct = (return_multiplier - 1) * 100
        cagr = ((return_multiplier ** (365/max(days, 1))) - 1) * 100

        # Trade Stats
        wins = [p for p in realized_pnl if p > 0]
        losses = [p for p in realized_pnl if p < 0]

        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)

        avg_win = np.mean(wins) if wins else 0
        avg_loss = abs(np.mean(losses)) if losses else 0
        max_win = max(wins) if wins else 0
        max_loss = min(losses) if losses else 0

        # RR Ratio
        rr_ratio = (avg_win / avg_loss) if avg_loss > 0 else 0

        # Expectancy
        expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)

        # Risk Adjusted Ratios
        # Sharpe (Annualized)
        std_dev = returns.std()
        sharpe = (returns.mean() / std_dev * np.sqrt(252)) if std_dev > 0 else 0

        # Sortino (Annualized, 0% target)
        downside_returns = returns[returns < 0]
        downside_std = downside_returns.std()
        sortino = (returns.mean() / downside_std * np.sqrt(252)) if downside_std > 0 else 0

        # Calmar
        calmar = (cagr / max_dd_pct) if max_dd_pct > 0 else 0

        # Recovery Factor
        recovery_factor = (total_realized_net / absolute_max_dd) if absolute_max_dd > 0 else 0

        # Stability (R-Squared of equity curve)
        y = equity_series.values
        x = np.arange(len(y))
        stability = 0
        if len(y) > 1:
            slope, intercept = np.polyfit(x, y, 1)
            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            stability = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # K-Ratio
        # Slope of log cumulative equity curve divided by standard error of the slope
        k_ratio = 0
        if len(y) > 1 and np.all(y > 0):
            log_y = np.log(y)
            slope_k, intercept_k = np.polyfit(x, log_y, 1)
            y_pred_k = slope_k * x + intercept_k
            mse = np.mean((log_y - y_pred_k) ** 2)
            x_var = np.sum((x - np.mean(x)) ** 2)
            if x_var > 0:
                se_slope = np.sqrt(mse / x_var)
                k_ratio = slope_k / se_slope if se_slope > 0 else 0

        # Omega Ratio (0% threshold)
        omega = 0
        if len(returns) > 0:
            pos_returns = returns[returns > 0].sum()
            neg_returns = abs(returns[returns < 0].sum())
            omega = pos_returns / neg_returns if neg_returns > 0 else (pos_returns if pos_returns > 0 else 0)

        # Benchmark Analytics
        alpha = 0
        beta = 1
        tracking_error = 0
        info_ratio = 0

        if timestamps:
            benchmark_prices = [self.price_history[ts].get(self.benchmark_symbol, 0) for ts in timestamps]
            b_series = pd.Series(benchmark_prices)
            b_returns = b_series.pct_change().dropna()

            # Match lengths
            common_idx = returns.index.intersection(b_returns.index)
            if len(common_idx) > 1:
                s_ret = returns.loc[common_idx]
                b_ret = b_returns.loc[common_idx]

                # Beta Calculation
                cov_matrix = np.cov(s_ret, b_ret)
                if cov_matrix[1, 1] > 0:
                    beta = cov_matrix[0, 1] / cov_matrix[1, 1]
                    # Alpha Calculation (Annualized simplified)
                    alpha = (s_ret.mean() - beta * b_ret.mean()) * 252

                # Information Ratio
                active_return = s_ret - b_ret
                tracking_error = active_return.std() * np.sqrt(252)
                if tracking_error > 0:
                    info_ratio = (active_return.mean() * 252) / tracking_error

        # Exposure Ratio (Time in Market)
        exposure_ratio = 0
        if not self.df.empty and timestamps:
            # Track periods with open position
            market_time_periods = 0
            for symbol in self.df['symbol'].unique():
                sym_df = self.df[self.df['symbol'] == symbol].sort_values('time')
                # This is an approximation for backtest replay
                # For better accuracy we'd need the position state at each timestamp
                pass
            # Simpler: If we have trades, we estimate based on first/last trade
            # But let's use the qty_at_price_ts if available
            if 'qty_at_price_ts' in locals():
                in_market = (qty_at_price_ts != 0).any(axis=1)
                exposure_ratio = in_market.sum() / len(in_market) if len(in_market) > 0 else 0

        return {
            "total_trades": trade_count,
            "closed_trades": len(realized_pnl),
            "gross_profit": float(total_realized_gross),
            "total_charges": float(total_charges),
            "net_profit": float(total_realized_net),
            "net_profit_pct": float((total_realized_net / self.initial_capital) * 100),
            "win_rate_pct": float(win_rate * 100),
            "max_drawdown_pct": float(max_dd_pct),
            "max_drawdown_duration": int(max_dd_duration),
            "expectancy": float(expectancy),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "calmar_ratio": float(calmar),
            "recovery_factor": float(recovery_factor),
            "profit_factor": float(profit_factor),
            "stability": float(stability),
            "k_ratio": float(k_ratio),
            "omega_ratio": float(omega),
            "alpha": float(alpha),
            "beta": float(beta),
            "tracking_error": float(tracking_error),
            "info_ratio": float(info_ratio),
            "exposure_ratio": float(exposure_ratio),
            "avg_win": float(avg_win),
            "avg_loss": float(avg_loss),
            "max_win": float(max_win),
            "max_loss": float(max_loss),
            "rr_ratio": float(rr_ratio),
            "cagr": float(cagr),
            "equity_curve": equity_series.tolist(),
            "benchmark_curve": (b_series / b_series.iloc[0] * self.initial_capital).tolist() if not b_series.empty else []
        }
