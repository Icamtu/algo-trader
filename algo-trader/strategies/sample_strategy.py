import logging
from typing import Any, Dict

from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class UserStrategy(BaseStrategy):
    """
    Starter strategy for this project.

    Edit only the clearly marked "USER INPUT" sections below.
    Everything else is framework wiring and can stay as-is until you want
    deeper custom behavior.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        """
        Change only the USER INPUT block below for your own setup.
        """
        # ===================== USER INPUT START =====================
        name = "My First Strategy"
        symbols = ["RELIANCE"]
        self.buy_below_price = 95.0
        self.sell_above_price = 105.0
        self.trade_quantity = 1
        # ====================== USER INPUT END ======================

        super().__init__(name, symbols, order_manager, portfolio_manager)

        # This keeps the starter strategy from stacking repeated entries.
        self.positions: Dict[str, int] = {symbol: 0 for symbol in self.symbols}
        logger.info(
            "'%s' configured for symbols=%s, buy_below=%.2f, sell_above=%.2f, quantity=%s",
            self.name,
            self.symbols,
            self.buy_below_price,
            self.sell_above_price,
            self.trade_quantity,
        )


    async def on_tick(self, tick: Tick):
        """
        Change only the USER INPUT logic block if you want a different rule.
        """
        logger.info("[%s] Tick received: %s at %.2f", self.name, tick.symbol, tick.price)

        current_position = self.positions.get(tick.symbol, 0)

        # ===================== USER INPUT START =====================
        if current_position == 0:
            if tick.price <= self.buy_below_price:
                logger.info("[%s] BUY condition met for %s at %.2f", self.name, tick.symbol, tick.price)
                await self.buy(tick.symbol, self.trade_quantity)
                self.positions[tick.symbol] = self.trade_quantity
        elif current_position > 0:
            if tick.price >= self.sell_above_price:
                logger.info("[%s] SELL condition met for %s at %.2f", self.name, tick.symbol, tick.price)
                await self.sell(tick.symbol, self.trade_quantity)
                self.positions[tick.symbol] = 0
        # ====================== USER INPUT END ======================

    async def on_start(self):
        logger.info("Starting strategy '%s' with initial positions: %s", self.name, self.positions)

    async def on_stop(self):
        await super().on_stop()
        logger.info("Stopping strategy '%s'. Final positions: %s", self.name, self.positions)
