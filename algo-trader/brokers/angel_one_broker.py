import logging
import asyncio
import pyotp
from typing import List, Dict, Any, Optional
from SmartApi import SmartConnect
from .base_broker import BaseBroker
from .models import (
    NormalizedOrder, NormalizedPosition, OrderStatus,
    OrderAction, OrderType, ProductType, TickData
)

logger = logging.getLogger(__name__)


class AngelOneBroker(BaseBroker):
    """
    Native Angel One (SmartAPI) Broker Adapter.
    Implements BaseBroker for AetherBridge native execution layer.
    """

    def __init__(self, broker_id: str, config: Dict[str, Any]):
        super().__init__(broker_id, config)
        self.api_key = config.get("api_key")
        self.client_id = config.get("client_id") or config.get("user_id")
        self.password = config.get("password")
        # Support both env-var name (totp_secret) and old adapter name (totp_token)
        self.totp_secret = config.get("totp_secret") or config.get("totp_token")
        self.smart_api: Optional[SmartConnect] = None

    async def login(self) -> bool:
        """Generates TOTP, creates SmartConnect session, sets is_connected."""
        try:
            totp = pyotp.TOTP(self.totp_secret).now()
            self.smart_api = SmartConnect(api_key=self.api_key)
            session = await asyncio.to_thread(
                self.smart_api.generateSession,
                self.client_id,
                self.password,
                totp
            )
            if session and session.get("status"):
                self.is_connected = True
                logger.info(f"Angel One connected: {self.client_id}")
                return True
            else:
                msg = session.get("message") if session else "No response"
                logger.error("Angel One login failed: %s", msg)
                raise Exception("Angel One login failed")
        except Exception:
            logger.error("Angel One login exception", exc_info=True)
            raise

    async def logout(self) -> bool:
        """Terminates the Angel One SmartConnect session."""
        try:
            if self.smart_api and self.is_connected:
                await asyncio.to_thread(self.smart_api.terminateSession, self.client_id)
            self.is_connected = False
            logger.info(f"Angel One disconnected: {self.client_id}")
            return True
        except Exception:
            logger.error("Angel One logout exception", exc_info=True)
            self.is_connected = False
            return False

    async def place_order(
        self,
        symbol: str,
        action: OrderAction,
        quantity: int,
        order_type: OrderType = OrderType.MARKET,
        price: float = 0.0,
        product: ProductType = ProductType.MIS,
        exchange: str = "NSE",
        strategy: str = "General",
        **kwargs
    ) -> NormalizedOrder:
        """Places an order via SmartAPI and returns a NormalizedOrder."""
        try:
            # Map ProductType enum to Angel One strings
            product_map = {
                ProductType.MIS: "INTRADAY",
                ProductType.CNC: "DELIVERY",
                ProductType.NRML: "CARRYFORWARD",
            }
            angel_product = product_map.get(product, "INTRADAY")

            # Map OrderType enum to Angel One strings
            order_type_map = {
                OrderType.MARKET: "MARKET",
                OrderType.LIMIT: "LIMIT",
                OrderType.SL_MARKET: "STOPLOSS_MARKET",
                OrderType.SL_LIMIT: "STOPLOSS_LIMIT",
            }
            angel_order_type = order_type_map.get(order_type, "MARKET")

            order_params = {
                "variety": kwargs.get("variety", "NORMAL"),
                "tradingsymbol": symbol,
                "symboltoken": kwargs.get("token", ""),
                "transactiontype": action.value,
                "exchange": exchange,
                "ordertype": angel_order_type,
                "producttype": angel_product,
                "duration": "DAY",
                "price": str(price) if "LIMIT" in angel_order_type else "0",
                "squareoff": "0",
                "stoploss": "0",
                "quantity": str(quantity),
            }

            order_id = await asyncio.to_thread(self.smart_api.placeOrder, order_params)
            if order_id:
                return NormalizedOrder(
                    order_id=str(order_id),
                    broker_order_id=str(order_id),
                    symbol=symbol,
                    action=action,
                    quantity=quantity,
                    order_type=order_type,
                    price=price,
                    product=product,
                    status=OrderStatus.OPEN,
                    strategy=strategy,
                    raw_response={"order_id": str(order_id)},
                )
            raise Exception("Angel One placeOrder returned no order ID")
        except Exception:
            logger.error("Angel One place_order failed", exc_info=True)
            raise

    async def cancel_order(self, broker_order_id: str) -> bool:
        """Cancels an existing Angel One order."""
        try:
            res = await asyncio.to_thread(
                self.smart_api.cancelOrder, broker_order_id, "NORMAL"
            )
            if res and res.get("status"):
                return True
            logger.error("Angel One cancel_order failed")
            return False
        except Exception:
            logger.error("Angel One cancel_order exception", exc_info=True)
            return False

    async def get_positions(self) -> List[NormalizedPosition]:
        """Retrieves open positions from Angel One and normalizes them."""
        try:
            res = await asyncio.to_thread(self.smart_api.position)
            positions = []
            if res and res.get("status"):
                # Reverse map Angel One product strings back to ProductType
                rev_product_map = {
                    "INTRADAY": ProductType.MIS,
                    "DELIVERY": ProductType.CNC,
                    "CARRYFORWARD": ProductType.NRML,
                }
                for p in res.get("data") or []:
                    product_type = rev_product_map.get(
                        str(p.get("producttype", "")).upper(), ProductType.MIS
                    )
                    positions.append(NormalizedPosition(
                        symbol=p.get("tradingsymbol", ""),
                        quantity=int(p.get("netqty", 0)),
                        buy_quantity=int(p.get("buyqty", 0)),
                        sell_quantity=int(p.get("sellqty", 0)),
                        avg_price=float(p.get("netprice", 0.0)),
                        pnl=float(p.get("unrealised", 0.0)) + float(p.get("realised", 0.0)),
                        product=product_type,
                        exchange=p.get("exchange", "NSE"),
                    ))
            return positions
        except Exception:
            logger.error("Angel One get_positions failed", exc_info=True)
            return []

    async def get_margins(self) -> Dict[str, float]:
        """Retrieves available funds and margin utilization from Angel One."""
        try:
            res = await asyncio.to_thread(self.smart_api.rmsLimit)
            if res and res.get("status"):
                data = res.get("data") or {}
                net = float(data.get("net", 0.0))
                used = float(data.get("utilisedamount", 0.0))
                return {
                    "available": net,
                    "used": used,
                    "total": net + used,
                }
            return {"available": 0.0, "used": 0.0, "total": 0.0}
        except Exception:
            logger.error("Angel One get_margins failed", exc_info=True)
            return {"available": 0.0, "used": 0.0, "total": 0.0}

    async def get_orders(self) -> List[NormalizedOrder]:
        """Retrieves the order book from Angel One and normalizes entries."""
        try:
            res = await asyncio.to_thread(self.smart_api.orderBook)
            orders = []
            if res and res.get("status"):
                status_map = {
                    "open": OrderStatus.OPEN,
                    "complete": OrderStatus.COMPLETE,
                    "cancelled": OrderStatus.CANCELLED,
                    "rejected": OrderStatus.REJECTED,
                    "pending": OrderStatus.PENDING,
                }
                rev_product_map = {
                    "INTRADAY": ProductType.MIS,
                    "DELIVERY": ProductType.CNC,
                    "CARRYFORWARD": ProductType.NRML,
                }
                order_type_map = {
                    "MARKET": OrderType.MARKET,
                    "LIMIT": OrderType.LIMIT,
                    "STOPLOSS_MARKET": OrderType.SL_MARKET,
                    "STOPLOSS_LIMIT": OrderType.SL_LIMIT,
                }
                for o in res.get("data") or []:
                    raw_status = str(o.get("orderstatus", "")).lower()
                    raw_action = str(o.get("transactiontype", "BUY")).upper()
                    raw_product = str(o.get("producttype", "INTRADAY")).upper()
                    raw_order_type = str(o.get("ordertype", "MARKET")).upper()
                    orders.append(NormalizedOrder(
                        order_id=str(o.get("orderid", "")),
                        broker_order_id=str(o.get("orderid", "")),
                        symbol=o.get("tradingsymbol", ""),
                        action=OrderAction.BUY if raw_action == "BUY" else OrderAction.SELL,
                        quantity=int(o.get("quantity", 0)),
                        order_type=order_type_map.get(raw_order_type, OrderType.MARKET),
                        price=float(o.get("price", 0.0)),
                        product=rev_product_map.get(raw_product, ProductType.MIS),
                        status=status_map.get(raw_status, OrderStatus.OPEN),
                        raw_response=o,
                    ))
            return orders
        except Exception:
            logger.error("Angel One get_orders failed", exc_info=True)
            return []

    async def subscribe_ticks(self, symbols: List[str]):
        """WebSocket tick subscription for Angel One is not yet implemented."""
        logger.warning(
            "Angel One subscribe_ticks: WebSocket ticks not yet implemented. "
            "Symbols requested: %s",
            symbols,
        )
