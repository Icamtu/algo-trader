import logging
from typing import Any, Dict, List, Optional
from data.options_engine import BlackScholesEngine

logger = logging.getLogger(__name__)

class AnalyticsEngine:
    """
    Core Analytics Engine for AetherDesk.
    Computes GEX, IV Smile, Max Pain, and Straddle metrics.
    """

    def __init__(self, risk_free_rate: float = 0.1):
        self.bs_engine = BlackScholesEngine()
        self.rf_rate = risk_free_rate

    def calculate_gex(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Gamma Exposure (GEX) across the option chain.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        # Time to expiry in years (assuming 365 days)
        try:
            from datetime import datetime
            expiry = datetime.strptime(expiry_date, "%d%b%y") # DDMMMYY format
            now = datetime.now()
            T = max(0.00001, (expiry - now).total_seconds() / (365 * 24 * 3600))
        except:
            T = 0.01 # Fallback

        gex_results = []
        total_ce_gex = 0
        total_pe_gex = 0
        total_ce_oi = 0
        total_pe_oi = 0

        for item in chain:
            strike = item["strike"]
            ce = item["ce"]
            pe = item["pe"]

            # CE GEX
            ce_gamma = 0
            ce_gex = 0
            if ce and ce.get("ltp", 0) > 0 and ce.get("oi", 0) > 0:
                # Estimate IV first
                iv = self.bs_engine.estimate_iv(ce["ltp"], spot_price, strike, T, self.rf_rate, "CE")
                greeks = self.bs_engine.calculate_greeks(spot_price, strike, T, self.rf_rate, iv, "CE")
                ce_gamma = greeks["gamma"]
                ce_gex = ce_gamma * ce["oi"] * ce["lotsize"]
                total_ce_gex += ce_gex
                total_ce_oi += ce["oi"]

            # PE GEX
            pe_gamma = 0
            pe_gex = 0
            if pe and pe.get("ltp", 0) > 0 and pe.get("oi", 0) > 0:
                iv = self.bs_engine.estimate_iv(pe["ltp"], spot_price, strike, T, self.rf_rate, "PE")
                greeks = self.bs_engine.calculate_greeks(spot_price, strike, T, self.rf_rate, iv, "PE")
                pe_gamma = greeks["gamma"]
                pe_gex = pe_gamma * pe["oi"] * pe["lotsize"]
                total_pe_gex += pe_gex
                total_pe_oi += pe["oi"]

            gex_results.append({
                "strike": strike,
                "ce_oi": ce["oi"] if ce else 0,
                "pe_oi": pe["oi"] if pe else 0,
                "ce_gamma": ce_gamma,
                "pe_gamma": pe_gamma,
                "ce_gex": ce_gex,
                "pe_gex": pe_gex,
                "net_gex": ce_gex - pe_gex
            })

        return {
            "status": "success",
            "underlying": chain_data["underlying"],
            "spot_price": spot_price,
            "total_ce_gex": total_ce_gex,
            "total_pe_gex": total_pe_gex,
            "total_net_gex": total_ce_gex - total_pe_gex,
            "pcr_oi": round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0,
            "chain": gex_results
        }

    def calculate_max_pain(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Max Pain strike (where option buyers lose the most).
        """
        chain = chain_data.get("chain", [])
        strikes = [item["strike"] for item in chain]

        pain_points = []
        for s in strikes:
            total_pain = 0
            for item in chain:
                strike = item["strike"]
                ce = item["ce"]
                pe = item["pe"]

                # Call Pain: (Current Strike - Option Strike) * OI
                if ce and s > strike:
                    total_pain += (s - strike) * ce["oi"]
                # Put Pain: (Option Strike - Current Strike) * OI
                if pe and s < strike:
                    total_pain += (strike - s) * pe["oi"]

            pain_points.append({"strike": s, "pain": total_pain})

        # Find strike with minimum pain
        max_pain_strike = min(pain_points, key=lambda x: x["pain"])["strike"]

        return {
            "status": "success",
            "max_pain_strike": max_pain_strike,
            "pain_points": pain_points
        }

    def calculate_iv_smile(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Implied Volatility smile across strikes.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        try:
            from datetime import datetime
            expiry = datetime.strptime(expiry_date, "%d%b%y")
            now = datetime.now()
            T = max(0.00001, (expiry - now).total_seconds() / (365 * 24 * 3600))
        except:
            T = 0.01

        smile = []
        for item in chain:
            strike = item["strike"]
            ce = item["ce"]
            pe = item["pe"]

            ce_iv = 0
            if ce and ce.get("ltp", 0) > 0:
                ce_iv = self.bs_engine.estimate_iv(ce["ltp"], spot_price, strike, T, self.rf_rate, "CE")

            pe_iv = 0
            if pe and pe.get("ltp", 0) > 0:
                pe_iv = self.bs_engine.estimate_iv(pe["ltp"], spot_price, strike, T, self.rf_rate, "PE")

            smile.append({
                "strike": strike,
                "ce_iv": round(ce_iv * 100, 2),
                "pe_iv": round(pe_iv * 100, 2),
                "avg_iv": round(((ce_iv + pe_iv) / 2) * 100, 2) if ce_iv > 0 and pe_iv > 0 else 0
            })

        return {
            "status": "success",
            "smile": smile
        }
    def calculate_chain_greeks(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute full Greeks (Delta, Gamma, Theta, Vega, Rho) across the option chain.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        try:
            from datetime import datetime
            expiry = datetime.strptime(expiry_date, "%d%b%y")
            now = datetime.now()
            T = max(0.00001, (expiry - now).total_seconds() / (365 * 24 * 3600))
        except:
            T = 0.01

        greeks_results = []

        for item in chain:
            strike = item["strike"]
            ce = item["ce"]
            pe = item["pe"]

            ce_metrics = {}
            if ce and ce.get("ltp", 0) > 0:
                iv = self.bs_engine.estimate_iv(ce["ltp"], spot_price, strike, T, self.rf_rate, "CE")
                ce_metrics = self.bs_engine.calculate_greeks(spot_price, strike, T, self.rf_rate, iv, "CE")
                ce_metrics["iv"] = round(iv * 100, 2)
                ce_metrics["ltp"] = ce["ltp"]

            pe_metrics = {}
            if pe and pe.get("ltp", 0) > 0:
                iv = self.bs_engine.estimate_iv(pe["ltp"], spot_price, strike, T, self.rf_rate, "PE")
                pe_metrics = self.bs_engine.calculate_greeks(spot_price, strike, T, self.rf_rate, iv, "PE")
                pe_metrics["iv"] = round(iv * 100, 2)
                pe_metrics["ltp"] = pe["ltp"]

            greeks_results.append({
                "strike": strike,
                "ce": ce_metrics,
                "pe": pe_metrics
            })

        return {
            "status": "success",
            "underlying": chain_data.get("underlying"),
            "spot_price": spot_price,
            "expiry": expiry_date,
            "chain": greeks_results
        }
