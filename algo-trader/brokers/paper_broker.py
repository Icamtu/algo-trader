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

    async def _run_tick_simulation(self, symbols: List[str]):
        """Background simulation loop generating ticks."""
        import asyncio
        import random
        from .models import TickData
        
        # Initial prices
        prices = {s: 2500.0 for s in symbols}
        
        while self.is_connected:
            for symbol in symbols:
                # Simple random walk
                prices[symbol] += random.uniform(-1.5, 1.5)
                tick = TickData(
                    symbol=symbol,
                    last_price=round(prices[symbol], 2),
                    volume=random.randint(100, 1000),
                    timestamp=datetime.now()
                )
                
                # Broadast if callback registered
                if hasattr(self, 'tick_callback') and self.tick_callback:
                    if asyncio.iscoroutinefunction(self.tick_callback):
                        await self.tick_callback(tick)
                    else:
                        self.tick_callback(tick)
            
            await asyncio.sleep(1.0) # 1Hz feed
