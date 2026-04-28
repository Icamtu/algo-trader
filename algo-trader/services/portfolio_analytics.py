import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from services.historify_service import historify_service

logger = logging.getLogger(__name__)

class PortfolioAnalyticsService:
    """
    Advanced Portfolio Analytics for AetherDesk Prime.
    Provides institutional-grade risk metrics including VaR and CVaR using Monte Carlo methods.
    """

    def __init__(self):
        pass

    async def calculate_portfolio_risk(
        self,
        positions: List[Dict[str, Any]],
        confidence_level: float = 0.95,
        horizon_days: int = 1,
        iterations: int = 5000
    ) -> Dict[str, Any]:
        """
        Calculate Portfolio-wide Value-at-Risk (VaR) and Conditional VaR (CVaR).

        Args:
            positions: List of dicts with 'symbol', 'quantity', 'avg_price'
            confidence_level: Confidence level for VaR (e.g., 0.95)
            horizon_days: Time horizon for the risk calculation
            iterations: Number of Monte Carlo trials
        """
        if not positions:
            return {"status": "error", "message": "No positions provided for analysis"}

        try:
            # 1. Fetch historical data for all symbols
            symbol_data = {}
            for pos in positions:
                symbol = pos["symbol"]
                # Fetch last 30 days of daily data for volatility estimation
                records = historify_service.get_records(symbol, interval="D", limit=60)
                if not records or len(records) < 5:
                    logger.warning(f"Insufficient historical data for {symbol} to perform VaR analysis.")
                    continue

                df = pd.DataFrame(records)
                df['returns'] = df['close'].pct_change().fillna(0)
                symbol_data[symbol] = df

            if not symbol_data:
                return {"status": "error", "message": "Insufficient historical data for all portfolio symbols"}

            # 2. Build returns matrix and calculate correlations/volatilities
            common_dates = None
            for symbol, df in symbol_data.items():
                if common_dates is None:
                    common_dates = set(df['time'])
                else:
                    common_dates = common_dates.intersection(set(df['time']))

            if not common_dates or len(common_dates) < 5:
                 return {"status": "error", "message": "Insufficient overlapping historical data for symbols"}

            # Align returns
            returns_dict = {}
            weights = []
            portfolio_value = 0.0

            # Map symbol to current value
            valid_positions = []
            for pos in positions:
                symbol = pos["symbol"]
                if symbol in symbol_data:
                    current_price = symbol_data[symbol].iloc[-1]['close']
                    value = abs(pos["quantity"]) * current_price
                    portfolio_value += value
                    valid_positions.append({"symbol": symbol, "value": value})

            if portfolio_value == 0:
                return {"status": "error", "message": "Portfolio value is zero"}

            for vp in valid_positions:
                symbol = vp["symbol"]
                weights.append(vp["value"] / portfolio_value)
                df = symbol_data[symbol]
                # Filter by common dates and sort
                df_common = df[df['time'].isin(common_dates)].sort_values('time')
                returns_dict[symbol] = df_common['returns'].values

            returns_df = pd.DataFrame(returns_dict)
            cov_matrix = returns_df.cov()
            avg_returns = returns_df.mean()

            # 3. Monte Carlo Simulation
            # Generate correlated random returns
            # Formula: Portfolio_Return = Sum(Weight_i * Return_i)

            weights = np.array(weights)

            # Cholesky decomposition for correlated returns
            try:
                chol_mat = np.linalg.cholesky(cov_matrix)
            except np.linalg.LinAlgError:
                # If matrix is not positive definite, use a simpler approach or add small jitter
                jitter = 1e-9 * np.eye(len(cov_matrix))
                chol_mat = np.linalg.cholesky(cov_matrix + jitter)

            # Simulations
            sim_returns = np.zeros(iterations)
            for i in range(iterations):
                # Random normal shocks
                shocks = np.random.normal(0, 1, len(weights))
                # Correlated shocks
                correlated_shocks = np.dot(chol_mat, shocks)
                # Projected returns (Mean + Correlated Volatility)
                # For horizon > 1 day, scale by sqrt(T)
                daily_sim_returns = avg_returns + correlated_shocks

                # Simple geometric accumulation for horizon
                if horizon_days > 1:
                    # Approximation: scale volatility and mean
                    period_return = np.sum(weights * (avg_returns * horizon_days + correlated_shocks * np.sqrt(horizon_days)))
                else:
                    period_return = np.sum(weights * daily_sim_returns)

                sim_returns[i] = period_return

            # 4. Calculate VaR and CVaR
            # VaR is the loss at the (1-confidence) percentile
            var_percentile = (1 - confidence_level) * 100
            var_value = np.percentile(sim_returns, var_percentile)

            # VaR in currency terms (negative because it's a loss)
            var_inr = portfolio_value * abs(min(0, var_value))

            # CVaR (Conditional VaR) is the average of returns worse than VaR
            cvar_returns = sim_returns[sim_returns <= var_value]
            if len(cvar_returns) > 0:
                cvar_value = np.mean(cvar_returns)
            else:
                cvar_value = var_value

            cvar_inr = portfolio_value * abs(min(0, cvar_value))

            # 5. Volatility and Beta (relative to NIFTY 50 if available)
            # For now, just portfolio annualized volatility
            ann_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights))) * np.sqrt(252)

            return {
                "status": "success",
                "metrics": {
                    "portfolio_value": round(portfolio_value, 2),
                    "var_inr": round(var_inr, 2),
                    "cvar_inr": round(cvar_inr, 2),
                    "var_pct": round(abs(min(0, var_value)) * 100, 2),
                    "cvar_pct": round(abs(min(0, cvar_value)) * 100, 2),
                    "confidence_level": confidence_level,
                    "horizon_days": horizon_days,
                    "annualized_volatility": round(ann_vol * 100, 2),
                    "iterations": iterations
                },
                "simulations": sim_returns.tolist() if iterations <= 1000 else [] # Only return if small enough
            }

        except Exception as e:
            logger.error(f"Portfolio risk calculation failed: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

# Singleton
portfolio_analytics = PortfolioAnalyticsService()
