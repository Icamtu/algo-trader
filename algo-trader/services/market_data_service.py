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
            om = self.order_manager
            if not om:
                logger.warning("Order manager not initialized.")
                return 0.0

            # Map exchange for index quotes
            quote_exchange = exchange
            if symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]:
                quote_exchange = "NSE_INDEX"

            # Try native broker first (AetherBridge architecture)
            if getattr(om, "native_broker", None):
                try:
                    quote = await om.native_broker.get_quote(symbol, quote_exchange)
                    if quote and isinstance(quote, dict):
                        ltp = float(quote.get("lp", quote.get("ltp", 0)))
                        if ltp > 0:
                            return ltp
                except Exception as ne:
                    logger.debug(f"Native broker quote failed for {symbol}: {ne}")

            # Try paper broker (sandbox mode)
            if getattr(om, "paper_broker", None):
                try:
                    quote = await om.paper_broker.get_quote(symbol, quote_exchange)
                    if quote and isinstance(quote, dict):
                        ltp = float(quote.get("lp", quote.get("ltp", 0)))
                        if ltp > 0:
                            return ltp
                except Exception as pe:
                    logger.debug(f"Paper broker quote failed for {symbol}: {pe}")

            # Fallback: use WebSocket tick buffer's last known prices
            try:
                from core.context import app_context
                from fastapi_app import manager as ws_manager
                tick = ws_manager.last_known_ticks.get(symbol, {})
                ltp = float(tick.get("ltp", 0))
                if ltp > 0:
                    logger.info(f"Using WS fallback LTP for {symbol}: {ltp}")
                    return ltp
            except Exception:
                pass

            logger.warning(f"Could not fetch LTP for {symbol} from any source.")
            return 0.0
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
            # 1. Get spot price & prev close
            om = self.order_manager
            quote_exchange = exchange
            if underlying in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]:
                quote_exchange = "NSE_INDEX"

            spot_price = 0
            prev_close = 0
            try:
                # Use multi-source quote fetch
                resp = await om.get_quote(underlying, quote_exchange)
                if resp and resp.get("status") == "success":
                    quote = resp.get("data", {})
                    if quote:
                        spot_price = float(quote.get("lp", quote.get("ltp", 0)))
                        prev_close = float(quote.get("pc", quote.get("prev_close", spot_price)))
            except Exception as qe:
                logger.debug(f"Quote fetch failed for {underlying}: {qe}")

            if spot_price <= 0:
                 spot_price = await self.get_underlying_ltp(underlying, exchange)
                 prev_close = spot_price

            # Final safeguard for prev_close to avoid division by zero in UI
            if prev_close <= 0 and spot_price > 0:
                prev_close = spot_price

            if spot_price <= 0:
                 return {"status": "error", "message": "Could not fetch spot price"}

            # 2. Extract strikes (This requires master contract access)
            # For simplicity in this unified service, we'll use a helper to get strikes from the client
            # In AetherDesk, we can query the shoonya client directly for option chain info

            # Map NFO/BFO
            opt_exchange = "NFO" if exchange in ["NSE", "NSE_INDEX", "NFO"] else "BFO"

            # Normalize expiry: ensure format DDMMMYY (strip hyphens) for consistent internal handling
            expiry_date = expiry_date.replace("-", "").upper()

            # Use Shoonya's get_option_chain if available, or simulate centers
            # Note: The native openalgo-upstream code queries the db for SymToken.
            # We will use the same database for symbol discovery.

            import sqlite3
            # Use the stabilized native database path
            # Use the stabilized native database path in Docker
            db_path = "/app/storage/symbols.db"
            if not os.path.exists(db_path):
                # Fallback to local workspace paths
                db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "symbols.db")

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

            available_strikes = [row[0] for row in cur.fetchall() if row[0] > 0]
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
                # Format strike: Remove .0 if it's a whole number, otherwise keep decimal
                strike_str = str(int(s)) if s == int(s) else str(s)

                ce_sym = f"{underlying}{expiry_date}{strike_str}CE"
                pe_sym = f"{underlying}{expiry_date}{strike_str}PE"
                symbols_to_fetch.append({"symbol": ce_sym, "exchange": opt_exchange})
                symbols_to_fetch.append({"symbol": pe_sym, "exchange": opt_exchange})

            # Bulk fetch quotes - use the correct multi-quote method
            quotes_resp = await self.order_manager.get_multi_quotes(symbols_to_fetch)
            # handle 'data' wrapper if present in bulk response
            quotes = quotes_resp.get("data", quotes_resp)

            chain = []
            for s in selected_strikes:
                # Format strike: Remove .0 if it's a whole number, otherwise keep decimal
                strike_str = str(int(s)) if s == int(s) else str(s)

                ce_sym = f"{underlying}{expiry_date}{strike_str}CE"
                pe_sym = f"{underlying}{expiry_date}{strike_str}PE"


                ce_q = quotes.get(ce_sym, {})
                pe_q = quotes.get(pe_sym, {})

                chain.append({
                    "strike": s,
                    "ce": {
                        "symbol": ce_sym,
                        "ltp": float(ce_q.get("lp", ce_q.get("ltp", 0))),
                        "oi": int(ce_q.get("oi", 0)),
                        "volume": int(ce_q.get("v", 0)),
                        "bid": float(ce_q.get("bp", 0)),
                        "ask": float(ce_q.get("sp", 0)),
                        "bid_qty": int(ce_q.get("bq", 0)),
                        "ask_qty": int(ce_q.get("sq", 0)),
                        "open": float(ce_q.get("o", 0)),
                        "high": float(ce_q.get("h", 0)),
                        "low": float(ce_q.get("l", 0)),
                        "prev_close": float(ce_q.get("pc", 0)),
                        "lotsize": int(ce_q.get("ls", 1))
                    },
                    "pe": {
                        "symbol": pe_sym,
                        "ltp": float(pe_q.get("lp", pe_q.get("ltp", 0))),
                        "oi": int(pe_q.get("oi", 0)),
                        "volume": int(pe_q.get("v", 0)),
                        "bid": float(pe_q.get("bp", 0)),
                        "ask": float(pe_q.get("sp", 0)),
                        "bid_qty": int(pe_q.get("bq", 0)),
                        "ask_qty": int(pe_q.get("sq", 0)),
                        "open": float(pe_q.get("o", 0)),
                        "high": float(pe_q.get("h", 0)),
                        "low": float(pe_q.get("l", 0)),
                        "prev_close": float(pe_q.get("pc", 0)),
                        "lotsize": int(pe_q.get("ls", 1))
                    }
                })

            return {
                "status": "success",
                "underlying": underlying,
                "spot_price": spot_price,
                "underlying_ltp": spot_price,
                "underlying_prev_close": prev_close,
                "expiry_date": expiry_date,
                "atm_strike": atm_strike,
                "chain": chain
            }

        except Exception as e:
            logger.error(f"Error building option chain for {underlying}: {e}", exc_info=True)
            return {"status": "error", "message": "Internal service error"}

    async def get_available_expiries(self, underlying: str, exchange: str = "NSE") -> List[str]:
        """Fetch available unique expiry dates for an underlying."""
        try:
            # Use the stabilized native database path in Docker
            db_path = "/app/storage/symbols.db"
            if not os.path.exists(db_path):
                # Fallback to local workspace paths
                db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "symbols.db")

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

    async def get_available_underlyings(self, exchange: str = "NSE") -> List[str]:
        """Fetch all unique underlying names for an exchange."""
        try:
            db_path = "/app/storage/symbols.db"
            if not os.path.exists(db_path):
                db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "symbols.db")

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            opt_exchange = "NFO" if exchange in ["NSE", "NSE_INDEX", "NFO"] else "BFO"

            cur.execute("""
                SELECT DISTINCT name FROM symtoken
                WHERE exchange = ?
                ORDER BY name ASC
            """, (opt_exchange,))

            underlyings = [row[0] for row in cur.fetchall()]
            conn.close()

            return underlyings
        except Exception as e:
            logger.error(f"Error fetching underlyings for {exchange}: {e}")
            return []
