import logging
from typing import Any, Dict, List
from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class AetherVault(BaseStrategy):
    """
    Multi-Year Wealth Compounding / Positional Strategy.
    Standardized for Weekly/Monthly horizons.
    Uses CNC product for long-term delivery.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        name = "AetherVault"
        symbols = ["NIFTYBEES", "RELIANCE", "HDFCBANK"]
        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.strategy_type = "positional"
        self.positions: Dict[str, int] = {s: 0 for s in self.symbols}
        self.allocation_per_symbol = 100000  # ₹1 Lakh per Vault slot
        self.interval = "1wk"

    async def on_tick(self, tick: Tick):
        self.update_history(tick, max_len=250)

        if tick.symbol == self.market_anchor:
            self.regime_status = self._calculate_market_regime()
            return

        current_position = self.positions.get(tick.symbol, 0)
        indicators = self._calculate_indicators(tick.symbol, rsi_window=21, vol_window=30)
        rsi = indicators["rsi"]

        # 1. Management: Vault logic handles regime breaks/rebalancing
        if current_position > 0:
            # Exit vault position if Regime turns sustained BEARISH
            if self.regime_status == "BEARISH" and rsi > 50:
                logger.warning(f"[{self.name}] Regime Break. Liquidating Vault position in {tick.symbol}")
                await self.sell(tick.symbol, abs(current_position), ai_reasoning="Macro Regime Shift to Bearish")
                self.positions[tick.symbol] = 0
                return

        # 2. Vault Entry (Deep Value Accumulation)
        if current_position == 0:
            if self.regime_status == "BULLISH" and rsi < 35:
                # High-Conviction AI Synthesis
                reasoning, conviction = await self.analyze_signal(tick.symbol, tick.price, rsi, 90, f"Vault Deep Value | Regime: {self.regime_status}")

                if conviction >= 0.85:
                    qty = int(self.allocation_per_symbol / tick.price)
                    if qty > 0:
                        logger.info(f"[{self.name}] AI Confirmed Value Zone. Allocating ₹{self.allocation_per_symbol} to {tick.symbol}")
                        await self.buy(tick.symbol, qty, ai_reasoning=reasoning, conviction=conviction)
                        self.positions[tick.symbol] = qty

    async def on_start(self):
        await super().on_start()
        logger.info(f"[{self.name}] Initiated for Long-Term Positional Compounding.")
