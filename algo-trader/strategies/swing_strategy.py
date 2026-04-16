import logging
from typing import Any, Dict, List

from core.strategy import BaseStrategy
from data.indicators import ema
from data.market_data import Tick
from execution.order_manager import OrderManager


logger = logging.getLogger(__name__)


def generate_signal(data):
    """
    Starter swing signal rule based on fast and slow EMA direction.
    """
    prices = [float(value) for value in data.get("prices", [])]
    fast_period = int(data.get("fast_period", 5))
    slow_period = int(data.get("slow_period", 12))

    fast_value = ema(prices, fast_period)
    slow_value = ema(prices, slow_period)
    if fast_value is None or slow_value is None:
        return "HOLD"
    if fast_value > slow_value:
        return "BUY"
    if fast_value < slow_value:
        return "SELL"
    return "HOLD"


class SwingStrategy(BaseStrategy):
    """
    Basic swing strategy using EMA trend direction.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        # ===================== USER INPUT START =====================
        name = "Swing Strategy"
        symbols = ["RELIANCE"]
        self.fast_period = 5
        self.slow_period = 12
        self.trade_quantity = 1
        self.max_history = 60
        # ====================== USER INPUT END ======================

        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.price_history: Dict[str, List[float]] = {symbol: [] for symbol in self.symbols}
        self.positions: Dict[str, int] = {symbol: 0 for symbol in self.symbols}

    async def on_tick(self, tick: Tick):
        history = self.price_history.setdefault(tick.symbol, [])
        history.append(tick.price)
        if len(history) > self.max_history:
            history.pop(0)

        signal = generate_signal(
            {
                "symbol": tick.symbol,
                "prices": history,
                "fast_period": self.fast_period,
                "slow_period": self.slow_period,
            }
        )

        # ===================== USER INPUT START =====================
        current_position = self.positions.get(tick.symbol, 0)
        if signal == "BUY" and current_position == 0:
            await self.buy(tick.symbol, self.trade_quantity)
            self.positions[tick.symbol] = self.trade_quantity
        elif signal == "SELL" and current_position > 0:
            await self.sell(tick.symbol, current_position)
            self.positions[tick.symbol] = 0
        # ====================== USER INPUT END ======================

    async def on_start(self):
        logger.info("Starting '%s' with EMA periods %s/%s", self.name, self.fast_period, self.slow_period)

    async def on_stop(self):
        await super().on_stop()
        logger.info("Stopped '%s'", self.name)
