import math
import logging
from datetime import datetime
from scipy.stats import norm
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class BlackScholesEngine:
    """
    Python-native Black-Scholes-Merton engine for real-time Greeks calculation.
    Calculates Delta, Gamma, Theta, Vega, and Rho without external dependencies.
    """

    @staticmethod
    def calculate_greeks(
        S: float,      # Current underlying price
        K: float,      # Strike price
        T: float,      # Time to expiration in years
        r: float,      # Risk-free interest rate (e.g., 0.1 for 10%)
        sigma: float,  # Implied Volatility (e.g., 0.2 for 20%)
        option_type: str = "CE" # CE (Call) or PE (Put)
    ) -> Dict[str, float]:
        """
        Calculate all Greeks for a given option.
        """
        # Handle zero or negative spot/strike case
        if S <= 0 or K <= 0:
            return {
                "delta": 0.0,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "rho": 0.0
            }

        if T <= 0:
            return {
                "delta": 1.0 if option_type == "CE" and S > K else -1.0 if option_type == "PE" and S < K else 0.0,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "rho": 0.0
            }

        # Handle zero volatility case
        if sigma <= 0:
            sigma = 0.0001

        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        greeks = {}

        if option_type == "CE":
            # Delta
            greeks["delta"] = norm.cdf(d1)
            # Theta
            greeks["theta"] = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) -
                                r * K * math.exp(-r * T) * norm.cdf(d2)) / 365
            # Rho
            greeks["rho"] = (K * T * math.exp(-r * T) * norm.cdf(d2)) / 100
        else:
            # Delta
            greeks["delta"] = norm.cdf(d1) - 1.0
            # Theta
            greeks["theta"] = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) +
                                r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365
            # Rho
            greeks["rho"] = (-K * T * math.exp(-r * T) * norm.cdf(-d2)) / 100

        # Gamma (Same for Call and Put)
        greeks["gamma"] = norm.pdf(d1) / (S * sigma * math.sqrt(T))

        # Vega (Same for Call and Put) - Returns change for 1% IV
        greeks["vega"] = (S * norm.pdf(d1) * math.sqrt(T)) / 100

        return greeks

    @staticmethod
    def calculate_price(
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: str = "CE"
    ) -> float:
        """
        Calculate theoretical Black-Scholes option price.
        """
        if S <= 0 or K <= 0:
            return 0.0

        if T <= 0:
            intrinsic = max(S - K, 0.0) if option_type == "CE" else max(K - S, 0.0)
            return intrinsic

        if sigma <= 0:
            sigma = 0.0001

        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        if option_type == "CE":
            return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
        return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

    @staticmethod
    def estimate_iv(
        price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        option_type: str = "CE",
        precision: float = 0.0001,
        max_iterations: int = 100
    ) -> float:
        """
        Estimate Implied Volatility using Newton-Raphson method.
        """
        if S <= 0 or K <= 0 or T <= 0 or price <= 0:
            return 0.0

        sigma = 0.5 # Initial guess
        for i in range(max_iterations):
            # Calculate option price with current sigma
            d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
            d2 = d1 - sigma * math.sqrt(T)

            if option_type == "CE":
                curr_price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
            else:
                curr_price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

            diff = price - curr_price
            if abs(diff) < precision:
                return sigma

            # Vega for Newton-Raphson
            # Note: We need actual vega (not for 1% change)
            vega = S * norm.pdf(d1) * math.sqrt(T)

            if vega > 0:
                sigma = sigma + diff / vega
            else:
                return sigma

            # Prevent extreme sigma
            if sigma <= 0:
                sigma = 0.0001
            if sigma > 5.0:
                sigma = 5.0

        return sigma

def build_option_matrix(
    underlying_price: float,
    strikes: list,
    expiry_date: str,
    risk_free_rate: float = 0.1
) -> list:
    """
    Build a strike-centered matrix of Options with Greeks.
    """
    # Calculate time to expiry in years
    expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
    now = datetime.now()
    delta_t = (expiry - now).total_seconds()
    T = max(0, delta_t / (365 * 24 * 3600))

    matrix = []
    engine = BlackScholesEngine()

    for strike in strikes:
        # Mocking prices for now - in production these would come from the broker
        # We assume 20% IV for initial Greek estimates
        iv = 0.2

        ce_greeks = engine.calculate_greeks(underlying_price, strike, T, risk_free_rate, iv, "CE")
        pe_greeks = engine.calculate_greeks(underlying_price, strike, T, risk_free_rate, iv, "PE")

        matrix.append({
            "strike": strike,
            "ce": {
                "ltp": 0.0, # Filled by broker data
                "iv": iv,
                "delta": ce_greeks["delta"],
                "gamma": ce_greeks["gamma"],
                "theta": ce_greeks["theta"],
                "vega": ce_greeks["vega"],
                "oi": 0
            },
            "pe": {
                "ltp": 0.0, # Filled by broker data
                "iv": iv,
                "delta": pe_greeks["delta"],
                "gamma": pe_greeks["gamma"],
                "theta": pe_greeks["theta"],
                "vega": pe_greeks["vega"],
                "oi": 0
            },
            "is_atm": abs(strike - underlying_price) < 25 # Threshold for Nifty-style indices
        })

    return matrix
