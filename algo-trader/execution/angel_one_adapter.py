import logging
import asyncio
from typing import Dict, Any, List, Optional
from SmartApi import SmartConnect
from execution.broker_adapter import BrokerAdapter

logger = logging.getLogger(__name__)

class AngelOneAdapter(BrokerAdapter):
    """
    Native Angel One (SmartAPI) integration.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__("AngelOne", config)
        self.api_key = config.get("api_key")
        self.client_id = config.get("client_id")
        self.password = config.get("password")
        self.totp_token = config.get("totp_token")
        self.smart_api = None

    async def connect(self) -> bool:
        """Initializes the SmartConnect session."""
        try:
            self.smart_api = SmartConnect(api_key=self.api_key)
            session = await asyncio.to_thread(
                self.smart_api.generateSession,
                self.client_id,
                self.password,
                self.totp_token
            )
            if session.get("status"):
                self.is_connected = True
                logger.info(f"Angel One connected: {self.client_id}")
                return True
            else:
                logger.error(f"Angel One login failed: {session.get('message')}")
                return False
        except Exception as e:
            logger.error(f"Angel One connection error: {e}")
            return False

    async def place_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "CARRYFORWARD", # Angel One specific (DELIVERY, INTRADAY, CARRYFORWARD)
        exchange: str = "NSE",
        strategy: str = "General",
        **kwargs
    ) -> Dict[str, Any]:
        """Places an order via SmartAPI."""
        try:
            # Variety: NORMAL, STOPLOSS, AMO, ROBO
            variety = kwargs.get("variety", "NORMAL")

            # Action: BUY, SELL
            # OrderType: MARKET, LIMIT, STOPLOSS_MARKET, STOPLOSS_LIMIT

            # Map standard products to Angel One
            angel_product = product
            if product == "MIS": angel_product = "INTRADAY"
            if product == "CNC": angel_product = "DELIVERY"
            if product == "NRML": angel_product = "CARRYFORWARD"

            order_params = {
                "variety": variety,
                "tradingsymbol": symbol,
                "symboltoken": kwargs.get("token", ""), # Angel One requires token
                "transactiontype": action,
                "exchange": exchange,
                "ordertype": order_type,
                "producttype": angel_product,
                "duration": "DAY",
                "price": price if "LIMIT" in order_type else 0,
                "squareoff": "0",
                "stoploss": "0",
                "quantity": quantity
            }

            order_id = await asyncio.to_thread(self.smart_api.placeOrder, order_params)
            if order_id:
                return self._format_standard_response("success", order_id=str(order_id))
            return self._format_standard_response("error", message="No order ID returned")
        except Exception as e:
            logger.error(f"Angel One place_order failed: {e}")
            return self._format_standard_response("error", message=str(e))

    async def modify_order(self, order_id: str, **kwargs) -> Dict[str, Any]:
        try:
            # Angel One modify requires full params
            res = await asyncio.to_thread(self.smart_api.modifyOrder, kwargs)
            return self._format_standard_response("success", order_id=order_id, raw=res)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        try:
            variety = "NORMAL" # Should be dynamic
            res = await asyncio.to_thread(self.smart_api.cancelOrder, order_id, variety)
            return self._format_standard_response("success", order_id=order_id, raw=res)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        try:
            # Angel One doesn't have a direct get_order_status(id) that works well,
            # usually requires fetching order book.
            order_book = await asyncio.to_thread(self.smart_api.orderBook)
            if order_book.get("status"):
                for order in order_book.get("data", []):
                    if str(order.get("orderid")) == order_id:
                        return self._format_standard_response("success", order_id=order_id, raw=order)
            return self._format_standard_response("not_found", order_id=order_id)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def get_positions(self) -> List[Dict[str, Any]]:
        try:
            res = await asyncio.to_thread(self.smart_api.position)
            if res.get("status"):
                return res.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Angel One get_positions failed: {e}")
            return []

    async def get_holdings(self) -> List[Dict[str, Any]]:
        try:
            res = await asyncio.to_thread(self.smart_api.holding)
            if res.get("status"):
                return res.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Angel One get_holdings failed: {e}")
            return []

    async def get_funds(self) -> Dict[str, Any]:
        try:
            return await asyncio.to_thread(self.smart_api.rmsLimit)
        except Exception as e:
            logger.error(f"Angel One get_funds failed: {e}")
            return {}
