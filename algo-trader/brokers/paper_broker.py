import logging
import uuid
from typing import List, Dict, Any, Optional
from .base_broker import BaseBroker
from .models import (
    NormalizedOrder, NormalizedPosition, OrderStatus,
    OrderAction, OrderType, ProductType, TickData
)
from datetime import datetime

logger = logging.getLogger(__name__)

class PaperBroker(BaseBroker):
    """
    Native AetherBridge Paper Broker.
    Simulates execution locally for testing and strategy validation.
    """

    def __init__(self, broker_id: str, config: Dict[str, Any]):
        super().__init__(broker_id, config)
        self.orders: Dict[str, NormalizedOrder] = {}
        self.positions: Dict[str, NormalizedPosition] = {}
        self.funds = config.get("initial_funds", 1000000.0)
        self.used_margin = 0.0
        self.tick_callback = None
        self._tick_task = None

    async def login(self) -> bool:
        self.is_connected = True
        logger.info("Paper Broker initialized (Simulation Mode)")
        return True

    async def logout(self) -> bool:
        self.is_connected = False
        return True

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

        order_id = f"PPR-{uuid.uuid4().hex[:8].upper()}"

        order = NormalizedOrder(
            order_id=order_id,
            broker_order_id=order_id,
            symbol=symbol,
            action=action,
            quantity=quantity,
            order_type=order_type,
            price=price,
            product=product,
            status=OrderStatus.COMPLETE, # Instant fill for paper
            strategy=strategy,
            timestamp=datetime.now()
        )

        self.orders[order_id] = order
        self._update_position(order)

        return order

    def _update_position(self, order: NormalizedOrder):
        symbol = order.symbol
        if symbol not in self.positions:
            self.positions[symbol] = NormalizedPosition(
                symbol=symbol,
                quantity=0,
                buy_quantity=0,
                sell_quantity=0,
                avg_price=0.0,
                product=order.product
            )

        pos = self.positions[symbol]
        if order.action == OrderAction.BUY:
            new_qty = pos.quantity + order.quantity
            pos.avg_price = ((pos.quantity * pos.avg_price) + (order.quantity * order.price)) / new_qty if new_qty > 0 else 0
            pos.quantity = new_qty
            pos.buy_quantity += order.quantity
        else:
            pos.quantity -= order.quantity
            pos.sell_quantity += order.quantity

    async def cancel_order(self, broker_order_id: str) -> bool:
        if broker_order_id in self.orders:
            self.orders[broker_order_id].status = OrderStatus.CANCELLED
            return True
        return False

    async def get_positions(self) -> List[NormalizedPosition]:
        return list(self.positions.values())

    async def get_margins(self) -> Dict[str, float]:
        return {
            "available": self.funds - self.used_margin,
            "used": self.used_margin,
            "total": self.funds
        }

    async def subscribe_ticks(self, symbols: List[str]):
        """Subscribes and starts the simulation loop."""
        logger.info(f"Paper Broker subscribed to: {symbols}")
        if self.is_connected and not self._tick_task:
            import asyncio
            self._tick_task = asyncio.create_task(self._run_tick_simulation(symbols))

    async def get_orders(self) -> List[NormalizedOrder]:
        """Returns all paper orders."""
        return list(self.orders.values())

    async def _run_tick_simulation(self, symbols: List[str]):
        """Background simulation loop generating ticks with realistic index pricing."""
        import asyncio
        import random
        from .models import TickData

        # Base prices for indices
        base_prices = {
            "NIFTY": 24000.0,
            "BANKNIFTY": 51000.0,
            "FINNIFTY": 22000.0,
            "MIDCPNIFTY": 12000.0,
            "SENSEX": 79000.0,
            "BANKEX": 58000.0
        }

        # Initial prices
        prices = {}
        for s in symbols:
            base = base_prices.get(s.split("-")[0], 2500.0)
            # If it's an option (longer symbol), use much lower base price (premium)
            if len(s) > 10:
                base = random.uniform(50, 500)
            prices[s] = base

        while self.is_connected:
            for symbol in symbols:
                # Simple random walk (0.01% - 0.05% move)
                volatility = prices[symbol] * 0.0005
                prices[symbol] += random.uniform(-volatility, volatility)
                prices[symbol] = max(0.05, prices[symbol])

                # Determine exchange based on symbol pattern
                exchange = "NSE"
                if symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]:
                    exchange = "NSE_INDEX"
                elif symbol in ["SENSEX", "BANKEX"]:
                    exchange = "BSE_INDEX"
                elif len(symbol) > 10: # Likely an option symbol like NIFTY24MAY19000CE
                    exchange = "NFO"

                tick = TickData(
                    symbol=symbol,
                    last_price=round(prices[symbol], 2),
                    volume=random.randint(100, 1000),
                    timestamp=datetime.now(),
                    exchange=exchange
                )

                # Broadast if callback registered
                if hasattr(self, 'tick_callback') and self.tick_callback:
                    if asyncio.iscoroutinefunction(self.tick_callback):
                        await self.tick_callback(tick)
                    else:
                        self.tick_callback(tick)

            await asyncio.sleep(1.0) # 1Hz feed
    async def get_quote(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """
        Simulates a real-time quote with realistic pricing for indices.
        """
        import random
        # Base prices for indices
        base_prices = {
            "NIFTY": 24000.0,
            "BANKNIFTY": 51000.0,
            "FINNIFTY": 22000.0,
            "MIDCPNIFTY": 12000.0,
            "SENSEX": 79000.0,
            "BANKEX": 58000.0
        }
        base = base_prices.get(symbol.split("-")[0], 2500.0)
        price = base + random.uniform(-base*0.002, base*0.002)

        return {
            "stat": "Ok",
            "lp": str(round(price, 2)),
            "v": str(random.randint(1000, 5000)),
            "oi": str(random.randint(10000, 50000)),
            "ft": str(int(datetime.now().timestamp())),
            "tsym": symbol,
            "exch": exchange
        }
    async def get_funds(self) -> Dict[str, float]:
        """Mock funds for paper trading."""
        return {
            "available": self.funds,
            "used": self.used_margin,
            "total": self.funds
        }

    async def get_historical_candles(
        self,
        symbol: str,
        exchange: str,
        interval: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Mock historical data for paper trading (returns empty list, triggers fallback)."""
        logger.info(f"PaperBroker: Mock history requested for {symbol} (falling back to yfinance)")
        return []
