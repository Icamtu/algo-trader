import logging
from typing import Any

from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class ActionCenterTester(BaseStrategy):
    """
    Test strategy designed to verify the Action Center (Semi-Auto) workflow.
    It generates a single BUY signal with human_approval=True on the first tick.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        name = "Action Center Tester"
        symbols = ["RELIANCE"]
        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.signal_sent = False

    async def on_tick(self, tick: Tick):
        if self.signal_sent:
            return

        logger.info(f"[{self.name}] First tick received for {tick.symbol}. Triggering test order...")

        # Place a BUY order with human_approval=True
        result = await self.buy(
            symbol=tick.symbol,
            quantity=1,
            human_approval=True
        )

        if result.get("status") == "success":
            logger.info(f"[{self.name}] Test order successfully diverted to Action Center.")
            self.signal_sent = True
        else:
            logger.error(f"[{self.name}] Failed to send test order: {result.get('message')}")

    async def on_start(self):
        logger.info(f"Starting '{self.name}'. Waiting for market data to trigger approval flow.")

    async def on_stop(self):
        await super().on_stop()
        logger.info(f"Stopped '{self.name}'")
