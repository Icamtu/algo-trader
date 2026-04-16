import logging
from typing import Any, Dict, List

from core.strategy import BaseStrategy
from data.market_data import Tick
from execution.order_manager import OrderManager
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine


logger = logging.getLogger(__name__)


def generate_signal(data):
    """
    Starter intraday signal rule based on simple price thresholds.
    """
    price = float(data["ltp"])
    buy_above = float(data.get("buy_above", 2500))
    sell_below = float(data.get("sell_below", 2400))

    if price >= buy_above:
        return "BUY"
    if price <= sell_below:
        return "SELL"
    return "HOLD"


class IntradayStrategy(BaseStrategy):
    """
    Basic intraday strategy.

    Edit only the USER INPUT sections for your own symbols and rules.
    """

    def __init__(self, order_manager: OrderManager, portfolio_manager: Any = None):
        # ===================== USER INPUT START =====================
        name = "Intraday Strategy"
        symbols = ["RELIANCE", "NIFTY"]
        self.buy_above = 3100.0  # RELIANCE targets
        self.sell_below = 2900.0
        # ====================== USER INPUT END ======================

        super().__init__(name, symbols, order_manager, portfolio_manager)
        self.market_anchor = "NIFTY"
        self.positions: Dict[str, int] = {symbol: 0 for symbol in self.symbols}
        self.price_history: Dict[str, List[float]] = {symbol: [] for symbol in self.symbols}
        self.regime_status = "NEUTRAL"
        self.data_service = MarketDataService(order_manager)
        self.analytics_engine = AnalyticsEngine()
        self.last_analytics_refresh = 0
        self.cached_context = "Market Structure: Standard positioning."
        self.active_trades: Dict[str, Dict] = {}
        self.symbol_stats: Dict[str, Dict] = {symbol: {"reentries": 0, "last_stop_out": 0} for symbol in self.symbols}

    async def _update_market_context(self, symbol: str):
        """Fetch GEX and Max Pain to provide context to the AI."""
        import time
        now = time.time()
        if now - self.last_analytics_refresh < 300: # 5 min cache
            return

        try:
            expiries = await self.data_service.get_available_expiries(symbol)
            if not expiries:
                # If we fail to get expiries, backoff for 60s instead of 300s
                # to avoid spamming every tick but still retry sooner than 5m.
                self.last_analytics_refresh = now - 240 # Attempt again in 60s
                return

            chain = await self.data_service.get_option_chain(symbol, "NSE", expiries[0])
            if chain.get("status") == "error":
                logger.warning(f"[{self.name}] Analytics Error: {chain.get('message')}")
                # Use a 60s backoff for API errors
                self.last_analytics_refresh = now - 240
                return

            gex = self.analytics_engine.calculate_gex(chain)
            pain = self.analytics_engine.calculate_max_pain(chain)

            self.cached_context = (
                f"Net GEX: {gex.get('total_net_gex', 0):,.0f}, "
                f"PCR OI: {gex.get('pcr_oi', 0)}, "
                f"Max Pain Strike: {pain.get('max_pain_strike', 0)}"
            )
            self.last_analytics_refresh = now
            logger.info(f"[{self.name}] Updated Analytics Context: {self.cached_context}")
        except Exception as e:
            logger.warning(f"[{self.name}] Failed to update analytical context: {e}")
            # Use a 60s backoff for exceptions
            self.last_analytics_refresh = now - 240

    def _calculate_rsi(self, symbol: str, window: int = 14) -> float:
        prices = self.price_history.get(symbol, [])
        if len(prices) < window + 1:
            return 50.0 # Neutral fallback

        deltas = [prices[i+1] - prices[i] for i in range(len(prices)-1)]
        gains = [d if d > 0 else 0 for d in deltas[-window:]]
        losses = [abs(d) if d < 0 else 0 for d in deltas[-window:]]

        avg_gain = sum(gains) / window
        avg_loss = sum(losses) / window

        if avg_loss == 0: return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def _calculate_volatility(self, symbol: str, window: int = 20) -> float:
        """Simple standard deviation as volatility proxy for ticks."""
        prices = self.price_history.get(symbol, [])
        if len(prices) < window:
            return 1.0

        mean = sum(prices[-window:]) / window
        variance = sum((x - mean)**2 for x in prices[-window:]) / window
        return (variance**0.5) or 1.0

    def _calculate_market_regime(self, anchor: str) -> str:
        """Determines if the global market is BULLISH, BEARISH, or NEUTRAL."""
        prices = self.price_history.get(anchor, [])
        if len(prices) < 20:
            return "NEUTRAL"

        # Simple EMA(20) crossover on NIFTY
        current = prices[-1]
        ema = sum(prices[-20:]) / 20

        if current > ema * 1.001: # 0.1% buffer
            return "BULLISH"
        elif current < ema * 0.999:
            return "BEARISH"
        return "NEUTRAL"

    async def on_tick(self, tick: Tick):
        # Update history
        self.price_history[tick.symbol].append(tick.price)
        if len(self.price_history[tick.symbol]) > 100:
            self.price_history[tick.symbol].pop(0)

        # 0. Update Market Regime if this is an anchor tick
        if tick.symbol == self.market_anchor:
            self.regime_status = self._calculate_market_regime(tick.symbol)
            return # Don't process signals on the index itself

        signal = generate_signal(
            {
                "symbol": tick.symbol,
                "ltp": tick.price,
                "buy_above": self.buy_above,
                "sell_below": self.sell_below,
            }
        )

        # ===================== USER INPUT START =====================
        current_position = self.positions.get(tick.symbol, 0)

        # 1. Monitor Active Trade (Managed Exits)
        if current_position > 0 and tick.symbol in self.active_trades:
            trade = self.active_trades[tick.symbol]
            side = trade["side"]
            entry = trade["entry"]
            sl = trade["sl"]
            t1 = trade["t1"]
            t2 = trade["t2"]

            # Target 1 (Scale Out 50%)
            if not trade["t1_hit"]:
                if (side == "BUY" and tick.price >= t1) or (side == "SELL" and tick.price <= t1):
                    logger.info(f"[{self.name}] AI Conviction: {trade['conviction']:.2f} | Reasoning: Target 1 Hit")
                    exit_qty = max(1, current_position // 2)
                    await self.sell(tick.symbol, exit_qty, ai_reasoning="Target 1 Scalp (1:1 R/R)", conviction=trade["conviction"])
                    self.positions[tick.symbol] -= exit_qty
                    trade["t1_hit"] = True

                    # Update Position Metadata for UI Telemetry
                    pos = self.order_manager.position_manager.get(tick.symbol)
                    if pos:
                        pos.metadata["scaled"] = True
                        pos.metadata["scaling_stage"] = "T1_HIT"
                    # Move SL to Break-even
                    trade["sl"] = entry
                    logger.info(f"[{self.name}] SL moved to Break-even for {tick.symbol} at ₹{entry}")
                    return # Exit tick processing after trade action

            # Target 2 (Full Exit)
            if (side == "BUY" and tick.price >= t2) or (side == "SELL" and tick.price <= t2):
                logger.info(f"[{self.name}] Target 2 Profit-Taken for {tick.symbol}. Closing remainder.")
                await self.sell(tick.symbol, current_position, ai_reasoning="Target 2 Final Profit (2:1 R/R)", conviction=trade["conviction"])
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]
                return

            # Stop Loss
            if (side == "BUY" and tick.price <= sl) or (side == "SELL" and tick.price >= sl):
                logger.warning(f"[{self.name}] Stop Loss Triggered for {tick.symbol} at ₹{tick.price}")
                await self.sell(tick.symbol, current_position, ai_reasoning="Dynamic Stop Loss Exit", conviction=trade["conviction"])
                self.positions[tick.symbol] = 0
                del self.active_trades[tick.symbol]

                # Track for Re-Entry
                if tick.symbol in self.symbol_stats:
                    self.symbol_stats[tick.symbol]["last_stop_out"] = tick.price
                return

        # 2. Monitor New Signal (Entry)
        if signal in ["BUY", "SELL"]:
            # Perform AI Synthesis with REAL context
            await self._update_market_context(tick.symbol)
            rsi = self._calculate_rsi(tick.symbol)
            score = 80 # Baseline technical score

            # Dynamic Sizing & Risk Setup
            vol = self._calculate_volatility(tick.symbol)
            sl_dist = vol * 2.0
            risk_amount = getattr(self.order_manager.risk_manager, "risk_per_trade_inr", 500.0)

            # Check for Re-Entry (Risk Halving)
            is_reentry = False
            if tick.symbol in self.symbol_stats and self.symbol_stats[tick.symbol]["reentries"] > 0:
                risk_amount *= 0.5 # 50% risk for second attempt
                is_reentry = True
                logger.info(f"[{self.name}] RE-ENTRY_GATE: Halving risk to ₹{risk_amount} for second attempt.")

            size_plan = self.portfolio_manager.calculate_risk_weighted_quantity(
                symbol=tick.symbol,
                price=tick.price,
                stop_loss_dist=sl_dist,
                risk_amount=risk_amount
            )
            qty = size_plan.quantity

            logger.info(f"[{self.name}] Signal {signal} detected. Dynamic Qty: {qty} (Risk: ₹{risk_amount}, SL_Dist: {sl_dist:.2f})")

            # AI Conviction Check
            reasoning, conviction = await self.analyze_signal(
                symbol=tick.symbol,
                price=tick.price,
                rsi=rsi,
                score=score,
                market_context=f"{self.cached_context} | Market Regime: {self.regime_status}"
            )

            if conviction < 0.70:
                logger.warning(f"[{self.name}] Trade BLOCKED - Conviction {conviction:.2f} below threshold (0.70)")
                return

            if signal == "BUY" and current_position == 0:
                # Re-Entry Condition
                if is_reentry and conviction < 0.85:
                    logger.warning(f"[{self.name}] Re-Entry REJECTED - Need 0.85+ conviction for second attempt.")
                    return

                await self.buy(tick.symbol, qty, ai_reasoning=reasoning, conviction=conviction)
                self.positions[tick.symbol] = qty
                self.active_trades[tick.symbol] = {
                    "side": "BUY",
                    "entry": tick.price,
                    "sl": tick.price - sl_dist,
                    "t1": tick.price + sl_dist,
                    "t2": tick.price + (2 * sl_dist),
                    "t1_hit": False,
                    "conviction": conviction
                }
                if is_reentry: self.symbol_stats[tick.symbol]["reentries"] += 1
                elif tick.symbol in self.symbol_stats: self.symbol_stats[tick.symbol]["reentries"] = 1 # Mark first as done

            elif signal == "SELL" and current_position > 0:
                # 3. Smart Reversal (Stop & Reverse)
                if conviction >= 0.90:
                    logger.info(f"[{self.name}] EXTREME CONVICTION REVERSAL: Flipping to SHORT from LONG.")
                    # Close current position entirely
                    await self.sell(tick.symbol, current_position, ai_reasoning="Smart Reversal (Flip)", conviction=conviction)
                    # Open new SHORT position immediately (using halved risk for pivot if it feels like a flip)
                    await self.sell(tick.symbol, qty, ai_reasoning=f"Smart Reversal (Pivot) | {reasoning}", conviction=conviction)
                    self.positions[tick.symbol] = -qty # Track negative for short simulation if needed
                    # Update active trade state for short monitoring
                    self.active_trades[tick.symbol] = {
                        "side": "SELL",
                        "entry": tick.price,
                        "sl": tick.price + sl_dist,
                        "t1": tick.price - sl_dist,
                        "t2": tick.price - (2 * sl_dist),
                        "t1_hit": False,
                        "conviction": conviction
                    }
                else:
                    # Basic manual override exit if signal flips
                    logger.info(f"[{self.name}] Signal flipped to SELL. Closing entire position.")
                    await self.sell(tick.symbol, current_position, ai_reasoning="Signal Flip Exit", conviction=conviction)
                    self.positions[tick.symbol] = 0
                    if tick.symbol in self.active_trades:
                        del self.active_trades[tick.symbol]
        # ====================== USER INPUT END ======================

    async def on_start(self):
        logger.info("Starting '%s' for symbols %s", self.name, self.symbols)

    async def on_stop(self):
        await super().on_stop()
        logger.info("Stopped '%s'", self.name)
