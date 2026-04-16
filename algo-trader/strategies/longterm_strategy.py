import logging
from typing import Any, Dict, List

from core.strategy import BaseStrategy
from data.indicators import ema, rsi
from data.market_data import Tick
from execution.order_manager import OrderManager


logger = logging.getLogger(__name__)


def generate_signal(data):
    """
    Starter long-term signal rule combining trend and RSI.
    """
    prices = [float(value) for value in data.get("prices", [])]
    trend_period = int(data.get("trend_period", 20))
    rsi_period = int(data.get("rsi_period", 14))
    buy_below_rsi = float(data.get("buy_below_rsi", 45))
    sell_above_rsi = float(data.get("sell_above_rsi", 65))

    trend_value = ema(prices, trend_period)
    rsi_value = rsi(prices, rsi_period)
    last_price = prices[-1] if prices else None

    if trend_value is None or rsi_value is None or last_price is None:
        return "HOLD"
    if last_price >= trend_value and rsi_value <= buy_below_rsi:
        return "BUY"
    if last_price < trend_value or rsi_value >= sell_above_rsi:
        return "SELL"
    return "HOLD"


class LongTermStrategy(BaseStrategy):
    """
    Basic long-term strategy using trend confirmation and RSI.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        # ===================== USER INPUT START =====================
        name = "Long Term Strategy"
        symbols = ["RELIANCE"]
        self.trend_period = 20
        self.rsi_period = 14
        self.buy_below_rsi = 45
        self.sell_above_rsi = 65
        self.trade_quantity = 1
        self.max_history = 120
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
                "trend_period": self.trend_period,
                "rsi_period": self.rsi_period,
                "buy_below_rsi": self.buy_below_rsi,
                "sell_above_rsi": self.sell_above_rsi,
            }
        )

        # ===================== USER INPUT START =====================
        current_position = self.positions.get(tick.symbol, 0)
        if signal == "BUY" and current_position == 0:
            await self.buy(tick.symbol, self.trade_quantity, product="CNC")
            self.positions[tick.symbol] = self.trade_quantity
        elif signal == "SELL" and current_position > 0:
            await self.sell(tick.symbol, current_position, product="CNC")
            self.positions[tick.symbol] = 0
        # ====================== USER INPUT END ======================

    async def on_start(self):
        logger.info("Starting '%s' with trend_period=%s and rsi_period=%s", self.name, self.trend_period, self.rsi_period)

    async def on_stop(self):
        await super().on_stop()
        logger.info("Stopped '%s'", self.name)
