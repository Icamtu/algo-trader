# algo-trader/core/strategy.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional
import logging
import asyncio
import os

# Assuming OrderManager and Tick types are defined elsewhere
from execution.order_manager import OrderManager
from data.market_data import Tick
from execution.decision_agent import DecisionAgent
import numpy as np

logger = logging.getLogger(__name__)

class BaseStrategy(ABC):
    """
    Abstract Base Class for all trading strategies.

    This class provides the structure that the StrategyRunner expects.
    Your custom strategies should inherit from this class.
    """

    def __init__(self, name: str, symbols: List[str], order_manager: OrderManager, portfolio_manager: Any = None):
        """
        Initializes the strategy. This method is called by the StrategyRunner
        when it loads the strategy.

        Args:
            name (str): The unique name of the strategy.
            symbols (List[str]): A list of instrument symbols the strategy
                                 needs data for.
            order_manager (OrderManager): The manager for sending trade orders.
            portfolio_manager (PortfolioManager): The manager for dynamic sizing.
        """
        self.name = name.strip()
        self.symbols = list(dict.fromkeys(symbols))
        self.order_manager = order_manager
        self.portfolio_manager = portfolio_manager
        self.runner = None # Set by StrategyRunner after instantiation
        self._is_active = False
        self._stop_event = asyncio.Event()

        # Phase 29: AI Decision Layer
        self.decision_agent = DecisionAgent(
            mode=os.getenv("AI_DECISION_MODE", "ai"),
            model=os.getenv("AI_MODEL", os.getenv("OLLAMA_MODEL", "qwen3.5:4b")),
            provider=os.getenv("AI_PROVIDER", "ollama"),
            agent_enabled=True
        )
        # Optimized History Buffers (Phase 13)
        self.buffer_size = 500
        self.price_buffers: Dict[str, np.ndarray] = {
            s: np.zeros(self.buffer_size) for s in self.symbols
        }
        self.buffer_indices: Dict[str, int] = {s: 0 for s in self.symbols}
        self.buffer_full: Dict[str, bool] = {s: False for s in self.symbols}

        self.regime_status = "NEUTRAL"
        self.market_anchor = "NIFTY"

        # Deployment-time Dynamic Config (Phase 16)
        self.strategy_type = "intraday"
        self.product_type = "MIS"
        self.trading_mode = "both"
        self.trading_hours = {
            "start": "09:15",
            "end": "15:15",
            "square_off": "15:20"
        }
        self.max_risk = 500
        self.capital_multiplier = 1.0
        self.target_pnl = 2500

        logger.info(f"Strategy '{self.name}' initialized with Optimized Rolling Buffers for symbols: {self.symbols}")

    @property
    def is_active(self) -> bool:
        return self._is_active

    @is_active.setter
    def is_active(self, value: bool):
        self._is_active = value

    @abstractmethod
    async def on_tick(self, tick: Tick):
        """
        *** YOUR TRADING LOGIC GOES HERE ***

        This is the core method of your strategy. It's called by the
        StrategyRunner for every new price tick for the symbols you've
        subscribed to.

        Args:
            tick (Tick): A data object containing the latest price tick
                         information (e.g., symbol, price, timestamp).
        """
        pass

    async def on_start(self):
        """
        Called by the StrategyRunner when the trading session starts.
        You can use this for any setup tasks, like fetching historical data
        or initializing indicators.
        """
        self.is_active = True
        logger.info(f"Strategy '{self.name}' is starting.")

    async def on_stop(self):
        """
        Called by the StrategyRunner when the trading session ends.
        Use this for any cleanup tasks, like saving state or closing all
        open positions.
        """
        self.is_active = False
        logger.info(f"Strategy '{self.name}' is stopping.")
        pass

    # --- ORDER EXECUTION WRAPPERS ---
    # These methods are helpers to make placing orders from your strategy
    # simple and clean.

    async def analyze_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str = "") -> tuple:
        """
        Synthesize a signal using the AI Decision Agent.
        Returns (reasoning, conviction).
        """
        picks = [{
            "symbol": symbol,
            "price": price,
            "rsi": rsi,
            "score": score,
            "market_context": market_context
        }]
        results = await self.decision_agent.analyze_top_picks(picks)
        if results:
            res = results[0]
            reasoning = res.get("ai_reasoning")
            conviction = res.get("ai_conviction", 0.5)

            # Phase 9: Sync back to TradeLogger if it was a retrospective analysis
            return reasoning, conviction
        return "No synthesis available", 0.5

    async def async_analyze_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str = ""):
        """
        Non-blocking AI analysis. Fires the request in the background and
        updates the trade log later.
        """
        asyncio.create_task(self._process_async_signal(symbol, price, rsi, score, market_context))

    async def _process_async_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str):
        reasoning, conviction = await self.analyze_signal(symbol, price, rsi, score, market_context)

        # Phase 15.3: Sync to high-concurrency Signal Registry
        if hasattr(self.order_manager, 'trade_logger'):
            asyncio.create_task(self.order_manager.trade_logger.log_signal(
                strategy_id=self.name,
                symbol=symbol,
                signal_type="AI_ANALYSIS",
                price=price,
                indicators={"rsi": rsi, "score": score},
                ai_reasoning=reasoning,
                conviction=conviction
            ))

        logger.info(f"[{self.name}] Async Synthesis Complete for {symbol}: Conviction {conviction}")

    async def log_trade(self, symbol: str, side: str, quantity: int, price: float, **kwargs):
        """Manual logging hook for custom strategy events."""
        if hasattr(self.order_manager, 'trade_logger'):
            return await self.order_manager.trade_logger.log_trade(
                strategy=self.name,
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                **kwargs
            )

    async def log_signal(self, symbol: str, signal_type: str, price: float, **kwargs):
        """Institutional signal auditing hook."""
        if hasattr(self.order_manager, 'trade_logger'):
            asyncio.create_task(self.order_manager.trade_logger.log_signal(
                strategy_id=self.name,
                symbol=symbol,
                signal_type=signal_type,
                price=price,
                **kwargs
            ))

    def _apply_regime_risk(self, symbol: str, quantity: int) -> int:
        """
        Dynamically adjusts order quantity based on global market regime and sector sentiment.
        """
        if not self.runner:
            return quantity

        # 1. Global Regime Scaling
        regime_data = getattr(self.runner, 'current_regime_data', {})
        regime = regime_data.get("regime", "NEUTRAL")
        pos_mult = regime_data.get("pos_mult", 1.0)
        risk_mult = regime_data.get("risk_mult", 1.0)

        adjusted_qty = int(quantity * pos_mult)

        # Global Hard Stop
        if regime == "BEARISH" and risk_mult >= 1.5:
             logger.warning(f"[{self.name}] BLOCKING BUY for {symbol} due to Aggressive BEARISH regime.")
             return 0

        # 2. Sector-Level Scaling (Phase 12)
        sector_sentiment = getattr(self.runner, 'sector_sentiment', {})
        sector_name = self._find_sector_for_symbol(symbol)

        if sector_name and sector_name in sector_sentiment:
            sent_data = sector_sentiment[sector_name]
            sentiment = sent_data.get("sentiment", "NEUTRAL").upper()
            conviction = float(sent_data.get("conviction", 0.5))

            if sentiment == "BEARISH":
                # Drain Tier 1/2 sectors that are AI-flagged as bearish
                drain_factor = 0.7 if conviction > 0.7 else 0.85
                adjusted_qty = int(adjusted_qty * drain_factor)
                logger.info(f"[{self.name}] Sector Drain ({sector_name}): {sentiment} @ {conviction} conv. Scaling: {drain_factor}x")
            elif sentiment == "BULLISH" and conviction > 0.8:
                # Selective boost for high-conviction bullish sectors
                adjusted_qty = int(adjusted_qty * 1.15)
                logger.info(f"[{self.name}] Sector Alpha ({sector_name}): High Conviction Bullish. Boosting qty by 15%.")

        if adjusted_qty != quantity:
             logger.info(f"[{self.name}] Multi-Layer Scaling: {quantity} -> {adjusted_qty}")

        return adjusted_qty

    def _check_trading_rules(self, side: str) -> tuple[bool, str]:
        """Enforce Trading Mode and Trading Hours (Phase 16)."""
        import pytz
        from datetime import datetime

        # 1. Check Trading Hours
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist).time()

        try:
            start_t = datetime.strptime(self.trading_hours["start"], "%H:%M").time()
            end_t = datetime.strptime(self.trading_hours["end"], "%H:%M").time()

            if not (start_t <= now <= end_t):
                return False, f"Outside trading hours ({self.trading_hours['start']} - {self.trading_hours['end']})"
        except Exception:
            logger.error("Error parsing trading hours", exc_info=True)

        # 2. Check Trading Mode
        mode = self.trading_mode.lower()
        if mode == "long" and side.upper() == "SELL":
            # We need to check if this is "SELL to close" or "SELL to open"
            # However, BaseStrategy doesn't track its own positions easily here without querying.
            # For "LONG Only", we block any SELL signal that would create a SHORT position.
            # For now, let's just block the side to be safe, or assume the user means "No shorting".
            pass # We'll refine this in buy/sell

        return True, "allowed"

    def _find_sector_for_symbol(self, symbol: str) -> Optional[str]:
        """Maps a symbol to its registered sector in the registry."""
        if not self.runner or not hasattr(self.runner, 'sector_config'):
            return None

        tiers = self.runner.sector_config.get("tiers", {})
        for _, tier_data in tiers.items():
            for sector in tier_data.get("sectors", []):
                if symbol == sector.get("index") or symbol in sector.get("symbols", []):
                    return sector.get("name")
        return None

    async def buy(
        self,
        symbol: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: Optional[str] = None,
        exchange: str = "NSE",
        human_approval: bool = False,
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
    ):
        """
        Places a BUY order. Includes regime-based risk filtering.
        """
        if not self.is_active:
            logger.warning(f"[{self.name}] Ignoring BUY signal; strategy is stopping.")
            return

        # Phase 16: Enforce Trading Rules
        allowed, reason = self._check_trading_rules("BUY")
        if not allowed:
            logger.warning(f"[{self.name}] BUY BLOCKED: {reason}")
            return {"status": "error", "message": reason}

        # Mode Enforcement (No Buying to open in Short Only)
        if self.trading_mode.lower() == "short":
            pos = self.order_manager.position_manager.get_position(symbol)
            if pos.quantity >= 0:
                logger.warning(f"[{self.name}] BUY BLOCKED: Strategy restricted to SHORT Only (no long entry allowed)")
                return {"status": "error", "message": "SHORT Only strategy cannot enter LONG positions"}

        # Product Choice (Override -> Strategy Level -> Default)
        final_product = product or getattr(self, "product_type", "MIS")

        # Phase 11: Apply Market Regime Risks
        final_qty = self._apply_regime_risk(symbol, quantity)
        if final_qty <= 0:
            return {"status": "error", "message": "Blocked by Market Regime Risk Agent"}

        # Get latest price from buffer
        price = 0.0
        if symbol in self.price_buffers:
            idx = (self.buffer_indices[symbol] - 1) % self.buffer_size
            price = self.price_buffers[symbol][idx]

        logger.info(f"[{self.name}] >> sending buy order for {final_qty} {symbol} at estimated ₹{price:.2f}.")
        return await self.order_manager.place_order(
            strategy_name=self.name,
            symbol=symbol,
            action="BUY",
            quantity=final_qty,
            order_type=order_type,
            price=price,
            product=final_product,
            exchange=exchange,
            human_approval=human_approval,
            ai_reasoning=ai_reasoning,
            conviction=conviction,
        )

    async def sell(
        self,
        symbol: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: Optional[str] = None,
        exchange: str = "NSE",
        human_approval: bool = False,
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
    ):
        """
        Places a SELL order.
        """
        # Phase 16: Enforce Trading Rules
        allowed, reason = self._check_trading_rules("SELL")
        if not allowed:
            logger.warning(f"[{self.name}] SELL BLOCKED: {reason}")
            return {"status": "error", "message": reason}

        # Mode Enforcement (No Selling to open in Long Only)
        if self.trading_mode.lower() == "long":
            pos = self.order_manager.position_manager.get_position(symbol)
            if pos.quantity <= 0:
                logger.warning(f"[{self.name}] SELL BLOCKED: Strategy restricted to LONG Only (no short entry allowed)")
                return {"status": "error", "message": "LONG Only strategy cannot enter SHORT positions"}

        # Product Choice
        final_product = product or getattr(self, "product_type", "MIS")

        if price == 0.0 and symbol in self.price_buffers:
            idx = (self.buffer_indices[symbol] - 1) % self.buffer_size
            price = self.price_buffers[symbol][idx]

        logger.info(f"[{self.name}] >> sending sell order for {quantity} {symbol} at estimated ₹{price:.2f}.")
        return await self.order_manager.place_order(
            strategy_name=self.name,
            symbol=symbol,
            action="SELL",
            quantity=quantity,
            order_type=order_type,
            price=price,
            product=final_product,
            exchange=exchange,
            human_approval=human_approval,
            ai_reasoning=ai_reasoning,
            conviction=conviction,
        )
    def _calculate_indicators(self, symbol: str, rsi_window: int = 14, vol_window: int = 20) -> Dict[str, float]:
        """Highly optimized zero-allocation indicator computation using NumPy Rolling Buffers."""
        if symbol not in self.price_buffers:
             return {"rsi": 50.0, "volatility": 1.0}

        curr_idx = self.buffer_indices[symbol]
        is_full = self.buffer_full[symbol]

        # Check if we have enough data
        min_len = max(rsi_window, vol_window) + 1
        if not is_full and curr_idx < min_len:
            return {"rsi": 50.0, "volatility": 1.0}

        buffer = self.price_buffers[symbol]

        # Get last N prices correctly from the rolling buffer
        # This is more efficient than np.roll
        if is_full:
            # Buffer is full, wrap around logic
            start = (curr_idx - min_len) % self.buffer_size
            if start + min_len <= self.buffer_size:
                data = buffer[start:start+min_len]
            else:
                data = np.concatenate([buffer[start:], buffer[:(start+min_len)%self.buffer_size]])
        else:
            data = buffer[max(0, curr_idx - min_len):curr_idx]

        # RSI Calculation (Vectorized over Slice)
        deltas = np.diff(data)
        recent_deltas = deltas[-(rsi_window):]
        gains = np.where(recent_deltas > 0, recent_deltas, 0)
        losses = np.where(recent_deltas < 0, -recent_deltas, 0)

        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)

        if avg_loss == 0:
            rsi_val = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_val = 100.0 - (100.0 / (1.0 + rs))

        # Volatility Calculation
        vol_data = data[-(vol_window):]
        vol_val = np.std(vol_data) or 1.0

        return {"rsi": float(rsi_val), "volatility": float(vol_val)}

    def _calculate_market_regime(self) -> str:
        """Standardized global trend safeguard, prioritizing AI-driven global state."""
        # 1. Check Global AI Regime from Runner
        if self.runner and hasattr(self.runner, 'current_regime_data'):
            regime = self.runner.current_regime_data.get("regime", "NEUTRAL")
            if regime != "NEUTRAL":
                return regime

        # 2. Fallback to Local Deterministic EMA
        buffer = self.price_buffers.get(self.market_anchor)
        if buffer is None: return "NEUTRAL"

        curr_idx = self.buffer_indices[self.market_anchor]
        is_full = self.buffer_full[self.market_anchor]

        if not is_full and curr_idx < 20: return "NEUTRAL"

        # Slicing the last 20 from buffer
        if is_full:
             data = np.concatenate([buffer[curr_idx-20:], buffer[:max(0, 20-(self.buffer_size-curr_idx))]]) if curr_idx < 20 else buffer[curr_idx-20:curr_idx]
             # Simplify: if is_full, we can always get 20
             start = (curr_idx - 20) % self.buffer_size
             if start + 20 <= self.buffer_size:
                 data = buffer[start:start+20]
             else:
                 data = np.concatenate([buffer[start:], buffer[:(start+20)%self.buffer_size]])
        else:
             data = buffer[max(0, curr_idx - 20):curr_idx]

        current = data[-1]
        ema = np.mean(data)
        if current > ema * 1.001: return "BULLISH"
        elif current < ema * 0.999: return "BEARISH"
        return "NEUTRAL"

    def update_history(self, tick: Tick, max_len: int = 500):
        """Standardized zero-allocation buffer update."""
        if tick.symbol not in self.price_buffers:
            self.price_buffers[tick.symbol] = np.zeros(self.buffer_size)
            self.buffer_indices[tick.symbol] = 0
            self.buffer_full[tick.symbol] = False

        idx = self.buffer_indices[tick.symbol]
        self.price_buffers[tick.symbol][idx] = tick.price

        new_idx = idx + 1
        if new_idx >= self.buffer_size:
            new_idx = 0
            self.buffer_full[tick.symbol] = True

        self.buffer_indices[tick.symbol] = new_idx
