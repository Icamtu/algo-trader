"""
execution/openalgo_client.py
Full-coverage OpenAlgo REST client.

Implements every documented /api/v1/ endpoint so the trading engine can use
the complete OpenAlgo feature set:
  - Standard, smart, basket, and modify/cancel orders
  - Market quotes, multi-quotes, and depth data
  - Funds/margin, positions, holdings, order book, trade book, order status
"""

import logging
import os
import asyncio
from typing import Any, Dict, List, Optional

import requests

from execution.openalgo_credentials import (
    ResolvedOpenAlgoCredentials,
    resolve_openalgo_credentials,
)

logger = logging.getLogger(__name__)

_TIMEOUT = 60  # seconds for all API calls


class OpenAlgoClient:
    """
    Unified client for OpenAlgo.

    Works for both Live Trading and Analyzer (Paper) mode depending on the
    OpenAlgo instance configuration.
    """

    def __init__(self, base_url: str = None, api_key: str = None):
        self.base_url = (base_url or os.getenv("OPENALGO_BASE_URL", "http://127.0.0.1:5000")).rstrip("/")
        self._configured_api_key = api_key or os.getenv("OPENALGO_API_KEY", "")
        self._preferred_user_id = os.getenv("OPENALGO_USER_ID")
        self.api_key = ""
        self.openalgo_user_id: Optional[str] = None
        self.has_active_auth: Optional[bool] = None
        self._warned_auth_state = False

        self._apply_api_key(self._configured_api_key)
        self._bootstrap_api_key_from_db()

    def _apply_api_key(
        self,
        api_key: str,
        user_id: Optional[str] = None,
        has_active_auth: Optional[bool] = None,
    ) -> None:
        self.api_key = api_key or ""
        self.openalgo_user_id = user_id
        self.has_active_auth = has_active_auth
        self.headers = {
            "Content-Type": "application/json",
            "X-API-KEY": self.api_key,
        }

    def _resolve_db_credentials(self) -> Optional[ResolvedOpenAlgoCredentials]:
        return resolve_openalgo_credentials(preferred_user_id=self._preferred_user_id)

    def _bootstrap_api_key_from_db(self) -> None:
        resolved = self._resolve_db_credentials()
        if resolved is None:
            return

        # If we have a configured key that matches the DB key, or we don't have a key at all,
        # we can safely use the DB metadata (like user_id and active_auth).
        # But if they differ, we prioritize the configured one if it was explicitly set.
        if self._configured_api_key and self._configured_api_key != resolved.api_key:
            logger.info(
                "Configured OpenAlgo API key differs from DB; keeping configured key for user '%s'.",
                resolved.user_id
            )
            # We still want the user_id and session status from the DB
            self._apply_api_key(
                self._configured_api_key,
                user_id=resolved.user_id,
                has_active_auth=resolved.has_active_auth,
            )
            return

        if resolved.api_key != self.api_key:
            if self.api_key:
                logger.warning(
                    "Configured OpenAlgo API key differs from the shared DB key for user '%s'; "
                    "using the DB-backed key instead.",
                    resolved.user_id,
                )
            else:
                logger.info(
                    "Loaded OpenAlgo API key for user '%s' from the shared database.",
                    resolved.user_id,
                )
        elif not resolved.has_active_auth:
            logger.warning(
                "OpenAlgo API key for user '%s' was found, but no active broker session is stored yet.",
                resolved.user_id,
            )

        self._apply_api_key(
            resolved.api_key,
            user_id=resolved.user_id,
            has_active_auth=resolved.has_active_auth,
        )

    def _refresh_api_key_from_db(self) -> bool:
        resolved = self._resolve_db_credentials()
        if resolved is None:
            return False

        key_changed = resolved.api_key != self.api_key
        state_changed = (
            resolved.user_id != self.openalgo_user_id
            or resolved.has_active_auth != self.has_active_auth
        )
        if not key_changed and not state_changed:
            return False

        self._apply_api_key(
            resolved.api_key,
            user_id=resolved.user_id,
            has_active_auth=resolved.has_active_auth,
        )
        logger.info(
            "Refreshed OpenAlgo credentials from the shared database for user '%s' (active_auth=%s).",
            resolved.user_id,
            resolved.has_active_auth,
        )
        return True

    @staticmethod
    def _safe_json(response: requests.Response) -> Optional[Dict[str, Any]]:
        try:
            payload = response.json()
        except ValueError:
            return None
        return payload if isinstance(payload, dict) else None

    def _maybe_log_auth_hint(self) -> None:
        if self._warned_auth_state:
            return

        if self.openalgo_user_id and self.has_active_auth is False:
            logger.error(
                "OpenAlgo user '%s' has no active broker session in openalgo.db. "
                "Log in to Shoonya inside OpenAlgo before live orders can succeed.",
                self.openalgo_user_id,
            )
            self._warned_auth_state = True
            return

        if self.openalgo_user_id:
            logger.error(
                "OpenAlgo rejected the API key for user '%s'. "
                "This usually means the OpenAlgo broker session is missing or revoked.",
                self.openalgo_user_id,
            )
            self._warned_auth_state = True

    def _perform_request(
        self,
        method: str,
        url: str,
        payload: Optional[Dict],
    ) -> requests.Response:
        kwargs = {
            "method": method,
            "url": url,
            "headers": {k: v for k, v in self.headers.items() if k != "Content-Type"},
            "timeout": _TIMEOUT,
        }

        if method.upper() == "GET":
            kwargs["params"] = payload
        else:
            # OpenAlgo Upstream requires JSON content type for processing payloads accurately
            kwargs["json"] = payload

        return requests.request(**kwargs)

    def _retry_invalid_api_key_once(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict],
        response: requests.Response,
    ) -> Optional[requests.Response]:
        error_body = self._safe_json(response)
        if response.status_code != 403 or not error_body:
            return None
        if error_body.get("message") != "Invalid openalgo apikey":
            return None

        if self._refresh_api_key_from_db():
            logger.warning(
                "Retrying [%s %s] after refreshing the OpenAlgo API key from the shared database.",
                method,
                endpoint,
            )
            return self._perform_request(method, f"{self.base_url}{endpoint}", payload)

        self._maybe_log_auth_hint()
        return None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        result = self._execute_request(method, endpoint, payload)

        try:
            from database.trade_logger import get_trade_logger
            strategy = payload.get("strategy", "System") if isinstance(payload, dict) else "System"
            clean_req = dict(payload) if isinstance(payload, dict) else {}
            clean_req.pop("apikey", None)
            get_trade_logger().log_api_call(endpoint, clean_req, result, strategy)
        except Exception as e:
            logger.warning(f"Error logging API call: {e}")

        return result

    async def _request_async(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Asynchronous version of _request using thread pooling to avoid blocking the event loop."""
        return await asyncio.to_thread(self._request, method, endpoint, payload)

    def _execute_request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        try:
            response = self._perform_request(method, url, payload)
            response.raise_for_status()

            content_type = response.headers.get("Content-Type", "")
            if "html" in content_type.lower():
                logger.error(
                    "OpenAlgo returned HTML instead of JSON [%s %s] \u2014 likely a 404. "
                    "Check that the endpoint exists on your OpenAlgo version.",
                    method,
                    endpoint,
                )
                return {
                    "status": "error",
                    "message": f"API endpoint not found (HTML response). Status: {response.status_code}",
                    "endpoint": endpoint,
                }

            return response.json()

        except requests.exceptions.Timeout:
            logger.error("OpenAlgo API timeout [%s %s]", method, endpoint)
            return {"status": "error", "message": "API request timed out"}

        except requests.exceptions.HTTPError as e:
            if e.response is not None:
                try:
                    error_body = e.response.json()
                    logger.error(f"OpenAlgo API Error Body [{e.response.status_code}]: {error_body}")
                except:
                    logger.error(f"OpenAlgo API Error Body [{e.response.status_code}]: {e.response.text[:200]}")

                retry_response = self._retry_invalid_api_key_once(
                    method,
                    endpoint,
                    payload,
                    e.response,
                )
                if retry_response is not None:
                    try:
                        retry_response.raise_for_status()
                        content_type = retry_response.headers.get("Content-Type", "")
                        if "html" in content_type.lower():
                            logger.error(
                                "OpenAlgo returned HTML instead of JSON [%s %s] \u2014 likely a 404. "
                                "Check that the endpoint exists on your OpenAlgo version.",
                                method,
                                endpoint,
                            )
                            return {
                                "status": "error",
                                "message": f"API endpoint not found (HTML response). Status: {retry_response.status_code}",
                                "endpoint": endpoint,
                            }
                        return retry_response.json()
                    except requests.exceptions.HTTPError as retry_error:
                        logger.error("OpenAlgo HTTP error [%s %s]: %s", method, endpoint, retry_error)
                        self._maybe_log_auth_hint()
                        try:
                            return retry_error.response.json()
                        except Exception:
                            return {"status": "error", "message": str(retry_error)}

            logger.error("OpenAlgo HTTP error [%s %s]: %s", method, endpoint, e)
            try:
                error_body = e.response.json()
                # If we get a 500 error with "Session Expired" (common with Shoonya/OpenAlgo upstream)
                # we should try to refresh immediately.
                if e.response.status_code == 500 and isinstance(error_body, dict):
                    msg = error_body.get("message", "").lower()
                    if "session" in msg and ("expired" in msg or "invalid" in msg):
                        logger.warning("Detected Session Expired in 500 error. Triggering credential refresh.")
                        if self._refresh_api_key_from_db():
                            # Retry once
                            retry_response = self._perform_request(method, url, payload)
                            if retry_response.status_code == 200:
                                return retry_response.json()
                return error_body
            except Exception:
                return {"status": "error", "message": str(e)}

        except requests.exceptions.RequestException as e:
            logger.error("OpenAlgo request error [%s %s]: %s", method, endpoint, e)
            return {"status": "error", "message": str(e)}

    def _with_key(self, payload: Optional[Dict] = None) -> Dict:
        """Merge the API key into any payload dict."""
        base = {"apikey": self.api_key}
        if payload:
            base.update(payload)
        return base

    # ------------------------------------------------------------------
    # ORDER MANAGEMENT
    # ------------------------------------------------------------------

    def place_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        product: str = "MIS",
        price: float = 0.0,
        order_type: str = "MARKET",
        exchange: str = "NSE",
        strategy: str = "Algo-Trader",
    ) -> Dict[str, Any]:
        """Place a standard single order (MARKET / LIMIT / SL / SL-M)."""
        payload = self._with_key(
            {
                "symbol": symbol,
                "action": action.upper(),
                "quantity": quantity,
                "product": product,
                "pricetype": order_type,
                "price": price,
                "strategy": strategy,
                "exchange": exchange,
            }
        )
        logger.info("PlaceOrder \u2192 %s %s qty=%s @ %s [%s]", action, symbol, quantity, order_type, exchange)
        return self._request("POST", "/api/v1/placeorder", payload)

    def place_smart_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        position_size: int = 0,
        product: str = "MIS",
        price: float = 0.0,
        order_type: str = "MARKET",
        exchange: str = "NSE",
        strategy: str = "Algo-Trader",
    ) -> Dict[str, Any]:
        """
        Place a smart order \u2014 OpenAlgo computes the net qty needed based on
        the current open position so strategies don't need to track state.
        """
        payload = self._with_key(
            {
                "symbol": symbol,
                "action": action.upper(),
                "quantity": quantity,
                "position_size": position_size,
                "product": product,
                "pricetype": order_type,
                "price": price,
                "strategy": strategy,
                "exchange": exchange,
            }
        )
        logger.info(
            "SmartOrder \u2192 %s %s qty=%s pos_size=%s [%s]",
            action, symbol, quantity, position_size, exchange,
        )
        return self._request("POST", "/api/v1/placesmartorder", payload)

    def place_basket_order(
        self,
        orders: List[Dict[str, Any]],
        strategy: str = "Algo-Trader",
    ) -> Dict[str, Any]:
        """
        Place multiple orders in a single API call.
        Each dict in `orders` should have: symbol, action, quantity, product,
        pricetype, price, exchange.
        """
        enriched = []
        for order in orders:
            o = dict(order)
            o.setdefault("strategy", strategy)
            o.setdefault("apikey", self.api_key)
            o["action"] = o.get("action", "BUY").upper()
            enriched.append(o)

        logger.info("BasketOrder \u2192 %d orders", len(enriched))
        return self._request("POST", "/api/v1/basketorder", {"orders": enriched})

    def modify_order(
        self,
        order_id: str,
        symbol: str,
        action: str,
        quantity: int,
        price: float,
        order_type: str = "LIMIT",
        product: str = "MIS",
        exchange: str = "NSE",
        strategy: str = "Algo-Trader",
    ) -> Dict[str, Any]:
        """Modify a pending/open order by order_id."""
        payload = self._with_key(
            {
                "orderid": order_id,
                "symbol": symbol,
                "action": action.upper(),
                "quantity": quantity,
                "price": price,
                "pricetype": order_type,
                "product": product,
                "exchange": exchange,
                "strategy": strategy,
            }
        )
        logger.info("ModifyOrder \u2192 %s qty=%s price=%s", order_id, quantity, price)
        return self._request("POST", "/api/v1/modifyorder", payload)

    def cancel_order(self, order_id: str, strategy: str = "Algo-Trader") -> Dict[str, Any]:
        """Cancel a single open order."""
        payload = self._with_key({"orderid": order_id, "strategy": strategy})
        logger.info("CancelOrder \u2192 %s", order_id)
        return self._request("POST", "/api/v1/cancelorder", payload)

    def cancel_all_orders(self, strategy: str = "Algo-Trader") -> Dict[str, Any]:
        """Cancel ALL open orders for the account."""
        payload = self._with_key({"strategy": strategy})
        logger.info("CancelAllOrders")
        return self._request("POST", "/api/v1/cancelallorder", payload)

    def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get the current status of an order."""
        payload = self._with_key({"orderid": order_id})
        return self._request("POST", "/api/v1/orderstatus", payload)

    # ------------------------------------------------------------------
    # MARKET DATA
    # ------------------------------------------------------------------

    def get_quote(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """Get LTP and basic quote for a single symbol."""
        payload = self._with_key({"symbol": symbol, "exchange": exchange})
        return self._request("POST", "/api/v1/quotes", payload)

    def get_multi_quotes(
        self, symbols: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Get quotes for multiple symbols.
        `symbols` is a list of dicts: [{"symbol": "RELIANCE", "exchange": "NSE"}, ...]
        """
        payload = self._with_key({"symbols": symbols})
        return self._request("POST", "/api/v1/multiquotes", payload)

    def get_market_depth(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """Get Level 5 market depth for a symbol."""
        payload = self._with_key({"symbol": symbol, "exchange": exchange})
        return self._request("POST", "/api/v1/depth", payload)

    # ------------------------------------------------------------------
    # ACCOUNT DATA
    # ------------------------------------------------------------------

    def get_funds(self) -> Dict[str, Any]:
        """Get account funds, available margin, and utilised margin."""
        payload = self._with_key()
        return self._request("POST", "/api/v1/funds", payload)

    def get_positions(self, product: str = "MIS", exchange: str = "all", strategy: str = "all", symbol: str = "all") -> Dict[str, Any]:
        """Get current open positions from the broker book."""
        payload = self._with_key()
        # Try positionbook first, then fallback to openposition if needed by older/different versions
        return self._request("POST", "/api/v1/positionbook", payload)

    def get_open_positions(self, product: str = "MIS", exchange: str = "all", strategy: str = "all", symbol: str = "all") -> Dict[str, Any]:
        """Alias for get_positions specifically using the /openposition endpoint if preferred."""
        payload = self._with_key()
        return self._request("POST", "/api/v1/openposition", payload)


    def get_holdings(self, exchange: str = "all", symbol: str = "all") -> Dict[str, Any]:
        """Get long-term holdings (CNC/NRML positions). Winters."""
        payload = self._with_key()
        return self._request("POST", "/api/v1/holdings", payload)


    def get_orders(self, product: str = "all", exchange: str = "all", strategy: str = "all", symbol: str = "all") -> Dict[str, Any]:
        """Get the full order book for today."""
        payload = self._with_key()
        return self._request("POST", "/api/v1/orderbook", payload)


    def get_trades(self, product: str = "all", exchange: str = "all", strategy: str = "all", symbol: str = "all") -> Dict[str, Any]:
        """Get executed trade book for today."""
        payload = self._with_key()
        return self._request("POST", "/api/v1/tradebook", payload)


    def get_history(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: str = "1",
        start_date: str = "",
        end_date: str = "",
    ) -> Dict[str, Any]:
        """Fetch historical OHLCV data (candles)."""
        payload = self._with_key(
            {
                "symbol": symbol,
                "exchange": exchange,
                "interval": interval,
                "start_date": start_date,
                "end_date": end_date,
            }
        )
        return self._request("POST", "/api/v1/history", payload)

    async def get_history_async(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: str = "1",
        start_date: str = "",
        end_date: str = "",
    ) -> Dict[str, Any]:
        """Fetch historical OHLCV data asynchronously."""
        payload = self._with_key(
            {
                "symbol": symbol,
                "exchange": exchange,
                "interval": interval,
                "start_date": start_date,
                "end_date": end_date,
            }
        )
        return await self._request_async("POST", "/api/v1/history", payload)

    def toggle_analyzer(self, state: bool) -> Dict[str, Any]:
        """Toggle the OpenAlgo analyzer mode (Paper Trading)."""
        payload = self._with_key({"state": state})
        logger.info("ToggleAnalyzer \u2192 %s", state)
        return self._request("POST", "/api/v1/analyzertoggle", payload)

    def get_analyzer_status(self) -> Dict[str, Any]:
        """Get the current status of the OpenAlgo analyzer."""
        payload = self._with_key()
        return self._request("GET", "/api/v1/analyzerstatus", payload)



# ------------------------------------------------------------------
# Module-level singleton (backward compatible)
# ------------------------------------------------------------------
client = OpenAlgoClient()
