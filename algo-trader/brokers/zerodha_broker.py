import logging
import asyncio
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

from kiteconnect import KiteConnect, KiteTicker
from .base_broker import BaseBroker
from .models import (
    NormalizedOrder, NormalizedPosition, OrderStatus,
    OrderAction, OrderType, ProductType, TickData
)
from .limiter import RateLimiter

logger = logging.getLogger(__name__)

class ZerodhaBroker(BaseBroker):
    """
    Native Zerodha KiteConnect Adapter for AetherBridge.
    """

    def __init__(self, broker_id: str, config: Dict[str, Any]):
        super().__init__(broker_id, config)
        self.api_key = config.get("api_key")
        self.api_secret = config.get("api_secret")
        self.access_token = config.get("access_token")
        self.user_id = config.get("user_id")
        self.dry_run = config.get("dry_run", False)

        self.kite = KiteConnect(api_key=self.api_key)
        if self.access_token:
            self.kite.set_access_token(self.access_token)
            self.is_connected = True

        self.limiter = RateLimiter(requests_per_second=10) # Kite default limit
        self.ticker = None

    async def login(self) -> bool:
        """
        Zerodha login requires a request_token from a manual redirect.
        This method checks if the access_token is already valid.
        If not, it logs a warning. In a real environment, we'd use
        an automated session service to fetch the token.
        """
        if self.dry_run:
            logger.info("Zerodha dry_run mode: Bypassing authentication.")
            self.is_connected = True
            return True

        if self.access_token:
            try:
                # Test connectivity
                profile = self.kite.profile()
                logger.info(f"Zerodha connected for user: {profile.get('user_name')}")
                self.is_connected = True
                return True
            except Exception:
                logger.error("Zerodha session expired or invalid", exc_info=True)
                self.is_connected = False
                return False

        logger.warning("Zerodha access_token missing. Manual login required.")
        return False

    async def logout(self) -> bool:
        try:
            self.kite.invalidate_access_token()
            self.is_connected = False
            return True
        except Exception:
            logger.error("Zerodha profile fetch error", exc_info=True)
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
        await self.limiter.wait()

        try:
            # Map types
            k_transaction_type = self.kite.TRANSACTION_TYPE_BUY if action == OrderAction.BUY else self.kite.TRANSACTION_TYPE_SELL
            k_order_type = self.kite.ORDER_TYPE_MARKET if order_type == OrderType.MARKET else self.kite.ORDER_TYPE_LIMIT
            k_product = self.kite.PRODUCT_MIS if product == ProductType.MIS else self.kite.PRODUCT_NRML if product == ProductType.NRML else self.kite.PRODUCT_CNC

            # Place order
            if self.dry_run:
                logger.info(f"[DRY_RUN] Zerodha {action} {quantity} {symbol} at {price}")
                order_id = f"DRY_{int(time.time())}"
            else:
                order_id = self.kite.place_order(
                    variety=self.kite.VARIETY_REGULAR,
                    exchange=exchange,
                    tradingsymbol=symbol,
                    transaction_type=k_transaction_type,
                    quantity=quantity,
                    product=k_product,
                    order_type=k_order_type,
                    price=price if k_order_type == self.kite.ORDER_TYPE_LIMIT else None,
                    tag=strategy[:20] # Kite tags limited to 20 chars
                )

            return NormalizedOrder(
                order_id=str(int(time.time() * 1000)), # Internal tracking ID
                broker_order_id=order_id,
                symbol=symbol,
                action=action,
                quantity=quantity,
                order_type=order_type,
                price=price,
                product=product,
                status=OrderStatus.COMPLETE if order_type == OrderType.MARKET or self.dry_run else OrderStatus.OPEN,
                strategy=strategy,
                raw_response={"order_id": order_id, "dry_run": self.dry_run}
            )

        except Exception as e:
            logger.error("Order placement failed", exc_info=True)
            return NormalizedOrder(
                order_id=str(int(time.time() * 1000)),
                symbol=symbol,
                action=action,
                quantity=quantity,
                order_type=order_type,
                product=product,
                status=OrderStatus.REJECTED,
                message=str(e),
                strategy=strategy
            )

    async def cancel_order(self, broker_order_id: str) -> bool:
        await self.limiter.wait()
        try:
            self.kite.cancel_order(variety=self.kite.VARIETY_REGULAR, order_id=broker_order_id)
            return True
        except Exception:
            logger.error("Zerodha cancel_order failed", exc_info=True)
            return False

    async def get_positions(self) -> List[NormalizedPosition]:
        await self.limiter.wait()
        try:
            positions = self.kite.positions()
            net_positions = positions.get("net", [])

            normalized = []
            for pos in net_positions:
                # Map product
                p_type = ProductType.MIS if pos.get("product") == "MIS" else ProductType.NRML

                normalized.append(NormalizedPosition(
                    symbol=pos.get("tradingsymbol"),
                    quantity=pos.get("quantity"),
                    buy_quantity=pos.get("buy_quantity"),
                    sell_quantity=pos.get("sell_quantity"),
                    avg_price=pos.get("average_price"),
                    pnl=pos.get("pnl"),
                    product=p_type,
                    exchange=pos.get("exchange")
                ))
            return normalized
        except Exception:
            logger.error("Zerodha get_positions failed", exc_info=True)
            return []

    async def get_margins(self) -> Dict[str, float]:
        await self.limiter.wait()
        try:
            margins = self.kite.margins()
            equity = margins.get("equity", {})
            return {
                "available": float(equity.get("available", {}).get("cash", 0.0)),
                "used": float(equity.get("utilised", {}).get("debits", 0.0))
            }
        except Exception:
            logger.error("Zerodha get_margins failed", exc_info=True)
            return {"available": 0.0, "used": 0.0}

    async def subscribe_ticks(self, symbols: List[str], exchange: str = "NSE"):
        """
        Subscribes to Zerodha ticks.
        Resolves tradingsymbols to instrument_tokens using InstrumentService.
        """
        if not self.is_connected:
            logger.error("Zerodha not connected. Cannot subscribe.")
            return

        from services.instrument_service import get_instrument_service
        inst_service = get_instrument_service()

        tokens = []
        for symbol in symbols:
            token = inst_service.resolve_token(symbol, exchange)
            if token:
                tokens.append(token)
            elif symbol.isdigit():
                tokens.append(int(symbol))
            else:
                logger.warning(f"Could not resolve instrument token for {symbol}")

        if not self.ticker:
            self.ticker = KiteTicker(api_key=self.api_key, access_token=self.access_token)

            def on_ticks(ws, ticks):
                for tick in ticks:
                    normalized_tick = TickData(
                        symbol=str(tick.get("instrument_token")),
                        last_price=tick.get("last_price"),
                        volume=tick.get("volume"),
                        timestamp=tick.get("timestamp") or datetime.now()
                    )
                    if self.tick_callback:
                        self.tick_callback(normalized_tick)

            def on_connect(ws, response):
                ws.subscribe(tokens)
                ws.set_mode(ws.MODE_FULL, tokens)

            self.ticker.on_ticks = on_ticks
            self.ticker.on_connect = on_connect

            # Run ticker in background
            self.ticker.connect(threaded=True)
        else:
            self.ticker.subscribe(tokens)
            self.ticker.set_mode(self.ticker.MODE_FULL, tokens)
