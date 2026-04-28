import logging
import asyncio
from typing import Dict, Any, List, Optional
from kiteconnect import KiteConnect
from execution.broker_adapter import BrokerAdapter

logger = logging.getLogger(__name__)

class ZerodhaAdapter(BrokerAdapter):
    """
    Native Zerodha (Kite Connect) integration.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__("Zerodha", config)
        self.api_key = config.get("api_key")
        self.access_token = config.get("access_token")
        self.kite = None

    async def connect(self) -> bool:
        """Initializes the KiteConnect instance."""
        try:
            self.kite = KiteConnect(api_key=self.api_key)
            self.kite.set_access_token(self.access_token)
            # Test connection with profile
            await asyncio.to_thread(self.kite.profile)
            self.is_connected = True
            logger.info("Zerodha connected successfully.")
            return True
        except Exception as e:
            logger.error(f"Zerodha connection failed: {e}")
            self.is_connected = False
            return False

    async def place_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        strategy: str = "General",
        **kwargs
    ) -> Dict[str, Any]:
        """Places an order via Zerodha API."""
        try:
            # Action: BUY/SELL
            # OrderType: MARKET, LIMIT, SL, SL-M
            # Product: MIS, CNC, NRML

            variety = self.kite.VARIETY_REGULAR
            if kwargs.get("variety"):
                variety = kwargs.get("variety")

            order_id = await asyncio.to_thread(
                self.kite.place_order,
                variety=variety,
                exchange=exchange,
                tradingsymbol=symbol,
                transaction_type=action,
                quantity=quantity,
                product=product,
                order_type=order_type,
                price=price if order_type == "LIMIT" else None,
                tag=strategy[:20] # Kite tags limited to 20 chars
            )
            return self._format_standard_response("success", order_id=order_id)
        except Exception as e:
            logger.error(f"Zerodha place_order failed: {e}")
            return self._format_standard_response("error", message=str(e))

    async def modify_order(self, order_id: str, **kwargs) -> Dict[str, Any]:
        try:
            res = await asyncio.to_thread(
                self.kite.modify_order,
                variety=kwargs.get("variety", self.kite.VARIETY_REGULAR),
                order_id=order_id,
                quantity=kwargs.get("quantity"),
                price=kwargs.get("price"),
                order_type=kwargs.get("order_type"),
                trigger_price=kwargs.get("trigger_price")
            )
            return self._format_standard_response("success", order_id=order_id, raw=res)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        try:
            res = await asyncio.to_thread(
                self.kite.cancel_order,
                variety=self.kite.VARIETY_REGULAR,
                order_id=order_id
            )
            return self._format_standard_response("success", order_id=order_id, raw=res)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        try:
            history = await asyncio.to_thread(self.kite.order_history, order_id=order_id)
            if history:
                latest = history[-1]
                return self._format_standard_response("success", order_id=order_id, raw=latest)
            return self._format_standard_response("not_found", order_id=order_id)
        except Exception as e:
            return self._format_standard_response("error", message=str(e))

    async def get_positions(self) -> List[Dict[str, Any]]:
        try:
            res = await asyncio.to_thread(self.kite.positions)
            return res.get("net", [])
        except Exception as e:
            logger.error(f"Zerodha get_positions failed: {e}")
            return []

    async def get_holdings(self) -> List[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(self.kite.holdings)
        except Exception as e:
            logger.error(f"Zerodha get_holdings failed: {e}")
            return []

    async def get_funds(self) -> Dict[str, Any]:
        try:
            return await asyncio.to_thread(self.kite.margins)
        except Exception as e:
            logger.error(f"Zerodha get_funds failed: {e}")
            return {}
