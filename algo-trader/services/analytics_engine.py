import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
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

    def _get_time_to_expiry(self, expiry_date: str) -> float:
        """Helper to robustly calculate time to expiry in years."""
        try:
            # Robust parsing: handle formats like 30-JUN-26 or 30JUN26
            clean_date = expiry_date.replace("-", "").upper()
            expiry = datetime.strptime(clean_date, "%d%b%y")
            now = datetime.now()
            return max(0.00001, (expiry - now).total_seconds() / (365 * 24 * 3600))
        except Exception:
            return 0.01 # Fallback

    def _parse_expiry_datetime(self, expiry_date: str) -> Optional[datetime]:
        try:
            clean_date = expiry_date.replace("-", "").upper()
            return datetime.strptime(clean_date, "%d%b%y")
        except Exception:
            return None

    def _coerce_timestamp(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, datetime):
            return int(value.timestamp())
        text = str(value).strip()
        if not text:
            return None
        try:
            if text.isdigit():
                return int(text)
            return int(datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp())
        except Exception:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    return int(datetime.strptime(text, fmt).timestamp())
                except Exception:
                    continue
        return None

    def _extract_atm_context(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        spot_price = float(chain_data.get("spot_price", 0) or 0)
        chain = chain_data.get("chain", []) or []
        atm_strike = chain_data.get("atm_strike")
        if atm_strike is None and chain:
            atm_row = min(chain, key=lambda item: abs(float(item.get("strike", 0) or 0) - spot_price))
            atm_strike = atm_row.get("strike", 0)
        atm_row = next((item for item in chain if item.get("strike") == atm_strike), None)
        if atm_row is None and chain:
            atm_row = min(chain, key=lambda item: abs(float(item.get("strike", 0) or 0) - float(atm_strike or spot_price)))
            atm_strike = atm_row.get("strike", 0)
        ce = (atm_row or {}).get("ce") or {}
        pe = (atm_row or {}).get("pe") or {}
        T = self._get_time_to_expiry(chain_data.get("expiry_date", ""))
        ce_iv = self.bs_engine.estimate_iv(ce.get("ltp", 0), spot_price, atm_strike, T, self.rf_rate, "CE") if ce.get("ltp", 0) > 0 else 0
        pe_iv = self.bs_engine.estimate_iv(pe.get("ltp", 0), spot_price, atm_strike, T, self.rf_rate, "PE") if pe.get("ltp", 0) > 0 else 0
        return {
            "spot_price": spot_price,
            "atm_strike": atm_strike or 0,
            "ce_iv": ce_iv,
            "pe_iv": pe_iv,
            "expiry_dt": self._parse_expiry_datetime(chain_data.get("expiry_date", "")),
        }

    def _normalize_history(self, history_rows: List[Dict[str, Any]], spot_fallback: float) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for row in history_rows or []:
            ts = self._coerce_timestamp(row.get("time") or row.get("timestamp") or row.get("datetime"))
            if ts is None:
                continue
            spot = row.get("close", row.get("ltp", row.get("spot", spot_fallback)))
            try:
                normalized.append({"time": ts, "spot": float(spot)})
            except Exception:
                continue
        normalized.sort(key=lambda item: item["time"])
        if normalized:
            return normalized
        return [{"time": int(datetime.now().timestamp()), "spot": float(spot_fallback or 0)}]

    def calculate_gex(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Gamma Exposure (GEX) across the option chain.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        T = self._get_time_to_expiry(expiry_date)

        gex_results = []
        total_ce_gex = 0
        total_pe_gex = 0
        total_ce_oi = 0
        total_pe_oi = 0
        lot_size = 1
        atm_strike = chain_data.get("atm_strike", 0)

        for item in chain:
            strike = item["strike"]
            ce = item["ce"]
            pe = item["pe"]
            lotsize = (ce or pe or {}).get("lotsize", 1) or 1
            lot_size = max(lot_size, lotsize)

            # CE GEX
            ce_gamma = 0
            ce_gex = 0
            if ce and ce.get("ltp", 0) > 0 and ce.get("oi", 0) > 0:
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
                "callOi": ce["oi"] if ce else 0,
                "putOi": pe["oi"] if pe else 0,
                "totalOi": (ce["oi"] if ce else 0) + (pe["oi"] if pe else 0),
                "ce_gamma": ce_gamma,
                "pe_gamma": pe_gamma,
                "ce_gex": ce_gex,
                "pe_gex": pe_gex,
                "net_gex": ce_gex - pe_gex
            })

        return {
            "status": "success",
            "underlying": chain_data.get("underlying"),
            "spot_price": spot_price,
            "futures_price": spot_price,
            "atm_strike": atm_strike,
            "lot_size": lot_size,
            "total_ce_gex": total_ce_gex,
            "total_pe_gex": total_pe_gex,
            "total_net_gex": total_ce_gex - total_pe_gex,
            "pcr_oi": round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0,
            "pcr": round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0,
            "pcr_volume": 0,
            "data": gex_results,
            "chain": gex_results
        }

    def calculate_max_pain(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Max Pain strike (where option buyers lose the most).
        """
        chain = chain_data.get("chain", [])
        strikes = [item["strike"] for item in chain]

        pain_points = []
        # Security: Enforce hard limit on strikes to prevent O(N^2) exhaustion
        safe_strikes = strikes[:500]

        for s in safe_strikes:
            total_pain = 0
            # Explicit inner loop with safety check
            for j, item in enumerate(chain):
                if j >= 1000: break # Safety break

                strike = item.get("strike", 0)
                ce = item.get("ce")
                pe = item.get("pe")

                if ce and s > strike:
                    total_pain += (s - strike) * ce.get("oi", 0)
                if pe and s < strike:
                    total_pain += (strike - s) * pe.get("oi", 0)

            pain_points.append({
                "strike": s,
                "pain": total_pain,
                "total_pain": total_pain,
                "total_pain_cr": round(total_pain / 10000000, 4),
            })

        max_pain_strike = min(pain_points, key=lambda x: x["pain"])["strike"] if pain_points else 0

        return {
            "status": "success",
            "max_pain_strike": max_pain_strike,
            "pain_data": pain_points
        }

    def calculate_iv_smile(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute Implied Volatility smile across strikes.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        T = self._get_time_to_expiry(expiry_date)

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

        atm_strike = chain_data.get("atm_strike", 0)
        atm_row = next((item for item in smile if item["strike"] == atm_strike), None)
        atm_iv = atm_row.get("avg_iv", 0) if atm_row else 0

        lower_target = atm_strike * 0.95 if atm_strike else 0
        upper_target = atm_strike * 1.05 if atm_strike else 0
        lower_row = min(smile, key=lambda item: abs(item["strike"] - lower_target)) if smile and lower_target else None
        upper_row = min(smile, key=lambda item: abs(item["strike"] - upper_target)) if smile and upper_target else None
        lower_iv = (lower_row or {}).get("pe_iv", 0) or (lower_row or {}).get("avg_iv", 0)
        upper_iv = (upper_row or {}).get("ce_iv", 0) or (upper_row or {}).get("avg_iv", 0)
        skew = round(lower_iv - upper_iv, 2) if lower_iv and upper_iv else 0

        return {
            "status": "success",
            "spot_price": spot_price,
            "atm_strike": atm_strike,
            "atm_iv": atm_iv,
            "skew": skew,
            "chain": smile
        }

    def calculate_vol_surface(self, surfaces_by_expiry: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not surfaces_by_expiry:
            return {"status": "error", "message": "No expiry surface data available", "data": []}

        strikes_set = set()
        for i, expiry in enumerate(surfaces_by_expiry):
            if i >= 50: break # Safety: limit number of expiries
            chain = expiry.get("chain", [])
            for k, item in enumerate(chain):
                if k >= 1000: break # Safety: limit strikes per expiry
                strike = item.get("strike")
                if strike is not None:
                    strikes_set.add(strike)

        strikes = sorted(list(strikes_set))[:500] # Safety: hard limit on total strikes
        expiries = []
        surface: List[List[float]] = []

        for expiry in surfaces_by_expiry:
            expiries.append({
                "date": expiry.get("expiry_date"),
                "atm_strike": expiry.get("atm_strike", 0),
                "spot_price": expiry.get("spot_price", 0),
            })
            # Security: Replace dictionary comprehension with explicit loop + limit
            smile_lookup = {}
            for k, row in enumerate(expiry.get("chain", [])):
                if k >= 1000: break # Safety break
                strike_key = row.get("strike")
                if strike_key is not None:
                    smile_lookup[strike_key] = row.get("avg_iv", 0)

            surface.append([smile_lookup.get(strike, 0) for strike in strikes])

        return {
            "status": "success",
            "data": {
                "strikes": strikes,
                "expiries": expiries,
                "surface": surface,
                "underlying_ltp": surfaces_by_expiry[0].get("spot_price", 0),
                "atm_strike": surfaces_by_expiry[0].get("atm_strike", 0),
            },
        }

    def calculate_iv_chart(self, chain_data: Dict[str, Any], history_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        context = self._extract_atm_context(chain_data)
        points = self._normalize_history(history_rows, context["spot_price"])
        expiry_dt = context["expiry_dt"]

        ce_series = []
        pe_series = []
        for point in points:
            point_dt = datetime.fromtimestamp(point["time"])
            if expiry_dt:
                T = max(0.00001, (expiry_dt - point_dt).total_seconds() / (365 * 24 * 3600))
            else:
                T = self._get_time_to_expiry(chain_data.get("expiry_date", ""))
            spot = point["spot"]
            ce_greeks = self.bs_engine.calculate_greeks(spot, context["atm_strike"], T, self.rf_rate, context["ce_iv"] or 0.0001, "CE")
            pe_greeks = self.bs_engine.calculate_greeks(spot, context["atm_strike"], T, self.rf_rate, context["pe_iv"] or 0.0001, "PE")
            ce_series.append({
                "time": point["time"],
                "iv": round((context["ce_iv"] or 0) * 100, 2),
                "delta": round(ce_greeks["delta"], 6),
                "theta": round(ce_greeks["theta"], 6),
                "vega": round(ce_greeks["vega"], 6),
                "gamma": round(ce_greeks["gamma"], 8),
            })
            pe_series.append({
                "time": point["time"],
                "iv": round((context["pe_iv"] or 0) * 100, 2),
                "delta": round(pe_greeks["delta"], 6),
                "theta": round(pe_greeks["theta"], 6),
                "vega": round(pe_greeks["vega"], 6),
                "gamma": round(pe_greeks["gamma"], 8),
            })

        return {
            "status": "success",
            "data": {
                "atm_strike": context["atm_strike"],
                "underlying_ltp": points[-1]["spot"],
                "series": [
                    {"option_type": "CE", "iv_data": ce_series},
                    {"option_type": "PE", "iv_data": pe_series},
                ],
            },
        }

    def calculate_straddle_chart(self, chain_data: Dict[str, Any], history_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        context = self._extract_atm_context(chain_data)
        points = self._normalize_history(history_rows, context["spot_price"])
        expiry_dt = context["expiry_dt"]

        series = []
        for point in points:
            point_dt = datetime.fromtimestamp(point["time"])
            if expiry_dt:
                T = max(0.00001, (expiry_dt - point_dt).total_seconds() / (365 * 24 * 3600))
            else:
                T = self._get_time_to_expiry(chain_data.get("expiry_date", ""))
            spot = point["spot"]
            ce_price = self.bs_engine.calculate_price(spot, context["atm_strike"], T, self.rf_rate, context["ce_iv"] or 0.0001, "CE")
            pe_price = self.bs_engine.calculate_price(spot, context["atm_strike"], T, self.rf_rate, context["pe_iv"] or 0.0001, "PE")
            series.append({
                "time": point["time"],
                "spot": round(spot, 2),
                "straddle": round(ce_price + pe_price, 2),
                "synthetic_future": round(context["atm_strike"] + ce_price - pe_price, 2),
                "atm_strike": context["atm_strike"],
                "ce_price": round(ce_price, 2),
                "pe_price": round(pe_price, 2),
            })

        return {
            "status": "success",
            "data": {
                "series": series,
            },
        }

    def calculate_chain_greeks(self, chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute full Greeks (Delta, Gamma, Theta, Vega, Rho) across the option chain.
        """
        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        expiry_date = chain_data.get("expiry_date", "")

        T = self._get_time_to_expiry(expiry_date)

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
            "data": greeks_results
        }
