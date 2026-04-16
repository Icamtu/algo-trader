import logging
from typing import Any, Dict, List
from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class AetherScalper(BaseStrategy):
    """
    Hyper-fast volatility scalper.
    Specializes in 1-5 minute timeframes using tick dynamics.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        name = "AetherScalper"
        symbols = ["RELIANCE", "NIFTY"] # Dynamically loaded symbols
        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.market_anchor = "NIFTY"
        self.active_trades: Dict[str, Dict] = {}
        self.positions: Dict[str, int] = {s: 0 for s in self.symbols}
        self.risk_per_trade = 500  # ₹500 risk per scalp
        self.hitl_enabled = True

    async def on_tick(self, tick: Tick):
        self.update_history(tick, max_len=100)
        if tick.symbol == self.market_anchor:
            self.regime_status = self._calculate_market_regime()
            return

        current_position = self.positions.get(tick.symbol, 0)
        indicators = self._calculate_indicators(tick.symbol, rsi_window=7, vol_window=14)
        rsi = indicators["rsi"]
        vol = indicators["volatility"] # Simplified ATR proxy

        # 1. Manage Active Lifecycle (Stops & Targets)
        if current_position != 0 and tick.symbol in self.active_trades:
            trade = self.active_trades[tick.symbol]
            entry_price = trade["entry_price"]

            # 1.1 Breakeven Logic (Institutional Move)
            if not trade.get("at_breakeven"):
                if (trade["side"] == "BUY" and tick.price >= entry_price + (vol * 0.75)) or \
                   (trade["side"] == "SELL" and tick.price <= entry_price - (vol * 0.75)):
                    logger.info(f"[{self.name}] Move to Breakeven for {tick.symbol}")
                    trade["sl"] = entry_price
                    trade["at_breakeven"] = True

            # 1.2 Stop Loss Check
            if (trade["side"] == "BUY" and tick.price <= trade["sl"]) or \
               (trade["side"] == "SELL" and tick.price >= trade["sl"]):
                logger.info(f"[{self.name}] {trade['side']} Stop Hit at {tick.price}")
                action = "SELL" if trade["side"] == "BUY" else "BUY"
                await self.order_manager.place_order(self.name, tick.symbol, action, abs(current_position), ai_reasoning="Scalp Stop Hit")
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]
                return

            # 1.3 Scalp Target (1:1.5 R/R)
            if (trade["side"] == "BUY" and tick.price >= trade["tp"]) or \
               (trade["side"] == "SELL" and tick.price <= trade["tp"]):
                logger.info(f"[{self.name}] {trade['side']} Target Hit at {tick.price}")
                action = "SELL" if trade["side"] == "BUY" else "BUY"
                await self.order_manager.place_order(self.name, tick.symbol, action, abs(current_position), ai_reasoning="Scalp Target Hit")
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]
                return

        # 2. Entry Signal (Volatility Spike + RSI extreme)
        if current_position == 0:
            signal = "HOLD"
            if rsi < 20 and self.regime_status != "BEARISH": signal = "BUY"
            elif rsi > 80 and self.regime_status != "BULLISH": signal = "SELL"

            if signal != "HOLD":
                # ATR-Weighted Sizing: Qty = Risk / StopDistance
                stop_dist = max(vol * 1.5, tick.price * 0.002) # Min 0.2% stop
                qty = int(self.risk_per_trade / stop_dist)
                if qty < 1: qty = 1

                # Phase 9: Speed-First Execution. 
                # Fire trade instantly; synthesize reasoning in the background.
                await (self.buy if signal == "BUY" else self.sell)(
                    tick.symbol,
                    qty,
                    ai_reasoning=f"High-frequency Scalp: {signal}",
                    conviction=0.8, # Default threshold for speed-branch
                    human_approval=self.hitl_enabled
                )
                
                # Attach deep synthesis asynchronously
                await self.async_analyze_signal(tick.symbol, tick.price, rsi, 85, f"Scalp Entry | Vol: {vol:.2f} | Regime: {self.regime_status}")
                sl = tick.price - stop_dist if signal == "BUY" else tick.price + stop_dist
                tp = tick.price + (stop_dist * 1.5) if signal == "BUY" else tick.price - (stop_dist * 1.5)

                self.active_trades[tick.symbol] = {
                    "side": signal,
                    "entry_price": tick.price,
                    "sl": sl,
                    "tp": tp,
                    "at_breakeven": False
                }
                self.positions[tick.symbol] = qty if signal == "BUY" else -qty

    async def on_start(self):
        await super().on_start()
        logger.info(f"[{self.name}] Initiated for Scalping Matrix.")
