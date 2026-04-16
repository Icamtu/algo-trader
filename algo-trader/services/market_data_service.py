import logging
import os
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
import asyncio
import sqlite3

logger = logging.getLogger(__name__)

class MarketDataService:
    """
    Unified Market Data Service for AetherDesk.
    Bridges the OrderManager core to the Analytics layer.
    """

    def __init__(self, order_manager):
        self.order_manager = order_manager

    async def get_underlying_ltp(self, symbol: str, exchange: str = "NSE") -> float:
        """Fetch LTP for an underlying symbol."""
        try:
            # Check if order_manager is initialized and logged in
            if not self.order_manager or not getattr(self.order_manager, "client", None):
                logger.warning("Order manager or client not initialized.")
                return 0.0

            # Map exchange for index quotes
            quote_exchange = exchange
            if symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]:
                quote_exchange = "NSE_INDEX"

            # Use order_manager's integrated data fetch (async)
            quote = await self.order_manager.get_quote(symbol, quote_exchange)

            # handle 'data' wrapper if present
            data = quote.get("data", quote)

            # support both Shoonya 'lp' and OpenAlgo 'ltp' normalized fields
            return float(data.get("lp", data.get("ltp", 0)))
        except Exception as e:
            logger.error(f"Error fetching LTP for {symbol}: {e}")
            return 0.0

    async def get_option_chain(
        self,
        underlying: str,
        exchange: str,
        expiry_date: str,
        strike_count: int = 10
    ) -> Dict[str, Any]:
        """
        Fetch real-time option chain from broker.
        """
        try:
            # 1. Get spot price
            spot_price = await self.get_underlying_ltp(underlying, exchange)
            if spot_price <= 0:
                 return {"status": "error", "message": "Could not fetch spot price"}

            # 2. Extract strikes (This requires master contract access)
            # For simplicity in this unified service, we'll use a helper to get strikes from the client
            # In AetherDesk, we can query the shoonya client directly for option chain info

            # Map NFO/BFO
            opt_exchange = "NFO" if exchange in ["NSE", "NSE_INDEX", "NFO"] else "BFO"

            # Use Shoonya's get_option_chain if available, or simulate centers
            # Note: The native openalgo-upstream code queries the db for SymToken.
            # We will use the same database for symbol discovery.

            import sqlite3
            # Use the stabilized native database path
            # Use the stabilized native database path in Docker
            db_path = "/app/storage/openalgo.db"
            if not os.path.exists(db_path):
                # Fallback to local workspace paths
                db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "openalgo.db")

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Convert expiry format: 28FEB25 -> 28-FEB-25
            expiry_db_fmt = f"{expiry_date[:2]}-{expiry_date[2:5]}-{expiry_date[5:]}".upper()

            # Get available strikes
            cur.execute("""
                SELECT DISTINCT strike FROM symtoken
                WHERE name = ? AND expiry = ? AND exchange = ?
                ORDER BY strike ASC
            """, (underlying.split("-")[0], expiry_db_fmt, opt_exchange))

            available_strikes = [row[0] for row in cur.fetchall()]
            conn.close()

            if not available_strikes:
                return {"status": "error", "message": f"No strikes found for {underlying} expiring {expiry_date}"}

            # 3. Find ATM
            atm_strike = min(available_strikes, key=lambda x: abs(x - spot_price))
            atm_idx = available_strikes.index(atm_strike)

            start_idx = max(0, atm_idx - strike_count)
            end_idx = min(len(available_strikes), atm_idx + strike_count + 1)
            selected_strikes = available_strikes[start_idx:end_idx]

            # 4. Fetch Quotes for all selected strikes
            symbols_to_fetch = []
            for s in selected_strikes:
                ce_sym = f"{underlying}{expiry_date}C{int(s)}"
                pe_sym = f"{underlying}{expiry_date}P{int(s)}"
                symbols_to_fetch.append({"symbol": ce_sym, "exchange": opt_exchange})
                symbols_to_fetch.append({"symbol": pe_sym, "exchange": opt_exchange})

            # Bulk fetch quotes - use the correct multi-quote method
            quotes_resp = await self.order_manager.get_multi_quotes(symbols_to_fetch)
            # handle 'data' wrapper if present in bulk response
            quotes = quotes_resp.get("data", quotes_resp)

            chain = []
            for s in selected_strikes:
                ce_sym = f"{underlying}{expiry_date}C{int(s)}"
                pe_sym = f"{underlying}{expiry_date}P{int(s)}"

                ce_q = quotes.get(ce_sym, {})
                pe_q = quotes.get(pe_sym, {})

                chain.append({
                    "strike": s,
                    "ce": {
                        "symbol": ce_sym,
                        "ltp": float(ce_q.get("lp", ce_q.get("ltp", 0))),
                        "oi": int(ce_q.get("oi", 0)),
                        "lotsize": int(ce_q.get("ls", 1))
                    },
                    "pe": {
                        "symbol": pe_sym,
                        "ltp": float(pe_q.get("lp", pe_q.get("ltp", 0))),
                        "oi": int(pe_q.get("oi", 0)),
                        "lotsize": int(pe_q.get("ls", 1))
                    }
                })

            return {
                "status": "success",
                "underlying": underlying,
                "spot_price": spot_price,
                "expiry_date": expiry_date,
                "atm_strike": atm_strike,
                "chain": chain
            }

        except Exception as e:
            logger.error(f"Error building option chain for {underlying}: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def get_available_expiries(self, underlying: str, exchange: str = "NSE") -> List[str]:
        """Fetch available unique expiry dates for an underlying."""
        try:
            # Use the stabilized native database path in Docker
            db_path = "/app/storage/openalgo.db"
            if not os.path.exists(db_path):
                # Fallback to local workspace paths
                db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "openalgo.db")

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Map index names if needed (e.g. NIFTY -> NIFTY%)
            # Shoonya symbols are typically like NIFTY28FEB25C...
            opt_exchange = "NFO" if exchange in ["NSE", "NSE_INDEX", "NFO"] else "BFO"

            cur.execute("""
                SELECT DISTINCT expiry FROM symtoken
                WHERE name = ? AND exchange = ?
                ORDER BY expiry ASC
            """, (underlying.split("-")[0], opt_exchange))

            # Expiry in DB is format like 28-FEB-25.
            # Frontend expects 28FEB25.
            raw_expiries = [row[0] for row in cur.fetchall()]
            conn.close()

            formatted = []
            for r in raw_expiries:
                if not r or "-" not in r: continue
                parts = r.split("-")
                # 28-FEB-25 -> 28FEB25
                formatted.append("".join(parts).upper())

            return sorted(list(set(formatted)))
        except Exception as e:
            logger.error(f"Error fetching expiries for {underlying}: {e}")
            return []
