import logging
from typing import Any, Dict, List
from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class AetherSwing(BaseStrategy):
    """
    Multi-Day Trend-Following Swing Strategy.
    Standardized for H1/D1 equivalent analysis via tick aggregation.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        name = "AetherSwing"
        symbols = ["NIFTYBEES", "RELIANCE"]
        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.active_trades: Dict[str, Dict] = {}
        self.positions: Dict[str, int] = {s: 0 for s in self.symbols}
        self.risk_per_trade = 2000  # ₹2000 risk per swing
        self.interval = "1d"
        self.hitl_enabled = True

    async def on_tick(self, tick: Tick):
        self.update_history(tick, max_len=200)
        if tick.symbol == self.market_anchor:
            self.regime_status = self._calculate_market_regime()
            return

        current_position = self.positions.get(tick.symbol, 0)
        indicators = self._calculate_indicators(tick.symbol, rsi_window=14, vol_window=30)
        rsi = indicators["rsi"]
        vol = indicators["volatility"]

        # 1. Manage Swing Lifecycle (Stops & Targets)
        if current_position != 0 and tick.symbol in self.active_trades:
            trade = self.active_trades[tick.symbol]

            # 1.1 First Target (1:1 R/R)
            if not trade.get("t1_hit"):
                if (trade["side"] == "BUY" and tick.price >= trade["t1"]) or \
                   (trade["side"] == "SELL" and tick.price <= trade["t1"]):
                    logger.info(f"[{self.name}] Target 1 Hit for {tick.symbol}. Scaling out 50%.")
                    exit_qty = abs(current_position) // 2
                    if exit_qty > 0:
                        action = "SELL" if trade["side"] == "BUY" else "BUY"
                        await self.order_manager.place_order(self.name, tick.symbol, action, exit_qty, ai_reasoning="Swing T1 Scaling")
                        self.positions[tick.symbol] -= exit_qty if trade["side"] == "BUY" else -exit_qty
                    trade["t1_hit"] = True
                    trade["sl"] = trade["entry_price"] # Move to Breakeven

            # 1.2 Stop Loss Check
            if (trade["side"] == "BUY" and tick.price <= trade["sl"]) or \
               (trade["side"] == "SELL" and tick.price >= trade["sl"]):
                logger.info(f"[{self.name}] {trade['side']} Stop Hit at {tick.price}")
                action = "SELL" if trade["side"] == "BUY" else "BUY"
                await self.order_manager.place_order(self.name, tick.symbol, action, abs(current_position), ai_reasoning="Swing Stop Hit")
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]
                return

            # 1.3 Final Target (2:1 R/R)
            if (trade["side"] == "BUY" and tick.price >= trade["t2"]) or \
               (trade["side"] == "SELL" and tick.price <= trade["t2"]):
                logger.info(f"[{self.name}] Final Swing Target Hit for {tick.symbol}")
                action = "SELL" if trade["side"] == "BUY" else "BUY"
                await self.order_manager.place_order(self.name, tick.symbol, action, abs(current_position), ai_reasoning="Swing T2 Complete")
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]
                return

        # 2. Swing Entry Signal (RSI Trend Alignment)
        if current_position == 0:
            signal = "HOLD"
            # Pullback in Bullish Regime or Overbought in Bearish Regime
            if self.regime_status == "BULLISH" and rsi < 45: signal = "BUY"
            elif self.regime_status == "BEARISH" and rsi > 55: signal = "SELL"

            if signal != "HOLD":
                stop_dist = max(vol * 2.5, tick.price * 0.01) # Standard 1% or 2.5x Vol
                qty = int(self.risk_per_trade / stop_dist)
                if qty < 1: qty = 1

                reasoning, conviction = await self.analyze_signal(tick.symbol, tick.price, rsi, 75, f"Swing Strategy | Vol: {vol:.2f} | Regime: {self.regime_status}")

                if conviction >= 0.75:
                    await (self.buy if signal == "BUY" else self.sell)(
                        tick.symbol, 
                        qty, 
                        ai_reasoning=reasoning, 
                        conviction=conviction,
                        human_approval=self.hitl_enabled
                    )
                    sl = tick.price - stop_dist if signal == "BUY" else tick.price + stop_dist
                    t1 = tick.price + stop_dist if signal == "BUY" else tick.price - stop_dist
                    t2 = tick.price + (stop_dist * 2.5) if signal == "BUY" else tick.price - (stop_dist * 2.5)

                    self.active_trades[tick.symbol] = {
                        "side": signal,
                        "entry_price": tick.price,
                        "sl": sl,
                        "t1": t1,
                        "t2": t2,
                        "t1_hit": False
                    }
                    self.positions[tick.symbol] = qty if signal == "BUY" else -qty

    async def on_start(self):
        await super().on_start()
        logger.info(f"[{self.name}] Initiated for Swing Analysis.")
